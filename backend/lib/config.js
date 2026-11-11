const DEV_SECRET = 'qrtrack-dev-secret-change-me';

function readConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';

  const config = {
    isProduction,
    port: Number(env.PORT) || 3001,
    databaseUrl: env.DATABASE_URL || env.POSTGRES_URL || '',
    // Optional. When unset, tracking URLs use the host the request came in on.
    baseUrl: (env.BASE_URL || '').trim().replace(/\/+$/, ''),
    adminPassword: env.ADMIN_PASSWORD || '',
    appSecret: env.APP_SECRET || (isProduction ? '' : DEV_SECRET),
  };

  if (isProduction) {
    const missing = [];
    if (!config.databaseUrl) missing.push('DATABASE_URL');
    if (!config.adminPassword) missing.push('ADMIN_PASSWORD');
    if (!env.APP_SECRET) missing.push('APP_SECRET');
    if (missing.length) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  return config;
}

module.exports = { readConfig };
