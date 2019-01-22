const tv4 = require('tv4');
const validator = require('validator');
const PhoneNumber = require('awesome-phonenumber');

const { AIRLINE_SEGMENT_ID, HOTEL_SEGMENT_ID } = require('../../constants');
let { config } = require('../../config');

let bookingSchema;

module.exports.initialize = function (config) {
  if (config.segment === HOTEL_SEGMENT_ID) {
    bookingSchema = require('./hotel-booking-schema.json');
  } else if (config.segment === AIRLINE_SEGMENT_ID) {
    bookingSchema = require('./airline-booking-schema.json');
  } else {
    throw new Error(`Unknown segment ${config.segment}`);
  }
};
module.exports.initialize(config);

class ValidationError extends Error {};
module.exports.ValidationError = ValidationError;

tv4.addFormat('email', (data) => {
  if (validator.isEmail(data)) {
    return null;
  }
  return 'Not a valid e-mail.';
});

tv4.addFormat('phone', (data) => {
  const pn = new PhoneNumber(data);
  if (pn.isValid()) {
    return null;
  }
  return `Invalid phone number: ${data}`;
});

function validateBookingAgainstSchema (data) {
  if (!tv4.validate(data, bookingSchema, false, true)) {
    const msg = tv4.error.message + ': ' + tv4.error.dataPath;
    throw new ValidationError(msg);
  }
};

module.exports.validateBooking = function (data) {
  // syntax
  validateBookingAgainstSchema(data);
  if (config.segment === HOTEL_SEGMENT_ID) {
    // arrival/departure dates
    if (data.booking.arrival >= data.booking.departure) {
      throw new ValidationError(`Arrival at ${data.booking.arrival} is after departure at ${data.booking.departure}`);
    }
  }
  if (config.segment === AIRLINE_SEGMENT_ID) {
    // nonempty classes
    for (let bc of data.booking.bookingClasses) {
      if (bc.passengers.length === 0) {
        throw new ValidationError(`Cannot book class ${bc.bookingClassId} for no passengers.`);
      }
    }
  }
};
