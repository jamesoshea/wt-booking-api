const { app } = require('./app');
const adapter = require('./services/adapter');
const config = require('./config');

adapter.set(new adapter.WTAdapter(config.adapterOpts));

const server = app.listen(config.port, () => {
  config.logger.info(`WT Booking API at ${config.port}...`);
});

module.exports = server;
