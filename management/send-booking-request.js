'use strict';

// mock a signed booking request to be send e.g. by hotel-explorer

const Web3Utils = require('web3-utils');
const WtJsLibs = require('@windingtree/wt-js-libs/dist/cjs/wt-js-libs').WtJsLibs;
const factories = require('../test/utils/factories');
const hotelsBooking = require('../src/controllers/hotels-booking');

const walletAddress = '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906';
const walletData = require('../test/utils/test-wallet.js');
const walletPassword = 'test123';

const provider = `http://localhost:${process.env.SOLIDITY_COVERAGE ? 8555 : 8545}`;

const sendSignedBooking = async () => {
  let wtJsLibs = WtJsLibs.createInstance({
    onChainDataOptions: {
      provider: provider,
    },
  });

  let booking = factories.getHotelBooking();
  booking.originAddress = walletAddress;

  const wallet = wtJsLibs.createWallet(walletData);
  wallet.unlock(walletPassword);
  let serializedData = JSON.stringify(booking);
  let dataHash = Web3Utils.soliditySha3(serializedData);
  let signature = await wallet.signData(dataHash);
  hotelsBooking.create({ rawBody: serializedData, body: booking, headers: { 'x-wt-signature': signature } }, { json: console.log }, console.log);
  let bookingId = 1;
  let uri = `/booking/${bookingId}`;
  dataHash = Web3Utils.soliditySha3(uri);
  signature = await wallet.signData(dataHash);
  hotelsBooking.cancel({ url: uri, params: { id: bookingId }, headers: { 'x-wt-signature': signature, 'x-wt-origin-address': walletAddress } }, { json: console.log }, console.log);
};

sendSignedBooking();