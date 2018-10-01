const winston = require('winston');

module.exports = {
  hotelId: '0xe92a8f9a7264695f4aed8d1f397dbc687ba40299',
  logger: winston.createLogger({
    level: 'debug',
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ['error'],
      }),
    ],
  }),
};
