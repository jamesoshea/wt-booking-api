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

/**
 * mailData specs:
 * When WT_SEGMENT is 'hotels'
 * ```
 * {
 *   customer: <Customer from docs/swagger.yaml>,
 *   note: <string>,
 *   hotel: <https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L78> limited to name,contacts,address and roomTypes
 *   arrival: <string, format date>,
 *   departure: <string, format date>,
 *   roomList: [
 *     {
 *       roomType: <https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L141>,
 *       guests: <Array of elements from BookingInfo.guestInfo from docs/swagger.yaml that belong to this room>,
 *     }
 *   ]
 *   pricing: <Booking.pricing from docs/swagger.yaml>,
 *   id: <string identifying this booking in local DB>,
 *   status: <string, status of this booking in local DB>,
 * }
 *
 * ```
 * When WT_SEGMENT is 'airlines'
 * ```
 * {
 *    customer: <Customer from docs/swagger.yaml>,
 *    note: <string>,
 *    airline: <https://github.com/windingtree/wtips/blob/0bfb89a9d57bd2836bf5fa0ada2e2bfb590aacae/assets/wtip-003/airlines-data-swagger.yaml#L59> limited to name,contacts and code
 *    booking: {
 *     flightNumber: OK0965,
 *     flightInstanceId: IeKeix6G,
 *     bookingClasses: [ // TODO add swagger links
 *       bookingClassId: business,
 *       passengers: [
 *         name: John,
 *         surname: Watson,
 *       ],
 *     ],
 *   }
 *   pricing: <Booking.pricing from docs/swagger.yaml>,
 *   id: <string identifying this booking in local DB>,
 *   status: <string, status of this booking in local DB>,
 * }
 * ```
 */

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
