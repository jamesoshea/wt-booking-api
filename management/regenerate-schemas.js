const openapi2schema = require('openapi2schema');
const fs = require('fs');

/**
 * Usage: `npm run regenerate-schemas`
 * Use this after updating swagger.yaml to update json object schemas used for validation.
 *
 * Build will fail if changes are found at build time.
 * $ [ -z "$(git diff --name-status --diff-filter=M src/services/validators/)" ] || exit 1
 */

const SCHEMA_DEFS = [
  {
    order: 1,
    filePath: 'src/services/validators/airline-booking-schema.json',
  },
  {
    order: 0,
    filePath: 'src/services/validators/hotel-booking-schema.json',
  },
];

openapi2schema('docs/swagger.yaml', { async: true }, (err, result) => {
  if (err) {
    // openapi2schema fails
    console.error(err);
  } else {
    for (let definition of SCHEMA_DEFS) {
      fs.writeFileSync(definition.filePath, JSON.stringify(result['/booking'].post.body.oneOf[definition.order], null, '  '));
    }
  }
});
