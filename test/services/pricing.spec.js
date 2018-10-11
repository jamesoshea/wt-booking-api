/* eslint-env mocha */
const { assert } = require('chai');
const dayjs = require('dayjs');

const { computePrice, NoRatePlanError } = require('../../src/services/pricing');

function _getGuestData (guestAges) {
  return {
    helpers: {
      arrivalDateDayjs: dayjs('2019-03-02'),
      departureDateDayjs: dayjs('2019-03-12'),
      lengthOfStay: 10,
      numberOfGuests: guestAges.length,
    },
    guestAges: guestAges,
  };
};

describe('services - pricing', function () {
  describe('computePrice', () => {
    it('should correctly compute the price for the simple case', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [{ currency: 'EUR', price: 100, roomTypeIds: ['group'] }];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10);
    });

    it('should select the correct curency', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { currency: 'GBP', price: 70, roomTypeIds: ['group'] },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10);
    });

    it('should throw if no rate plan is available for the requested currency', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { price: 200, roomTypeIds: ['group'] },
        ];
      assert.throws(() => computePrice(bookingData, ratePlans, '2018-12-01', 'GBP', 'CHF'), NoRatePlanError);
    });

    it('should correctly assume the default currency for rate plans', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { price: 70, roomTypeIds: ['group'] },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'GBP', 'GBP'), 3 * 70 * 10);
    });

    it('should work with multiple booking items across several rooms', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            guestData: _getGuestData(['31', '32', '5']),
          },
          {
            roomType: { id: 'single' },
            guestData: _getGuestData(['55']),
          },
        ],
        ratePlans = [
          { currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { currency: 'EUR', price: 70, roomTypeIds: ['single'] },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10 + 70 * 10);
    });

    it('should select the correct rate plan based on availableForTravel', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 110, roomTypeIds: ['group'], availableForTravel: { from: '2018-01-01', to: '2018-12-31' } },
          { currency: 'EUR', price: 120, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-12-31' } },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 120 * 10);
    });

    it('should select the correct rate plan based on availableForReservation', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 140, roomTypeIds: ['group'], availableForReservation: { from: '2018-01-01', to: '2018-12-31' } },
          { currency: 'EUR', price: 100, roomTypeIds: ['group'], availableForReservation: { from: '2019-01-01', to: '2019-12-31' } },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 140 * 10);
    });

    it('should select the correct rate plan based on restrictions', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 110, roomTypeIds: ['group'], restrictions: { lengthOfStay: { min: 12 } } },
          { currency: 'EUR', price: 130, roomTypeIds: ['group'], restrictions: { lengthOfStay: { min: 8 } } },
          { currency: 'EUR', price: 120, roomTypeIds: ['group'], restrictions: { bookingCutOff: { min: 360 } } },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 130 * 10);
    });

    it('should throw NoRatePlanError when no applicable rate plan is available', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            guestData: _getGuestData(['31', '32', '5']),
          },
        ],
        ratePlans = [{ currency: 'EUR', price: 140, roomTypeIds: ['group'], availableForReservation: { from: '2020-01-01' } }];
      assert.throws(() => computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), NoRatePlanError);
    });

    it('should correctly combine multiple rate plans for a single booking item', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 110, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-03-05' } },
          { currency: 'EUR', price: 120, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-12-31' } },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 110 * 4 + 3 * 120 * 6);
    });

    it('should throw NoRatePlanError when rate plans cannot be combined to cover the whole stay', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { currency: 'EUR', price: 110, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-03-05' } },
          { currency: 'EUR', price: 120, roomTypeIds: ['group'], availableForTravel: { from: '2019-03-07', to: '2019-12-31' } },
        ];
      assert.throws(() => computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), NoRatePlanError);
    });

    it('should correctly apply the maxAge modifier', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', undefined, '5']),
        }],
        ratePlans = [
          {
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
            modifiers: [
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', maxAge: 7 },
                adjustment: -10,
              },
            ],
          },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 10 * 100 * 2 + 10 * 100 * 1 * 0.9);
    });

    it('should correctly apply the minOccupants modifier', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            guestData: _getGuestData(['31', '32', '5']),
          },
          {
            roomType: { id: 'group' },
            guestData: _getGuestData(['37', '35']),
          },
        ],
        ratePlans = [
          {
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
            modifiers: [
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minOccupants: 3 },
                adjustment: -20,
              },
            ],
          },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 10 * 100 * 2 + 10 * 100 * 3 * 0.8);
    });

    it('should correctly apply the minLengthOfStay modifier', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          {
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
            modifiers: [
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minLengthOfStay: 3 },
                adjustment: -20,
              },
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minLengthOfStay: 8 },
                adjustment: -40,
              },
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minLengthOfStay: 20 },
                adjustment: -60,
              },
            ],
          },
        ];
      assert.equal(computePrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 10 * 100 * 3 * 0.6);
    });
  });
});
