const tv4 = require('tv4');
const validator = require('validator');

const config = require('../../config');

let bookingSchema;
if (config.segment === 'hotels') {
  bookingSchema = require('./hotel-booking-schema.json');
} else if (config.segment === 'airlines') {
  bookingSchema = require('./airline-booking-schema.json');
} else {
  throw new Error(`Unknown segment ${config.segment}`);
}

class ValidationError extends Error {};
module.exports.ValidationError = ValidationError;

tv4.addFormat('email', (data) => {
  if (validator.isEmail(data)) {
    return null;
  }
  return 'Not a valid e-mail.';
});

module.exports.validateBooking = function (data) {
  if (!tv4.validate(data, bookingSchema, false, true)) {
    const msg = tv4.error.message + ': ' + tv4.error.dataPath;
    throw new ValidationError(msg);
  }
};
