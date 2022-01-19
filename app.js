const db = require('./lib/db');
const server = require('./lib/server');

run();

async function run() {
  const { plants } = await db();
  await server(plants);
}
