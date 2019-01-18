const tv4 = require('tv4');
const validator = require('validator');

const bookingSchema = require('./booking-schema.json');

class ValidationError extends Error {};
module.exports.ValidationError = ValidationError;

tv4.addFormat('email', (data) => {
  if (validator.isEmail(data)) {
    return null;
  }
  return 'Not a valid e-mail.';
});

function validateBookingAgainstSchema (data) {
  if (!tv4.validate(data, bookingSchema, false, true)) {
    const msg = tv4.error.message + ': ' + tv4.error.dataPath;
    throw new ValidationError(msg);
  }
};

module.exports.validateBooking = function (data) {
  validateBookingAgainstSchema(data);
  if (data.booking.arrival >= data.booking.departure) {
    throw new ValidationError(`Arrival at ${data.booking.arrival} is after departure at ${data.booking.departure}`);
  }
};
