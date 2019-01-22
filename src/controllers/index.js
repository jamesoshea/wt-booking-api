const { config } = require('../config');
const hotelBooking = require('../controllers/hotels-booking');
const airlineBooking = require('../controllers/airlines-booking');
const { HOTEL_SEGMENT_ID, AIRLINE_SEGMENT_ID } = require('../constants');

function getController () {
  if (config.segment === HOTEL_SEGMENT_ID) {
    return hotelBooking;
  } else if (config.segment === AIRLINE_SEGMENT_ID) {
    return airlineBooking;
  } else {
    throw new Error(`Unknown segment ${config.segment}`);
  }
}

module.exports.createBooking = (req, res, next) => {
  return getController().create(req, res, next);
};

module.exports.cancelBooking = (req, res, next) => {
  return getController().cancel(req, res, next);
};
