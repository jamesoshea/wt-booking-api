const dayjs = require('dayjs'),
  currencyjs = require('currency.js'),
  wtpas = require('@windingtree/wt-pricing-algorithms');

class NoRatePlanError extends Error {};

function computeHotelPrice (bookingData, ratePlans, bookingDate, currency, hotelCurrency) {
  bookingDate = dayjs(bookingDate);
  let total = currencyjs(0);
  for (let bookingItem of bookingData) {
    const computer = new wtpas.prices.PriceComputer([bookingItem.roomType], ratePlans, hotelCurrency);
    const item = computer.getBestPrice(
      bookingDate,
      bookingItem.arrival,
      bookingItem.departure,
      bookingItem.guests,
      currency
    );

    const desiredRoomType = item.find((r) => r.id === bookingItem.roomType.id);
    if (!desiredRoomType || !desiredRoomType.prices) {
      throw new NoRatePlanError('No rate plan found at all.');
    }
    const desiredCurrency = desiredRoomType.prices.find((p) => p.currency === currency);
    if (!desiredCurrency || !desiredCurrency.total) {
      throw new NoRatePlanError('No rate plan in desired currency found.');
    }
    total = total.add(
      currencyjs(desiredCurrency.total.format())
    );
  }
  return total;
}

module.exports = {
  computeHotelPrice,
  NoRatePlanError,
};
