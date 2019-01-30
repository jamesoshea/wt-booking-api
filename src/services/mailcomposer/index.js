const { AIRLINE_SEGMENT_ID, HOTEL_SEGMENT_ID } = require('../../../src/constants');
const { initSegment } = require('../../config');
const config = initSegment();
const hotelTemplates = require('./hotels-templates');
const airlineTemplates = require('./airlines-templates');

function getTemplates () {
  if (config.segment === HOTEL_SEGMENT_ID) {
    return hotelTemplates;
  } else if (config.segment === AIRLINE_SEGMENT_ID) {
    return airlineTemplates;
  } else {
    throw new Error(`Unknown segment ${config.segment}`);
  }
}

const renderSupplier = (mailData) => {
  const segmentTemplates = getTemplates();
  return {
    subject: segmentTemplates.supplierSubject(mailData),
    text: segmentTemplates.supplierText(mailData),
    html: segmentTemplates.supplierHtml(mailData),
  };
};

const renderCustomer = (mailData) => {
  const segmentTemplates = getTemplates();
  return {
    subject: segmentTemplates.customerSubject(mailData),
    text: segmentTemplates.customerText(mailData),
    html: segmentTemplates.customerHtml(mailData),
  };
};

module.exports = {
  renderSupplier,
  renderCustomer,
};
