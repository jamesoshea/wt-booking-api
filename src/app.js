const bodyParser = require('body-parser');
const express = require('express');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const path = require('path');
const YAML = require('yamljs');
const slash = require('express-slash');
const rateLimit = require('express-rate-limit');

let { config } = require('./config');
const { version } = require('../package.json');
const { cancelBooking, createBooking } = require('./controllers/index');
const { HttpError, HttpInternalError, Http404Error, HttpBadRequestError } = require('./errors');

const app = express();

// No need to leak information and waste bandwith with this header.
app.disable('x-powered-by');
app.enable('strict routing'); // used by express-slash
app.enable('trust proxy'); // used by express-rate-limit, required behind a reverse-proxy

// Swagger docs.
const swaggerDocument = YAML.load(path.resolve(__dirname, '../docs/swagger.yaml'));
swaggerDocument.servers = [{ url: config.baseUrl }];
swaggerDocument.info.version = version;
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(cors());

app.use(bodyParser.json({
  // Use parser's `verify` callback to get raw (unparsed) body of the request. Is used for signing verification.
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  },
}));
app.use((err, req, res, next) => {
  // Catch and handle bodyParser errors.
  if (err.statusCode === 400 && err.type === 'entity.parse.failed') {
    return next(new HttpBadRequestError('badRequest', 'Invalid JSON.'));
  }
  next(err);
});

// Logg HTTP requests.
app.use(morgan(':remote-addr :remote-user [:date[clf]] :method :url HTTP/:http-version :status :res[content-length] - :response-time ms', {
  stream: {
    write: (msg) => config.logger.info(msg),
  },
}));

// Root handler
app.get('/', async (req, res) => {
  res.status(200).json({
    docs: `${config.baseUrl}/docs/`,
    info: 'https://github.com/windingtree/wt-booking-api/blob/master/README.md',
    version,
    config: process.env.WT_CONFIG,
    allowUnsignedBookingRequests: config.allowUnsignedBookingRequests,
    allowThrottling: config.throttling.allow,
    trustClues: await config.wtLibs.getTrustClueClient().getMetadataForAllClues(),
    whitelist: config.spamProtectionOptions.whitelist,
    blacklist: config.spamProtectionOptions.blacklist,
  });
});

// Booking
const router = express.Router({
  strict: true,
});
const throttle = (opts) => {
  const options = Object.assign({
    max: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Too many bookings created from this IP address',
    keyGenerator: function (req) {
      return req.ip;
    },
  }, opts);
  if (config.throttling && config.throttling.allow) {
    return rateLimit(options);
  } else {
    return function (req, res, next) {
      return next();
    };
  }
};

router.post('/booking', throttle(), createBooking);
router.delete('/booking/:id', throttle({
  message: 'Too many bookings cancelled from this IP address',
}), cancelBooking);

app.use(router);
app.use(slash());

// 404 handler
app.use('*', (req, res, next) => {
  next(new Http404Error());
});

// Error handler
app.use((err, req, res, next) => {
  if (!(err instanceof HttpError)) {
    config.logger.error(err.stack);
    err = new HttpInternalError(null, err.originalError, err.message);
  }
  const response = res.status(err.status);
  if (err.headers) {
    response.set(err.headers);
  }
  response.json(err.toPlainObject());
});

module.exports = {
  app,
};
