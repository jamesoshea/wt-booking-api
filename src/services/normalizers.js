function normalizeEmail (email) {
  return email && email.trim && email.trim().toLowerCase();
}

function normalizePhone (phone) {
  if (!phone || !phone.trim) {
    return;
  }
  let normalizedPhone = phone.trim().replace(/ |-|\(|\)/gi, '');
  if (normalizedPhone.substring(0, 2) === '00') {
    return '+' + normalizedPhone.substring(2);
  }
  return normalizedPhone;
}

function normalizeBooking (bookingData) {
  if (bookingData.customer && bookingData.customer.phone) {
    bookingData.customer.phone = normalizePhone(bookingData.customer.phone);
  }

  if (bookingData.customer && bookingData.customer.email) {
    bookingData.customer.email = normalizeEmail(bookingData.customer.email);
  }
  return bookingData;
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeBooking,
};
