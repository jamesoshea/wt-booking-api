const knex = require('knex');

module.exports = {
  db: knex({
    client: process.env.DB_CLIENT,
    connection: JSON.parse(process.env.DB_CLIENT_OPTIONS),
    useNullAsDefault: true,
  }),
  adapterOpts: {
    baseUrl: process.env.BASE_URL,
    readApiUrl: process.env.READ_API_URL,
    writeApiUrl: process.env.WRITE_API_URL,
    hotelId: process.env.HOTEL_ID,
    writeApiAccessKey: process.env.WRITE_API_KEY,
    writeApiWalletPassword: process.env.WALLET_PASSWORD,
  },
};
