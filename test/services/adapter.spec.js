/* eslint-env mocha */
const { assert } = require('chai');
const sinon = require('sinon');

const { WTAdapter, InvalidUpdateError } = require('../../src/services/adapter');

describe('services - adapter', function () {
  let wtAdapter;

  beforeEach(async () => {
    wtAdapter = new WTAdapter('hotelId', 'htttp://readApiUrl.com',
      'http://writeApiUrl.com', 'writeApiAccessKey', 'writeApiWalletPassword');
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

  describe('WTAdapter._applyUpdate', () => {
    const wtAdapter = new WTAdapter('hotelId', 'htttp://readApiUrl.com',
      'http://writeApiUrl.com', 'writeApiAccessKey', 'writeApiWalletPassword');
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

    it('should apply the update requested update', async () => {
      wtAdapter._applyUpdate(availability, {
        roomType1: [
          { date: '2019-01-01', delta: -1 },
          { date: '2019-01-02', delta: -2 },
        ],
        roomType2: [{ date: '2019-01-01', delta: -3 }],
      });
      assert.deepEqual(availability, {
        roomType1: [
          { date: '2019-01-01', quantity: 9 },
          { date: '2019-01-02', quantity: 8 },
        ],
        roomType2: [
          { date: '2019-01-01', quantity: 2 },
          { date: '2019-01-02', quantity: 5 },
        ],
      });
    });

    it('should throw InvalidUpdateError upon unknown roomTypeId', async () => {
      assert.throws(() => wtAdapter._applyUpdate(availability, {
        roomTypeX: [{ date: '2019-01-01', delta: -1 }],
      }), InvalidUpdateError);
    });

    it('should throw InvalidUpdateError upon unknown date', async () => {
      assert.throws(() => wtAdapter._applyUpdate(availability, {
        roomType1: [{ date: '2021-01-01', delta: -1 }],
      }), InvalidUpdateError);
    });

    it('should throw InvalidUpdateError upon overbooking', async () => {
      assert.throws(() => wtAdapter._applyUpdate(availability, {
        roomType1: [{ date: '2019-01-01', delta: -100 }],
      }), InvalidUpdateError);
    });
  });

  describe('WTAdapter.updateAvailability', () => {
    it('should update the availability', async () => {
      assert.deepEqual(wtAdapter.__availability, { count: 10 });
      await wtAdapter.updateAvailability({});
      assert.deepEqual(wtAdapter.__availability, { count: 9 });
    });

    it('should serialize updates', async () => {
      await Promise.all([
        wtAdapter.updateAvailability({}),
        wtAdapter.updateAvailability({}),
        wtAdapter.updateAvailability({}),
        wtAdapter.updateAvailability({}),
      ]);
      assert.deepEqual(wtAdapter.__availability, { count: 6 });
    });

    it('should handle single failures', async () => {
      await Promise.all([
        wtAdapter.updateAvailability({}),
        wtAdapter.updateAvailability('fail').catch(() => {}),
        wtAdapter.updateAvailability({}),
        wtAdapter.updateAvailability({}),
      ]);
      assert.deepEqual(wtAdapter.__availability, { count: 7 });
    });
  });
});
