/*
 * Taken from WT hotel explorer and adapted slightly.
 */

const dayjs = require('dayjs'),
  currencyjs = require('currency.js');

function selectApplicableModifiers (guestData, modifiers, dateDayjs) {
  if (!modifiers || !modifiers.length) {
    return [];
  }
  // Drop modifiers not fitting the overall guest data
  let maxMinLOS;
  let maxMinOccupants;
  // Some modifiers might be affecting the same thing, but we can't
  // modify the original array while iterating over it, so they
  // get deleted later.
  const elementsToDrop = [];
  const applicableModifiers = modifiers.filter((mod) => {
    // no conditions - no modifier
    if (!mod.conditions) {
      return false;
    }
    // date limits
    if (mod.conditions.from && dayjs(mod.conditions.from).diff(dateDayjs, 'days') > 0) {
      return false;
    }
    if (mod.conditions.to && dayjs(mod.conditions.to).diff(dateDayjs, 'days') < 0) {
      return false;
    }
    // LOS condition
    if (mod.conditions.minLengthOfStay) {
      if (mod.conditions.minLengthOfStay > guestData.helpers.lengthOfStay) {
        return false;
      }
      if (maxMinLOS && mod.conditions.minLengthOfStay < maxMinLOS.conditions.minLengthOfStay) {
        return false;
      }
      if (maxMinLOS) {
        elementsToDrop.push(maxMinLOS);
      }
      maxMinLOS = mod;
      return true;
    }
    // Occupants condition
    if (mod.conditions.minOccupants) {
      if (mod.conditions.minOccupants > guestData.helpers.numberOfGuests) {
        return false;
      }
      if (maxMinOccupants && mod.conditions.minOccupants < maxMinOccupants.conditions.minOccupants) {
        return false;
      }
      if (maxMinOccupants) {
        elementsToDrop.push(maxMinOccupants);
      }
      maxMinOccupants = mod;
      return true;
    }
    return true;
  });
  return applicableModifiers.filter(mod => elementsToDrop.indexOf(mod) === -1);
}

function selectBestGuestModifier (modifiers, age) {
  const ageModifiers = modifiers.filter(mod => mod.conditions.maxAge !== undefined);
  const selectedAgeModifier = ageModifiers.reduce((best, current) => {
    if (current.conditions.maxAge >= age && ( // guest is under the bar
      !best || // no best has yet been setup
      // current has a closer limit than the best
      best.conditions.maxAge > current.conditions.maxAge ||
      ( // the limit is the same, but current has better price adjustment
        best.conditions.maxAge === current.conditions.maxAge &&
        best.adjustment > current.adjustment
      )
    )) {
      return current;
    }
    return best;
  }, undefined);
  if (selectedAgeModifier) {
    return selectedAgeModifier;
  }
  // Fallback to a best offer, no age-specific modifier matched
  const genericModifiers = modifiers
    .filter(mod => mod.conditions.maxAge === undefined)
    .sort((a, b) => (a.adjustment <= b.adjustment ? -1 : 1));
  return genericModifiers[0];
}

function getApplicableRatePlans (guestData, roomType, ratePlans, bookingDate, currency, hotelCurrency) {
  return ratePlans.filter((rp) => {
    // Rate plan is not tied to this room type
    if (rp.roomTypeIds.indexOf(roomType.id) === -1) {
      return false;
    }

    // Rate plan has a different currency than requested.
    if ((rp.currency || hotelCurrency) !== currency) {
      return false;
    }

    // Filter out rate plans by dates
    if (rp.availableForReservation) {
      // Rate plan cannot be used today
      const availableForReservationFrom = dayjs(rp.availableForReservation.from);
      const availableForReservationTo = dayjs(rp.availableForReservation.to);
      if (availableForReservationTo.isBefore(bookingDate) ||
          availableForReservationFrom.isAfter(bookingDate)) {
        return false;
      }
    }

    if (rp.availableForTravel) {
      // Rate plan is totally out of bounds of travel dates
      const availableForTravelFrom = dayjs(rp.availableForTravel.from);
      const availableForTravelTo = dayjs(rp.availableForTravel.to);
      if (availableForTravelTo.isBefore(guestData.helpers.arrivalDateDayjs) ||
          availableForTravelFrom.isAfter(guestData.helpers.departureDateDayjs)) {
        return false;
      }
    }

    // apply general restrictions if any
    if (rp.restrictions) {
      if (rp.restrictions.bookingCutOff) {
        if (rp.restrictions.bookingCutOff.min &&
          dayjs(guestData.helpers.arrivalDateDayjs)
            .subtract(rp.restrictions.bookingCutOff.min, 'days')
            .isBefore(bookingDate)
        ) {
          return false;
        }

        if (rp.restrictions.bookingCutOff.max &&
          dayjs(guestData.helpers.arrivalDateDayjs)
            .subtract(rp.restrictions.bookingCutOff.max, 'days')
            .isAfter(bookingDate)
        ) {
          return false;
        }
      }
      if (rp.restrictions.lengthOfStay) {
        if (rp.restrictions.lengthOfStay.min &&
          rp.restrictions.lengthOfStay.min > guestData.helpers.lengthOfStay
        ) {
          return false;
        }

        if (rp.restrictions.lengthOfStay.max &&
          rp.restrictions.lengthOfStay.max < guestData.helpers.lengthOfStay
        ) {
          return false;
        }
      }
    }

    return true;
  });
}

function computeDailyPrice (guestData, dateDayjs, ratePlan) {
  const applicableModifiers = selectApplicableModifiers(
    guestData, ratePlan.modifiers, dateDayjs,
  );
  if (!applicableModifiers.length) {
    return currencyjs(ratePlan.price).multiply(guestData.helpers.numberOfGuests);
  }

  const guestPrices = [];
  let selectedModifier;
  let adjustment;
  for (let i = 0; i < guestData.guestAges.length; i += 1) {
    adjustment = 0;
    // Pick the best modifier for each guest and adjust the price
    selectedModifier = selectBestGuestModifier(applicableModifiers, guestData.guestAges[i]);
    if (selectedModifier) {
      adjustment = (selectedModifier.adjustment / 100) * ratePlan.price;
    }
    guestPrices.push(ratePlan.price + adjustment);
  }
  return guestPrices.reduce((a, b) => a.add(currencyjs(b)), currencyjs(0));
}

function computeStayPrices (guestData, applicableRatePlans) {
  const dailyPrices = [];
  let currentDate = dayjs(guestData.helpers.arrivalDateDayjs);
  // Find an appropriate rate plan for every day
  for (let i = 0; i < guestData.helpers.lengthOfStay; i += 1) {
    let currentRatePlan,
      bestDailyPrice;

    // Loop over all rate plans and find the most fitting one for that day.
    for (let j = 0; j < applicableRatePlans.length; j += 1) {
      currentRatePlan = applicableRatePlans[j];

      let useRatePlan = true;
      if (currentRatePlan.availableForTravel) {
        // Deal with a rate plan ending sometimes during the stay
        const availableForTravelFrom = dayjs(currentRatePlan.availableForTravel.from);
        const availableForTravelTo = dayjs(currentRatePlan.availableForTravel.to);
        useRatePlan = (!currentDate.isBefore(availableForTravelFrom) && !currentDate.isAfter(availableForTravelTo));
      }
      if (useRatePlan) {
        const currentDailyPrice = computeDailyPrice(
          guestData, currentDate, currentRatePlan,
        );
        if (!bestDailyPrice || currentDailyPrice.subtract(bestDailyPrice) <= 0) {
          bestDailyPrice = currentDailyPrice;
        }
      }
    }
    dailyPrices.push(bestDailyPrice);
    currentDate = currentDate.add(1, 'day');
  }
  if (dailyPrices.length < guestData.helpers.lengthOfStay || dailyPrices.indexOf(undefined) > -1) {
    throw new Error('The whole stay cannot be covered'); // TODO: throw a specific error class
  }
  return dailyPrices;
}

module.exports.computePrice = function (bookingData, ratePlans, bookingDate, currency, hotelCurrency) {
  bookingDate = dayjs(bookingDate);
  let total = currencyjs(0);
  for (let bookingItem of bookingData) {
    const applicableRatePlans = getApplicableRatePlans(
      bookingItem.guestData, bookingItem.roomType, ratePlans, bookingDate, currency, hotelCurrency,
    );
    if (applicableRatePlans.length === 0) {
      throw new Error('No available plan'); // TODO throw a specific error class
    }
    const dailyPrices = computeStayPrices(bookingItem.guestData, applicableRatePlans),
      itemPrice = dailyPrices.reduce((a, b) => a.add(currencyjs(b)), currencyjs(0));
    total = total.add(itemPrice);
  }
  return total;
};
