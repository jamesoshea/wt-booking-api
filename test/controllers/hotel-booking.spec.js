/* eslint-env mocha */
/* eslint-disable promise/no-callback-in-promise */
const { HOTEL_SEGMENT_ID } = require('../../src/constants');
const { assert } = require('chai');
const request = require('supertest');
const sinon = require('sinon');

const { initSegment } = require('../../src/config');
let config;
const { getHotelBooking, getHotelData } = require('../utils/factories');
const mailerService = require('../../src/services/mailer');
const adapter = require('../../src/services/adapters/base-adapter');
const Booking = require('../../src/models/booking');
const validator = require('../../src/services/validators/index');

describe('controllers - hotel booking', function () {
  let server, wtAdapterOrig, wtAdapter,
    mailerOrig, mailer;

  before(async () => {
    process.env.WT_SEGMENT = HOTEL_SEGMENT_ID;
    config = initSegment();
    server = require('../../src/index');
    validator.initialize(config);
    wtAdapterOrig = adapter.get();
    mailerOrig = mailerService.get();
    wtAdapter = {
      getSupplierData: sinon.stub().callsFake((fields) => {
        return Promise.resolve(getHotelData());
      }),
      updateAvailability: sinon.stub().callsFake(() => {
        return Promise.resolve();
      }),
      checkAdmissibility: sinon.stub().callsFake(() => {
        return Promise.resolve();
      }),
    };
    mailer = {
      sendMail: sinon.stub().resolves(true),
    };
    mailerService.set(mailer);
    adapter.set(wtAdapter);
  });

  beforeEach(() => {
    wtAdapter.updateAvailability.resetHistory();
    wtAdapter.checkAdmissibility.resetHistory();
    mailer.sendMail.resetHistory();
  });

  after(() => {
    server.close();
    adapter.set(wtAdapterOrig);
    mailerService.set(mailerOrig);
  });

  describe('POST /booking', () => {
    it('should accept the booking, store it, perform the update and return a confirmation', (done) => {
      request(server)
        .post('/booking')
        .send(getHotelBooking(true))
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.deepEqual(wtAdapter.updateAvailability.args, [
              [
                [
                  {
                    'guestInfoIds': ['1'],
                    'id': 'single-room',
                  },
                  {
                    'guestInfoIds': ['2'],
                    'id': 'single-room',
                  },
                ],
                '2019-01-01', '2019-01-03',
              ],
            ]);
            assert.property(res.body, 'id');
            assert.propertyVal(res.body, 'status', Booking.STATUS.CONFIRMED);
            const booking = await Booking.get(res.body.id);
            assert.isDefined(booking);
            assert.propertyVal(booking, 'id', res.body.id);
            assert.propertyVal(booking, 'status', Booking.STATUS.CONFIRMED);
            assert.deepEqual(booking.rawData, {
              arrival: '2019-01-01',
              departure: '2019-01-03',
              rooms: ['single-room', 'single-room'],
            });
            done();
          } catch (err) {
            done(err);
          }
        });
    });

    it('should accept the booking, store it, perform the update and return a confirmation with pending state if configured', (done) => {
      const orig = config.defaultBookingState;
      config.defaultBookingState = Booking.STATUS.PENDING;
      request(server)
        .post('/booking')
        .send(getHotelBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.deepEqual(wtAdapter.updateAvailability.args, [
              [
                [
                  {
                    'guestInfoIds': ['1'],
                    'id': 'single-room',
                  },
                  {
                    'guestInfoIds': ['2'],
                    'id': 'single-room',
                  },
                ],
                '2019-01-01', '2019-01-03',
              ],
            ]);
            assert.property(res.body, 'id');
            assert.propertyVal(res.body, 'status', Booking.STATUS.PENDING);
            const booking = await Booking.get(res.body.id);
            assert.isDefined(booking);
            assert.propertyVal(booking, 'id', res.body.id);
            assert.propertyVal(booking, 'status', Booking.STATUS.PENDING);
            config.defaultBookingState = orig;
            done();
          } catch (err) {
            config.defaultBookingState = orig;
            done(err);
          }
        });
    });

    it('should not do an update if configured', (done) => {
      const orig = config.updateAvailability;
      config.updateAvailability = false;
      request(server)
        .post('/booking')
        .send(getHotelBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.equal(wtAdapter.updateAvailability.callCount, 0);
            config.updateAvailability = orig;
            done();
          } catch (err) {
            config.updateAvailability = orig;
            done(err);
          }
        });
    });

    it('should send email to hotel if configured', (done) => {
      const origMailerOpts = config.mailerOpts;
      const origMailing = config.mailing;
      config.mailerOpts = { provider: 'dummy' };
      config.mailing = {
        sendSupplier: true,
        supplierAddress: 'hotel@example.com',
      };
      request(server)
        .post('/booking')
        .send(getHotelBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.equal(mailer.sendMail.callCount, 1);
            assert.equal(mailer.sendMail.firstCall.args[0].to, 'hotel@example.com');
            config.mailerOpts = origMailerOpts;
            config.mailing = origMailing;
            done();
          } catch (err) {
            config.mailerOpts = origMailerOpts;
            config.mailing = origMailing;
            done(err);
          }
        });
    });

    it('should send email to customer if configured', (done) => {
      const origMailerOpts = config.mailerOpts;
      const origMailing = config.mailing;
      config.mailerOpts = { provider: 'dummy' };
      config.mailing = {
        sendCustomer: true,
      };
      request(server)
        .post('/booking')
        .send(getHotelBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.equal(mailer.sendMail.callCount, 1);
            assert.equal(mailer.sendMail.firstCall.args[0].to, 'sherlock.holmes@houndofthebaskervilles.net');
            config.mailerOpts = origMailerOpts;
            config.mailing = origMailing;
            done();
          } catch (err) {
            config.mailerOpts = origMailerOpts;
            config.mailing = origMailing;
            done(err);
          }
        });
    });

    it('should send email to hotel and customer if configured', (done) => {
      const origMailerOpts = config.mailerOpts;
      const origMailing = config.mailing;
      config.mailerOpts = { provider: 'dummy' };
      config.mailing = {
        sendCustomer: true,
        sendSupplier: true,
        supplierAddress: 'hotel@example.com',
      };
      request(server)
        .post('/booking')
        .send(getHotelBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.equal(mailer.sendMail.callCount, 2);
            assert.equal(mailer.sendMail.firstCall.args[0].to, 'hotel@example.com');
            assert.equal(mailer.sendMail.secondCall.args[0].to, 'sherlock.holmes@houndofthebaskervilles.net');
            config.mailerOpts = origMailerOpts;
            config.mailing = origMailing;
            done();
          } catch (err) {
            config.mailerOpts = origMailerOpts;
            config.mailing = origMailing;
            done(err);
          }
        });
    });

    it('should return 200 if the customer has both e-mail and phone', (done) => {
      const booking = getHotelBooking();
      booking.customer.phone = '+420777777777';
      booking.customer.email = 'sherlock.holmes@houndofthebaskervilles.net';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(200)
        .end(done);
    });

    it('should return 422 if neither e-mail nor phone are supplied', (done) => {
      const booking = getHotelBooking();
      delete booking.customer.phone;
      delete booking.customer.email;
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if non-string phone is supplied', (done) => {
      const booking = getHotelBooking();
      booking.customer.phone = {};
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if e-mail is invalid', (done) => {
      const booking = getHotelBooking();
      booking.customer.email = 'huh';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if phone is invalid', (done) => {
      const booking = getHotelBooking();
      booking.customer.phone = 'bababaphone';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if unknown attributes are encountered', (done) => {
      request(server)
        .post('/booking')
        .send(Object.assign({ dummy: 'dummy' }, getHotelBooking()))
        .expect(422)
        .end(done);
    });

    it('should return 422 if an unexpected hotelId is used', (done) => {
      request(server)
        .post('/booking')
        .send(Object.assign({}, getHotelBooking(), { hotelId: 'unexpected' }))
        .expect(422)
        .end(done);
    });

    it('should return 422 if cancellationFees are empty', (done) => {
      const booking = getHotelBooking();
      booking.pricing.cancellationFees = [];
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if cancellationFees are malformed', (done) => {
      const booking = getHotelBooking();
      booking.pricing.cancellationFees = [{}];
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 when the price is not right', (done) => {
      const booking = getHotelBooking();
      const orig = wtAdapter.checkAdmissibility;
      wtAdapter.checkAdmissibility = sinon.stub().callsFake(() => {
        return Promise.reject(new adapter.InvalidPriceError());
      });
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end((err) => {
          wtAdapter.checkAdmissibility = orig;
          done(err);
        });
    });

    it('should return 422 when the note is too long', (done) => {
      const booking = getHotelBooking();
      booking.note = 'a'.repeat(3001);
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 when arrival is after departure', (done) => {
      const booking = getHotelBooking();
      booking.booking.arrival = '2019-03-01';
      booking.booking.departure = '2019-02-01';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 when arrival is the same as departure', (done) => {
      const booking = getHotelBooking();
      booking.booking.arrival = '2019-03-01';
      booking.booking.departure = '2019-03-01';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 when room is not available', (done) => {
      const booking = getHotelBooking();
      const orig = wtAdapter.checkAdmissibility;
      wtAdapter.checkAdmissibility = sinon.stub().callsFake(() => {
        return Promise.reject(new adapter.RoomUnavailableError('cannot go into room'));
      });
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end((err) => {
          wtAdapter.checkAdmissibility = orig;
          done(err);
        });
    });

    it('should return 409 when booking is not possible', (done) => {
      const booking = getHotelBooking();
      const orig = wtAdapter.updateAvailability;
      wtAdapter.updateAvailability = sinon.stub().callsFake(() => {
        return Promise.reject(new adapter.InvalidUpdateError());
      });
      request(server)
        .post('/booking')
        .send(booking)
        .expect(409)
        .end((err) => {
          wtAdapter.updateAvailability = orig;
          done(err);
        });
    });

    it('should return 502 when upstream error is encountered', (done) => {
      const booking = getHotelBooking();
      const orig = wtAdapter.updateAvailability;
      wtAdapter.updateAvailability = sinon.stub().callsFake(() => {
        return Promise.reject(new adapter.UpstreamError());
      });
      request(server)
        .post('/booking')
        .send(booking)
        .expect(502)
        .end((err) => {
          wtAdapter.updateAvailability = orig;
          done(err);
        });
    });

    it('should return 503 when upstream error with retry-after is encountered', (done) => {
      const booking = getHotelBooking();
      const orig = wtAdapter.updateAvailability;
      wtAdapter.updateAvailability = sinon.stub().callsFake(() => {
        const err = new adapter.UpstreamError();
        err.headers = {
          'retry-after': 20,
        };
        return Promise.reject(err);
      });
      request(server)
        .post('/booking')
        .send(booking)
        .expect(503)
        .end((err) => {
          wtAdapter.updateAvailability = orig;
          done(err);
        });
    });
  });

  describe('DELETE /booking/:id', () => {
    it('should mark an existing booking as cancelled and restore the availability', (done) => {
      Booking.create({
        arrival: '2019-01-01',
        departure: '2019-01-03',
        rooms: ['single-room', 'single-room'],
      }, Booking.STATUS.CONFIRMED).then((booking) => {
        request(server)
          .delete(`/booking/${booking.id}`)
          .expect(204)
          .end(async (err, res) => {
            if (err) return done(err);
            try {
              booking = await Booking.get(booking.id);
              assert.equal(booking.status, Booking.STATUS.CANCELLED);
              assert.deepEqual(wtAdapter.updateAvailability.args, [
                [['single-room', 'single-room'], '2019-01-01', '2019-01-03', true],
              ]);
              done();
            } catch (err) {
              done(err);
            }
          });
      }).catch(done);
    });

    it('should return 409 if the booking has already been cancelled', (done) => {
      Booking.create({ data: 'dummy' }, Booking.STATUS.CANCELLED).then((booking) => {
        request(server)
          .delete(`/booking/${booking.id}`)
          .expect(409, done);
      }).catch(done);
    });

    it('should return 404 if the booking does not exist', (done) => {
      request(server)
        .delete('/booking/nonexistent')
        .expect(404, done);
    });

    it('should return 403 if booking cancellation is disallowed', (done) => {
      const orig = config.allowCancel;
      config.allowCancel = false;
      Booking.create({ data: 'dummy' }, Booking.STATUS.CONFIRMED).then((booking) => {
        request(server)
          .delete(`/booking/${booking.id}`)
          .expect(403)
          .end((err) => {
            config.allowCancel = orig;
            done(err);
          });
      }).catch((err) => {
        config.allowCancel = orig;
        done(err);
      });
    });
  });
});
