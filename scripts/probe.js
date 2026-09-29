'use strict';
const { RemoraClient } = require('../lib/remora-client');
if (!process.argv[2]) {
  console.error('Usage: npm run probe -- <Remora IP or hostname>');
  process.exit(1);
}
new RemoraClient(process.argv[2]).probe()
  .then(info => console.log(JSON.stringify(info, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
