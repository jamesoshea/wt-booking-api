const {
  hotelSubject,
  hotelText,
  hotelHtml,
  customerSubject,
  customerText,
  customerHtml,
} = require('./templates');

/**
 * mailData specs:
 *
 * ```
 * {
 *    customer: <Customer from docs/swagger.yaml>,
 *    note: <string>,
 *    hotel: <https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L78> limited to name,contacts,address and roomTypes
 *    arrival: <string, format date>,
 *    departure: <string, format date>,
 *    roomList: [
 *      {
 *        roomType: <https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L141>,
 *        guests: <Array of elements from BookingInfo.guestInfo from docs/swagger.yaml that belong to this room>,
 *      }
 *     ]
 *   pricing: <Booking.pricing from docs/swagger.yaml>,
 *   id: <string identifying this booking in local DB>,
 *   status: <string, status of this booking in local DB>,
 * }
 * ```
 */

const renderHotel = (mailData) => {
  return {
    subject: hotelSubject(mailData),
    text: hotelText(mailData),
    html: hotelHtml(mailData),
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
  renderHotel,
  renderCustomer,
};
