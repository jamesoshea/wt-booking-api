/* eslint-env mocha */
const { assert } = require('chai');
const request = require('supertest');
const sinon = require('sinon');

const { getBooking } = require('../utils/factories');
const adapter = require('../../src/services/adapter');

describe('controllers - booking', function () {
  let server, wtAdapterOrig, wtAdapter;

  before(async () => {
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
    };
    adapter.set(wtAdapter);
    server = require('../../src/index');
  });

  after(() => {
    adapter.set(wtAdapterOrig);
    server.close();
  });

  describe('POST /booking', () => {
    it('should accept the booking, perform the update and return a confirmation', (done) => {
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
              [['single-room', 'single-room'], '2019-01-01', '2019-01-03'],
            ]);
            assert.deepEqual(res.body, {});
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

    it('should return 422 if neither e-mail nore phone are supplied', (done) => {
      const booking = getBooking();
      delete booking.customer.phone;
      delete booking.customer.email;
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
});
