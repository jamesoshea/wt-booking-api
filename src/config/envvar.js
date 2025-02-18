const knex = require('knex');

const convertEnvVarToList = (val, defaults) => {
  if (val === undefined) {
    return defaults;
  }
  return val.split(',');
};

const convertEnvVarToBoolean = (val, defaults) => {
  if (val === undefined) {
    return defaults;
  }
  switch (val.toLowerCase().trim()) {
  case '1':
  case 'true':
  case 'yes':
    return true;
  case '0':
  case 'false':
  case 'no':
    return false;
  default:
    return defaults;
  }
};

if (process.env.DEFAULT_BOOKING_STATE && process.env.DEFAULT_BOOKING_STATE !== 'confirmed' && process.env.DEFAULT_BOOKING_STATE !== 'pending') {
  throw new Error('DEFAULT_BOOKING_STATE has to be `confirmed` or `pending`');
}

module.exports = {
  db: knex({
    client: process.env.DB_CLIENT,
    connection: JSON.parse(process.env.DB_CLIENT_OPTIONS || '{}'),
    useNullAsDefault: true,
  }),
  throttling: {
    allow: convertEnvVarToBoolean(process.env.THROTTLING_ALLOW, true),
  },
  adapterOpts: {
    baseUrl: process.env.BASE_URL,
    readApiUrl: process.env.READ_API_URL,
    writeApiUrl: process.env.WRITE_API_URL,
    supplierId: process.env.SUPPLIER_ID,
    writeApiAccessKey: process.env.WRITE_API_KEY,
    writeApiWalletPassword: process.env.WALLET_PASSWORD,
  },
  checkOpts: {
    availability: convertEnvVarToBoolean(process.env.CHECK_AVAILABILITY, true),
    cancellationFees: convertEnvVarToBoolean(process.env.CHECK_CANCELLATION_FEES, true),
    totalPrice: convertEnvVarToBoolean(process.env.CHECK_TOTAL_PRICE, true),
  },
  wtLibsOptions: {
    onChainDataOptions: {
      provider: process.env.ETH_NETWORK_PROVIDER,
    },
    trustClueOptions: JSON.parse(process.env.TRUST_CLUE_OPTIONS || '{}'), // TODO improve this, JSON.parse is not enough
  },
  defaultBookingState: process.env.DEFAULT_BOOKING_STATE || 'confirmed',
  allowUnsignedBookingRequests: convertEnvVarToBoolean(process.env.ALLOW_UNSIGNED_BOOKING_REQUESTS, true),
  updateAvailability: convertEnvVarToBoolean(process.env.UPDATE_AVAILABILITY, true),
  allowCancel: convertEnvVarToBoolean(process.env.ALLOW_CANCELLATION, true),
  mailing: {
    sendSupplier: convertEnvVarToBoolean(process.env.MAIL_SUPPLIER_CONFIRMATION_SEND, false),
    sendCustomer: convertEnvVarToBoolean(process.env.MAIL_CUSTOMER_CONFIRMATION_SEND, false),
    supplierAddress: process.env.MAIL_SUPPLIER_CONFIRMATION_ADDRESS || undefined,
  },
  mailerOpts: {
    provider: process.env.MAIL_PROVIDER || undefined, // dummy, sendgrid
    providerOpts: JSON.parse(process.env.MAIL_PROVIDER_OPTIONS || '{}'),
  },
  spamProtectionOptions: {
    whitelist: convertEnvVarToList(process.env.SPAM_WHITELIST, []),
    blacklist: convertEnvVarToList(process.env.SPAM_BLACKLIST, []),
  },
};
