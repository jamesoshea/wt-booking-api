const config = require('../../config');
const {
  supplierSubject,
  supplierText,
  supplierHtml,
  customerSubject,
  customerText,
  customerHtml,
} = require(`./${config.segment}-templates`);

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
 *     flightId: IeKeix6G,
 *     bookingClasses: [
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
  return {
    subject: supplierSubject(mailData),
    text: supplierText(mailData),
    html: supplierHtml(mailData),
  };
};

const renderCustomer = (mailData) => {
  return {
    subject: customerSubject(mailData),
    text: customerText(mailData),
    html: customerHtml(mailData),
  };
};

module.exports = {
  renderSupplier,
  renderCustomer,
};
