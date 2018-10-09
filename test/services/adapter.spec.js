/* eslint-env mocha */
const { assert } = require('chai');
const sinon = require('sinon');

const {
  WTAdapter,
  InvalidUpdateError,
  RestrictionsViolatedError,
  IllFormedCancellationFeesError,
  InadmissibleCancellationFeesError,
} = require('../../src/services/adapter');

function _getAdapter () {
  return new WTAdapter({
    hotelId: 'hotelId',
    readApiUrl: 'htttp://readApiUrl',
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
      availability = {
        roomType1: [
          { date: '2019-01-01', quantity: 10 },
          { date: '2019-01-02', quantity: 10 },
        ],
        roomType2: [
          { date: '2019-01-01', quantity: 5 },
          { date: '2019-01-02', quantity: 5 },
        ],
      };
    });

    it('should apply the requested update', async () => {
      wtAdapter._applyUpdate(availability, ['roomType1', 'roomType2', 'roomType2'],
        '2019-01-01', '2019-01-03');
      assert.deepEqual(availability, {
        roomType1: [
          { date: '2019-01-01', quantity: 9 },
          { date: '2019-01-02', quantity: 9 },
        ],
        roomType2: [
          { date: '2019-01-01', quantity: 3 },
          { date: '2019-01-02', quantity: 3 },
        ],
      });
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
      availability = {
        roomType1: [
          { date: '2019-01-01', quantity: 10 },
          { date: '2019-01-02', quantity: 10, restrictions: { noArrival: true } },
          { date: '2019-01-03', quantity: 10 },
          { date: '2019-01-04', quantity: 10, restrictions: { noDeparture: true } },
        ],
      };

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

  describe('WTAdapter.updateAvailability', () => {
    let wtAdapter;

    beforeEach(async () => {
      wtAdapter = _getAdapter();
      wtAdapter.__availability = { count: 10 };
      sinon.stub(wtAdapter, '_getAvailability').callsFake(() => {
        return Promise.resolve(wtAdapter.__availability);
      });
      sinon.stub(wtAdapter, '_applyUpdate').callsFake((orig, update) => {
        if (update === 'fail') {
          throw new Error('Failed update');
        }
        orig.count -= 1;
      });
      sinon.stub(wtAdapter, '_setAvailability').callsFake((availability) => {
        wtAdapter.__availability = availability;
        return Promise.resolve();
      });
    });

    it('should update the availability', async () => {
      assert.deepEqual(wtAdapter.__availability, { count: 10 });
      await wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02');
      assert.deepEqual(wtAdapter.__availability, { count: 9 });
    });

    it('should serialize updates', async () => {
      await Promise.all([
        wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02'),
      ]);
      assert.deepEqual(wtAdapter.__availability, { count: 6 });
    });

    it('should handle single failures', async () => {
      await Promise.all([
        wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability('fail', '2019-01-01', '2019-01-02').catch(() => {}),
        wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02'),
        wtAdapter.updateAvailability([], '2019-01-01', '2019-01-02'),
      ]);
      assert.deepEqual(wtAdapter.__availability, { count: 7 });
    });
  });

  describe('WTAdapter.checkPrice', () => {
    const wtAdapter = _getAdapter();
    sinon.stub(wtAdapter, '_getDescription').callsFake(() => {
      return Promise.resolve({
        defaultCancellationAmount: 10,
        cancellationPolicies: [
          { from: '2018-01-01', to: '2018-12-31', amount: 29, deadline: 86 },
          { from: '2018-01-01', to: '2018-12-31', amount: 49, deadline: 51 },
          { from: '2018-01-01', to: '2018-12-31', amount: 74, deadline: 35 },

          // The cancellation policies are intentionally not
          // "in-order" to test robustness.
          { from: '2019-01-01', to: '2019-12-31', amount: 50, deadline: 51 },
          { from: '2019-01-01', to: '2019-12-31', amount: 30, deadline: 86 },
          { from: '2019-01-01', to: '2019-12-31', amount: 75, deadline: 35 },
        ],
      });
    });

    it('should successfully return when the cancellationFees are OK', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 10 },
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should successfully return when the cancellationFees are favourable for the hotel', async () => {
      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 15 },
        { from: '2019-01-01', to: '2019-02-04', amount: 35 },
        { from: '2019-02-05', to: '2019-02-20', amount: 55 },
        { from: '2019-02-21', to: '2019-03-28', amount: 85 },
      ];
      await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should throw an error when cancellation fees are nonsensical', async () => {
      const cancellationFees = [
        { from: '2019-01-01', to: '2011-01-20', amount: 30 },
      ];
      try {
        await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
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
        await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
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
        await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
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
        await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
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
        await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
        throw new Error('Should have thrown');
      } catch (err) {
        if (!(err instanceof InadmissibleCancellationFeesError)) {
          throw err;
        }
      }
    });

    it('should successfully return even if the cancellation policies have "holes"', async () => {
      const wtAdapter = _getAdapter();
      sinon.stub(wtAdapter, '_getDescription').callsFake(() => {
        return Promise.resolve({
          defaultCancellationAmount: 10,
          cancellationPolicies: [
            { from: '2019-01-01', to: '2019-03-20', amount: 30, deadline: 86 },
            { from: '2019-01-01', to: '2019-03-20', amount: 50, deadline: 51 },
            // For the last week, default cancellation amount should be used again.
          ],
        });
      });

      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 10 },
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-03-20', amount: 50 },
        { from: '2019-03-21', to: '2019-03-28', amount: 10 },
      ];
      await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should successfully return when cancellation policies overlap', async () => {
      const wtAdapter = _getAdapter();
      sinon.stub(wtAdapter, '_getDescription').callsFake(() => {
        return Promise.resolve({
          defaultCancellationAmount: 10,
          cancellationPolicies: [
            { from: '2019-01-01', to: '2019-12-31', amount: 30, deadline: 86 },
            { from: '2019-01-01', to: '2019-12-31', amount: 50, deadline: 51 },
            { from: '2019-02-08', to: '2019-02-10', amount: 40, deadline: 50 },
            { from: '2019-01-01', to: '2019-12-31', amount: 75, deadline: 35 },
          ],
        });
      });

      const cancellationFees = [
        { from: '2018-12-01', to: '2018-12-31', amount: 10 },
        { from: '2019-01-01', to: '2019-02-04', amount: 30 },
        { from: '2019-02-05', to: '2019-02-07', amount: 50 },
        { from: '2019-02-08', to: '2019-02-10', amount: 40 },
        { from: '2019-02-11', to: '2019-02-20', amount: 50 },
        { from: '2019-02-21', to: '2019-03-28', amount: 75 },
      ];
      await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
    });

    it('should successfully return when only the default cancellation policy exists', async () => {
      const wtAdapter = _getAdapter();
      sinon.stub(wtAdapter, '_getDescription').callsFake(() => {
        return Promise.resolve({
          defaultCancellationAmount: 10,
        });
      });

      const cancellationFees = [
        { from: '2018-12-01', to: '2019-03-28', amount: 10 },
      ];
      await wtAdapter.checkPrice('GBP', 100, cancellationFees, '2018-12-01', '2019-03-28');
    });
  });
});
