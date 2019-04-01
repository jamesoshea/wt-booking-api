const winston = require('winston');
const assert = require('assert');
const { HOTEL_SEGMENT_ID, AIRLINE_SEGMENT_ID } = require('../constants');

const env = process.env.WT_CONFIG || 'dev';

const config = Object.assign({
  port: 8935,
  baseUrl: process.env.BASE_URL || 'http://localhost:8935',
  logger: winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ['error'],
      }),
    ],
  }),
  throttling: {
    allow: false,
  },
  adapterOpts: {
    // In your env config, replace these with suitable values.
    readApiUrl: 'http://localhost:3000',
    writeApiUrl: 'http://localhost:8000',
    supplierId: '0xe92a8f9a7264695f4aed8d1f397dbc687ba40299',
    writeApiAccessKey: 'usgq6tSBW+wDYA/MBF367HnNp4tGKaCT',
    writeApiWalletPassword: 'windingtree',
  },
  // These options are good for testing or APIs that actually pass
  // data to humans that are responsible for data validation. These
  // should never be turned off in fully automated production-like
  // environment
  checkOpts: {
    availability: true, // If false, no restrictions and no room quantity is checked. This may lead to overbooking.
    cancellationFees: true, // If false, passed cancellation fees are not validated. This may lead to conditions unfavourable for a supplier
    totalPrice: true, // If false, the price is not validated against ratePlans/bookingClasses. This may lead to conditions unfavourable for a supplier
  },
  defaultBookingState: 'confirmed', // Or 'pending'
  updateAvailability: true, // If false, availability is not updated in data stored in WT platform
  allowCancel: true, // If false, booking cancellation is not allowed.
  mailing: {
    sendSupplier: false, // If true, a summary of each accepted booking is sent to supplierAddress. Requires configured mailer.
    sendCustomer: false, // If true, a summary of each accepted booking is sent to the customer. Requires configured mailer.
    supplierAddress: undefined,
  },
  mailerOpts: {
    provider: undefined, // dummy, sendgrid (or other if implemented)
    providerOpts: {
      from: 'booking-noreply@windingtree.com', // E-mail originator
    },
  },
}, require(`./${env}`));

const initSegment = () => {
  const segment = process.env.WT_SEGMENT || 'hotels';
  assert([HOTEL_SEGMENT_ID, AIRLINE_SEGMENT_ID].indexOf(segment) !== -1);
  config.segment = segment;
  return config;
};
initSegment();

module.exports = {
  config,
  initSegment,
};
