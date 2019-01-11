const config = require('../../config');
let _opts;

const initialize = (opts) => {
  _opts = opts;
};

const sendMail = (params) => {
  config.logger.debug(`Dummy Mailer sendMail:\n    params: ${JSON.stringify(params)}\n    _opts: ${JSON.stringify(_opts)}`);
  return Promise.resolve({
    status: 'OK',
  });
};

module.exports = {
  initialize,
  sendMail,
};
