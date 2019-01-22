const { app } = require('./app');
const adapter = require('./services/adapters/base-adapter');
const hotelAdapter = require('./services/adapters/hotel-adapter');
const airlineAdapter = require('./services/adapters/airline-adapter');
const mailer = require('./services/mailer');
const { AIRLINE_SEGMENT_ID, HOTEL_SEGMENT_ID } = require('./constants');
let { config } = require('./config');

if (config.segment === HOTEL_SEGMENT_ID) {
  adapter.set(new hotelAdapter.WTHotelAdapter(config.adapterOpts));
} else if (config.segment === AIRLINE_SEGMENT_ID) {
  adapter.set(new airlineAdapter.WTAirlineAdapter(config.adapterOpts));
} else {
  throw new Error(`Unknown segment ${config.segment}`);
}
mailer.set(new mailer.Mailer(config.mailerOpts.provider, config.mailerOpts.providerOpts));

const server = app.listen(config.port, () => {
  config.logger.info(`WT Booking API at ${config.port}...`);
});

module.exports = server;
