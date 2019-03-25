const path = require('path');
const YAML = require('yamljs');
const { SCHEMA_PATH } = require('../constants');
const { version } = require('../../package.json');
const { config } = require('../config');

const MODEL_DEFINITIONS = [
  '@windingtree/wt-shared-schemas',
  '@windingtree/wt-hotel-schemas',
  '@windingtree/wt-airline-schemas',
];

const normalizePath = (path) => {
  return path.replace('@', '').replace('/', '-');
};

const replaceReferences = (model, from, to) => {
  if (model.$ref) {
    model.$ref = model.$ref.replace(from, to);
  }
  if (typeof model === 'object') {
    for (let property in model) {
      replaceReferences(model[property], from, to);
    }
  }
  return model;
};

/**
 * Update $refs in model definition to local references.
 * @param model
 */
const resolveReferences = (model) => {
  if (model.$ref && model.$ref.startsWith('@windingtree/')) {
    for (let path of MODEL_DEFINITIONS) {
      // We cannot use nested schemas, because the swagger-model-validator does not support that
      model.$ref = model.$ref.replace(`${path}/swagger.yaml#/components/schemas/`, `#/components/schemas/${normalizePath(path)}-`);
    }
  }
  if (typeof model === 'object') {
    for (let property in model) {
      resolveReferences(model[property]);
    }
  }
  return model;
};

/**
 * Add referenced models to enable $ref resolution
 * @param model
 */
const addDefinitions = (model) => {
  for (let path of MODEL_DEFINITIONS) {
    let refDef = YAML.load(`node_modules/${path}/dist/swagger.yaml`);
    // We cannot use nested schemas, because the swagger-model-validator does not support that
    refDef = replaceReferences(refDef, '#/components/schemas/', `#/components/schemas/${normalizePath(path)}-`);
    model.components.schemas = Object.assign({},
      model.components.schemas,
      Object.keys(refDef.components.schemas).reduce((agg, curr) => {
        agg[`${normalizePath(path)}-${curr}`] = refDef.components.schemas[curr];
        return agg;
      }, {})
    );
  }
  return model;
};

const SCHEMA_CACHE = {};

const getSchema = (schemaPath = SCHEMA_PATH) => {
  if (SCHEMA_CACHE[schemaPath]) {
    return SCHEMA_CACHE[schemaPath];
  }
  let swaggerDocument = YAML.load(path.resolve(schemaPath));
  if (schemaPath === SCHEMA_PATH) {
    swaggerDocument.servers = [{ url: config.baseUrl }];
    swaggerDocument.info.version = version;
  }
  swaggerDocument = resolveReferences(swaggerDocument);
  const processed = addDefinitions(swaggerDocument);
  SCHEMA_CACHE[schemaPath] = processed;
  return SCHEMA_CACHE[schemaPath];
};

module.exports = {
  resolveReferences,
  addDefinitions,
  getSchema,
};
