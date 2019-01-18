/* eslint-env mocha */
/* eslint-disable standard/object-curly-even-spacing */
/* eslint-disable no-new */
const { assert } = require('chai');
const MailComposer = require('../../src/services/mailcomposer');

const nonAsciiTest = 'Příliš žluťoučký kůň úpěl ďábelské ódy\'s &<>$';
const noXssTest = 'random text with <b>HTML</b> and XSS <script>alert("xss");</script>';
const fakeMailData = {
  customer: {
    name: `${noXssTest} ${nonAsciiTest}`,
    surname: `${noXssTest} ${nonAsciiTest}`,
    email: 'test@example.com',
    phone: '00420123123123',
    address: {
      line1: `${noXssTest} ${nonAsciiTest}`,
      line2: `${noXssTest} ${nonAsciiTest}`,
      city: `${noXssTest} ${nonAsciiTest}`,
      state: `${noXssTest} ${nonAsciiTest}`,
      country: 'US',
      postalCode: 12345,
    },
  },
  note: `${noXssTest} ${nonAsciiTest}`,
  hotel: {
    name: `${noXssTest} ${nonAsciiTest}`,
    contacts: {
      general: {
        email: 'hotel@example.com',
        phone: '00420123123456',
        url: 'https://example.com',
      },
    },
    address: {
      line1: `${noXssTest} ${nonAsciiTest}`,
      line2: `${noXssTest} ${nonAsciiTest}`,
      city: `${noXssTest} ${nonAsciiTest}`,
      state: `${noXssTest} ${nonAsciiTest}`,
      country: 'US',
      postalCode: 12345,
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
        { name: `${noXssTest} ${nonAsciiTest}`, surname: `${noXssTest} ${nonAsciiTest}`, age: 17 },
      ],
    },
  ],
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

describe('services - mailcomposer', function () {
  it('should escape html', () => {
    const result = MailComposer.renderHotel(fakeMailData);
    assert.match(result.text, /<script>/i);
    assert.notMatch(result.html, /<script>/i);
  });
});
