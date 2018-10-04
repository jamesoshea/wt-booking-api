const { HttpValidationError, HttpBadGatewayError, HttpConflictError } = require('../errors');

const config = require('../config');
const validators = require('../services/validators');
const adapter = require('../services/adapter');

const hotelId = config.adapterOpts.hotelId.toLowerCase();

/**
 * Create a new booking.
 */
module.exports.create = async (req, res, next) => {
  try {
    // 1. Validate request payload.
    validators.validateBooking(req.body);
    // 2. Verify that hotelId is the expected one.
    if (req.body.hotelId.toLowerCase() !== hotelId) {
      throw new validators.ValidationError('Unexpected hotelId.');
    }
    // 3. Assemble the intended availability update and try to apply it.
    // (Validation of the update is done inside the adapter.)
    const wtAdapter = adapter.get(),
      booking = req.body.booking;
    await wtAdapter.updateAvailability(booking.rooms.map((x) => x.id),
      booking.arrival, booking.departure);
    // 4. Return confirmation.
    // TODO: Fill in the details.
    res.json({});
  } catch (err) {
    if (err instanceof validators.ValidationError) {
      return next(new HttpValidationError('validationFailed', err.message));
    }
    if (err instanceof adapter.UpstreamError) {
      return next(new HttpBadGatewayError('badGatewayError', err.message));
    }
    if ((err instanceof adapter.InvalidUpdateError) || (err instanceof adapter.RestrictionsViolatedError)) {
      return next(new HttpConflictError('conflictError', err.message));
    }
    next(err);
  }
};
