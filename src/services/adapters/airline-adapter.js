const _ = require('lodash');
const dayjs = require('dayjs');
const request = require('request-promise-native');
const moment = require('moment-timezone');

const adapter = require('./base-adapter');
const validators = require('../validators/index');
const {
  cancellationFees: cancellationFeesLibrary,
} = require('@windingtree/wt-pricing-algorithms/dist/node/wt-pricing-algorithms');

const REQUIRED_FIELDS = [
  'supplierId',
  'readApiUrl',
  'writeApiUrl',
  'writeApiAccessKey',
  'writeApiWalletPassword',
];

// Tolerance against numerical errors in floating-point price & fee computation.
const EPSILON = 1e-4;

class WTAirlineAdapter {
  constructor (opts) {
    for (let field of REQUIRED_FIELDS) {
      if (!opts[field]) {
        throw new Error(`Missing configuration: ${field}`);
      }
    }
    this.supplierId = opts.supplierId;
    this.readApiUrl = opts.readApiUrl;
    this.writeApiUrl = opts.writeApiUrl;
    this.writeApiAccessKey = opts.writeApiAccessKey;
    this.writeApiWalletPassword = opts.writeApiWalletPassword;

    // A promise that serves for serializing of all updates.
    this.updating = Promise.resolve();
  }

  /**
   * Get flight instance data with current availability.
   *
   * @param {string} flightInstanceId
   * @returns {Promise<Object>}
   */
  async getFlightInstanceData (flightInstanceId) {
    let fields = [ 'id', 'bookingClasses', 'departureDateTime' ];
    fields = fields.join(',');
    try {
      const response = await request({
        method: 'GET',
        uri: `${this.readApiUrl}/airlines/${this.supplierId}/flightinstances/${flightInstanceId}?fields=${fields}`,
        json: true,
        simple: false,
        resolveWithFullResponse: true,
      });
      if (response.statusCode <= 299) {
        return response.body;
      } else {
        throw new Error(`Error ${response.statusCode}`);
      }
    } catch (err) {
      throw new adapter.UpstreamError(err.message);
    }
  }

  /**
   * Set flight instance. Used to update flight availability count.
   *
   * Do not call directly to avoid race conditions.
   *
   * @param {Object} flightInstance
   * @param {String} flightInstanceId
   * @returns {Promise<Object>}
   */
  async _setAvailability (flightInstance, flightInstanceId) {
    /*
      TODO wt-write-api doesn't support this endpoint yet. Updating availability needs to be implemented by each airline
      depending on their internal requirements
    */
    // try {
    //   const response = await request({
    //     method: 'PATCH',
    //     uri: `${this.writeApiUrl}/airlines/${this.supplierId}/flightinstances/${flightInstanceId}`,
    //     json: true,
    //     body: {
    //       flightInstance,
    //     },
    //     headers: {
    //       'X-Access-Key': this.writeApiAccessKey,
    //       'X-Wallet-Password': this.writeApiWalletPassword,
    //     },
    //     simple: false,
    //     resolveWithFullResponse: true,
    //   });
    //   if (response.statusCode <= 299) {
    //     return response.body;
    //   } else {
    //     throw new Error(`Error ${response.statusCode}`);
    //   }
    // } catch (err) {
    //   throw new adapter.UpstreamError(err.message);
    // }
  }

  /**
   * Check restrictions on airlines (there aren't any for now).
   *
   * @param {Object} flightInstance
   * @param {Object} bookingData
   * @returns {undefined}
   * @throws {RestrictionsViolatedError}
   */
  _checkRestrictions (flightInstance, bookingData) {

  }

  /**
   * Apply availability count update (modifies the flight instance object
   * in the process).
   *
   * @param {Object} flightInstance The original flight object to be modified
   * @param {Object} bookingData
   * @param {Boolean} restore (optional) If true, the
   *     availability is restored rather than removed.
   * @returns {undefined}
   */
  _applyUpdate (flightInstance, bookingData, restore) {
    if (bookingData.booking.flightInstanceId !== flightInstance.id) {
      throw new adapter.InvalidUpdateError(`Trying to update incorrect flight id ${flightInstance.id} with booking for ${bookingData.booking.flightInstanceId}.`);
    }

    for (let bc of bookingData.booking.bookingClasses) {
      let className = bc.bookingClassId;
      let passengerCount = bc.passengers.length;
      let bookingClass = flightInstance.bookingClasses.find(bc => bc.id === className);
      if (_.isUndefined(bookingClass)) {
        throw new adapter.InvalidUpdateError(`No booking class ${className} at flight ${flightInstance.id}.`);
      }
      if (bookingClass.availabilityCount - passengerCount < 0) {
        const msg = `Flight ${bookingData.booking.flightNumber} (id: ${bookingData.booking.flightInstanceId}) is overbooked in class ${className}.`;
        throw new adapter.InvalidUpdateError(msg);
      }

      if (!restore) {
        bookingClass.availabilityCount -= passengerCount;
      } else {
        bookingClass.availabilityCount += passengerCount;
      }
    }
  }

  /**
   * Update flight instance availability count.
   *
   * Serializes calls internally to avoid race conditions.
   *
   * @param {String} flightInstanceId
   * @param {Object} bookingData
   * @param {Boolean} restore (optional) If true, the
   *     availability is restored rather than removed.
   * @returns {Promise<Object>}
   */
  updateAvailability (flightInstanceId, bookingData, restore) {
    this.updating = this.updating.then(() => {
      return this.getFlightInstanceData(flightInstanceId);
    }).then((flightInstance) => {
      // If availability is restored, we assume it is done based
      // on a cancelled booking, whose validity has been
      // previously checked - therefore, we do not check it
      // again.
      if (!restore) {
        // Only a soft check here, hard check follows in _applyUpdate
        this._checkRestrictions(flightInstance, bookingData);
      }
      this._applyUpdate(flightInstance, bookingData, restore); // Modifies availability count.
      return this._setAvailability(flightInstance, flightInstanceId);
    });
    const ret = this.updating;
    // Do not propagate errors further;
    this.updating = this.updating.catch(() => undefined);
    return ret;
  }

  /**
   * Checks if flight instance is actually available.
   *
   * @param {Object} flightInstance The original availability object.
   * @param {Object} bookingData List of booked rooms.
   * @returns {undefined}
   * @throws {FlightUnavailableError}
   */
  _checkAvailability (flightInstance, bookingData) {
    this._checkRestrictions(flightInstance, bookingData);

    for (let bc of bookingData.booking.bookingClasses) {
      let className = bc.bookingClassId;
      let passengerCount = bc.passengers.length;
      let bookingClass = flightInstance.bookingClasses.find(bc => bc.id === className);
      if (_.isUndefined(bookingClass)) {
        throw new adapter.FlightUnavailableError(`No booking class ${className} at flight ${flightInstance.id}.`);
      }
      if (bookingClass.availabilityCount - passengerCount < 0) {
        const msg = `Flight ${bookingData.booking.flightNumber} (id: ${bookingData.booking.flightInstanceId}) is overbooked in class ${className}.`;
        throw new adapter.FlightUnavailableError(msg);
      }
    }
  }

  /**
   * Get airline data.
   *
   * @param {Array<String>} fields
   * @returns {Promise<Object>}
   */
  async getSupplierData (fields) {
    fields = fields.join(',');
    try {
      const response = await request({
        method: 'GET',
        uri: `${this.readApiUrl}/airlines/${this.supplierId}?fields=${fields}`,
        json: true,
        simple: false,
        resolveWithFullResponse: true,
      });
      if (response.statusCode <= 299) {
        return response.body;
      } else {
        throw new Error(`Error ${response.statusCode}`);
      }
    } catch (err) {
      throw new adapter.UpstreamError(err.message);
    }
  }

  /**
   * Check if the given cancellation fee computed with the
   * specified arrival date is admissible wrt. the given
   * policies.
   *
   * @param {Object} fee
   * @param {Array} policies (as returned by @windingtree/wt-pricing-algorithms' computeCancellationFees)
   * @param {Object} defaultPolicy
   * @return {Boolean}
   */
  _isAdmissible (fee, policies, defaultPolicy) {
    const feeFrom = dayjs(fee.from),
      feeTo = dayjs(fee.to);

    // 1. Select the applicable policy from the list.
    const isBeforeAny = (policies.length === 0) || feeTo.isBefore(policies[0].policyFrom),
      isAfterAll = (policies.length === 0) || feeFrom.isAfter(policies[policies.length - 1].to);
    // Keep track if the fee period is covered by any single cancellation policy.
    let covered = false;
    policies = policies.filter((policy, index) => {
      if (!isBeforeAny && !isAfterAll) {
        covered = covered || (feeFrom.isBefore(policy.to) || feeTo.isAfter(policy.from));
      }
      return (feeFrom.isSame(policy.from) && feeTo.isSame(policy.to));
    });

    const policy = policies[0] || (covered ? null : defaultPolicy);

    // 2. Verify that the fee amount is admissible wrt. to the selected policy.
    return policy && (fee.amount >= (policy.amount - EPSILON));
  }

  /**
   * Check if the array of cancellation fees is meaningful.
   *
   * @param {Array} fees
   * @param {dayjs} bookedAt
   * @param {dayjs} arrival
   * @return {String|Boolean}
   */
  _isIllFormed (fees, bookedAt, arrival) {
    fees = fees.map((f) => {
      return {
        from: dayjs(f.from),
        to: dayjs(f.to),
      };
    });
    // 1. Check if the whole period between booking and arrival is covered.
    fees.sort((f1, f2) => {
      return (f1.from.isBefore(f2.from)) ? -1 : 1;
    });
    const period = { from: undefined, to: undefined };
    for (let i = 0; i < fees.length; i++) {
      if (!period.from) { // The first item.
        period.from = fees[i].from;
        period.to = fees[i].to;
      } else if (fees[i].from.subtract(1, 'day').isSame(period.to)) {
        period.to = fees[i].to;
      } else {
        return 'Ill-formed cancellation fees: the whole period between booking date and arrival must be covered without overlapping.';
      }
    }

    if (period.from.isBefore(bookedAt)) {
      return 'Ill-formed cancellation fees: `from` is before the booking date.';
    }

    if (period.to.isAfter(arrival)) {
      return 'Ill-formed cancellation fees: `to` is after the arrival date.';
    }

    if (!period.from.isSame(bookedAt) || !period.to.isSame(arrival)) {
      return 'Ill-formed cancellation fees: the whole period between booking date and arrival is not covered.';
    }

    // 2. Check if "from" is after "to".
    for (let fee of fees) {
      if (dayjs(fee.from).isAfter(dayjs(fee.to))) {
        return 'Ill-formed cancellation fees: `from` comes after `to`.';
      }
    }
    return false;
  }

  /**
   * Check cancellation fees.
   *
   * Note: we assume that hotel's cancellation policies are
   * meaningfully defined; we do not validate it here.
   *
   * @param {Object} airline
   * @param {Array} cancellationFees
   * @param {String} bookedAt
   * @param {String} departureDateTime
   * @return {Promise<void>}
   * @throw {InadmissibleCancellationFeesError}
   * @throw {IllFormedCancellationFeesError}
   */
  _checkCancellationFees (airline, cancellationFees, bookedAt, departureDateTime) {
    const illFormed = this._isIllFormed(cancellationFees, bookedAt, departureDateTime);
    if (illFormed) {
      throw new adapter.IllFormedCancellationFeesError(illFormed);
    }
    // For each item, find out if it's admissible wrt. declared
    // cancellation policies.
    const normalizedPolicies = cancellationFeesLibrary.computeCancellationFees(
      bookedAt,
      departureDateTime,
      airline.cancellationPolicies,
      airline.defaultCancellationAmount
    );
    for (let fee of cancellationFees) {
      if (!this._isAdmissible(fee, normalizedPolicies, { amount: airline.defaultCancellationAmount })) {
        let msg = `Inadmissible cancellation fee found: (${fee.from}, ${fee.to}, ${fee.amount})`;
        throw new adapter.InadmissibleCancellationFeesError(msg);
      }
    }
  }

  /**
   * Check price. For now this simply checks basic fare validity based on known fares.
   * TODO use wt-pricing-algorithms to account for currencies, modifieres etc.
   *
   * @param {Object} airline
   * @param {Object} flightInstance
   * @param {Object} bookingData
   * @param {String} currency
   * @param {float} total
   * @return {Promise<void>}
   * @throw {InvalidPriceError}
   */
  _checkTotal (airline, flightInstance, bookingData, currency, total) {
    let price = 0;
    for (let bookingClass of bookingData.bookingClasses) {
      let fareForClass = flightInstance.bookingClasses.find(bc => bc.id === bookingClass.bookingClassId);
      if (!fareForClass) {
        throw new adapter.InvalidPriceError(`Unknown booking class ${bookingClass.bookingClassId}`);
      }
      fareForClass = fareForClass.fare;
      if (fareForClass.currency !== currency) {
        throw new adapter.InvalidPriceError(`WTAirlineAdapter can only work with one currency atm. Flight instance: ${fareForClass.currency}, Airline: ${currency}`);
      }
      price += bookingClass.passengerCount * fareForClass.amount; // TODO support currencies
    }

    if (total < (price - EPSILON)) {
      throw new adapter.InvalidPriceError(`The total is too low, expected ${price}`);
    }
  }

  /**
   * Check admissibility wrt. the suggested price,
   * flight availability and cancellation fees.
   *
   * Every component of the validation can be turned off with
   * `checkOpts` parameter.
   *
   * @param {Object} bookingData
   * @param {Object} flightInstance
   * @param {Object} pricing
   * @param {Date} bookedAt
   * @param {Object} checkOpts {availability, cancellationFees, totalPrice}
   * @return {Promise<void>}
   * @throw {InvalidPriceError}
   * @throw {InadmissibleCancellationFeesError}
   * @throw {IllFormedCancellationFeesError}
   * @throw {RoomUnavailableError}
   */
  async checkAdmissibility (bookingData, flightInstance, pricing, bookedAt, checkOpts) {
    checkOpts = checkOpts || {
      availability: true,
      cancellationFees: true,
      totalPrice: true,
    };
    const fields = ['defaultCancellationAmount', 'cancellationPolicies', 'currency', 'flights', 'code'],
      airline = await this.getSupplierData(fields),
      bookingDate = moment(bookedAt).format('YYYY-MM-DD');

    // sanity checks TODO move to validation?
    // 1. is in future
    if (!moment(bookedAt).isValid()) {
      throw new validators.ValidationError(`Booking date is in invalid format (${bookedAt}). Use ISO 8601.`);
    }
    const flightDeparture = moment(flightInstance.departureDateTime);
    if (!flightDeparture.isValid()) {
      throw new validators.ValidationError(`Flight date is in invalid format (${flightInstance.departureDateTime}). Use ISO 8601.`);
    }
    if (flightDeparture.isBefore(bookedAt)) {
      throw new validators.ValidationError(`Flight departure date ${flightInstance.departureDateTime} is earlier than booking date ${bookingDate}`);
    }
    // 2. flight exists
    const flightIds = _.map(airline.flights.items, 'id');
    if (flightIds.indexOf(bookingData.booking.flightInstanceId) === -1) {
      throw new validators.ValidationError(`Unknown flight id ${bookingData.booking.flightInstanceId}.`);
    }
    // 3. existing booking classes
    const bookingClasses = _.map(flightInstance.bookingClasses, 'id');
    for (let bc of bookingData.booking.bookingClasses) {
      if (bookingClasses.indexOf(bc.bookingClassId) === -1) {
        throw new validators.ValidationError(`Unknown booking class ${bc.bookingClassId}`);
      }
    }
    if (Object.values(checkOpts).filter((v) => v).length > 0) {
      // check the room availability
      if (checkOpts.availability) {
        this._checkAvailability(flightInstance, bookingData);
      }
      // check cancellation fees
      if (checkOpts.cancellationFees) {
        this._checkCancellationFees(airline, pricing.cancellationFees, bookingDate, flightInstance.departureDateTime);
      }
      // check final price
      if (checkOpts.totalPrice) {
        // fare
        this._checkTotal(airline, flightInstance, bookingData, pricing.currency, pricing.total);
      }
    }
  }
}

module.exports = {
  WTAirlineAdapter,
};
