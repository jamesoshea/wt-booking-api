/* eslint-env mocha */
/* eslint-disable standard/object-curly-even-spacing */
const { assert } = require('chai');
const sinon = require('sinon');

const {
  WTAdapter,
  InvalidUpdateError,
  RestrictionsViolatedError,
  RoomUnavailableError,
  IllFormedCancellationFeesError,
  InadmissibleCancellationFeesError,
  InvalidPriceError,
} = require('../../src/services/adapter');

function _getAdapter () {
  return new WTAdapter({
    hotelId: 'hotelId',
    readApiUrl: 'http://readApiUrl',
    writeApiUrl: 'http://writeApiUrl',
    writeApiAccessKey: 'writeApiAccessKey',
    writeApiWalletPassword: 'writeApiWalletPassword',
  });
}

describe('services - adapter', function () {
  describe('WTAdapter._applyUpdate', () => {
    const wtAdapter = _getAdapter();
    let availability;

    beforeEach(() => {
      availability = [
        { roomTypeId: 'roomType1', date: '2019-01-01', quantity: 10 },
        { roomTypeId: 'roomType1', date: '2019-01-02', quantity: 10 },
        { roomTypeId: 'roomType2', date: '2019-01-01', quantity: 5 },
        { roomTypeId: 'roomType2', date: '2019-01-02', quantity: 5 },
      ];
    });

    it('should apply the requested update', async () => {
      wtAdapter._applyUpdate(availability, ['roomType1', 'roomType2', 'roomType2'],
        '2019-01-01', '2019-01-03');
      assert.deepEqual(availability, [
        { roomTypeId: 'roomType1', date: '2019-01-01', quantity: 9 },
        { roomTypeId: 'roomType1', date: '2019-01-02', quantity: 9 },
        { roomTypeId: 'roomType2', date: '2019-01-01', quantity: 3 },
        { roomTypeId: 'roomType2', date: '2019-01-02', quantity: 3 },
      ]);
    });

    it('should restore availability instead of reducing it if requested', async () => {
      wtAdapter._applyUpdate(availability, ['roomType1', 'roomType2', 'roomType2'],
        '2019-01-01', '2019-01-03', true);
      assert.deepEqual(availability, [
        { roomTypeId: 'roomType1', date: '2019-01-01', quantity: 11 },
        { roomTypeId: 'roomType1', date: '2019-01-02', quantity: 11 },
        { roomTypeId: 'roomType2', date: '2019-01-01', quantity: 7 },
        { roomTypeId: 'roomType2', date: '2019-01-02', quantity: 7 },
      ]);
    });

    it('should throw InvalidUpdateError upon unknown roomTypeId', async () => {
      assert.throws(() => {
        wtAdapter._applyUpdate(availability, ['roomTypeX'], '2019-01-01', '2019-01-02');
      }, InvalidUpdateError);
    });

    it('should throw InvalidUpdateError upon unknown date', async () => {
      assert.throws(() => {
        wtAdapter._applyUpdate(availability, ['roomType1'], '2021-01-01', '2021-01-02');
      }, InvalidUpdateError);
    });

    it('should throw InvalidUpdateError upon overbooking', async () => {
      assert.throws(() => {
        wtAdapter._applyUpdate(availability, Array(100).fill('roomType1'), '2019-01-01', '2019-01-02');
      }, InvalidUpdateError);
    });
  });

  describe('WTAdapter._checkRestrictions', () => {
    const wtAdapter = _getAdapter(),
      availability = [
        { roomTypeId: 'roomType1', date: '2019-01-01', quantity: 10 },
        { roomTypeId: 'roomType1', date: '2019-01-02', quantity: 10, restrictions: { noArrival: true } },
        { roomTypeId: 'roomType1', date: '2019-01-03', quantity: 10 },
        { roomTypeId: 'roomType1', date: '2019-01-04', quantity: 10, restrictions: { noDeparture: true } },
      ];

    it('should throw when the noArrival restriction is violated', async () => {
      assert.throws(() => {
        wtAdapter._checkRestrictions(availability, ['roomType1'], '2019-01-02', '2019-01-03');
      }, RestrictionsViolatedError);
    });

    it('should throw when the noDeparture restriction is violated', async () => {
      assert.throws(() => {
        wtAdapter._checkRestrictions(availability, ['roomType1'], '2019-01-01', '2019-01-04');
      }, RestrictionsViolatedError);
    });

    it('should not throw if no restrictions are violated', async () => {
      wtAdapter._checkRestrictions(availability, ['roomType1'], '2019-01-01', '2019-01-03');
    });
  });

  describe('WTAdapter._checkAvailability', () => {
    const wtAdapter = _getAdapter();
    it('should throw when the room is not available', async () => {
      assert.throws(() => {
        wtAdapter._checkAvailability([
          { roomTypeId: 'roomType1', date: '2019-01-01', quantity: 0 },
          { roomTypeId: 'roomType1', date: '2019-01-02', quantity: 0 },
          { roomTypeId: 'roomType1', date: '2019-01-03', quantity: 0 },
          { roomTypeId: 'roomType1', date: '2019-01-04', quantity: 0 },
        ],
        [{ 'guestInfoIds': ['1'], 'id': 'roomType1' }], '2019-01-02', '2019-01-03');
      }, RoomUnavailableError);
    });

    it('should throw when the room availability is undefined', async () => {
      assert.throws(() => {
        wtAdapter._checkAvailability([], [{ 'guestInfoIds': ['1'], 'id': 'roomType1' }], '2019-01-01', '2019-01-04');
      }, RoomUnavailableError);
    });

    it('should not throw if room is available', async () => {
      wtAdapter._checkAvailability([
        { roomTypeId: 'roomType1', date: '2019-01-01', quantity: 10 },
        { roomTypeId: 'roomType1', date: '2019-01-02', quantity: 10 },
        { roomTypeId: 'roomType1', date: '2019-01-03', quantity: 10 },
        { roomTypeId: 'roomType1', date: '2019-01-04', quantity: 10 },
      ], [{ 'guestInfoIds': ['1'], 'id': 'roomType1' }], '2019-01-01', '2019-01-03');
    });
  });

  describe('WTAdapter.updateAvailability', () => {
    let wtAdapter;

    beforeEach(async () => {
      wtAdapter = _getAdapter();
      wtAdapter.__availability = [{ roomTypeId: 'roomType1', quantity: 10, date: '2019-01-01' }];
      sinon.stub(wtAdapter, '_getAvailability').callsFake(() => {
        return Promise.resolve(wtAdapter.__availability);
      });
      sinon.stub(wtAdapter, '_applyUpdate').callsFake((availability, roomTypes, arrival, departure, restore) => {
        if (roomTypes[0] === 'fail') {
          throw new Error('Failed update');
        }
        availability[0].quantity += (restore ? 1 : -1);
      });
      sinon.stub(wtAdapter, '_setAvailability').callsFake((availability) => {
        wtAdapter.__availability = availability;
        return Promise.resolve();
      });
    });

    it('should update the availability', async () => {
      assert.equal(wtAdapter.__availability[0].quantity, 10);
      await wtAdapter.updateAvailability(['roomType1'], '2019-01-01', '2019-01-02');
      assert.equal(wtAdapter.__availability[0].quantity, 9);
    });

    it('should restore the availability if requested', async () => {
      assert.deepEqual(wtAdapter.__availability[0].quantity, 10);
      await wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02', true);
      assert.deepEqual(wtAdapter.__availability[0].quantity, 11);
    });

    it('should serialize updates', async () => {
      const rooms = [
        {
          'guestInfoIds': ['1'],
          'id': 'roomType1',
        },
      ];
      await Promise.all([
        wtAdapter.updateAvailability(rooms, '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability(rooms, '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability(rooms, '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability(rooms, '2019-01-01', '2019-01-02'),
      ]);
      assert.equal(wtAdapter.__availability[0].quantity, 6);
    });

    it('should handle single failures', async () => {
      const rooms = [
        {
          'guestInfoIds': ['1'],
          'id': 'roomType1',
        },
      ];
      await Promise.all([
        wtAdapter.updateAvailability(rooms, '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability([{ id: 'fail' }], '2019-01-01', '2019-01-02').catch(() => {}),
        wtAdapter.updateAvailability(rooms, '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability(rooms, '2019-01-01', '2019-01-02'),
      ]);
      assert.equal(wtAdapter.__availability[0].quantity, 7);
    });
  });

  describe('WTAdapter._checkCancellationFees', () => {
    const wtAdapter = _getAdapter(),
      description = {
        defaultCancellationAmount: 10,
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
        { from: '2018-12-01', to: '2018-12-31', amount: 10 },
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      await wtAdapter._checkCancellationFees(description, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should successfully return when the cancellationFees are favourable for the hotel', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 15 },
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
        if (!(err instanceof IllFormedCancellationFeesError)) {
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
        if (!(err instanceof IllFormedCancellationFeesError)) {
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
        if (!(err instanceof IllFormedCancellationFeesError)) {
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
        if (!(err instanceof IllFormedCancellationFeesError)) {
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
        if (!(err instanceof InadmissibleCancellationFeesError)) {
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
        if (!(err instanceof InadmissibleCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should throw an error when fees are unfavourable for the hotel', async () => {
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
        if (!(err instanceof InadmissibleCancellationFeesError)) {
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

  describe('WTAdapter._checkTotal', () => {
    // NOTE: Most of the testing is done within the pricing.spec.js test suite.
    const wtAdapter = _getAdapter(),
      description = { currency: 'EUR' },
      ratePlans = [
        {
          id: 'plan1',
          roomTypeIds: ['room1'],
          price: 10,
        },
      ],
      bookingInfo = {
        arrival: '2019-03-20',
        departure: '2019-03-28',
        guestInfo: [{ id: 1 }],
        rooms: [{
          id: 'room1',
          guestInfoIds: [1],
        }],
      };

    it('should successfully return when the total is OK', async () => {
      await wtAdapter._checkTotal(description, ratePlans, bookingInfo, 'EUR', 8 * 10, '2018-12-01');
    });

    it('should throw InvalidPriceError when the total is too low', async () => {
      try {
        await wtAdapter._checkTotal(description, ratePlans, bookingInfo, 'EUR', 60, '2018-12-01');
        throw new Error('Should have thrown');
      } catch (err) {
        assert.instanceOf(err, InvalidPriceError);
      }
    });
  });

  describe('WTAdapter.checkAdmissibility', () => {
    const hotelData = { dummy: true,
        ratePlans: 'ratePlans',
        timezone: 'Europe/Prague',
        availability: [{ roomTypeId: 'single-room', quantity: 10, date: '2019-01-01' }],
      },
      wtAdapter = _getAdapter();
    const bookingInfo = {
        arrival: 'arrival',
        departure: '2019-01-02',
        rooms: [
          {
            'guestInfoIds': ['1'],
            'id': 'single-room',
          },
          {
            'guestInfoIds': ['2'],
            'id': 'single-room',
          },
        ],
      },
      pricing = { cancellationFees: 'cancellationFees', total: 'total', currency: 'currency' },
      today = '2018-12-01';

    beforeEach(() => {
      sinon.stub(wtAdapter, 'getHotelData').callsFake(() => {
        return Promise.resolve(hotelData);
      });
      sinon.stub(wtAdapter, '_checkCancellationFees').returns(undefined);
      sinon.stub(wtAdapter, '_checkTotal').returns(undefined);
      sinon.stub(wtAdapter, '_checkAvailability').returns(undefined);
    });

    afterEach(() => {
      wtAdapter.getHotelData.restore();
      wtAdapter._checkCancellationFees.restore();
      wtAdapter._checkTotal.restore();
      wtAdapter._checkAvailability.restore();
    });

    it('should call all the checking functions', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, pricing, new Date(today));
      assert.equal(wtAdapter.getHotelData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 1);
      assert.deepEqual(wtAdapter._checkCancellationFees.args[0],
        [hotelData, 'cancellationFees', today, 'arrival']);
      assert.equal(wtAdapter._checkTotal.callCount, 1);
      assert.deepEqual(wtAdapter._checkTotal.args[0],
        [hotelData, 'ratePlans', bookingInfo, 'currency', 'total', today]);
      assert.equal(wtAdapter._checkAvailability.callCount, 1);
      assert.deepEqual(wtAdapter._checkAvailability.args[0],
        [hotelData.availability.roomTypes, bookingInfo.rooms, bookingInfo.arrival, bookingInfo.departure]);
    });

    it('should call no checking functions if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, pricing, new Date(today), {});
      assert.equal(wtAdapter.getHotelData.callCount, 0);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 0);
      assert.equal(wtAdapter._checkTotal.callCount, 0);
      assert.equal(wtAdapter._checkAvailability.callCount, 0);
    });

    it('should check cancellation fees if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, pricing, new Date(today), {
        cancellationFees: true,
      });
      assert.equal(wtAdapter.getHotelData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 1);
      assert.equal(wtAdapter._checkTotal.callCount, 0);
      assert.equal(wtAdapter._checkAvailability.callCount, 0);
    });

    it('should check total price if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, pricing, new Date(today), {
        totalPrice: true,
      });
      assert.equal(wtAdapter.getHotelData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 0);
      assert.equal(wtAdapter._checkTotal.callCount, 1);
      assert.equal(wtAdapter._checkAvailability.callCount, 0);
    });

    it('should check availability if configured so', async () => {
      await wtAdapter.checkAdmissibility(bookingInfo, pricing, new Date(today), {
        availability: true,
      });
      assert.equal(wtAdapter.getHotelData.callCount, 1);
      assert.equal(wtAdapter._checkCancellationFees.callCount, 0);
      assert.equal(wtAdapter._checkTotal.callCount, 0);
      assert.equal(wtAdapter._checkAvailability.callCount, 1);
    });
  });
});
