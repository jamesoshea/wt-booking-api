const { app } = require('./app');
const adapter = require('./services/adapters/base-adapter');
const hotelAdapter = require('./services/adapters/hotel-adapter');
const airlineAdapter = require('./services/adapters/airline-adapter');
const mailer = require('./services/mailer');
const config = require('./config');

if (config.segment === 'hotels') {
  adapter.set(new hotelAdapter.WTHotelAdapter(config.adapterOpts));
} else if (config.segment === 'airlines') {
  adapter.set(new airlineAdapter.WTAirlineAdapter(config.adapterOpts));
} else {
  throw new Error(`Unknown segment ${config.segment}`);
}
mailer.set(new mailer.Mailer(config.mailerOpts.provider, config.mailerOpts.providerOpts));

const server = app.listen(config.port, () => {
  config.logger.info(`WT Booking API at ${config.port}...`);
});

module.exports = server;
