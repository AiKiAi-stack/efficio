module.exports = {
  apps: [{
    name: 'efficio-api',
    script: 'dist-ncc/index.js',
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
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    // 资源限制 - 针对 1GB VPS 优化
    max_memory_restart: '400M',
    kill_timeout: 3000,
    listen_timeout: 10000,

    // 自动重启
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',

    // 健康检查
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.env', 'data'],

    // 最大重启次数
    max_restalls: 5,

    // 错误处理
    merge_logs: true,
    autorestart: true
  }]
};
