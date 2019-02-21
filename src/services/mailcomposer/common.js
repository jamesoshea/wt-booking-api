const countriesList = require('iso-3166-1-alpha-2');

const normalizeAddress = (address) => {
  if (address.countryCode) {
    // eslint-disable-next-line camelcase
    address.country_code = address.countryCode;
    if (!address.country && countriesList.getCountry(address.countryCode)) {
      address.country = countriesList.getCountry(address.countryCode);
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
