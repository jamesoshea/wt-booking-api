const shortid = require('shortid');

const { db } = require('../config').config;

const TABLE = 'bookings',
  ID_LENGTH = 255,
  STATUS = {
    CONFIRMED: 'confirmed',
    PENDING: 'pending',
    CANCELLED: 'cancelled',
  };

async function createTable () {
  await db.schema.createTable(TABLE, (table) => {
    table.string('id', ID_LENGTH).primary();
    table.enum('status', Object.values(STATUS)).notNullable();
    table.json('raw_data').notNullable();
    table.timestamps(true, true);
  });
};

async function dropTable () {
  await db.schema.dropTableIfExists(TABLE);
};

/**
 * Create a new booking and return its representation.
 *
 * @param {Object} bookingData
 * @param {String} status
 * @return {Promise<Object>}
 */
async function create (bookingData, status) {
  const id = shortid.generate();
  await db(TABLE).insert({
    id,
    status,
    'raw_data': JSON.stringify(bookingData),
  });
  return {
    id,
    status,
    rawData: bookingData,
  };
};

/**
 * Get a booking by its ID.
 *
 * @param {String} id
 * @return {Promise<Object>}
 */
async function get (id) {
  const booking = (await db(TABLE).where({
    'id': id,
  }).select('id', 'status', 'raw_data'))[0];
  return booking && {
    id: id,
    status: booking.status,
    rawData: JSON.parse(booking.raw_data),
  };
};

/**
 * Cancel a booking.
 *
 * @param {String} id
 * @return {Promise<Boolean>}
 */
async function cancel (id) {
  return Boolean(await db(TABLE).where('id', id).update({
    'status': STATUS.CANCELLED,
    'updated_at': db.fn.now(),
  }));
};

module.exports = {
  TABLE,
  STATUS,
  createTable,
  dropTable,
  create,
  get,
  cancel,
};
