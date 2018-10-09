/* eslint-env mocha */
const { assert } = require('chai');
const dayjs = require('dayjs');

const { computePrice } = require('../../src/services/pricing');

describe('services - pricing', function () {
  describe('computePrice', () => {
    it('should compute the price in the simple case', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: {
            helpers: {
              arrivalDateDayJs: dayjs('2019-03-02'),
              departureDateDayJs: dayjs('2019-03-12'),
              lengthOfStay: 10,
              guestAges: ['31', '32', '5'],
              numberOfGuests: 3,
            },
          },
        }],
        ratePlans = [
          {
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
          },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10);
    });

    it('should work with multiple booking items across the same room', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            guestData: {
              helpers: {
                arrivalDateDayJs: dayjs('2019-03-02'),
                departureDateDayJs: dayjs('2019-03-12'),
                lengthOfStay: 10,
                guestAges: ['31', '32', '5'],
                numberOfGuests: 3,
              },
            },
          },
          {
            roomType: { id: 'group' },
            guestData: {
              helpers: {
                arrivalDateDayJs: dayjs('2019-03-02'),
                departureDateDayJs: dayjs('2019-03-12'),
                lengthOfStay: 10,
                guestAges: ['47', '47'],
                numberOfGuests: 2,
              },
            },
          },
        ],
        ratePlans = [
          {
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
          },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 5 * 100 * 10);
    });

    it('should work with multiple booking items across several rooms', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            guestData: {
              helpers: {
                arrivalDateDayJs: dayjs('2019-03-02'),
                departureDateDayJs: dayjs('2019-03-12'),
                lengthOfStay: 10,
                guestAges: ['31', '32', '5'],
                numberOfGuests: 3,
              },
            },
          },
          {
            roomType: { id: 'single' },
            guestData: {
              helpers: {
                arrivalDateDayJs: dayjs('2019-03-02'),
                departureDateDayJs: dayjs('2019-03-12'),
                lengthOfStay: 10,
                guestAges: ['55'],
                numberOfGuests: 1,
              },
            },
          },
        ],
        ratePlans = [
          {
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
          },
          {
            currency: 'EUR',
            price: 70,
            roomTypeIds: ['single'],
          },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10 + 70 * 10);
    });
  });
});
