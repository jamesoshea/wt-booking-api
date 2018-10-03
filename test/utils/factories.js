const config = require('../../src/config');

module.exports.getBooking = function () {
  // TODO: Fill in more data.
  return {
    hotelId: config.adapterOpts.hotelId,
  };
};
