/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const {
  resolveReferences,
  addDefinitions,
  getSchema,
} = require('../../src/services/api-schema');

describe('API schema', function () {
  const model = {
    'openapi': '3.0.0',
    'servers': [],
    'info': {
      'version': '0.12.1',
    },
    'paths': {},
    'components': {
      'schemas': {
        'HotelDetail': {
          'allOf': [
            {
              '$ref': '@windingtree/wt-hotel-schemas/swagger.yaml#/components/schemas/HotelDescriptionBase',
            },
            {
              'type': 'object',
              'required': [
                'id',
              ],
              'properties': {
                'id': {
                  '$ref': '#/components/schemas/EthereumAddressType',
                },
              },
            },
          ],
        },
      },
    },
  };
  describe('resolveReferences', () => {
    it('should not touch non-@windingtree references', () => {
      const transformed = resolveReferences(model);
      expect(transformed.components.schemas.HotelDetail.allOf[1].properties.id.$ref).to.be.equal('#/components/schemas/EthereumAddressType');
    });

    it('should replace @windingtree references with local namespaced ones', () => {
      const transformed = resolveReferences(model);
      expect(transformed.components.schemas.HotelDetail.allOf[0].$ref).to.be.equal('#/components/schemas/windingtree-wt-hotel-schemas-HotelDescriptionBase');
    });
  });

  describe('addDefinitions', () => {
    it('should copy over definitions to their own namespace', () => {
      const transformed = addDefinitions(model);
      expect(transformed.components.schemas).to.have.property('windingtree-wt-hotel-schemas-HotelDescriptionBase');
      expect(transformed.components.schemas['windingtree-wt-hotel-schemas-HotelDescriptionBase'].properties.address.$ref).to.be.equal('#/components/schemas/windingtree-wt-hotel-schemas-AddressType');
    });
  });

  describe('getSchema', () => {
    it('should return the whole schema', () => {
      const schema = getSchema();
      expect(schema.components.schemas.Customer.properties.address.$ref).to.be.equal('#/components/schemas/windingtree-wt-shared-schemas-AddressType');
      expect(schema.components.schemas).to.have.property('windingtree-wt-shared-schemas-AddressType');
      expect(schema.components.schemas).to.have.property('windingtree-wt-hotel-schemas-HotelDescription');
      expect(schema.components.schemas['windingtree-wt-hotel-schemas-HotelDescriptionBase'].properties.address.$ref).to.be.equal('#/components/schemas/windingtree-wt-hotel-schemas-AddressType');
    });
  });
});
