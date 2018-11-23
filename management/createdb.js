const { setupDB } = require('../src/db');

setupDB().then(() => {
  console.log('Created');
  process.exit(0);
}, (err) => {
  console.log(`Error: ${err}`);
  process.exit(1);
});
