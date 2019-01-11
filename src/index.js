const { app } = require('./app');
const adapter = require('./services/adapter');
const mailer = require('./services/mailer');
const config = require('./config');

adapter.set(new adapter.WTAdapter(config.adapterOpts));
mailer.set(new mailer.Mailer(config.mailerOpts.provider, config.mailerOpts.providerOpts));

const server = app.listen(config.port, () => {
  config.logger.info(`WT Booking API at ${config.port}...`);
});

module.exports = server;
