if (process.env.SKIP_DB_SETUP) {
  console.log('Skipping DB setup');
} else {
  const { setupDB } = require('../src/db');

  return setupDB().then(() => {
    console.log('DB is all set');
    // If this is called directly as a script, terminate
    // the DB connection, otherwise the process will hang
    if (require.main === module) {
      const { db } = require('../src/config');
      db.destroy();
    }
  }, (err) => {
    console.log(`Error: ${err}`);
    process.exit(1);
  });
}
