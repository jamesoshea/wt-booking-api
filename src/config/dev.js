const winston = require('winston');

module.exports = {
  logger: winston.createLogger({
    level: 'debug',
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ['error'],
      }),
    ],
  }),
  adapterOpts: {
    readApiUrl: 'http://localhost:3000',
    writeApiUrl: 'http://localhost:8000',
    hotelId: '0xe92a8f9a7264695f4aed8d1f397dbc687ba40299',
    writeApiAccessKey: 'usgq6tSBW+wDYA/MBF367HnNp4tGKaCT',
    writeApiWalletPassword: 'windingtree',
  },
};
