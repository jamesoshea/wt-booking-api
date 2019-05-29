const knex = require('knex');
const winston = require('winston');

module.exports = {
  db: knex({
    client: 'sqlite3',
    connection: {
      filename: './.dev.sqlite',
    },
    useNullAsDefault: true,
  }),
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
    supplierId: '0xe92a8f9a7264695f4aed8d1f397dbc687ba40299',
    writeApiAccessKey: 'usgq6tSBW+wDYA/MBF367HnNp4tGKaCT',
    writeApiWalletPassword: 'windingtree',
  },
  wtLibsOptions: {
    onChainDataOptions: {
      provider: 'http://localhost:8545',
    },
    trustClueOptions: require('../../test/utils/trust-clue-options').trustClueOptions,
  },
};
