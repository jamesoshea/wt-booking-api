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

const hotelSubject = (data) => {
  return `New booking ${data.id}: ${data.arrival}-${data.departure}`;
};

const hotelText = (data) => {
  return JSON.stringify(data);
};

const hotelHtml = (data) => {
  return hotelText(data);
};

const customerSubject = (data) => {
  return `Booking confirmation in ${data.hotel.name} for ${data.arrival}-${data.departure}`;
};

const customerText = (data) => {
  return JSON.stringify(data);
};

const customerHtml = (data) => {
  return customerText(data);
};

module.exports = {
  hotelSubject,
  hotelText,
  hotelHtml,
  customerSubject,
  customerText,
  customerHtml,
};
