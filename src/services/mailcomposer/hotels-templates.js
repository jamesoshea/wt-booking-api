const dayjs = require('dayjs');
const escapeHTML = require('escape-html');
const showdown = require('showdown');
const PhoneNumber = require('awesome-phonenumber');
const addressFormatter = require('@fragaria/address-formatter');
const { normalizeAddress } = require('./common');

/**
 * mailData specs:
 *
 * ```
 * {
 *    customer: <Customer from docs/swagger.yaml>,
 *    note: <string>,
 *    hotel: <https://github.com/windingtree/wiki/blob/868b5d2685b1cd70647020978141be820ddccd30/hotel-data-swagger.yaml> limited to name, contacts, address
 *    arrival: <string, format date>,
 *    departure: <string, format date>,
 *    roomList: [
 *      {
 *        roomType: <https://github.com/windingtree/wiki/blob/868b5d2685b1cd70647020978141be820ddccd30/hotel-data-swagger.yaml#L141>,
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
  let generalPhone;
  if (hotelData.contacts && hotelData.contacts.general && hotelData.contacts.general.phone) {
    const pn = new PhoneNumber(hotelData.contacts.general.phone);
    generalPhone = pn.getNumber('international');
  }
  const template = `
# Hotel

${hotelData.name ? `- Name: ${hotelData.name}` : ''}
${hotelData.address
    ? `- Address:
    - ${addressFormatter.format(normalizeAddress(hotelData.address), { output: 'array' }).join('\n    - ')}
` : ''}
${hotelData.contacts && hotelData.contacts.general
    ? `- Contact:
${hotelData.contacts.general.email ? `    - E-mail: ${hotelData.contacts.general.email}` : ''}
${hotelData.contacts.general.phone ? `    - Phone: ${generalPhone}` : ''}
${hotelData.contacts.general.url ? `    - Web: ${hotelData.contacts.general.url}` : ''}
` : ''}
`;
  // Drop empty lines and return
  return template.replace(/^\s*[\r\n]/gm, '');
};

const formatCustomer = (customerData) => {
  let customerPhone;
  if (customerData.phone) {
    const pn = new PhoneNumber(customerData.phone);
    customerPhone = pn.getNumber('international');
  }
  const template = `
# Customer

${customerData.name ? `- Name: ${customerData.name}` : ''}
${customerData.surname ? `- Surname: ${customerData.surname}` : ''}
${customerData.email ? `- E-mail: ${customerData.email}` : ''}
${customerData.phone ? `- Phone: ${customerPhone}` : ''}
${customerData.address
    ? `- Address:
    - ${addressFormatter.format(normalizeAddress(customerData.address), { output: 'array' }).join('\n    - ')}
` : ''}
`;
  // Drop empty lines and return
  return template.replace(/^\s*[\r\n]/gm, '');
};

const formatRoomList = (roomList) => {
  return roomList.map((r) => {
    const guestList = r.guests.map((g, i) => {
      return `
        - Guest ${i + 1}: ${g.name ? `${g.name} ` : ''}${g.surname ? ` ${g.surname}` : ''}${g.age ? `${g.name || g.surname ? ', ' : ''}age ${g.age}` : ''}`;
    }).join('\n');
    return `
    - ${r.roomType.name} (People: ${r.guests.length})${guestList}`;
  }).join('\n');
};

const formatCancellationFees = (cancellationFees) => {
  return cancellationFees.map((cf) => (`
    - If you cancel between ${dayjs(cf.from).format('YYYY-MM-DD')} and ${dayjs(cf.to).format('YYYY-MM-DD')} hotel will keep ${cf.amount}% of the total price
`)).join('\n');
};

const formatSummary = (data) => {
  const template = `
# Summary

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
${formatSummary(data)}
${formatCustomer(data.customer)}
${data.note
    ? `
# Note
${data.note}`
    : ''}

${formatHotel(data.hotel)}
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
${formatSummary(data)}
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
  supplierSubject: hotelSubject,
  supplierText: hotelText,
  supplierHtml: hotelHtml,
  customerSubject,
  customerText,
  customerHtml,
};
