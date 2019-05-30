const Web3Utils = require('web3-utils');

const { HttpBadRequestError } = require('../../errors');
const { WT_HEADER_SIGNATURE } = require('../../constants');
const { config } = require('../../config');

/**
 * As booking request contains sensitive data we only sign a `soliditySha3` hash of the serialized request.
 * This still allows booking-api to verify the message integrity and enables future use of signed booking
 * requests to prove one is an established party (thus gaining trust) without revealing content of the bookings.
 *
 * @param {String} data
 * @returns {String} hash
 */
module.exports.computeHash = (data) => {
  return Web3Utils.soliditySha3(data);
};

module.exports.isSignedRequest = (req) => {
  return !!req.headers[WT_HEADER_SIGNATURE];
};

module.exports.signData = async (data, wallet) => {
  let dataHash = this.computeHash(data);
  return wallet.signData(dataHash);
};

module.exports.verifySignedRequest = (rawBody, headers, verificationFn) => {
  try {
    const trustClient = config.wtLibs.getTrustClueClient();
    try {
      trustClient.verifySignedData(this.computeHash(rawBody), headers[WT_HEADER_SIGNATURE], verificationFn);
    } catch (e) {
      console.log(e);
      throw new HttpBadRequestError('badRequest', 'Request signature verification failed: incorrect origin address or tampered body', e.message);
    }
  } catch (e) {
    throw new HttpBadRequestError('badRequest', e.message);
  }
};

module.exports.verificationFnCreate = (serializedData) => (_actualSigner) => {
  let data = JSON.parse(serializedData);
  let expectedSigner = data.originAddress;
  if (Web3Utils.toChecksumAddress(expectedSigner) !== _actualSigner) {
    throw new Error(`Expected signer '${expectedSigner}' does not match the recovered one '${_actualSigner}'`);
  }
};

module.exports.verificationFnCancel = (expectedSigner) => (_actualSigner) => {
  if (Web3Utils.toChecksumAddress(expectedSigner) !== _actualSigner) {
    throw new Error(`Expected signer '${expectedSigner}' does not match the recovered one '${_actualSigner}'`);
  }
};
