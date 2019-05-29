const _ = require('lodash');

const { HttpValidationError, HttpBadGatewayError, HttpConflictError,
  Http404Error, HttpForbiddenError, HttpBadRequestError,
  HttpServiceUnavailable } = require('../errors');
const { WT_HEADER_ORIGIN_ADDRESS } = require('../constants');
const { config } = require('../config');
const validators = require('../services/validators');
const signing = require('../services/signing');
const normalizers = require('../services/normalizers');
const adapter = require('../services/adapters/base-adapter');
const mailComposer = require('../services/mailcomposer');
const mailerService = require('../services/mailer');
const Booking = require('../models/booking');

const airlineId = config.adapterOpts.supplierId.toLowerCase();

const prepareDataForConfirmationMail = async (bookingBody, bookingRecord, adapter) => {
  const airlineData = await adapter.getSupplierData(['name', 'contacts', 'code', 'flights']);
  const flight = airlineData.flights.items.find(f => f.id === bookingBody.booking.flightInstanceId);
  return {
    origin: bookingBody.origin,
    customer: bookingBody.customer,
    note: bookingBody.note,
    airline: airlineData,
    flight: flight,
    booking: bookingBody.booking,
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
    // 0. Verify signed request
    if (signing.isSignedRequest(req)) {
      if (!req.rawBody) {
        throw new HttpBadRequestError('badRequest', 'Couldn\'t find raw request body, is "content-type" header set properly? Try "application/json".');
      }
      try {
        signing.verifySignedRequest(req.rawBody, req.headers, signing.verificationFnCreate(req.rawBody));
      } catch (e) {
        return next(e);
      }
    } else if (!config.allowUnsignedBookingRequests) {
      return next(new HttpBadRequestError('badRequest', 'API doesn\'t accept unsigned booking requests.'));
    }
    // 1. Normalize request payload
    const bookingData = normalizers.normalizeBooking(req.body);
    // 2. Validate request payload.
    validators.validateBooking(bookingData);
    // 3. Verify that airlineId is the expected one.
    if (bookingData.airlineId.toLowerCase() !== airlineId) {
      throw new validators.ValidationError('Unexpected airlineId.');
    }
    // 4. Evaluate trust
    if (!bookingData.originAddress) {
      return next(new HttpForbiddenError('forbidden', 'Unknown caller. You need to fill `originAddress` field so the API can evaluate trust clues.'));
    }
    const interpretedClues = await config.wtLibs.getTrustClueClient().interpretAllValues(bookingData.originAddress);

    // Let's say we're okay with at least one clue passing. Customize following logic to suit your needs (e.g. use `interpretedClues.every`).
    const someCluesPass = interpretedClues.some(c => c.value) || interpretedClues.length === 0;
    if (!someCluesPass) {
      return next(new HttpForbiddenError('forbidden', `Untrusted caller. Check information on trust clues provided at ${config.adapterOpts.baseUrl}/`));
    }

    // 5. Assemble the intended availability update and try to apply it.
    // (Validation of the update is done inside the adapter.)
    const wtAdapter = adapter.get(),
      booking = bookingData.booking,
      pricing = bookingData.pricing;

    const flightInstance = await wtAdapter.getFlightInstanceData(booking.flightInstanceId);
    await wtAdapter.checkAdmissibility(bookingData, flightInstance, pricing, new Date(), config.checkOpts);
    if (config.updateAvailability) {
      await wtAdapter.updateAvailability(booking.flightInstanceId, bookingData);
    }

    // We are not storing any personal information
    let bookingClasses = _.cloneDeep(booking.bookingClasses);
    bookingClasses = bookingClasses.map((c) => { c.passengerCount = c.passengers.length; delete c.passengers; return c; });
    const bookingRecordData = {
        origin: bookingData.origin,
        airline: bookingData.airlineId,
        pricing: pricing,
        booking: {
          flightInstanceId: booking.flightInstanceId,
          flightNumber: booking.flightNumber,
          bookingClasses: bookingClasses,
        },
      },
      bookingRecord = await Booking.create(bookingRecordData, config.defaultBookingState);
    // 4. E-mail confirmations
    const mailer = mailerService.get();
    const mailInformation = ((config.mailing.sendSupplier && config.mailing.supplierAddress) || config.mailing.sendCustomer)
      ? await prepareDataForConfirmationMail(bookingData, bookingRecord, wtAdapter)
      : {};
    // airline
    if (config.mailing.sendSupplier && config.mailing.supplierAddress) {
      // no need to wait for result
      mailer.sendMail({
        to: config.mailing.supplierAddress,
        ...mailComposer.renderSupplier(mailInformation),
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
      // would probably come from the airline's property
      // management system.
      id: bookingRecord.id,
      status: bookingRecord.status,
    });
  } catch (err) {
    if (err instanceof validators.ValidationError) {
      return next(new HttpValidationError('validationFailed', err.message));
    }
    if (err instanceof adapter.UpstreamError) {
      if (err.headers && err.headers['retry-after']) {
        return next(new HttpServiceUnavailable(null, null, err.message, err.headers));
      }
      return next(new HttpBadGatewayError('badGatewayError', err.message));
    }
    if (err instanceof adapter.InvalidUpdateError) {
      return next(new HttpConflictError('conflictError', err.message));
    }
    if (err instanceof adapter.RestrictionsViolatedError) {
      return next(new HttpConflictError('restrictionsViolated', err.message));
    }
    if (err instanceof adapter.FlightUnavailableError) {
      return next(new HttpValidationError('unavailableFlight', err.message));
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
    if (signing.isSignedRequest(req) && req.headers[WT_HEADER_ORIGIN_ADDRESS]) {
      try {
        // DELETE shouldn't contain body, so the originAddress is sent in a header and uri is signed instead of body
        signing.verifySignedRequest(req.url, req.headers, signing.verificationFnCancel(req.headers[WT_HEADER_ORIGIN_ADDRESS]));
      } catch (e) {
        return next(e);
      }
    } else if (!config.allowUnsignedBookingRequests) {
      return next(new HttpBadRequestError('badRequest', 'API doesn\'t accept unsigned booking requests.'));
    }

    const bookingId = req.params.id,
      bookingRecord = await Booking.get(bookingId);
    if (!bookingRecord) {
      const msg = `Booking ${bookingId} does not exist.`;
      throw new Http404Error('notFound', msg);
    }
    if (bookingRecord.status === Booking.STATUS.CANCELLED) {
      const msg = `Booking ${bookingId} already cancelled.`;
      throw new HttpConflictError('alreadyCancelled', msg);
    }
    if (!config.allowCancel) {
      const msg = 'Booking cancellation is not allowed.';
      throw new HttpForbiddenError('forbidden', msg);
    }

    // Restore the availability.
    const booking = bookingRecord.rawData,
      wtAdapter = adapter.get();
    await wtAdapter.updateAvailability(booking.flightInstanceId, booking, true);

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
