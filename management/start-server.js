#! /usr/bin/env node

require('./createdb.js');
const swagger = require('./resolve-swagger-references');
swagger.convertSchema();
require('../src/index.js');
