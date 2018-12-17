if (process.env.SKIP_DB_SETUP) {
  console.log('Skipping DB setup');
  process.exit(0);
}

const { setupDB } = require('../src/db');

setupDB().then(() => {
  console.log('DB is all set');
  process.exit(0);
}, (err) => {
  console.log(`Error: ${err}`);
  process.exit(1);
});
