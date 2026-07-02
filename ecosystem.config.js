module.exports = {
  apps: [{
    name: 'podcast-worker',
    script: 'run-worker.js',
    cwd: 'C:\\Users\\skint\\Desktop\\Podcast Creator',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'C:\\Users\\skint\\.pm2\\logs\\podcast-worker-error.log',
    out_file: 'C:\\Users\\skint\\.pm2\\logs\\podcast-worker-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
