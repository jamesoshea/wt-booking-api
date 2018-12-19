const { HttpValidationError, HttpBadGatewayError, HttpConflictError,
  Http404Error, HttpForbiddenError } = require('../errors');
const config = require('../config');
const validators = require('../services/validators');
const adapter = require('../services/adapter');
const Booking = require('../models/booking');

const hotelId = config.adapterOpts.hotelId.toLowerCase();

/**
 * Create a new booking.
 */
module.exports.create = async (req, res, next) => {
  try {
    // 1. Validate request payload.
    validators.validateBooking(req.body);
    // 2. Verify that hotelId is the expected one.
    if (req.body.hotelId.toLowerCase() !== hotelId.toLowerCase()) {
      throw new validators.ValidationError('Unexpected hotelId.');
    }
    // 3. Assemble the intended availability update and try to apply it.
    // (Validation of the update is done inside the adapter.)
    const wtAdapter = adapter.get(),
      booking = req.body.booking,
      pricing = req.body.pricing,
      rooms = booking.rooms.map((x) => x.id);
    await wtAdapter.checkAdmissibility(booking, pricing, new Date());
    await wtAdapter.updateAvailability(rooms, booking.arrival, booking.departure);
    const bookingData = {
        arrival: booking.arrival,
        departure: booking.departure,
        rooms,
      },
      bookingRecord = await Booking.create(bookingData, Booking.STATUS.CONFIRMED);
    // 4. Return confirmation.
    res.json({
      // In a non-demo implementation of booking API, the ID
      // would probably come from the hotel's property
      // management system.
      id: bookingRecord.id,
      status: bookingRecord.status,
    });
  } catch (err) {
    if (err instanceof validators.ValidationError) {
      return next(new HttpValidationError('validationFailed', err.message));
    }
    if (err instanceof adapter.UpstreamError) {
      return next(new HttpBadGatewayError('badGatewayError', err.message));
    }
    if (err instanceof adapter.InvalidUpdateError) {
      return next(new HttpConflictError('conflictError', err.message));
    }
    if (err instanceof adapter.RestrictionsViolatedError) {
      return next(new HttpConflictError('restrictionsViolated', err.message));
    }
    if (err instanceof adapter.InvalidPriceError) {
      return next(new HttpValidationError('invalidPrice', err.message));
    }
    if ((err instanceof adapter.InadmissibleCancellationFeesError) ||
      (err instanceof adapter.IllFormedCancellationFeesError)) {
      return next(new HttpValidationError('invalidCancellationFees', err.message));
    }
    next(err);
  }
};

/**
 * Cancel an existing booking.
 */
module.exports.cancel = async (req, res, next) => {
  try {
    const bookingId = req.params.id,
      booking = await Booking.get(bookingId);
    if (!booking) {
      const msg = `Booking ${bookingId} does not exist.`;
      throw new Http404Error('notFound', msg);
    }
    if (booking.status === Booking.STATUS.CANCELLED) {
      const msg = `Booking ${bookingId} already cancelled.`;
      throw new HttpConflictError('alreadyCancelled', msg);
    }
    if (!config.allowCancel) {
      const msg = 'Booking cancellation is not allowed.';
      throw new HttpForbiddenError('forbidden', msg);
    }

    // Restore the availability.
    const { rooms, arrival, departure } = booking.rawData,
      wtAdapter = adapter.get();
    await wtAdapter.updateAvailability(rooms, arrival, departure, true);

    // Mark the booking as cancelled.
    await Booking.cancel(bookingId);
    return res.sendStatus(204);
  } catch (err) {
    if (err instanceof adapter.InvalidUpdateError) {
      // This happens when availability data have changed so
      // much since the booking that it cannot be restored any
      // more.
      return next(new HttpConflictError('cannotCancel', err.message));
    }
    next(err);
  }
};
