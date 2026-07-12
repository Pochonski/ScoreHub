module.exports = {
  apps: [
    {
      name: 'mundialista-dashboard',
      script: 'index.js',
      instances: process.env.WEB_CONCURRENCY || 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
