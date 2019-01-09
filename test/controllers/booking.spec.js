/* eslint-env mocha */
/* eslint-disable promise/no-callback-in-promise */
const { assert } = require('chai');
const request = require('supertest');
const sinon = require('sinon');

const config = require('../../src/config');
const { getBooking } = require('../utils/factories');
const adapter = require('../../src/services/adapter');
const Booking = require('../../src/models/booking');

describe('controllers - booking', function () {
  let server, wtAdapterOrig, wtAdapter;

  before(async () => {
    server = require('../../src/index');
    wtAdapterOrig = adapter.get();
    wtAdapter = {
      updateAvailability: sinon.stub().callsFake((rooms, arrival, departure) => {
        if (arrival === 'UpstreamError') {
          return Promise.reject(new adapter.UpstreamError());
        }
        if (arrival === 'InvalidUpdateError') {
          return Promise.reject(new adapter.InvalidUpdateError());
        }
        return Promise.resolve();
      }),
      checkAdmissibility: sinon.stub().callsFake((booking) => {
        if (booking.arrival === 'InvalidPriceError') {
          return Promise.reject(new adapter.InvalidPriceError());
        }
        return Promise.resolve();
      }),
    };
    adapter.set(wtAdapter);
  });

  after(() => {
    server.close();
    adapter.set(wtAdapterOrig);
  });

  describe('POST /booking', () => {
    it('should accept the booking, store it, perform the update and return a confirmation', (done) => {
      wtAdapter.updateAvailability.resetHistory();
      request(server)
        .post('/booking')
        .send(getBooking())
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
            assert.property(res.body, 'status');
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

    it('should return 200 if the customer has both e-mail and phone', (done) => {
      const booking = getBooking();
      booking.customer.phone = '+420777777777';
      booking.customer.email = 'sherlock.holmes@houndofthebaskervilles.net';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(200)
        .end(done);
    });

    it('should return 422 if neither e-mail nor phone are supplied', (done) => {
      const booking = getBooking();
      delete booking.customer.phone;
      delete booking.customer.email;
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if e-mail is invalid', (done) => {
      const booking = getBooking();
      booking.customer.email = 'huh';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if unknown attributes are encountered', (done) => {
      request(server)
        .post('/booking')
        .send(Object.assign({ dummy: 'dummy' }, getBooking()))
        .expect(422)
        .end(done);
    });

    it('should return 422 if an unexpected hotelId is used', (done) => {
      request(server)
        .post('/booking')
        .send(Object.assign({}, getBooking(), { hotelId: 'unexpected' }))
        .expect(422)
        .end(done);
    });

    it('should return 422 when the price is not right', (done) => {
      const booking = getBooking();
      booking.booking.arrival = 'InvalidPriceError';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 409 when booking is not possible', (done) => {
      const booking = getBooking();
      booking.booking.arrival = 'InvalidUpdateError';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(409)
        .end(done);
    });

    it('should return 502 when upstream error is encountered', (done) => {
      const booking = getBooking();
      booking.booking.arrival = 'UpstreamError';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(502)
        .end(done);
    });
  });

  describe('DELETE /booking/:id', () => {
    it('should mark an existing booking as cancelled and restore the availability', (done) => {
      wtAdapter.updateAvailability.resetHistory();
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
