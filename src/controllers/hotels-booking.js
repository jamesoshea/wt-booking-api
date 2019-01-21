const { HttpValidationError, HttpBadGatewayError, HttpConflictError,
  Http404Error, HttpForbiddenError } = require('../errors');
const config = require('../config');
const validators = require('../services/validators');
const normalizers = require('../services/normalizers');
const adapter = require('../services/adapter');
const mailComposer = require('../services/mailcomposer');
const mailerService = require('../services/mailer');
const Booking = require('../models/booking');

const hotelId = config.adapterOpts.hotelId.toLowerCase();

const prepareDataForConfirmationMail = async (bookingBody, bookingRecord, adapter) => {
  const hotelData = await adapter.getHotelData(['name', 'contacts', 'address', 'roomTypes']);
  const roomList = bookingBody.booking.rooms.map((r) => {
    return {
      roomType: hotelData.roomTypes.find((rt) => rt.id === r.id),
      guests: r.guestInfoIds.map((gid) => bookingBody.booking.guestInfo.find((gi) => gi.id === gid)),
    };
  });
  return {
    customer: bookingBody.customer,
    note: bookingBody.note,
    hotel: hotelData,
    arrival: bookingBody.booking.arrival,
    departure: bookingBody.booking.departure,
    roomList,
    pricing: bookingBody.pricing,
    id: bookingRecord.id,
    status: bookingRecord.status,
  };
};

/**
 * Create a new booking.
 */
module.exports.create = async (req, res, next) => {
  try {
    // 0. Normalize request payload
    const bookingData = normalizers.normalizeBooking(req.body);
    // 1. Validate request payload.
    validators.validateBooking(bookingData);
    // 2. Verify that hotelId is the expected one.
    if (bookingData.hotelId.toLowerCase() !== hotelId) {
      throw new validators.ValidationError('Unexpected hotelId.');
    }
    // 3. Assemble the intended availability update and try to apply it.
    // (Validation of the update is done inside the adapter.)
    const wtAdapter = adapter.get(),
      booking = bookingData.booking,
      pricing = bookingData.pricing;

    await wtAdapter.checkAdmissibility(booking, pricing, new Date(), config.checkOpts);
    if (config.updateAvailability) {
      await wtAdapter.updateAvailability(booking.rooms, booking.arrival, booking.departure);
    }

    // We are not storing any personal information
    const bookingRecordData = {
        arrival: booking.arrival,
        departure: booking.departure,
        rooms: booking.rooms.map((r) => (r.id)),
      },
      bookingRecord = await Booking.create(bookingRecordData, config.defaultBookingState);
    // 4. E-mail confirmations
    const mailer = mailerService.get();
    const mailInformation = ((config.mailing.sendHotel && config.mailing.hotelAddress) || config.mailing.sendCustomer)
      ? await prepareDataForConfirmationMail(bookingData, bookingRecord, wtAdapter)
      : {};
    // hotel
    if (config.mailing.sendHotel && config.mailing.hotelAddress) {
      // no need to wait for result
      mailer.sendMail({
        to: config.mailing.hotelAddress,
        ...mailComposer.renderHotel(mailInformation),
      });
    }
    // customer
    if (config.mailing.sendCustomer) {
      // no need to wait for result
      mailer.sendMail({
        to: req.body.customer.email,
        ...mailComposer.renderCustomer(mailInformation),
      });
    }
    // 5. Return confirmation.
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
