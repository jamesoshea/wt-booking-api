const Web3Utils = require('web3-utils');

const { HttpBadRequestError } = require('../../errors');
const { WT_HEADER_SIGNATURE, WT_HEADER_SIGNED_HASH } = require('../../constants');
const { config } = require('../../config');

module.exports.computeHash = (data) => {
  return Web3Utils.soliditySha3(Web3Utils.utf8ToHex(JSON.stringify(data)));
};

module.exports.isSignedRequest = (req) => {
  return req.headers[WT_HEADER_SIGNED_HASH] && req.headers[WT_HEADER_SIGNATURE];
};

module.exports.signHash = async (data, wallet) => {
  let dataHash = this.computeHash(data);
  return wallet.encodeAndSignData({ 'originAddress': wallet.address, 'dataHash': dataHash }, 'originAddress');
};

module.exports.verifySignedRequest = (req, originAddress = undefined) => {
  if (originAddress === undefined) {
    originAddress = req.body.originAddress;
  }
  try {
    const trustClient = config.wtLibs.getTrustClueClient();
    let decoded = trustClient.verifyAndDecodeSignedData(req.headers[WT_HEADER_SIGNED_HASH], req.headers[WT_HEADER_SIGNATURE], 'originAddress');
    let decodedHash = decoded.dataHash;
    let decodedOriginAddress = decoded.originAddress;
    if (this.computeHash(req.body) !== decodedHash) {
      throw new HttpBadRequestError('badRequest', 'Request signature verification failed: tampered body');
    }
    if (originAddress !== decodedOriginAddress) {
      throw new HttpBadRequestError('badRequest', 'Request signature verification failed: incorrect origin address');
    }
  } catch (e) {
    throw new HttpBadRequestError('badRequest', e.message);
  }
};
