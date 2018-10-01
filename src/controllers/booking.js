const { HttpValidationError } = require('../errors');

const validators = require('../services/validators');

/**
 * Create a new booking.
 */
module.exports.book = async (req, res, next) => {
  try {
    // 1. Validate request payload.
    validators.validateBooking(req.body);
    // 2. Return confirmation.
    // TODO: Fill in the details.
    res.json({});
  } catch (err) {
    if (err instanceof validators.ValidationError) {
      return next(new HttpValidationError('validationFailed', err.message));
    }
    next(err);
  }
};
