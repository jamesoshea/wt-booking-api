const hotelSubject = () => {
  return 'Hotel confirmation';
};

const hotelText = () => {
  return 'hotel confirmation';
};

const hotelHtml = () => {
  return hotelText();
};

const customerSubject = () => {
  return 'Customer confirmation';
};

const customerText = () => {
  return 'customer confirmation';
};

const customerHtml = () => {
  return hotelHtml();
};

module.exports = {
  hotelSubject,
  hotelText,
  hotelHtml,
  customerSubject,
  customerText,
  customerHtml,
};
