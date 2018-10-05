const dayjs = require('dayjs');
const request = require('request-promise-native');

class UpstreamError extends Error {};
class InvalidUpdateError extends Error {};
class RestrictionsViolatedError extends Error {};
class InvalidCancellationFeesError extends Error {};

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
   * Check if the given cancellation fee computed wrt.the
   * specified arrival date is admissible wrt. the given
   * policy.
   *
   * @param {Object} fee
   * @param {Object} policy
   * @param {dayjs} today
   * @param {dayjs} arrival
   * @return {Boolean}
   */
  _isAdmissible (fee, policy, today, arrival) {
    if (fee.amount < policy.amount) {
      return false;
    }
    const feeFrom = fee.from ? dayjs(fee.from) : today,
      feeTo = fee.from ? dayjs(fee.to) : arrival,
      policyTo = policy.to ? dayjs(policy.to) : arrival;
    let policyFrom = policy.from ? dayjs(policy.from) : today;
    // Take deadline into account
    if (policy.deadline) {
      const deadline = arrival.subtract(policy.deadline, 'day');
      if (deadline.isAfter(policyTo)) {
        return false;
      }
      if (deadline.isAfter(policyFrom)) {
        policyFrom = deadline;
      }
    }

    // Return result based on whether the cancellation fee interval lies
    // within the policy interval.
    return (!feeFrom.isBefore(policyFrom)) && (!feeTo.isAfter(policyTo));
  }

  /**
   * Check if the array of cancellation fees is meaningful.
   *
   * We do not check if the fee intervals overlap or not because
   * that is a legitimate case. (We assume that in such
   * ambiguous cases, the consumer can choose which one of the applicable
   * fees they want to apply.)
   *
   * @param {Array} fees
   * @return {Boolean}
   */
  _isWellFormed (fees) {
    for (let fee of fees) {
      const from = fee.from && dayjs(fee.from);
      const to = fee.to && dayjs(fee.to);
      if (from && to && from.isAfter(to)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check price and cancellation fees.
   *
   * @param {String} currency
   * @param {float} total
   * @param {Array} cancellationFees
   * @return {Promise<void>}
   * @throw {InvalidCancellationFeesError}
   */
  async checkPrice (currency, total, cancellationFees, arrival) {
    let fields = ['defaultCancellationAmount', 'cancellationPolicies'],
      description = await this._getDescription(fields),
      cancellationPolicies = (description.cancellationPolicies || []).concat([
        description.defaultCancellationAmount,
      ]);

    // For each item, find out if it's admissible wrt. declared
    // cancellation policies.
    for (let fee of cancellationFees) {
      let admissible = false;
      for (let policy of cancellationPolicies) {
        if (this._isAdmissible(fee, policy, arrival)) {
          admissible = true;
          break;
        }
      }
      if (!admissible) {
        let msg = `Inadmissible cancellation fee found: (${fee.from}, ${fee.to}, ${fee.amount})`;
        throw new InvalidCancellationFeesError(msg);
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
  InvalidCancellationFeesError,
  get,
  set,
};
