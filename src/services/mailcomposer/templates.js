const dayjs = require('dayjs');
const escapeHTML = require('escape-html');
const showdown = require('showdown');

/**
 * mailData specs:
 *
 * ```
 * {
 *    customer: <Customer from docs/swagger.yaml>,
 *    note: <string>,
 *    hotel: <https://github.com/windingtree/wiki/blob/d64397e5fb6e439f8436ed856f60664d08ae9b48/hotel-data-swagger.yaml#L78> limited to name, contacts, address
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

const formatHotel = (hotelData) => {
  const template = `
# Hotel

${hotelData.name ? `- Name: ${hotelData.name}` : ''}
${hotelData.address
    ? `- Address:
  ${hotelData.address.line1 ? `    - ${hotelData.address.line1}` : ''}
  ${hotelData.address.line2 ? `    - ${hotelData.address.line2}` : ''}
  ${hotelData.address.city ? `    - ${hotelData.address.city}` : ''}
  ${hotelData.address.state ? `    - ${hotelData.address.state}` : ''}
  ${hotelData.address.country ? `    - ${hotelData.address.country}` : ''}
  ${hotelData.address.postalCode ? `    - ${hotelData.address.postalCode}` : ''}
` : ''}
${hotelData.contacts && hotelData.contacts.general
    ? `- Contact:
  ${hotelData.contacts.general.email ? `    - E-mail: ${hotelData.contacts.general.email}` : ''}
  ${hotelData.contacts.general.phone ? `    - Phone: ${hotelData.contacts.general.phone}` : ''}
  ${hotelData.contacts.general.url ? `    - Web: ${hotelData.contacts.general.url}` : ''}
` : ''}
`;
  // Drop empty lines and return
  return template.replace(/^\s*[\r\n]/gm, '');
};

const formatCustomer = (customerData) => {
  const template = `
# Customer

${customerData.name ? `- Name: ${customerData.name}` : ''}
${customerData.surname ? `- Surname: ${customerData.surname}` : ''}
${customerData.email ? `- E-mail: ${customerData.email}` : ''}
${customerData.phone ? `- Phone: ${customerData.phone}` : ''}
${customerData.address
    ? `- Address:
  ${customerData.address.line1 ? `    - ${customerData.address.line1}` : ''}
  ${customerData.address.line2 ? `    - ${customerData.address.line2}` : ''}
  ${customerData.address.city ? `    - ${customerData.address.city}` : ''}
  ${customerData.address.state ? `    - ${customerData.address.state}` : ''}
  ${customerData.address.country ? `    - ${customerData.address.country}` : ''}
  ${customerData.address.postalCode ? `    - ${customerData.address.postalCode}` : ''}
` : ''}
`;
  // Drop empty lines and return
  return template.replace(/^\s*[\r\n]/gm, '');
};

const formatRoomList = (roomList) => {
  return roomList.map((r) => (`
    - ${r.roomType.name}: (People: ${r.guests.length})
`)).join('\n');
};

const formatCancellationFees = (cancellationFees) => {
  return cancellationFees.map((cf) => (`
    - If you cancel between ${dayjs(cf.from).format('YYYY-MM-DD')} and ${dayjs(cf.to).format('YYYY-MM-DD')} hotel will keep ${cf.amount}% of the total price
`)).join('\n');
};

const formatBooking = (data) => {
  const template = `
# Booking

- ID: ${data.id} (${data.status})
- Arrival: ${dayjs(data.arrival).format('YYYY-MM-DD')}
- Departure: ${dayjs(data.departure).format('YYYY-MM-DD')}
- Total: ${data.pricing.total} ${data.pricing.currency}
- Cancellation fees:
${formatCancellationFees(data.pricing.cancellationFees)}
- Rooms:
${formatRoomList(data.roomList)}
`;
  // Drop empty lines and return
  return template.replace(/^\s*[\r\n]/gm, '');
};

const hotelSubject = (data) => {
  const formattedArrival = (dayjs(data.arrival)).format('YYYY-MM-DD');
  const formattedDeparture = (dayjs(data.departure)).format('YYYY-MM-DD');
  return `New booking ${data.id}: ${formattedArrival} - ${formattedDeparture}`;
};

const hotelText = (data) => {
  const f = `
${formatHotel(data.hotel)}
${formatCustomer(data.customer)}
${formatBooking(data)}
${data.note
    ? `

# Note

${data.note}`
    : ''}
`;
  return f;
};

const hotelHtml = (data) => {
  const converter = new showdown.Converter();
  return converter.makeHtml(escapeHTML(hotelText(data)));
};

const customerSubject = (data) => {
  const formattedArrival = (dayjs(data.arrival)).format('YYYY-MM-DD');
  const formattedDeparture = (dayjs(data.departure)).format('YYYY-MM-DD');
  return `Booking confirmation in ${data.hotel.name} for ${formattedArrival} - ${formattedDeparture}`;
};

const customerText = (data) => {
  const f = `
${formatHotel(data.hotel)}
${formatCustomer(data.customer)}
${formatBooking(data)}
${data.note
    ? `
Note
====
${data.note}`
    : ''}
`;
  return f;
};

const customerHtml = (data) => {
  const converter = new showdown.Converter();
  return converter.makeHtml(escapeHTML(customerText(data)));
};

module.exports = {
  hotelSubject,
  hotelText,
  hotelHtml,
  customerSubject,
  customerText,
  customerHtml,
};
