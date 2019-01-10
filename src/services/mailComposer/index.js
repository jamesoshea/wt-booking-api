const {
  hotelSubject,
  hotelText,
  hotelHtml,
  customerSubject,
  customerText,
  customerHtml,
} = require('./templates');

const renderHotel = (mailData) => {
  return {
    subject: hotelSubject(mailData),
    text: hotelText(mailData),
    html: hotelHtml(mailData),
  };
};

const renderCustomer = (mailData) => {
  return {
    subject: customerSubject(mailData),
    text: customerText(mailData),
    html: customerHtml(mailData),
  };
};

module.exports = {
  renderHotel,
  renderCustomer,
};
