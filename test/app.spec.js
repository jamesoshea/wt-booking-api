/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const request = require('supertest');

const { db } = require('../src/config');
const { resetDB } = require('../src/db');

// Global "before" hook - runs before all tests.
before(async () => {
  await resetDB();
});

// Global "after" hook - runs after all tests.
// (Without it, the test suite won't return.)
after(async () => {
  await db.destroy();
});

describe('API', function () {
  let server;
  before(() => {
    server = require('../src/index');
  });
  after(() => {
    server.close();
  });

  describe('GET /', () => {
    it('should return basic information', async () => {
      await request(server)
        .get('/')
        .expect(200)
        .expect('content-type', /json/i)
        .expect((res) => {
          expect(res.body).to.have.property('docs');
          expect(res.body).to.have.property('info');
          expect(res.body).to.have.property('version');
          expect(res.body).to.have.property('config');
        });
    });

    it('should not panic upon malformed json data', async () => {
      await request(server)
        .get('/')
        .send('sdndslsl')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should properly implement CORS to be usable from anywhere', async () => {
      await request(server)
        .get('/')
        .set('Content-Type', 'application/json')
        .expect('Access-Control-Allow-Origin', '*');
    });
  });

  describe('GET /unknown-endpoint', () => {
    it('should return 404', async () => {
      await request(server)
        .get('/random-endpoint')
        .expect(404)
        .expect('content-type', /json/i)
        .expect((res) => {
          expect(res.body).to.have.property('code', '#notFound');
          expect(res.body).to.have.property('short');
          expect(res.body).to.have.property('long');
        });
    });
  });
});
