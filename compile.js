const fs = require('fs');
const solc = require('solc');

const source = fs.readFileSync('purchase-contract.sol', 'UTF-8');
fs.writeFileSync('purchase-contract.json', JSON.stringify(solc.compile(source, 1).contracts[':Purchase']));
