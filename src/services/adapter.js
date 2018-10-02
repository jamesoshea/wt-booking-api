const request = require('request-promise-native');

class UpstreamError extends Error {};

class WTAdapter {
  constructor (hotelId, readApiUrl, writeApiUrl, writeApiAccessKey, writeApiWalletPassword) {
    this.hotelId = hotelId;
    this.readApiUrl = readApiUrl;
    this.writeApiUrl = writeApiUrl;
    this.writeApiAccessKey = writeApiAccessKey;
    this.writeApiWalletPassword = writeApiWalletPassword;

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
  }

  /**
   * Apply availability update.
   *
   * @param {Object} availability
   * @param {Object} update
   * @returns {Promise<Object>}
   */
  _applyUpdate (availability, update) {
    // TODO: implement
    return availability;
  }

  /**
   * Update availability.
   *
   * Serializes calls internally to avoid race conditions.
   *
   * @param {Object} update
   * @returns {Promise<Object>}
   */
  updateAvailability (update) {
    this.updating = this.updating.then(() => {
      return this._getAvailability();
    }).then((orig) => {
      return this._applyUpdate(orig, update);
    }).then((availability) => {
      return this._setAvailability(availability);
    });
    const ret = this.updating;
    // Do not propagate errors further;
    this.updating = this.updating.catch(() => undefined);
    return ret;
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
  get,
  set,
};
