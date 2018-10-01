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

  describe('POST /book', () => {
    it('should accept the booking and return a confirmation', (done) => {
      request(server)
        .post('/book')
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

    it('should return 422 if unknown attributes are encountered', (done) => {
      request(server)
        .post('/book')
        .send(Object.assign({ dummy: 'dummy' }, getBooking()))
        .expect(422)
        .end(done);
    });
  });
});
