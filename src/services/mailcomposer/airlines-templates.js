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
 *   },
 *   pricing: <Booking.pricing from docs/swagger.yaml>,
 *   id: <string identifying this booking in local DB>,
 *   status: <string, status of this booking in local DB>,
 * }
 * ```
 */

const formatAirline = (airlineData) => {
  const template = `
# Airline

${airlineData.name ? `- Name: ${airlineData.name}` : ''}
${airlineData.code ? `- Code: ${airlineData.code}` : ''}
${airlineData.contacts && airlineData.contacts.general
    ? `- Contact:
  ${airlineData.contacts.general.email ? `    - E-mail: ${airlineData.contacts.general.email}` : ''}
  ${airlineData.contacts.general.phone ? `    - Phone: ${airlineData.contacts.general.phone}` : ''}
  ${airlineData.contacts.general.url ? `    - Web: ${airlineData.contacts.general.url}` : ''}
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

const formatPassengers = (passengers) => {
  return passengers.map((p) => (`${p.name} ${p.surname}`)).join(', ');
};

const formatFlight = (booking) => {
  return booking.bookingClasses.map((c) => (`
  - ${c.bookingClassId}: (Passengers: ${formatPassengers(c.passengers)})
`)).join('\n');
};

const formatCancellationFees = (cancellationFees) => {
  return cancellationFees.map((cf) => (`
    - If you cancel between ${dayjs(cf.from).format('YYYY-MM-DD')} and ${dayjs(cf.to).format('YYYY-MM-DD')} airline will keep ${cf.amount}% of the total price
`)).join('\n');
};

const formatBooking = (data) => {
  const template = `
# Summary

- ID: ${data.id} (${data.status})
- Flight Nr: ${data.booking.flightNumber}
- FlightID: ${data.booking.id}
- Total: ${data.pricing.total} ${data.pricing.currency}
- Cancellation fees:
${formatCancellationFees(data.pricing.cancellationFees)}
- Flight:
${formatFlight(data.booking)}
`;
  // Drop empty lines and return
  return template.replace(/^\s*[\r\n]/gm, '');
};

const airlineSubject = (data) => {
  return `New booking ${data.id}: Flight nr ${data.booking.flightNumber} (flight id: ${data.booking.flightId})`;
};

const airlineText = (data) => {
  const f = `
${formatBooking(data)}
${formatCustomer(data.customer)}
${data.note
    ? `
# Note
${data.note}`
    : ''}

${formatAirline(data.airline)}
`;
  return f;
};

const airlineHtml = (data) => {
  const converter = new showdown.Converter();
  return converter.makeHtml(escapeHTML(airlineText(data)));
};

const customerSubject = (data) => {
  return `Booking confirmation ${data.id} with ${data.airline.name}: Flight nr ${data.booking.flightNumber}`;
};

const customerText = (data) => {
  const f = `
${formatAirline(data.airline)}
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
  supplierSubject: airlineSubject,
  supplierText: airlineText,
  supplierHtml: airlineHtml,
  customerSubject,
  customerText,
  customerHtml,
};
