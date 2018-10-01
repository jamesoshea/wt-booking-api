const tv4 = require('tv4');

const bookingSchema = require('./booking-schema.json');

class ValidationError extends Error {};
module.exports.ValidationError = ValidationError;

module.exports.validateBooking = function (data) {
  if (!tv4.validate(data, bookingSchema, false, true)) {
    const msg = tv4.error.message + ': ' + tv4.error.dataPath;
    throw new ValidationError(msg);
  }
};
