const config = require('../../src/config');

module.exports.getBooking = function () {
  return {
    hotelId: config.adapterOpts.hotelId,
    customer: {
      name: 'Sherlock',
      surname: 'Holmes',
      address: {
        line1: '221B Baker Street',
        city: 'London',
        country: 'GB',
      },
      email: 'sherlock.holmes@houndofthebaskervilles.net',
    },
    pricing: {
      currency: 'GBP',
      total: 221,
      cancellationFees: [
        { from: '2018-12-01', to: '2019-01-01', amount: 50 },
      ],
    },
    booking: {
      arrival: '2019-01-01',
      departure: '2019-01-03',
      rooms: [
        {
          id: 'single-room',
          guestInfoIds: ['1'],
        },
        {
          id: 'single-room',
          guestInfoIds: ['2'],
        },
      ],
      guestInfo: [
        {
          id: '1',
          name: 'Sherlock',
          surname: 'Holmes',
        },
        {
          id: '2',
          name: 'John',
          surname: 'Watson',
        },
      ],
    },
  };
};
