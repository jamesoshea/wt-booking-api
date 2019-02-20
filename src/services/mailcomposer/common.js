const countriesList = require('countries-list');

const normalizeAddress = (address) => {
  if (address.countryCode) {
    // eslint-disable-next-line camelcase
    address.country_code = address.countryCode;
    if (countriesList.countries[address.countryCode] && !address.country) {
      address.country = countriesList.countries[address.countryCode].name;
    }
    delete address.countryCode;
  }
  if (address.houseNumber) {
    // eslint-disable-next-line camelcase
    address.house_number = address.houseNumber;
    delete address.houseNumber;
  }
  return address;
};

module.exports = {
  normalizeAddress,
};
