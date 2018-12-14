/* eslint-env mocha */
/* eslint-disable no-unused-vars */
const { assert } = require('chai');

const { db } = require('../../src/config');
const { resetDB } = require('../../src/db');
const Booking = require('../../src/models/booking');

describe('models - booking', () => {
  beforeEach(async () => {
    await resetDB();
  });

  describe('create', () => {
    it('should store a new booking and return its representation', async () => {
      const booking = await Booking.create({ data: 'dummy' }, Booking.STATUS.CONFIRMED),
        stored = await db(Booking.TABLE).select('id', 'status', 'raw_data');
      assert.equal(stored.length, 1);
      assert.property(stored[0], 'id');
      assert.propertyVal(stored[0], 'status', Booking.STATUS.CONFIRMED);
      assert.propertyVal(stored[0], 'raw_data', '{"data":"dummy"}');
      assert.property(booking, 'id');
      assert.propertyVal(booking, 'status', Booking.STATUS.CONFIRMED);
      assert.deepEqual(booking.rawData, { data: 'dummy' });
    });

    it('should assign a unique ID to each booking', async () => {
      const booking1 = await Booking.create({ data: 'dummy' }, Booking.STATUS.CONFIRMED),
        booking2 = await Booking.create({ data: 'dummy' }, Booking.STATUS.CONFIRMED);
      assert.notEqual(booking1.id, booking2.id);
    });
  });

  describe('get', () => {
    it('should return a previously created booking', async () => {
      const { id: id1 } = await Booking.create({ data: 'dummy1' }, Booking.STATUS.CONFIRMED),
        { id: id2 } = await Booking.create({ data: 'dummy2' }, Booking.STATUS.CONFIRMED),
        booking = await Booking.get(id2);
      assert.deepEqual(booking, {
        id: id2,
        status: Booking.STATUS.CONFIRMED,
        rawData: { data: 'dummy2' },
      });
    });
  });

  describe('cancel', () => {
    it('should switch the booking status to `cancelled`', async () => {
      const { id } = await Booking.create({ data: 'dummy' }, Booking.STATUS.CONFIRMED);
      await Booking.cancel(id);
      const booking = await Booking.get(id);
      assert.notEqual(booking.status, Booking.STATUS.CONFIRMED);
      assert.equal(booking.status, Booking.STATUS.CANCELLED);
    });
  });
});
