/* eslint-env mocha */
/* eslint-disable promise/no-callback-in-promise */
const { AIRLINE_SEGMENT_ID, WT_HEADER_SIGNATURE, WT_HEADER_ORIGIN_ADDRESS } = require('../../src/constants');
const { assert } = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const TrustClueClient = require('@windingtree/wt-js-libs').TrustClueClient;

const { initSegment } = require('../../src/config');
let config;
const { getAirlineBooking, getAirlineData, getFlightInstanceData, getWallet } = require('../utils/factories');
const signing = require('../../src/services/signing');
const mailerService = require('../../src/services/mailer');
const adapter = require('../../src/services/adapters/base-adapter');
const Booking = require('../../src/models/booking');
const validator = require('../../src/services/validators/index');
const trustClueOptions = require('../utils/trust-clue-options').trustClueOptions;

// TODO improve test structure, add tests on cancellation, implement for hotels, add docs

describe('controllers - airline booking', function () {
  let server, wtAdapterOrig, wtAdapter,
    mailerOrig, mailer, allowUnsignedOrig;

  before(async () => {
    process.env.WT_SEGMENT = AIRLINE_SEGMENT_ID;
    config = initSegment();
    server = require('../../src/index');
    validator.initialize(config);
    wtAdapterOrig = adapter.get();
    mailerOrig = mailerService.get();
    wtAdapter = {
      getSupplierData: sinon.stub().callsFake((fields) => {
        return Promise.resolve(getAirlineData());
      }),
      updateAvailability: sinon.stub().callsFake(() => {
        return Promise.resolve();
      }),
      checkAdmissibility: sinon.stub().callsFake(() => {
        return Promise.resolve();
      }),
      getFlightInstanceData: sinon.stub().callsFake(() => {
        return Promise.resolve(getFlightInstanceData()[0]);
      }),
    };
    mailer = {
      sendMail: sinon.stub().resolves(true),
    };
    mailerService.set(mailer);
    adapter.set(wtAdapter);
    allowUnsignedOrig = config.allowUnsignedBookingRequests;
    config.allowUnsignedBookingRequests = true;
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
    config.allowUnsignedBookingRequests = allowUnsignedOrig;
  });

  describe('POST /booking', () => {
    it('should accept the booking, store it, perform the update and return a confirmation', (done) => {
      const orig = config;
      config.defaultBookingState = 'confirmed';
      config.updateAvailability = true;
      request(server)
        .post('/booking')
        .send(getAirlineBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.deepEqual(wtAdapter.updateAvailability.args, [
              [
                getAirlineBooking().booking.flightInstanceId,
                getAirlineBooking(),
              ],
            ]);
            assert.property(res.body, 'id');
            assert.propertyVal(res.body, 'status', Booking.STATUS.CONFIRMED);
            const booking = await Booking.get(res.body.id);
            assert.isDefined(booking);
            assert.propertyVal(booking, 'id', res.body.id);
            assert.propertyVal(booking, 'status', Booking.STATUS.CONFIRMED);
            assert.deepEqual(booking.rawData, {
              origin: 'Fanciest OTA',
              airline: '0xe92a8f9a7264695f4aed8d1f397dbc687ba40299',
              pricing: {
                cancellationFees: [
                  {
                    amount: 50,
                    from: '2018-12-01',
                    to: '2019-01-01',
                  },
                ],
                currency: 'GBP',
                total: 221,
              },
              booking: {
                flightInstanceId: 'IeKeix6G-1',
                flightNumber: 'OK0965',
                bookingClasses: [
                  {
                    bookingClassId: 'business',
                    passengerCount: 1,
                  },
                  {
                    bookingClassId: 'economy',
                    passengerCount: 1,
                  },
                ],
              },
            });
            config = orig;
            done();
          } catch (err) {
            config = orig;
            done(err);
          }
        });
    });

    it('should accept the booking, store it, perform the update and return a confirmation with pending state if configured', (done) => {
      const orig = config.defaultBookingState;
      config.defaultBookingState = Booking.STATUS.PENDING;
      request(server)
        .post('/booking')
        .send(getAirlineBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.deepEqual(wtAdapter.updateAvailability.args, [
              [
                getAirlineBooking().booking.flightInstanceId,
                getAirlineBooking(),
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
        .send(getAirlineBooking())
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

    it('should send email to airline if configured', (done) => {
      const origMailerOpts = config.mailerOpts;
      const origMailing = config.mailing;
      config.mailerOpts = { provider: 'dummy' };
      config.mailing = {
        sendSupplier: true,
        supplierAddress: 'airline@example.com',
      };
      request(server)
        .post('/booking')
        .send(getAirlineBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.equal(mailer.sendMail.callCount, 1);
            assert.equal(mailer.sendMail.firstCall.args[0].to, 'airline@example.com');
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
        .send(getAirlineBooking())
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

    it('should send email to airline and customer if configured', (done) => {
      const origMailerOpts = config.mailerOpts;
      const origMailing = config.mailing;
      config.mailerOpts = { provider: 'dummy' };
      config.mailing = {
        sendCustomer: true,
        sendSupplier: true,
        supplierAddress: 'airline@example.com',
      };
      request(server)
        .post('/booking')
        .send(getAirlineBooking())
        .expect(200)
        .expect('content-type', /application\/json/)
        .end(async (err, res) => {
          if (err) return done(err);
          try {
            assert.equal(mailer.sendMail.callCount, 2);
            assert.equal(mailer.sendMail.firstCall.args[0].to, 'airline@example.com');
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

    describe('trust clues, blacklist, whitelist', () => {
      let origClient, origTrustClueOptions, origSpam, origAllow;
      beforeEach(() => {
        wtAdapter.updateAvailability.resetHistory();
        wtAdapter.checkAdmissibility.resetHistory();
        mailer.sendMail.resetHistory();
        origClient = config.wtLibs.getTrustClueClient();
        origTrustClueOptions = config.wtLibsOptions.trustClueOptions;
        origSpam = config.spamProtectionOptions;
        origAllow = config.allowUnsignedBookingRequests;
        config.wtLibs.trustClueClient = TrustClueClient.createInstance(trustClueOptions);
        config.wtLibs.trustClueOptions = trustClueOptions;
        config.allowUnsignedBookingRequests = false;
      });
      afterEach(() => {
        config.wtLibs.trustClueClient = origClient;
        config.wtLibs.trustClueOptions = origTrustClueOptions;
        config.spamProtectionOptions = origSpam;
        config.allowUnsignedBookingRequests = origAllow;
      });

      it('should accept a booking by trusted party', () => {
        const wallet = getWallet();
        const airlineBooking = getAirlineBooking();
        airlineBooking.originAddress = wallet.address;

        request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(200);
      });

      it('should reject a booking by untrusted party', async () => {
        const airlineBooking = getAirlineBooking();
        config.allowUnsignedBookingRequests = true; // TODO

        return request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(403)
          .expect((res) => {
            assert.match(res.error.text, /Untrusted caller/i);
          });
      });

      it('should reject a booking by unknown party', async () => {
        const airlineBooking = getAirlineBooking();
        delete airlineBooking.originAddress;
        config.allowUnsignedBookingRequests = true; // TODO

        return request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(403)
          .expect((res) => {
            assert.match(res.error.text, /Unknown caller/i);
          });
      });

      it('should accept a booking by whitelisted party', () => {
        const wallet = getWallet();
        const airlineBooking = getAirlineBooking();
        airlineBooking.originAddress = wallet.address;
        config.spamProtectionOptions = {
          whitelist: [ wallet.address ],
          blacklist: [],
        };

        request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(200);
      });

      it('should accept a booking by unknown party based on trust clues', () => {
        const wallet = getWallet();
        const airlineBooking = getAirlineBooking();
        airlineBooking.originAddress = wallet.address;
        config.spamProtectionOptions = {
          whitelist: [ '0x04e46f24307e4961157b986a0b653a0d88f9dbd6' ],
          blacklist: [ '0x87265a62c60247f862b9149423061b36b460f4bb' ],
        };

        request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(200);
      });

      it('should reject a booking by unknown party based on trust clues', () => {
        // origTrustClient = config.wtLibs.getTrustClueClient();
        const rejectingTrustClueOptions = {
          provider: 'http://localhost:8545',
          clues: {
            'test-list': {
              create: async (options) => {
                return {
                  getMetadata: () => ({
                    name: 'test-list',
                    description: 'Test trust clue whitelist for 0x04e46f24307e4961157b986a0b653a0d88f9dbd6',
                  }),
                  getValueFor: (addr) => {
                    return addr === '0x04e46f24307e4961157b986a0b653a0d88f9dbd6';
                  },
                  interpretValueFor: (addr) => {
                    return addr === '0x04e46f24307e4961157b986a0b653a0d88f9dbd6';
                  },
                };
              },
            }
          }
        };
        config.wtLibs.options.trustClueOptions = rejectingTrustClueOptions;
        config.wtLibs.trustClueClient = TrustClueClient.createInstance(rejectingTrustClueOptions);
        const wallet = getWallet();
        const airlineBooking = getAirlineBooking();
        airlineBooking.originAddress = wallet.address;
        config.spamProtectionOptions = {
          whitelist: [ '0x04e46f24307e4961157b986a0b653a0d88f9dbd6' ],
          blacklist: [ '0x87265a62c60247f862b9149423061b36b460f4bb' ],
        };

        request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(403);
      });

      it('should reject a booking by blacklisted party', () => {
        const wallet = getWallet();
        const airlineBooking = getAirlineBooking();
        airlineBooking.originAddress = wallet.address;
        config.spamProtectionOptions = {
          whitelist: [],
          blacklist: [ wallet.address ],
        };

        request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(403);
      });

      it('should prioritize blacklist to whitelist', () => {
        const wallet = getWallet();
        const airlineBooking = getAirlineBooking();
        airlineBooking.originAddress = wallet.address;
        config.allowUnsignedBookingRequests = true; // TODO
        config.spamProtectionOptions = {
          whitelist: [ wallet.address ],
          blacklist: [ wallet.address ],
        };

        return request(server)
          .post('/booking')
          .send(airlineBooking)
          .expect(403);
      });
    });

    it('should return 200 if the customer has both e-mail and phone', (done) => {
      const booking = getAirlineBooking();
      booking.customer.phone = '+420777777777';
      booking.customer.email = 'sherlock.holmes@houndofthebaskervilles.net';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(200)
        .end(done);
    });

    it('should return 422 if neither e-mail nor phone are supplied', (done) => {
      const booking = getAirlineBooking();
      delete booking.customer.phone;
      delete booking.customer.email;
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if e-mail is invalid', (done) => {
      const booking = getAirlineBooking();
      booking.customer.email = 'huh';
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 if phone is invalid', (done) => {
      const booking = getAirlineBooking();
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
        .send(Object.assign({ dummy: 'dummy' }, getAirlineBooking()))
        .expect(422)
        .end(done);
    });

    it('should return 422 if an unexpected airlineId is used', (done) => {
      request(server)
        .post('/booking')
        .send(Object.assign({}, getAirlineBooking(), { airlineId: 'unexpected' }))
        .expect(422)
        .end(done);
    });

    it('should return 422 when the price is not right', (done) => {
      const booking = getAirlineBooking();
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
      const booking = getAirlineBooking();
      booking.note = 'a'.repeat(3001);
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 when the flight number is too short', (done) => {
      const booking = getAirlineBooking();
      booking.booking.flightNumber = 'a'.repeat(2);
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 when the flight number is too long', (done) => {
      const booking = getAirlineBooking();
      booking.booking.flightNumber = 'a'.repeat(8);
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 422 when the flight id is too long', (done) => {
      const booking = getAirlineBooking();
      booking.booking.flightInstanceId = 'a'.repeat(256);
      request(server)
        .post('/booking')
        .send(booking)
        .expect(422)
        .end(done);
    });

    it('should return 409 when booking is not possible', (done) => {
      const booking = getAirlineBooking();
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
      const booking = getAirlineBooking();
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
      const booking = getAirlineBooking();
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

    it('should accept a signed booking', async () => {
      const wallet = getWallet();
      const airlineBooking = getAirlineBooking();
      airlineBooking.originAddress = wallet.address;
      let serializedData = JSON.stringify(airlineBooking);
      let signature = await signing.signData(serializedData, wallet);

      return request(server)
        .post('/booking')
        .set(WT_HEADER_SIGNATURE, signature)
        .set('content-type', 'application/json')
        .send(serializedData)
        .expect(200);
    });

    it('should reject a booking signed by other than originAddress', async () => {
      const wallet = getWallet();
      const airlineBooking = getAirlineBooking();
      airlineBooking.originAddress = '0x04e46f24307e4961157b986a0b653a0d88f9dbd6';
      let serializedData = JSON.stringify(airlineBooking);
      let signature = await signing.signData(serializedData, wallet);

      return request(server)
        .post('/booking')
        .set(WT_HEADER_SIGNATURE, signature)
        .set('content-type', 'application/json')
        .send(serializedData)
        .expect(400)
        .then((err, res) => {
          assert.equal(err.body.long, 'Request signature verification failed: incorrect origin address or tampered body');
        });
    });

    it('should reject a booking with tampered body', async () => {
      const wallet = getWallet();
      const airlineBooking = getAirlineBooking();
      airlineBooking.originAddress = wallet.address;
      let signature = await signing.signData(JSON.stringify(airlineBooking), wallet);

      airlineBooking.pricing.total = 1;

      return request(server)
        .post('/booking')
        .set(WT_HEADER_SIGNATURE, signature)
        .set('content-type', 'application/json')
        .send(JSON.stringify(airlineBooking))
        .expect(400)
        .then((err, res) => {
          assert.equal(err.body.long, 'Request signature verification failed: incorrect origin address or tampered body');
        });
    });

    it('should reject an unsigned booking when configured to', (done) => {
      const orig = config.allowUnsignedBookingRequests;
      config.allowUnsignedBookingRequests = false;
      request(server)
        .post('/booking')
        .send(getAirlineBooking())
        .expect(400)
        .then((err, res) => {
          assert.equal(err.body.long, 'API doesn\'t accept unsigned booking requests.');
          config.allowUnsignedBookingRequests = orig;
          done();
        })
        .catch(err => {
          config.allowUnsignedBookingRequests = orig;
          done(err);
        });
    });
  });

  describe('DELETE /booking/:id', () => {
    it('should mark an existing booking as cancelled and restore the availability', (done) => {
      const bookingRaw = {
        flightInstanceId: 'IeKeix6G-1',
        flightNumber: 'OK0965',
        bookingClasses: [ { bookingClassId: 'economy', passengerCount: 2 } ],
      };
      config.wtLibsOptions.trustClueOptions = {};
      Booking.create(bookingRaw, Booking.STATUS.CONFIRMED).then((booking) => {
        request(server)
          .delete(`/booking/${booking.id}`)
          .expect(204)
          .end(async (err, res) => {
            if (err) return done(err);
            try {
              booking = await Booking.get(booking.id);
              assert.equal(booking.status, Booking.STATUS.CANCELLED);
              assert.deepEqual(wtAdapter.updateAvailability.args, [
                [
                  bookingRaw.flightInstanceId,
                  bookingRaw,
                  true,
                ],
              ]);
              done();
            } catch (err) {
              done(err);
            }
          });
      }).catch(done);
    });

    describe('DELETE /booking/:id signed', () => {
      let bookingId;

      beforeEach(async () => {
        let booking = await Booking.create(getAirlineBooking(), Booking.STATUS.CONFIRMED);
        bookingId = booking.id;
      });

      it('should accept a signed booking cancellation', async () => {
        const wallet = getWallet();
        let uri = `/booking/${bookingId}`;
        let signature = await signing.signData(uri, wallet);

        return request(server)
          .delete(uri)
          .set(WT_HEADER_SIGNATURE, signature)
          .set(WT_HEADER_ORIGIN_ADDRESS, wallet.address)
          .expect(204);
      });

      it('should reject a booking cancellation signed by other than originAddress', async () => {
        const wallet = getWallet();
        let uri = `/booking/${bookingId}`;
        let signature = await signing.signData(uri, wallet);

        return request(server)
          .delete(uri)
          .set(WT_HEADER_SIGNATURE, signature)
          .set(WT_HEADER_ORIGIN_ADDRESS, '0x04e46f24307e4961157b986a0b653a0d88f9dbd6')
          .expect(400)
          .then((err, res) => {
            assert.equal(err.body.long, 'Request signature verification failed: incorrect origin address or tampered body');
          });
      });

      it('should reject a booking cancellation with tampered body', async () => {
        const wallet = getWallet();
        let signature = await signing.signData(`/booking/${bookingId + 1}`, wallet);

        return request(server)
          .delete(`/booking/${bookingId}`)
          .set(WT_HEADER_SIGNATURE, signature)
          .set(WT_HEADER_ORIGIN_ADDRESS, wallet.address)
          .expect(400)
          .then((err, res) => {
            assert.equal(err.body.long, 'Request signature verification failed: incorrect origin address or tampered body');
          });
      });

      it('should reject an unsigned booking cancellation when configured to', (done) => {
        const orig = config.allowUnsignedBookingRequests;
        config.allowUnsignedBookingRequests = false;

        request(server)
          .delete(`/booking/${bookingId}`)
          .expect(400)
          .then((err, res) => {
            assert.equal(err.body.long, 'API doesn\'t accept unsigned booking requests.');
            config.allowUnsignedBookingRequests = orig;
            done();
          })
          .catch(err => {
            config.allowUnsignedBookingRequests = orig;
            done(err);
          });
      });
    });

    it('should return 409 if the booking has already been cancelled', (done) => {
        // config.allowUnsignedBookingRequests = true; // TODO
      config.wtLibsOptions.trustClueOptions = {};
      Booking.create({ data: 'dummy' }, Booking.STATUS.CANCELLED).then((booking) => {
        request(server)
          .delete(`/booking/${booking.id}`)
          .expect(409, done);
      }).catch(done);
    });

    it('should return 404 if the booking does not exist', (done) => {
        // config.allowUnsignedBookingRequests = true; // TODO
      config.wtLibsOptions.trustClueOptions = {};
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

    describe('trust clues', () => {
      let orig, bookingId;

      beforeEach(async () => {
        let booking = await Booking.create(getAirlineBooking(), Booking.STATUS.CONFIRMED);
        bookingId = booking.id;
        orig = config.wtLibs.getTrustClueClient();
        config.wtLibs.trustClueClient = TrustClueClient.createInstance(trustClueOptions);
      });
      afterEach(() => {
        config.wtLibs.trustClueClient = orig;
      });

    //   it('should accept a cancellation by trusted party', async () => {
    //     return request(server)
    //       .delete(`/booking/${bookingId}`)
    //       .expect(204);
    //   });
    //
    //   it('should reject a cancellation by untrusted party', async () => {
    //     return request(server)
    //       .delete(`/booking/${bookingId}`)
    //       .expect(403)
    //       .expect((res) => {
    //         assert.match(res.error.text, /Untrusted caller/i);
    //       });
    //   });
    //
    //   it('should reject a cancellation by unknown party', async () => {
    //     return request(server)
    //       .delete(`/booking/${bookingId}`)
    //       .expect(403)
    //       .expect((res) => {
    //         assert.match(res.error.text, /Unknown caller/i);
    //       });
    //   });
    });

    describe('whitelist and blacklist', () => {
      let orig, origTrustClient;
      beforeEach(() => {
        orig = config.spamProtectionOptions;
      });
      afterEach(() => {
        config.spamProtectionOptions = orig;
      });

      it('should accept a cancellation by whitelisted party', async () => {

      });
    });
  });
});
