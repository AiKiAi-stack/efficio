module.exports = {
  apps: [{
    name: 'efficiency-tracker-api',
    script: 'dist/index.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    // 日志配置
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,

    // 资源限制
    max_memory_restart: '512M',

    // 自动重启
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',

    // 健康检查
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.env'],

    // 最大重启次数
    max_restalls: 5
  }]
};
