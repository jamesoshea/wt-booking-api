const dayjs = require('dayjs');
const request = require('request-promise-native');

class UpstreamError extends Error {};
class InvalidUpdateError extends Error {};
class RestrictionsViolatedError extends Error {};
class IllFormedCancellationFeesError extends Error {};
class InadmissibleCancellationFeesError extends Error {};

const REQUIRED_FIELDS = [
  'hotelId',
  'readApiUrl',
  'writeApiUrl',
  'writeApiAccessKey',
  'writeApiWalletPassword',
];

class WTAdapter {
  constructor (opts) {
    for (let field of REQUIRED_FIELDS) {
      if (!opts[field]) {
        throw new Error(`Missing configuration: ${field}`);
      }
    }
    this.hotelId = opts.hotelId;
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
        uri: `${this.readApiUrl}/hotels/${this.hotelId}/availability`,
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
      throw new UpstreamError(err.message);
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
        method: 'POST',
        uri: `${this.writeApiUrl}/hotels/${this.hotelId}`,
        json: true,
        body: {
          availability,
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
        throw new Error(`Error ${response.statusCode}`);
      }
    } catch (err) {
      throw new UpstreamError(err.message);
    }
  }

  /**
   * Check restrictions on arrival and departure.
   *
   * @param {Object} availability
   * @param {String} arrival
   * @param {String} departure
   * @returns {undefined}
   * @throws {RestrictionsViolatedError}
   */
  _checkRestrictions (availability, rooms, arrival, departure) {
    for (let roomTypeId of new Set(rooms)) {
      for (let item of (availability[roomTypeId] || [])) {
        if (item.date === arrival && item.restrictions && item.restrictions.noArrival) {
          const msg = `Cannot arrive to ${roomTypeId} on date ${arrival}.`;
          throw new RestrictionsViolatedError(msg);
        }
        if (item.date === departure && item.restrictions && item.restrictions.noDeparture) {
          const msg = `Cannot depart from ${roomTypeId} on date ${departure}.`;
          throw new RestrictionsViolatedError(msg);
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
   * @param {Object} availability
   * @param {Object} update
   * @returns {undefined}
   */
  _applyUpdate (availability, rooms, arrival, departure) {
    const totals = rooms.reduce((_totals, roomTypeId) => {
      _totals[roomTypeId] = (_totals[roomTypeId] || 0) + 1;
      return _totals;
    }, {});
    for (let roomTypeId in totals) {
      if (!availability[roomTypeId]) {
        throw new InvalidUpdateError(`No availability provided for room type ${roomTypeId}.`);
      }
      const departureDate = dayjs(departure);
      let currentDate = dayjs(arrival);
      while (currentDate.isBefore(departureDate)) {
        var found = false;
        for (let availabilityItem of availability[roomTypeId]) {
          if (availabilityItem.date === currentDate.format('YYYY-MM-DD')) {
            if (availabilityItem.quantity - totals[roomTypeId] < 0) {
              const msg = `Room type ${roomTypeId} and date ${currentDate.format('YYYY-MM-DD')} is overbooked.`;
              throw new InvalidUpdateError(msg);
            }
            availabilityItem.quantity -= totals[roomTypeId];
            found = true;
            break;
          }
        }
        if (!found) {
          const msg = `No availability provided for room type ${roomTypeId} and date ${currentDate.format('YYYY-MM-DD')}.`;
          throw new InvalidUpdateError(msg);
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
   * @param {String} arrival
   * @param {String} departure * @param {Array} rooms Array of roomTypeIds to be booked * @returns {Promise<Object>} */
  updateAvailability (rooms, arrival, departure) {
    this.updating = this.updating.then(() => {
      return this._getAvailability();
    }).then((availability) => {
      this._checkRestrictions(availability, rooms, arrival, departure);
      this._applyUpdate(availability, rooms, arrival, departure); // Modifies availability.
      return this._setAvailability(availability);
    });
    const ret = this.updating;
    // Do not propagate errors further;
    this.updating = this.updating.catch(() => undefined);
    return ret;
  }

  /**
   * Get hotel description data.
   *
   * @param {Array<String>} fields
   * @returns {Promise<Object>}
   */
  async _getDescription (fields) {
    fields = fields.join(',');
    try {
      const response = await request({
        method: 'GET',
        uri: `${this.readApiUrl}/hotels/${this.hotelId}?fields=${fields}`,
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
      throw new UpstreamError(err.message);
    }
  }

  /**
   * Check if the given cancellation fee computed with the
   * specified arrival date is admissible wrt. the given
   * policies.
   *
   * @param {Object} fee
   * @param {Array} policies
   * @param {dayjs} today
   * @param {dayjs} arrival
   * @return {Boolean}
   */
  _isAdmissible (fee, policies, today, arrival) {
    const feeFrom = dayjs(fee.from),
      feeTo = dayjs(fee.to);
    // 1. Normalize policy descriptors.
    let normalizedPolicies = policies
      .map((p) => {
        // TODO: je spravne posouvat policyTo a policyFrom, kdyz
        // je to uplne mimo?
        let policyTo = p.to ? dayjs(p.to) : arrival;
        policyTo = arrival.isBefore(policyTo) ? arrival : policyTo;
        let policyFrom = p.from ? dayjs(p.from) : today;
        policyFrom = today.isAfter(policyFrom) ? today : policyFrom;
        const deadline = p.deadline ? arrival.subtract(p.deadline, 'day') : dayjs('1970-01-01');
        if (deadline.isAfter(policyFrom)) {
          policyFrom = deadline;
        }
        return {
          amount: p.amount,
          policyTo: policyTo,
          policyFrom: policyFrom,
          deadline: deadline,
        };
      });

    // 2. Sort by (policyFrom, deadline) to enable cutoff by
    // next-policy deadline.
    normalizedPolicies.sort((p1, p2) => {
      if (p1.policyTo.isBefore(p2.policyTo)) {
        return -1;
      } else if (p2.policyTo.isBefore(p1.policyTo)) {
        return 1;
      } else if (!p1.deadline.isSame(p2.deadline)) {
        return p1.deadline.isBefore(p2.deadline) ? -1 : 1;
      }
      return 0;
    });

    // 3. Filter out irrelevant policies.
    normalizedPolicies = normalizedPolicies.filter((policy, index) => {
      if (policy.deadline.isAfter(policy.policyTo)) {
        return false;
      }
      return true;
    });

    // 4. Select the applicable policy from the list.
    policies = normalizedPolicies.filter((policy, index) => {
      if (index < normalizedPolicies.length - 1) {
        // Cut off by next policy deadline (taken into account
        // in policyFrom by now).
        policy.policyTo = normalizedPolicies[index + 1].policyFrom.subtract(1, 'day');
      }

      return (feeFrom.isSame(policy.policyFrom) && feeTo.isSame(policy.policyTo));
    });

    if (!policies.length) {
      return false;
    }
    const policy = policies[0];

    // 3. Verify that the fee amount is admissible wrt. to the selected policy.
    return (fee.amount >= policy.amount);
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
    const msg = 'Ill-formed cancellation fees: the whole period between booking date and arrival must be covered.';
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
        return msg;
      }
    }
    if (!period.from.isSame(bookedAt) || !period.to.isSame(arrival)) {
      return msg;
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
   * Check price and cancellation fees.
   *
   * @param {String} currency
   * @param {float} total
   * @param {Array} cancellationFees
   * @param {String} bookedAt
   * @param {String} arrival
   * @return {Promise<void>}
   * @throw {InadmissibleCancellationFeesError}
   * @throw {IllFormedCancellationFeesError}
   */
  async checkPrice (currency, total, cancellationFees, bookedAt, arrival) {
    let fields = ['defaultCancellationAmount', 'cancellationPolicies'],
      description = await this._getDescription(fields),
      cancellationPolicies = [
        { amount: description.defaultCancellationAmount },
      ].concat(description.cancellationPolicies || []);

    // For each item, find out if it's admissible wrt. declared
    // cancellation policies.
    const illFormed = this._isIllFormed(cancellationFees, bookedAt, arrival);
    if (illFormed) {
      throw new IllFormedCancellationFeesError(illFormed);
    }

    const arrivalDate = dayjs(arrival),
      todayDate = dayjs(bookedAt);
    for (let fee of cancellationFees) {
      if (!this._isAdmissible(fee, cancellationPolicies, todayDate, arrivalDate)) {
        let msg = `Inadmissible cancellation fee found: (${fee.from}, ${fee.to}, ${fee.amount})`;
        throw new InadmissibleCancellationFeesError(msg);
      }
    }
  }
}

let _WTAdapter;

/**
 * Get the previously set WTAdapter instance.
 */
function get () {
  if (!_WTAdapter) {
    throw new Error('No WTAdapter instance has been set!');
  }
  return _WTAdapter;
}

/**
 * Set WTAdapter instance during runtime.
 */
function set (wtAdapter) {
  _WTAdapter = wtAdapter;
}

module.exports = {
  WTAdapter,
  UpstreamError,
  InvalidUpdateError,
  RestrictionsViolatedError,
  IllFormedCancellationFeesError,
  InadmissibleCancellationFeesError,
  get,
  set,
};
