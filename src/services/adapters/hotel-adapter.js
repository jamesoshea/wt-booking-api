const dayjs = require('dayjs');
const request = require('request-promise-native');
const moment = require('moment-timezone');

const adapter = require('./base-adapter');
const { computeHotelPrice, NoRatePlanError } = require('../pricing');
const {
  cancellationFees: cancellationFeesLibrary,
  availability: availabilityLibrary,
} = require('@windingtree/wt-pricing-algorithms');

const REQUIRED_FIELDS = [
  'supplierId',
  'readApiUrl',
  'writeApiUrl',
  'writeApiAccessKey',
  'writeApiWalletPassword',
];

// Tolerance against numerical errors in floating-point price & fee computation.
const EPSILON = 1e-4;

class WTHotelAdapter {
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
   * Get the current availability document.
   *
   * Do not call directly to avoid race conditions.
   *
   * @returns {Promise<Object>}
   */
  async _getAvailability () {
    try {
      const response = await request({
        method: 'GET',
        uri: `${this.readApiUrl}/hotels/${this.supplierId}/availability`,
        json: true,
        simple: false,
        resolveWithFullResponse: true,
      });
      if (response.statusCode <= 299) {
        return response.body.items;
      } else {
        throw new Error(`Error ${response.statusCode}`);
      }
    } catch (err) {
      throw new adapter.UpstreamError(err.message);
    }
  }

  /**
   * Set availability.
   *
   * Do not call directly to avoid race conditions.
   *
   * @param {Object} availability
   * @returns {Promise<Object>}
   */
  async _setAvailability (availability) {
    try {
      const response = await request({
        method: 'PATCH',
        uri: `${this.writeApiUrl}/hotels/${this.supplierId}`,
        json: true,
        body: {
          availability: { roomTypes: availability },
        },
        headers: {
          'X-Access-Key': this.writeApiAccessKey,
          'X-Wallet-Password': this.writeApiWalletPassword,
        },
        simple: false,
        resolveWithFullResponse: true,
      });
      if (response.statusCode <= 299) {
        return response.body;
      } else {
        if (response.statusCode === 503 && response.headers['retry-after']) {
          const upstreamError = new adapter.UpstreamError(`Error ${response.statusCode}`);
          upstreamError.headers = {
            'retry-after': response.headers['retry-after'],
          };
          throw upstreamError;
        }
        throw new Error(`Error ${response.statusCode}`);
      }
    } catch (err) {
      console.log(err)
      if (err instanceof adapter.UpstreamError) {
        throw err;
      }
      throw new adapter.UpstreamError(err.message);
    }
  }

  /**
   * Check restrictions on arrival and departure.
   *
   * @param {Object} availability
   * @param {Array} roomTypes
   * @param {String} arrival
   * @param {String} departure
   * @returns {undefined}
   * @throws {RestrictionsViolatedError}
   */
  _checkRestrictions (availability, roomTypes, arrival, departure) {
    for (let item of availability) {
      if (roomTypes.indexOf(item.roomTypeId) !== -1) {
        if (item.date === arrival && item.restrictions && item.restrictions.noArrival) {
          const msg = `Cannot arrive to ${item.roomTypeId} on date ${arrival}.`;
          throw new adapter.RestrictionsViolatedError(msg);
        }
        if (item.date === departure && item.restrictions && item.restrictions.noDeparture) {
          const msg = `Cannot depart from ${item.roomTypeId} on date ${departure}.`;
          throw new adapter.RestrictionsViolatedError(msg);
        }
      }
    }
  }

  /**
   * Apply availability update (modifies the availability object
   * in the process).
   *
   * "availability" is supposed to have the structure defined in
   * https://github.com/windingtree/wiki/blob/master/hotel-data-swagger.yaml
   *
   * "update" is an object where keys are roomTypeIds and values
   * are arrays of items with two properties: "date" and
   * "subtract".
   *
   * @param {Object} availability The original availability object.
   * @param {Array} rooms List of booked rooms.
   * @param {String} arrival
   * @param {String} departure
   * @param {Boolean} restore (optional) If true, the
   *     availability is restored rather than removed.
   * @returns {undefined}
   */
  _applyUpdate (availability, rooms, arrival, departure, restore) {
    const totals = rooms.reduce((_totals, roomTypeId) => {
      _totals[roomTypeId] = (_totals[roomTypeId] || 0) + 1;
      return _totals;
    }, {});
    for (let roomTypeId in totals) {
      if (!availability.find((a) => a.roomTypeId === roomTypeId)) {
        throw new adapter.InvalidUpdateError(`No availability provided for room type ${roomTypeId}.`);
      }
      const departureDate = dayjs(departure);
      let currentDate = dayjs(arrival);
      while (currentDate.isBefore(departureDate)) {
        let found = false;
        for (let availabilityItem of availability) {
          if (availabilityItem.roomTypeId === roomTypeId &&
            availabilityItem.date === currentDate.format('YYYY-MM-DD')) {
            if (availabilityItem.quantity - totals[roomTypeId] < 0) {
              const msg = `Room type ${roomTypeId} and date ${currentDate.format('YYYY-MM-DD')} is overbooked.`;
              throw new adapter.InvalidUpdateError(msg);
            }
            if (restore) {
              availabilityItem.quantity += totals[roomTypeId];
            } else {
              availabilityItem.quantity -= totals[roomTypeId];
            }
            found = true;
            break;
          }
        }
        if (!found) {
          const msg = `No availability provided for room type ${roomTypeId} and date ${currentDate.format('YYYY-MM-DD')}.`;
          throw new adapter.InvalidUpdateError(msg);
        }
        currentDate = currentDate.add(1, 'day');
      }
    }
  }

  /**
   * Update availability.
   *
   * Serializes calls internally to avoid race conditions.
   *
   * @param {Array} rooms Array of roomTypeIds to be booked
   * @param {String} arrival
   * @param {String} departure
   * @param {Boolean} restore (optional) If true, the
   *     availability is restored rather than removed.
   * @returns {Promise<Object>}
   */
  updateAvailability (rooms, arrival, departure, restore) {
    this.updating = this.updating.then(() => {
      return this._getAvailability();
    }).then((availability) => {
      // If availability is restored, we assume it is done based
      // on a cancelled booking, whose validity has been
      // previously checked - therefore, we do not check it
      // again.
      if (!restore) {
        // Only a soft check here, hard check follows in _applyUpdate
        this._checkRestrictions(availability, arrival, departure);
      }
      this._applyUpdate(availability, rooms.map((x) => x.id), arrival, departure, restore); // Modifies availability.
      return this._setAvailability(availability);
    });
    const ret = this.updating;
    // Do not propagate errors further;
    this.updating = this.updating.catch(() => undefined);
    return ret;
  }

  /**
   * Checks if rooms are actually available for given dates.
   *
   * @param {Object} availabilityData The original availability object.
   * @param {Array} rooms List of booked rooms.
   * @param {String} arrival
   * @param {String} departure
   * @returns {undefined}
   * @throws {RoomUnavailableError}
   */
  _checkAvailability (availabilityData, rooms, arrival, departure) {
    this._checkRestrictions(availabilityData, rooms.map((r) => r.id), arrival, departure);
    const indexedAvailability = availabilityLibrary.indexAvailability(availabilityData);
    for (let i = 0; i < rooms.length; i += 1) {
      const numberOfGuests = rooms[i].guestInfoIds ? rooms[i].guestInfoIds.length : undefined;
      const result = availabilityLibrary.computeAvailability(arrival, departure, numberOfGuests, [rooms[i]], indexedAvailability);
      const roomResult = result.find((r) => r.roomTypeId === rooms[i].id);
      if (!roomResult || !roomResult.quantity) {
        throw new adapter.RoomUnavailableError(`Cannot go to ${rooms[i].id}, it is not available.`);
      }
    }
  }

  /**
   * Get hotel data.
   *
   * @param {Array<String>} fields
   * @returns {Promise<Object>}
   */
  async getSupplierData (fields) {
    fields = fields.join(',');
    try {
      const response = await request({
        method: 'GET',
        uri: `${this.readApiUrl}/hotels/${this.supplierId}?fields=${fields}`,
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
   * @param {Object} hotelDescription
   * @param {Array} cancellationFees
   * @param {String} bookedAt
   * @param {String} arrival
   * @return {Promise<void>}
   * @throw {InadmissibleCancellationFeesError}
   * @throw {IllFormedCancellationFeesError}
   */
  _checkCancellationFees (hotelDescription, cancellationFees, bookedAt, arrival) {
    const illFormed = this._isIllFormed(cancellationFees, bookedAt, arrival);
    if (illFormed) {
      throw new adapter.IllFormedCancellationFeesError(illFormed);
    }
    // For each item, find out if it's admissible wrt. declared
    // cancellation policies.
    const normalizedPolicies = cancellationFeesLibrary.computeCancellationFees(
      bookedAt,
      arrival,
      hotelDescription.cancellationPolicies,
      hotelDescription.defaultCancellationAmount
    );
    for (let fee of cancellationFees) {
      if (!this._isAdmissible(fee, normalizedPolicies, { amount: hotelDescription.defaultCancellationAmount })) {
        let msg = `Inadmissible cancellation fee found: (${fee.from}, ${fee.to}, ${fee.amount})`;
        throw new adapter.InadmissibleCancellationFeesError(msg);
      }
    }
  }

  /**
   * Check price.
   *
   * @param {Object} hotelDescription
   * @param {Object} ratePlans
   * @param {Object} bookingInfo
   * @param {Object} pricing
   * @return {Promise<void>}
   * @throw {InvalidPriceError}
   */
  _checkPrice (hotelDescription, ratePlans, bookingInfo, pricing, bookedAt) {
    ratePlans = Object.values(ratePlans);
    const guestInfo = {};
    for (let item of bookingInfo.guestInfo) {
      guestInfo[item.id] = item;
    }
    const bookingData = bookingInfo.rooms.map((room) => {
      return {
        roomType: { id: room.id },
        arrival: bookingInfo.arrival,
        departure: bookingInfo.departure,
        guests: room.guestInfoIds.map((gid) => guestInfo[gid]),
      };
    });
    let price;
    try {
      price = computeHotelPrice(bookingData, ratePlans, bookedAt, pricing.currency, hotelDescription.currency);
    } catch (err) {
      if (err instanceof NoRatePlanError) {
        throw new adapter.InvalidPriceError(err.message);
      }
      throw err;
    }

    if (pricing.total < (price - EPSILON)) {
      throw new adapter.InvalidPriceError(`The total is too low, expected ${price}.`);
    }
    if (pricing.components && pricing.components.stay) {
      // check subtotals wrt total
      const subtotalSum = pricing.components.stay
        .map((s) => s.subtotal)
        .reduce((agg, c) => agg + c, 0);
      if (pricing.total !== subtotalSum) {
        throw new adapter.InvalidPriceError(`The total is different than the sum of subtotals: ${pricing.total} vs. ${subtotalSum}.`);
      }
      // check resultingPrice wrt subtotals
      pricing.components.stay
        .map((s) => {
          if (s.guests) {
            const guestSum = s.guests
              .map((g) => g.resultingPrice)
              .reduce((agg, p) => agg + p, 0);
            if (s.subtotal !== guestSum) {
              throw new adapter.InvalidPriceError(`The subtotal is different than the sum of resultingPrice for guests for ${s.date}: ${s.subtotal} vs. ${guestSum}.`);
            }
          }
        });
    }
  }

  /**
   * Check admissibility wrt. the suggested price,
   * room availability and cancellation fees.
   *
   * Every component of the validation can be turned off with
   * `checkOpts` parameter.
   *
   * @param {Object} bookingInfo
   * @param {Object} pricing
   * @param {Date} bookedAt
   * @param {Object} checkOpts {availability, cancellationFees, totalPrice}
   * @return {Promise<void>}
   * @throw {InvalidPriceError}
   * @throw {InadmissibleCancellationFeesError}
   * @throw {IllFormedCancellationFeesError}
   * @throw {RoomUnavailableError}
   */
  async checkAdmissibility (bookingInfo, pricing, bookingDate, checkOpts) {
    checkOpts = checkOpts || {
      availability: true,
      cancellationFees: true,
      totalPrice: true,
    };
    if (Object.values(checkOpts).filter((v) => v).length > 0) {
      const fields = ['defaultCancellationAmount', 'cancellationPolicies', 'currency', 'ratePlans', 'timezone', 'availability'],
        hotel = await this.getSupplierData(fields),
        // Convert booking date to hotel's timezone and continue
        // all computation in hotel timezone.
        bookedAt = moment(bookingDate).tz(hotel.timezone).format('YYYY-MM-DD');
      // check the room availability
      if (checkOpts.availability) {
        this._checkAvailability(hotel.availability.roomTypes, bookingInfo.rooms, bookingInfo.arrival, bookingInfo.departure);
      }
      // check cancellation fees
      if (checkOpts.cancellationFees) {
        this._checkCancellationFees(hotel, pricing.cancellationFees, bookedAt, bookingInfo.arrival);
      }
      // check final price
      if (checkOpts.totalPrice) {
        this._checkPrice(hotel, hotel.ratePlans, bookingInfo, pricing, bookedAt);
      }
    }
  }
}

module.exports = {
  WTHotelAdapter,
};
