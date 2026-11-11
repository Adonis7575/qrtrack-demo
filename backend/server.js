require('dotenv').config({ path: require('node:path').join(__dirname, '.env'), quiet: true });

const { readConfig } = require('./lib/config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

async function main() {
  const config = readConfig();
  const db = await openDatabase({ url: config.databaseUrl });
  const app = createApp({ db, config });

  const host = config.isProduction ? '0.0.0.0' : '127.0.0.1';
  const server = app.listen(config.port, host, () => {
    const where = db.kind === 'pglite' ? 'local embedded Postgres (backend/.data)' : 'Postgres (DATABASE_URL)';
    console.log(`QRTrack running on http://localhost:${config.port}`);
    console.log(`Database: ${where}`);
    if (!config.adminPassword) console.log('Sign-in: disabled (set ADMIN_PASSWORD to require it)');
  });

  const shutdown = () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`Failed to start QRTrack: ${err.message}`);
  process.exit(1);
});
