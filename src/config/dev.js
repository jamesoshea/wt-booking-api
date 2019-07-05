const knex = require("knex");
const winston = require("winston");

module.exports = {
  db: knex({
    client: "sqlite3",
    connection: {
      filename: "./.dev.sqlite"
    },
    useNullAsDefault: true
  }),
  logger: winston.createLogger({
    level: "debug",
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ["error"]
      })
    ]
  }),
  adapterOpts: {
    readApiUrl: "https://lisbon-api.windingtree.com",
    writeApiUrl: "https://lisbon-write-api.windingtree.com",
    supplierId: "0xcca04822Ad9c178bdf9da9091218e241f4C28042",
    writeApiAccessKey: "m9D+YSqjAf99xADMQ+vknUFxkHfmLg5LLxi6ptLRheM=",
    writeApiWalletPassword: "MEWpassword1,"
  },
  checkTrustClues: false,
  wtLibsOptions: {
    onChainDataOptions: {
      provider: "http://localhost:8545"
    },
    trustClueOptions: require("../../test/utils/trust-clue-options")
      .trustClueOptions
  },
  spamProtectionOptions: {
    whitelist: ["0x0275e1A76B1C3B67575e66074CdF4fD19D43983A"],
    blacklist: []
  }
};
