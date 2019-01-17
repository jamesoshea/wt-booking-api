const path = require('path');

const bodyParser = require('body-parser');
const express = require('express');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const YAML = require('yamljs');

const config = require('./config');
const { version } = require('../package.json');
const booking = require(`./controllers/${config.segment}-booking`);
const { HttpError, HttpInternalError, Http404Error, HttpBadRequestError } = require('./errors');

const app = express();

// No need to leak information and waste bandwith with this header.
app.disable('x-powered-by');

// Swagger docs.
const swaggerDocument = YAML.load(path.resolve('./docs/swagger.yaml'));
swaggerDocument.servers = [{ url: config.baseUrl }];
swaggerDocument.info.version = version;
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(cors());

app.use(bodyParser.json());
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
app.get('/', (req, res) => {
  res.status(200).json({
    docs: `${config.baseUrl}/docs/`,
    info: 'https://github.com/windingtree/wt-booking-api/blob/master/README.md',
    version,
    config: process.env.WT_CONFIG,
  });
});

// Booking
app.post('/booking', booking.create);
app.delete('/booking/:id', booking.cancel);

// 404 handler
app.use('*', (req, res, next) => {
  next(new Http404Error());
});

// Error handler
app.use((err, req, res, next) => {
  if (!(err instanceof HttpError)) {
    config.logger.error(err.stack);
    err = new HttpInternalError();
  }
  res.status(err.status).json(err.toPlainObject());
});

module.exports = {
  app,
};
