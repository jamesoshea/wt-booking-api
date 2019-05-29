const knex = require('knex');
const winston = require('winston');

const web3ProviderAddress = 'http://localhost:8545';

module.exports = {
  port: 8920,
  db: knex({
    client: 'sqlite3',
    connection: {
      filename: './.test.sqlite',
    },
    useNullAsDefault: true,
  }),
  adapterOpts: {
    baseUrl: 'http://localhost:8935',
    readApiUrl: 'http://localhost:3000',
    writeApiUrl: 'http://localhost:8000',
    supplierId: '0xe92a8f9a7264695f4aed8d1f397dbc687ba40299',
    writeApiAccessKey: 'usgq6tSBW+wDYA/MBF367HnNp4tGKaCT',
    writeApiWalletPassword: 'windingtree',
  },
  logger: winston.createLogger({
    level: 'warn',
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ['error'],
      }),
    ],
  }),
  wtLibsOptions: {
    onChainDataOptions: {
      provider: web3ProviderAddress,
    },
    trustClueOptions: {
      provider: web3ProviderAddress,
      clues: {},
    },
  },
};
