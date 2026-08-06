module.exports = {
  apps: [
    {
      name:         'cms',
      script:       'node_modules/.bin/next',
      args:         'start',

      // Cluster mode uses all available CPU cores.
      // For a 2-core VPS, this spawns 2 worker processes.
      instances:    'max',
      exec_mode:    'cluster',

      // Environment — production values are in .env.local on the VPS.
      // PM2 picks up .env.local automatically when using Next.js.
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },

      // Logging
      error_file:   'logs/err.log',
      out_file:     'logs/out.log',
      log_file:     'logs/combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:   true,

      // Auto-restart if memory exceeds 1 GB per instance
      max_memory_restart: '1G',

      // Graceful shutdown: wait up to 5 seconds for in-flight requests
      kill_timeout: 5000,

      // Restart delay after crash (ms)
      restart_delay: 3000,

      // Maximum consecutive crashes before PM2 stops retrying
      max_restarts: 10,
    },
  ],
};