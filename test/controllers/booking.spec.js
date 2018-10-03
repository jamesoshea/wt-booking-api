/* eslint-env mocha */
const { assert } = require('chai');
const request = require('supertest');

const { getBooking } = require('../utils/factories');

describe('controllers - booking', function () {
  let server;

  before(async () => {
    server = require('../../src/index');
  });

  after(() => {
    server.close();
  });

  describe('POST /booking', () => {
    it('should accept the booking and return a confirmation', (done) => {
      request(server)
        .post('/booking')
        .send(getBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
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
  });
});
