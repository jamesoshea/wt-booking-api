/* eslint-env mocha */
/* eslint-disable standard/object-curly-even-spacing */
const { assert } = require('chai');
const sinon = require('sinon');
let { initSegment } = require('../../../src/config');

const adapter = require('../../../src/services/adapters/base-adapter');
const { getFlightInstanceData, getAirlineBooking } = require('../../utils/factories');
const { WTAirlineAdapter } = require('../../../src/services/adapters/airline-adapter');
const { ValidationError } = require('../../../src/services/validators');

function _getAdapter () {
  return new WTAirlineAdapter({
    supplierId: 'supplierId',
    readApiUrl: 'http://readApiUrl',
    writeApiUrl: 'http://writeApiUrl',
    writeApiAccessKey: 'writeApiAccessKey',
    writeApiWalletPassword: 'writeApiWalletPassword',
  });
}

describe('services - airline adapter', function () {
  const flightInstanceData = getFlightInstanceData();

  before(() => {
    process.env.WT_SEGMENT = 'airlines';
    initSegment();
  });

  describe('WTAirlineAdapter._applyUpdate', () => {
    const wtAdapter = _getAdapter();
    let flightInstances, flightBooking;

    beforeEach(() => {
      flightInstances = [
        {
          id: 'IeKeix6G-1',
          bookingClasses: [
            { id: 'economy', availabilityCount: 100 },
            { id: 'business', availabilityCount: 20 },
          ],
        }, {
          id: 'IeKeix6G-2',
          bookingClasses: [
            { id: 'economy', availabilityCount: 1 },
            { id: 'business', availabilityCount: 1 },
          ],
        },
      ];
      flightBooking = {
        booking: {
          flightInstanceId: 'IeKeix6G-1',
          bookingClasses: [
            {
              bookingClassId: 'business',
              passengers: [ { } ],
            },
            {
              bookingClassId: 'economy',
              passengers: [ { }, { } ],
            },
          ],
        },
      };
    });

    it('should apply the requested update', async () => {
      wtAdapter._applyUpdate(flightInstances[0], flightBooking);
      assert.deepEqual(flightInstances[0], {
        id: 'IeKeix6G-1',
        bookingClasses: [
          { id: 'economy', availabilityCount: 98 },
          { id: 'business', availabilityCount: 19 },
        ],
      });
    });

    it('should restore availability instead of reducing it if requested', async () => {
      wtAdapter._applyUpdate(flightInstances[0], flightBooking, true);
      assert.deepEqual(flightInstances[0], {
        id: 'IeKeix6G-1',
        bookingClasses: [
          { id: 'economy', availabilityCount: 102 },
          { id: 'business', availabilityCount: 21 },
        ],
      });
    });

    it('should throw InvalidUpdateError upon unknown flightInstanceId', async () => {
      assert.throws(() => {
        flightBooking.booking.flightInstanceId = 'unknownflightInstanceId';
        wtAdapter._applyUpdate(flightInstances[0], flightBooking);
      }, adapter.InvalidUpdateError);
    });

    it('should throw InvalidUpdateError upon unknown booking class', async () => {
      assert.throws(() => {
        flightBooking.booking.bookingClasses[0].bookingClassId = 'unknownClass';
        wtAdapter._applyUpdate(flightInstances[0], flightBooking);
      }, adapter.InvalidUpdateError);
    });

    it('should throw InvalidUpdateError upon overbooking', async () => {
      assert.throws(() => {
        wtAdapter._applyUpdate(flightInstances[1], flightBooking);
      }, adapter.InvalidUpdateError);
    });
  });

  describe('WTAirlineAdapter._checkRestrictions', () => {
    const wtAdapter = _getAdapter();

    // it('should throw when the xxx restriction is violated', async () => { // no restrictions for airlines atm
    //   assert.throws(() => {
    //     wtAdapter._checkRestrictions(getFlightInstanceData()[0], getAirlineBooking());
    //   }, adapter.RestrictionsViolatedError);
    // });

    it('should not throw if no restrictions are violated', async () => {
      wtAdapter._checkRestrictions(getFlightInstanceData()[0], getAirlineBooking());
    });
  });

  describe('WTAirlineAdapter._checkAvailability', () => {
    const wtAdapter = _getAdapter();
    it('should throw when the flight is not available', async () => {
      assert.throws(() => {
        wtAdapter._checkAvailability({
          id: 'IeKeix6G-1',
          bookingClasses: [
            { id: 'economy', availabilityCount: 1 },
            { id: 'business', availabilityCount: 1 },
          ],
        },
        {
          booking: {
            flightInstanceId: 'IeKeix6G-1',
            bookingClasses: [
              {
                bookingClassId: 'business',
                passengers: [{}],
              },
              {
                bookingClassId: 'economy',
                passengers: [{}, {}],
              },
            ],
          },
        });
      }, adapter.FlightUnavailableError);
    });

    it('should throw when the flight availability is undefined', async () => {
      assert.throws(() => {
        wtAdapter._checkAvailability({ flightInstanceId: 'IeKeix6G-2', bookingClasses: [] },
          {
            booking: {
              flightInstanceId: 'IeKeix6G-2',
              bookingClasses: [
                {
                  bookingClassId: 'business',
                  passengers: [{}],
                },
              ],
            },
          });
      }, adapter.FlightUnavailableError);
    });

    it('should not throw if flight is available', async () => {
      wtAdapter._checkAvailability({
        id: 'IeKeix6G-3',
        bookingClasses: [
          { id: 'economy', availabilityCount: 2 },
          { id: 'business', availabilityCount: 1 },
        ],
      },
      {
        booking: {
          flightInstanceId: 'IeKeix6G-3',
          bookingClasses: [
            {
              bookingClassId: 'business',
              passengers: [{}],
            },
            {
              bookingClassId: 'economy',
              passengers: [{}, {}],
            },
          ],
        },
      });
    });
  });

  describe('WTAirlineAdapter.updateAvailability', () => {
    let wtAdapter, bookingData;

    beforeEach(async () => {
      wtAdapter = _getAdapter();
      wtAdapter.__flightInstance = {
        id: 'IeKeix6G-1',
        bookingClasses: [
          { id: 'economy', availabilityCount: 100 },
          { id: 'business', availabilityCount: 20 },
        ],
      };
      bookingData = {
        booking: {
          flightInstanceId: 'IeKeix6G-1',
          bookingClasses: [
            {
              bookingClassId: 'business',
              passengers: [ { } ],
            },
            {
              bookingClassId: 'economy',
              passengers: [ { }, { } ],
            },
          ],
        },
      };
      sinon.stub(wtAdapter, 'getFlightInstanceData').callsFake((flightInstanceId) => {
        if (flightInstanceId === 'IeKeix6G-error') {
          throw new Error('Failed update');
        }
        return Promise.resolve(wtAdapter.__flightInstance);
      });
      // sinon.stub(wtAdapter, '_applyUpdate').callsFake((flightInstance, flightBooking, restore) => {
      //   if (flightInstance === 'fail') {
      //     throw new Error('Failed update');
      //   }
      //   flightInstance.bookingClasses[0].availabilityCount += (restore ? 1 : -1);
      // });
      sinon.stub(wtAdapter, '_setAvailability').callsFake((flightInstance, flightInstanceId) => {
        wtAdapter.__flightInstance = flightInstance;
        return Promise.resolve();
      });
    });

    it('should update the availability', async () => {
      assert.equal(wtAdapter.__flightInstance.bookingClasses[0].availabilityCount, 100);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[1].availabilityCount, 20);
      await wtAdapter.updateAvailability('IeKeix6G-1', bookingData);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[0].availabilityCount, 98);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[1].availabilityCount, 19);
    });

    it('should restore the availability if requested', async () => {
      assert.equal(wtAdapter.__flightInstance.bookingClasses[0].availabilityCount, 100);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[1].availabilityCount, 20);
      await wtAdapter.updateAvailability('IeKeix6G-1', bookingData, true);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[0].availabilityCount, 102);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[1].availabilityCount, 21);
    });

    it('should serialize updates', async () => {
      await Promise.all([
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
      ]);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[0].availabilityCount, 90);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[1].availabilityCount, 15);
    });

    it('should handle single failures', async () => {
      await Promise.all([
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
        wtAdapter.updateAvailability('IeKeix6G-error', bookingData).catch(() => {}),
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
        wtAdapter.updateAvailability('IeKeix6G-1', bookingData),
      ]);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[0].availabilityCount, 92);
      assert.equal(wtAdapter.__flightInstance.bookingClasses[1].availabilityCount, 16);
    });
  });

  describe('WTAirlineAdapter._checkCancellationFees', () => {
    const wtAdapter = _getAdapter(),
      description = {
        defaultCancellationAmount: 20,
        cancellationPolicies: [
          // Some parts are commented-out; some cancellation
          // policies are intentionally not "in-order" to test
          // robustness.
          { from: '2018-01-01', to: '2018-12-31', amount: 29, deadline: 86 },
          { /* from: '2018-01-01', */ to: '2018-12-31', amount: 49, deadline: 51 },
          { from: '2018-01-01', to: '2018-12-31', amount: 74, deadline: 35 },

          { from: '2019-01-01', /* to: '2019-12-31', */ amount: 50, deadline: 51 },
          { from: '2019-01-01', to: '2019-12-31', amount: 30, deadline: 86 },
          { from: '2019-01-01', /* to: '2019-12-31', */ amount: 75, deadline: 35 },
        ],
      };

    it('should successfully return when the cancellationFees are OK', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 20 },
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should successfully return when the cancellationFees are favourable for the airline', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 20 },
        { from: '2019-01-01', to: '2019-02-04', amount: 35 },
        { from: '2019-02-05', to: '2019-02-20', amount: 55 },
        { from: '2019-02-21', to: '2019-03-28', amount: 85 },
      ];
      await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should throw an error when cancellation fees are nonsensical', async () => {
      const cancellationFees = [
        { from: '2019-01-01', to: '2011-01-20', amount: 30 },
      ];
      try {
        await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
        if (!(err instanceof adapter.IllFormedCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should throw an error when cancellation fees do not cover the whole period between booking and arrival', async () => {
      const cancellationFees = [
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      try {
        await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.match(err.message, /the whole period between/);
        if (!(err instanceof adapter.IllFormedCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should throw an error when cancellation fees start before booking date', async () => {
      const cancellationFees = [
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      try {
        await wtAdapter._checkCancellationFees(description, cancellationFees, '2019-02-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.match(err.message, /is before the booking date/);
        if (!(err instanceof adapter.IllFormedCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should throw an error when cancellation fees end after arrival date', async () => {
      const cancellationFees = [
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      try {
        await wtAdapter._checkCancellationFees(description, cancellationFees, '2019-01-01', '2019-02-28');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.match(err.message, /is after the arrival date/);
        if (!(err instanceof adapter.IllFormedCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should throw an error when the deadline constraint is violated', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 10 },
        { from: '2019-01-01', to: '2019-02-01', amount: 30 },
        { from: '2019-02-02', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      try {
        await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
        if (!(err instanceof adapter.InadmissibleCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should throw an error when last year\'s cancellation fees are used', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 10 },
        { from: '2019-01-01', to: '2019-02-04', amount: 29 },
        { from: '2019-02-05', to: '2019-02-20', amount: 49 },
        { from: '2019-02-21', to: '2019-03-28', amount: 74 },
      ];
      try {
        await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
        if (!(err instanceof adapter.InadmissibleCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should throw an error when fees are unfavourable for the airline', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 5 },
        { from: '2019-01-01', to: '2019-02-04', amount: 25 },
        { from: '2019-02-05', to: '2019-02-20', amount: 45 },
        { from: '2019-02-21', to: '2019-03-28', amount: 70 },
      ];
      try {
        await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
        if (!(err instanceof adapter.InadmissibleCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should successfully return even if the cancellation policies have "holes"', async () => {
      const description = {
          defaultCancellationAmount: 10,
          cancellationPolicies: [
            { from: '2019-01-01', to: '2019-03-20', amount: 30, deadline: 86 },
            { from: '2019-01-01', to: '2019-03-20', amount: 50, deadline: 51 },
            // For the last week, default cancellation amount should be used again.
          ],
        },
        cancellationFees = [
          { from: '2018-12-01', to: '2018-12-31', amount: 10 },
          { from: '2019-01-01', to: '2019-02-04', amount: 30 },
          { from: '2019-02-05', to: '2019-03-20', amount: 50 },
          { from: '2019-03-21', to: '2019-03-28', amount: 10 },
        ];
      await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should successfully return when cancellation policies overlap', async () => {
      const description = {
          defaultCancellationAmount: 10,
          cancellationPolicies: [
            { from: '2019-01-01', to: '2019-12-31', amount: 30, deadline: 86 },
            { from: '2019-01-01', to: '2019-12-31', amount: 50, deadline: 51 },
            { from: '2019-02-08', to: '2019-02-10', amount: 40, deadline: 50 },
            { from: '2019-01-01', to: '2019-12-31', amount: 75, deadline: 35 },
          ],
        },
        cancellationFees = [
          { from: '2018-12-01', to: '2018-12-31', amount: 10 },
          { from: '2019-01-01', to: '2019-02-04', amount: 30 },
          { from: '2019-02-05', to: '2019-02-20', amount: 50 },
          { from: '2019-02-21', to: '2019-03-28', amount: 75 },
        ];
      await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should successfully return when only the default cancellation policy exists', async () => {
      const description = {
          defaultCancellationAmount: 10,
        },
        cancellationFees = [
          { from: '2018-12-01', to: '2019-03-28', amount: 10 },
        ];
      await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
    });
  });

  describe('WTAirlineAdapter._checkTotal', () => {
    // NOTE: Most of the testing is done within the pricing.spec.js test suite.
    const wtAdapter = _getAdapter(),
      description = { currency: 'EUR' },
      flightInstances = [{
        id: 'IeKeix6G-1',
        departureDateTime: '2018-12-10 12:00:00',
        bookingClasses: [
          { id: 'economy', fare: { amount: 70, currency: 'USD' } },
          { id: 'business', fare: { amount: 100, currency: 'USD' } },
        ],
      }, {
        id: 'IeKeix6G-2',
        departureDateTime: '2018-12-24 12:00:00',
        bookingClasses: [
          { id: 'economy' },
        ],
      }],
      bookingInfo = {
        flightNumber: 'OK0863',
        flightInstanceId: 'as876t4',
        bookingClasses: [{
          bookingClassId: 'economy',
          passengerCount: 2,
        }, {
          bookingClassId: 'business',
          passengerCount: 1,
        }],
      };

    it('should successfully return when the total is OK', async () => {
      await wtAdapter._checkTotal(description, flightInstances[0], bookingInfo, 'USD', 240, '2018-12-01');
    });

    it('should throw InvalidPriceError when using unknown booking class', async () => {
      try {
        bookingInfo.bookingClasses[1].bookingClassId = 'couchette';
        await wtAdapter._checkTotal(description, flightInstances[0], bookingInfo, 'USD', 240, '2018-12-01');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.instanceOf(err, adapter.InvalidPriceError);
      }
    });

    it('should throw InvalidPriceError when using multiple currencies', async () => {
      try {
        await wtAdapter._checkTotal(description, flightInstances[0], bookingInfo, 'EUR', 240, '2018-12-01');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.instanceOf(err, adapter.InvalidPriceError);
      }
    });

    it('should throw InvalidPriceError when the total is too low', async () => {
      try {
        await wtAdapter._checkTotal(description, flightInstances[0], bookingInfo, 'USD', 239, '2018-12-01');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.instanceOf(err, adapter.InvalidPriceError);
      }
    });
  });

  describe('WTAirlineAdapter.checkAdmissibility', () => {
    const airlineData = { dummy: true,
        id: 'supplierId',
        flights: {
          updatedAt: '2019-01-01 12:00:00',
          items: [
            { id: 'IeKeix6G' },
          ],
        },
      },
      wtAdapter = _getAdapter();
    const bookingInfo = {
        booking: {
          flightInstanceId: 'IeKeix6G',
          flightNumber: 'OK0965',
          bookingClasses: [
            {
              bookingClassId: 'business',
              passengers: [ { name: 'Sherlock', surname: 'Holmes' } ],
            },
            {
              bookingClassId: 'economy',
              passengers: [ { name: 'John', surname: 'Watson' } ],
            },
          ],
        },
      },
      pricing = { cancellationFees: 'cancellationFees', total: 'total', currency: 'currency' },
      today = '2018-12-01';

    beforeEach(() => {
      sinon.stub(wtAdapter, 'getSupplierData').callsFake(() => {
        return Promise.resolve(airlineData);
      });
      sinon.stub(wtAdapter, 'getFlightInstanceData').callsFake(() => {
        return Promise.resolve(flightInstanceData[0]);
      });
      sinon.stub(wtAdapter, '_checkCancellationFees').returns(undefined);
      sinon.stub(wtAdapter, '_checkTotal').returns(undefined);
      sinon.stub(wtAdapter, '_checkAvailability').returns(undefined);
    });

    afterEach(() => {
      wtAdapter.getSupplierData.restore();
      wtAdapter.getFlightInstanceData.restore();
      wtAdapter._checkCancellationFees.restore();
      wtAdapter._checkTotal.restore();
      wtAdapter._checkAvailability.restore();
    });

    it('should call all the checking functions', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, flightInstanceData[0], pricing, new Date(today));
      assert.equal(wtAdapter.getSupplierData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 1);
      assert.deepEqual(wtAdapter._checkCancellationFees.args[0],
        [airlineData, 'cancellationFees', today, '2018-12-10 12:00:00']);
      assert.equal(wtAdapter._checkTotal.callCount, 1);
      assert.deepEqual(wtAdapter._checkTotal.args[0],
        [airlineData, { departureDateTime: '2018-12-10 12:00:00', bookingClasses: [ { id: 'economy', availabilityCount: 100 }, { id: 'business', availabilityCount: 20 } ], id: 'IeKeix6G-1' }, bookingInfo, 'currency', 'total']);
      assert.equal(wtAdapter._checkAvailability.callCount, 1);
      assert.deepEqual(wtAdapter._checkAvailability.args[0],
        [flightInstanceData[0], bookingInfo]);
    });

    it('should call no checking functions if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, flightInstanceData[0], pricing, new Date(today), {});
      assert.equal(wtAdapter._checkCancellationFees.callCount, 0);
      assert.equal(wtAdapter._checkTotal.callCount, 0);
      assert.equal(wtAdapter._checkAvailability.callCount, 0);
    });

    it('should check cancellation fees if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, flightInstanceData[0], pricing, new Date(today), {
        cancellationFees: true,
      });
      assert.equal(wtAdapter.getSupplierData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 1);
      assert.equal(wtAdapter._checkTotal.callCount, 0);
      assert.equal(wtAdapter._checkAvailability.callCount, 0);
    });

    it('should check total price if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, flightInstanceData[0], pricing, new Date(today), {
        totalPrice: true,
      });
      assert.equal(wtAdapter.getSupplierData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 0);
      assert.equal(wtAdapter._checkTotal.callCount, 1);
      assert.equal(wtAdapter._checkAvailability.callCount, 0);
    });

    it('should check availability if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, flightInstanceData[0], pricing, new Date(today), {
        availability: true,
      });
      assert.equal(wtAdapter.getSupplierData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 0);
      assert.equal(wtAdapter._checkTotal.callCount, 0);
      assert.equal(wtAdapter._checkAvailability.callCount, 1);
    });

    it('should throw when booking a flight in past', async () => {
      try {
        let flightInstance = Object.assign({}, flightInstanceData[0]);
        flightInstance.departureDateTime = '2018-10-01 12:00:00';
        await wtAdapter.checkAdmissibility(bookingInfo, flightInstance, pricing, new Date(today));
        throw new Error('Should have thrown');
      } catch (err) {
        assert.match(err.message, /is earlier than booking date/);
        if (!(err instanceof ValidationError)) {
          throw err;
        }
      }
    });

    it('should throw on invalid flight date', async () => {
      try {
        let flightInstance = Object.assign({}, flightInstanceData[0]);
        flightInstance.departureDateTime = '2018-100-001 12:00:00';
        await wtAdapter.checkAdmissibility(bookingInfo, flightInstance, pricing, new Date(today));
        throw new Error('Should have thrown');
      } catch (err) {
        assert.match(err.message, /Flight date is in invalid format/);
        if (!(err instanceof ValidationError)) {
          throw err;
        }
      }
    });

    it('should throw on invalid booking date', async () => {
      try {
        await wtAdapter.checkAdmissibility(bookingInfo, flightInstanceData[0], pricing, '2018-100-001 12:00:00');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.match(err.message, /Booking date is in invalid format/);
        if (!(err instanceof ValidationError)) {
          throw err;
        }
      }
    });
  });
});
