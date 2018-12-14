const Booking = require('./models/booking');

/**
 * Create all necessary tables.
 *
 * @return {Promise<void>}
 */
async function setupDB () {
  await Booking.createTable();
}

/**
 * Bring the database to the initial empty state.
 *
 * @return {Promise<void>}
 */
async function resetDB () {
  await Booking.dropTable();
  await setupDB();
}

module.exports = {
  setupDB,
  resetDB,
};
