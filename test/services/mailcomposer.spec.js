/* eslint-env mocha */
/* eslint-disable standard/object-curly-even-spacing */
/* eslint-disable no-new */
const { assert } = require('chai');
const fs = require('fs');
const path = require('path');

const MailComposer = require('../../src/services/mailcomposer');
const { initSegment } = require('../../src/config/index');
const mdHotelContents = fs.readFileSync(path.resolve(__dirname, './hotel-mail.md'), { encoding: 'utf-8' });
const mdAirlineContents = fs.readFileSync(path.resolve(__dirname, './airline-mail.md'), { encoding: 'utf-8' });

const nonAsciiTest = 'Příliš žluťoučký kůň úpěl ďábelské ódy\'s &<>$';
const noXssTest = 'random text with <b>HTML</b> and XSS <script>alert("xss");</script>';
const fakeBaseMailData = {
  customer: {
    name: `${noXssTest} ${nonAsciiTest}`,
    surname: `${noXssTest} ${nonAsciiTest}`,
    email: 'test@example.com',
    phone: '+420123123123',
    address: {
      road: 'Welter street',
      houseNumber: '1234',
      city: 'Houston',
      countryCode: 'US',
      postcode: '12345',
    },
  },
  note: `${noXssTest} ${nonAsciiTest}`,
  pricing: {
    currency: 'CZK',
    total: 123.35,
    cancellationFees: [
      { from: '2019-01-01', to: '2019-01-03', amount: 100 },
    ],
  },
  id: `${noXssTest} ${nonAsciiTest}`,
  status: 'confirmed',
};
const fakeHotelMailData = Object.assign({
  hotel: {
    name: `${noXssTest} ${nonAsciiTest}`,
    contacts: {
      general: {
        email: 'hotel@example.com',
        phone: '+420123123456',
        url: 'https://example.com',
      },
    },
    address: {
      road: 'Welter street',
      houseNumber: '1234',
      city: 'Houston',
      countryCode: 'US',
      postcode: '12345',
    },
  },
  arrival: '2019-07-14',
  departure: '2019-07-21',
  roomList: [
    {
      roomType: {
        id: 'room-1',
        name: `${noXssTest} ${nonAsciiTest}`,
      },
      guests: [
        { name: `${noXssTest} ${nonAsciiTest}`, surname: `${noXssTest} ${nonAsciiTest}`, age: 13 },
        { age: 17 },
      ],
    },
  ],
}, fakeBaseMailData);
const fakeAirlineMailData = Object.assign({
  booking: {
    flightNumber: `${noXssTest} ${nonAsciiTest}`,
    flightInstanceId: `${noXssTest} ${nonAsciiTest}`,
    bookingClasses: [
      { id: 'economy', passengers: [ { name: 'Jeffrey', surname: 'Winger' } ] },
      { id: 'business', passengers: [ { name: 'John', surname: 'Watson' } ] },
    ],
  },
  flight: {
    id: 'qwerty',
    origin: 'PRG',
    destination: 'LAX',
    segments: [],
  },
  airline: {
    name: 'Mazurka Airlines',
    code: 'MA',
    contacts: {
      general: {
        email: 'info@airline-mazurka.com',
        phone: '+4078965423',
        url: 'https://www.airline-mazurka.com',
      },
    },
  },
}, fakeBaseMailData);

describe('services - mailcomposer hotels', function () {
  before(() => {
    process.env.WT_SEGMENT = 'hotels';
    initSegment();
  });

  it('should render markdown', () => {
    const result = MailComposer.renderSupplier(fakeHotelMailData);
    assert.equal(result.text, mdHotelContents);
  });

  it('should escape html', () => {
    const result = MailComposer.renderSupplier(fakeHotelMailData);
    assert.match(result.text, /<script>/i);
    assert.notMatch(result.html, /<script>/i);
  });
});

describe('services - mailcomposer airlines', function () {
  before(() => {
    process.env.WT_SEGMENT = 'airlines';
    initSegment();
  });

  it('should render markdown', () => {
    const result = MailComposer.renderSupplier(fakeAirlineMailData);
    assert.equal(result.text, mdAirlineContents);
  });

  it('should escape html', () => {
    const result = MailComposer.renderSupplier(fakeAirlineMailData);
    assert.match(result.text, /<script>/i);
    assert.notMatch(result.html, /<script>/i);
  });
});
