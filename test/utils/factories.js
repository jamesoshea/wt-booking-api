const config = require('../../src/config');

module.exports.getHotelData = function () {
  return {
    name: 'Hotel Mazurka',
    contacts: {
      general: {
        email: 'info@hotel-mazurka.com',
        phone: '004078965423',
        url: 'https://www.hotel-mazurka.com',
      },
    },
    address: {
      line1: 'Transylvania Road 789',
      line2: '',
      postalCode: '33312',
      city: 'Dragolm',
      country: 'RO',
    },
    roomTypes: [
      {
        name: 'Single room - standard',
        description: 'Standard single-bed room with a private bathroom.',
        totalQuantity: 6,
        occupancy: {
          min: 1,
          max: 1,
        },
        amenities: [
          'TV',
        ],
        id: 'single-room',
        updatedAt: '2019-01-02T11:41:47.537Z',
      },
      {
        name: 'Double room',
        description: 'Room with a double bed',
        totalQuantity: 4,
        occupancy: {
          min: 1,
          max: 2,
        },
        amenities: [
          'TV',
        ],
        id: 'double-room',
        updatedAt: '2019-01-02T11:41:47.537Z',
      },
    ],
    id: '0xD8b8aF90986174d5c5558aAC0905AA1DB2Ee41ce',
  };
};

module.exports.getHotelBooking = function () {
  return {
    hotelId: config.adapterOpts.supplierId,
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
