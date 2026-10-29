/**
 * PM2 Ecosystem Config — SobatSerabut
 * Jalankan: pm2 start ecosystem.config.js
 * Auto-startup: pm2 startup && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'sobatserabut',
      script: 'app.js',
      cwd: '/home/jinny21/SobatSerabut',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/jinny21/SobatSerabut/logs/pm2-error.log',
      out_file: '/home/jinny21/SobatSerabut/logs/pm2-out.log',
      merge_logs: true,
    }
  ]
};
