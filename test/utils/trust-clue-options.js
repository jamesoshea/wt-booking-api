const trustClueOptions = {
  provider: "http://localhost:8545",
  clues: {
    "test-list": {
      create: async options => {
        const { getWallet } = require("../utils/factories");
        const wallet = getWallet();
        return {
          getMetadata: () => ({
            name: "test-list",
            description:
              "Dummy trust clue whitelist for 0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906"
          }),
          getValueFor: addr => {
            return addr === wallet.address;
          },
          interpretValueFor: addr => {
            return addr === wallet.address;
          }
        };
      }
    },
    "test-deposit": {
      options: {
        threshold: 0
      },
      create: async options => {
        const { getWallet } = require("../utils/factories");
        const wallet = getWallet();
        let getValue = function(addr) {
          if (addr === wallet.address) {
            return 1000;
          }
          return 0;
        };
        return {
          getMetadata: () => ({
            name: "test-deposit",
            description:
              "Dummy trust clue checking a deposit of at least 500 Líf"
          }),
          getValueFor: getValue,
          interpretValueFor: addr => {
            let value = getValue(addr);
            return value >= options.threshold;
          }
        };
      }
    }
  }
};

module.exports = {
  trustClueOptions
};
