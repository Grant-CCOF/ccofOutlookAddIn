module.exports = {
    apps: [{
      name: 'capital-choice-platform',
      script: './server.js',
      cwd: '/opt/capital-choice-platform',
      instances: '1',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      cron_restart: '0 2 * * *',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      pid_file: './pids/app.pid',
      node_args: '--max-old-space-size=1024',
      kill_timeout: 5000,
      listen_timeout: 5000,
      shutdown_with_message: true
    }]
  };