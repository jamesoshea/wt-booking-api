const { config } = require('../../src/config');

module.exports.getHotelData = function () {
  return {
    name: 'Hotel Mazurka',
    contacts: {
      general: {
        email: 'info@hotel-mazurka.com',
        phone: '+4078965423',
        url: 'https://www.hotel-mazurka.com',
      },
    },
    address: {
      road: 'Transylvania Road',
      houseNumber: '789',
      postcode: '33312',
      city: 'Dragolm',
      countryCode: 'RO',
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
        road: 'Baker Street',
        houseNumber: '221B',
        city: 'London',
        countryCode: 'GB',
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

module.exports.getAirlineData = function () {
  return {
    name: 'Mazurka Airlines',
    code: 'MA',
    contacts: {
      general: {
        email: 'info@airline-mazurka.com',
        phone: '+4078965423',
        url: 'https://www.airline-mazurka.com',
      },
    },
    flights: {
      updatedAt: '2019-01-01 12:00:00',
      items: [
        {
          id: 'IeKeix6G-1',
          origin: 'PRG',
          destination: 'LAX',
          segments: [
            {
              id: 'segment1',
              departureAirport: 'PRG',
              arrivalAirport: 'CDG',
            },
            {
              id: 'segment2',
              departureAirport: 'CDG',
              arrivalAirport: 'LAX',
            },
          ],
          flightInstancesUri: 'https://airline.com/flightinstancesone',
        },
        {
          id: 'IeKeix6G-1',
          origin: 'LON',
          destination: 'CAP',
          segments: [
            {
              id: 'segment1',
              departureAirport: 'LON',
              arrivalAirport: 'CAP',
            },
          ],
          flightInstancesUri: 'https://airline.com/flightinstancestwo',
        },
      ],
    },
    id: '0xD8b8aF90986174d5c5558aAC0905AA1DB2Ee41ce',
  };
};

module.exports.getFlightInstanceData = function () {
  return [{
    id: 'IeKeix6G-1',
    departureDateTime: '2018-12-10 12:00:00',
    bookingClasses: [
      { id: 'economy', availabilityCount: 100 },
      { id: 'business', availabilityCount: 20 },
    ],
  }, {
    id: 'IeKeix6G-2',
    departureDateTime: '2018-12-24 12:00:00',
    bookingClasses: [
      { id: 'economy', availabilityCount: 150 },
    ],
  }];
};

module.exports.getAirlineBooking = function () {
  return {
    airlineId: config.adapterOpts.supplierId,
    customer: {
      name: 'Sherlock',
      surname: 'Holmes',
      address: {
        road: 'Baker Street',
        houseNumber: '221B',
        city: 'London',
        countryCode: 'GB',
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
      flightInstanceId: 'IeKeix6G-1',
      flightNumber: 'OK0965',
      bookingClasses: [
        {
          bookingClassId: 'business',
          passengers: [ { name: 'Sherlock', surname: 'Holmes' } ],
        },
        {
          bookingClassId: 'economy',
          passengers: [ { name: 'John', surname: 'Watson' } ],
        },
      ],
    },
  };
};
