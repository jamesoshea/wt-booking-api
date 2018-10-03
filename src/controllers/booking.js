const { HttpValidationError } = require('../errors');

const config = require('../config');
const validators = require('../services/validators');

const hotelId = config.adapterOpts.hotelId.toLowerCase();

/**
 * Create a new booking.
 */
module.exports.book = async (req, res, next) => {
  try {
    // 1. Validate request payload.
    validators.validateBooking(req.body);
    // 2. Verify that hotelId is the expected one.
    if (req.body.hotelId.toLowerCase() !== hotelId) {
      throw new validators.ValidationError('Unexpected hotelId.');
    }
    // 3. Return confirmation.
    // TODO: Fill in the details.
    res.json({});
  } catch (err) {
    if (err instanceof validators.ValidationError) {
      return next(new HttpValidationError('validationFailed', err.message));
    }
    next(err);
  }
};
