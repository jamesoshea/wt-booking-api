const request = require('request-promise-native');

class UpstreamError extends Error {};

class WTAdapter {
  constructor (hotelId, readApiUrl, writeApiUrl, writeApiAccessKey, writeApiWalletPassword) {
    this.hotelId = hotelId;
    this.readApiUrl = readApiUrl;
    this.writeApiUrl = writeApiUrl;
    this.writeApiAccessKey = writeApiAccessKey;
    this.writeApiWalletPassword = writeApiWalletPassword;
  }

  /**
   * Get the current availability document.
   *
   * @returns {Promise<Object>}
   */
  async getAvailability () {
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
   * @returns {Promise<Object>}
   */
  async setAvailability (availability) {
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
