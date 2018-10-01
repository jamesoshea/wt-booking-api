const winston = require('winston');

module.exports = {
  hotelId: '0xd9fb97bfffefbdd2e849489b8b8cddf06e208c05',
  logger: winston.createLogger({
    level: 'warn',
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ['error'],
      }),
    ],
  }),
};
