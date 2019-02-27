/* eslint-env mocha */
const { assert } = require('chai');

const { computeHotelPrice, NoRatePlanError } = require('../../src/services/pricing');

function _getGuestData (guestAges) {
  return {
    arrival: '2019-03-02',
    departure: '2019-03-12',
    guests: guestAges.map((g) => ({ age: g })),
  };
};

describe('services - pricing', function () {
  describe('computeHotelPrice', () => {
    it('should correctly compute the price for the simple case', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [{ currency: 'EUR', price: 100, roomTypeIds: ['group'] }];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10);
    });

    it('should select the correct curency', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { id: 'rp-2', currency: 'GBP', price: 70, roomTypeIds: ['group'] },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10);
    });

    it('should throw if no rate plan is available for the requested currency', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guests: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { id: 'rp-2', price: 200, roomTypeIds: ['group'] },
        ];
      assert.throws(() => computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'GBP', 'CHF'), NoRatePlanError);
    });

    it('should correctly assume the default currency for rate plans', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { id: 'rp-2', price: 70, roomTypeIds: ['group'] },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'GBP', 'GBP'), 3 * 70 * 10);
    });

    it('should work with multiple booking items across several rooms', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            ...(_getGuestData(['31', '32', '5'])),
          },
          {
            roomType: { id: 'single' },
            ...(_getGuestData(['55'])),
          },
        ],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 100, roomTypeIds: ['group'] },
          { id: 'rp-2', currency: 'EUR', price: 70, roomTypeIds: ['single'] },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 100 * 10 + 70 * 10);
    });

    it('should select the correct rate plan based on availableForTravel', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 110, roomTypeIds: ['group'], availableForTravel: { from: '2018-01-01', to: '2018-12-31' } },
          { id: 'rp-2', currency: 'EUR', price: 120, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-12-31' } },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 120 * 10);
    });

    it('should select the correct rate plan based on availableForReservation', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 140, roomTypeIds: ['group'], availableForReservation: { from: '2018-01-01', to: '2018-12-31' } },
          { id: 'rp-2', currency: 'EUR', price: 100, roomTypeIds: ['group'], availableForReservation: { from: '2019-01-01', to: '2019-12-31' } },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 140 * 10);
    });

    it('should select the correct rate plan based on restrictions', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 110, roomTypeIds: ['group'], restrictions: { lengthOfStay: { min: 12 } } },
          { id: 'rp-2', currency: 'EUR', price: 130, roomTypeIds: ['group'], restrictions: { lengthOfStay: { min: 8 } } },
          { id: 'rp-3', currency: 'EUR', price: 120, roomTypeIds: ['group'], restrictions: { bookingCutOff: { min: 360 } } },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 130 * 10);
    });

    it('should throw NoRatePlanError when no applicable rate plan is available', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            ...(_getGuestData(['31', '32', '5'])),
          },
        ],
        ratePlans = [{ id: 'rp-1', currency: 'EUR', price: 140, roomTypeIds: ['group'], availableForReservation: { from: '2020-01-01' } }];
      assert.throws(() => computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), NoRatePlanError);
    });

    it('should correctly combine multiple rate plans for a single booking item', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 110, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-03-05' } },
          { id: 'rp-2', currency: 'EUR', price: 120, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-12-31' } },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 3 * 110 * 4 + 3 * 120 * 6);
    });

    it('should throw NoRatePlanError when rate plans cannot be combined to cover the whole stay', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          guestData: _getGuestData(['31', '32', '5']),
        }],
        ratePlans = [
          { id: 'rp-1', currency: 'EUR', price: 110, roomTypeIds: ['group'], availableForTravel: { from: '2019-01-01', to: '2019-03-05' } },
          { id: 'rp-2', currency: 'EUR', price: 120, roomTypeIds: ['group'], availableForTravel: { from: '2019-03-07', to: '2019-12-31' } },
        ];
      assert.throws(() => computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), NoRatePlanError);
    });

    it('should correctly apply the maxAge modifier', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', undefined, '5'])),
        }],
        ratePlans = [
          {
            id: 'rp-1',
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
            modifiers: [
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', maxAge: 7 },
                adjustment: -10,
                unit: 'percentage',
              },
            ],
          },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 10 * 100 * 2 + 10 * 100 * 1 * 0.9);
    });

    it('should correctly apply the minOccupants modifier', () => {
      const bookingData = [
          {
            roomType: { id: 'group' },
            ...(_getGuestData(['31', '32', '5'])),
          },
          {
            roomType: { id: 'group' },
            ...(_getGuestData(['37', '35'])),
          },
        ],
        ratePlans = [
          {
            id: 'rp-1',
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
            modifiers: [
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minOccupants: 3 },
                adjustment: -20,
                unit: 'percentage',
              },
            ],
          },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 10 * 100 * 2 + 10 * 100 * 3 * 0.8);
    });

    it('should correctly apply the minLengthOfStay modifier', () => {
      const bookingData = [{
          roomType: { id: 'group' },
          ...(_getGuestData(['31', '32', '5'])),
        }],
        ratePlans = [
          {
            id: 'rp-1',
            currency: 'EUR',
            price: 100,
            roomTypeIds: ['group'],
            modifiers: [
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minLengthOfStay: 3 },
                adjustment: -20,
                unit: 'percentage',
              },
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minLengthOfStay: 8 },
                adjustment: -40,
                unit: 'percentage',
              },
              {
                conditions: { from: '2019-01-01', to: '2019-12-31', minLengthOfStay: 20 },
                adjustment: -60,
                unit: 'percentage',
              },
            ],
          },
        ];
      assert.equal(computeHotelPrice(bookingData, ratePlans, '2018-12-01', 'EUR', 'EUR'), 10 * 100 * 3 * 0.6);
    });
  });

  describe('computeAirlinePrice', () => {

  });
});
