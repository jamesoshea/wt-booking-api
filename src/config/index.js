const winston = require('winston');

const env = process.env.WT_CONFIG || 'dev';

const config = Object.assign({
  port: 8935,
  baseUrl: process.env.WT_API_BASE_URL || 'http://localhost:8935',
  logger: winston.createLogger({
    level: 'info',
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ['error'],
      }),
    ],
  }),
  adapterOpts: {
    // In your env config, replace these with suitable values.
    readApiUrl: 'http://localhost:3000',
    writeApiUrl: 'http://localhost:8000',
    hotelId: '0xe92a8f9a7264695f4aed8d1f397dbc687ba40299',
    writeApiAccessKey: 'usgq6tSBW+wDYA/MBF367HnNp4tGKaCT',
    writeApiWalletPassword: 'windingtree',
  },
  allowCancel: true, // If false, booking cancellation is not allowed.
}, require(`./${env}`));

module.exports = config;
