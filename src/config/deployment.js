const knex = require('knex');

module.exports = {
  db: knex({
    client: 'sqlite3',
    connection: {
      filename: './.db.sqlite',
    },
    useNullAsDefault: true,
  }),
  adapterOpts: {
    baseUrl: process.env.WT_API_BASE_URL,
    readApiUrl: process.env.READ_API_URL,
    writeApiUrl: process.env.WRITE_API_URL,
    hotelId: process.env.HOTEL_ID,
    writeApiAccessKey: process.env.WRITE_API_KEY,
    writeApiWalletPassword: process.env.WALLET_PASSWORD,
  },
};
