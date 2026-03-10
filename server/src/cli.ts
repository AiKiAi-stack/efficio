#!/usr/bin/env node
/**
 * Efficio Server CLI
 *
 * 命令行接口，支持启动参数和配置文件
 *
 * 用法:
 *   efficio-server                          # 使用默认配置启动
 *   efficio-server --port 8080              # 指定端口
 *   efficio-server --host 0.0.0.0           # 监听所有接口
 *   efficio-server --config /path/to/config.json  # 指定配置文件
 *   efficio-server --help                   # 显示帮助
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const program = new Command();

// 默认配置
const DEFAULT_CONFIG = {
  port: 3001,
  host: 'localhost',
  database: './data/efficiency.db',
  logLevel: 'info'
};

// 配置文件路径优先级
function findConfigFile(customPath?: string): string | null {
  // 1. 命令行指定的配置文件
  if (customPath) {
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    console.warn(`Warning: Config file not found: ${customPath}`);
    return null;
  }

  // 2. 当前目录的 efficio.json
  const localConfig = path.resolve(process.cwd(), 'efficio.json');
  if (fs.existsSync(localConfig)) {
    return localConfig;
  }

  // 3. ~/.config/efficio.json
  const homeConfig = path.resolve(os.homedir(), '.config', 'efficio.json');
  if (fs.existsSync(homeConfig)) {
    return homeConfig;
  }

  // 4. ./config/efficio.json
  const configDirConfig = path.resolve(process.cwd(), 'config', 'efficio.json');
  if (fs.existsSync(configDirConfig)) {
    return configDirConfig;
  }

  return null;
}

// 加载配置文件
function loadConfig(configPath: string | null): Record<string, unknown> {
  if (!configPath || !fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading config file ${configPath}:`, error);
    return {};
  }
}

// 合并配置（优先级：命令行 > 配置文件 > 默认值）
function mergeConfig(
  configFile: Record<string, unknown>,
  cliOptions: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...DEFAULT_CONFIG,
    ...configFile,
    ...cliOptions
  };
}

// 显示启动信息
function printStartupInfo(config: Record<string, unknown>) {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║         Efficio Server Starting               ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  Host:        ${(config.host as string)?.padEnd(32) || 'localhost'}║`);
  console.log(`║  Port:        ${String(config.port).padEnd(32)}║`);
  console.log(`║  Database:    ${String(config.database).padEnd(32)}║`);
  console.log(`║  Log Level:   ${String(config.logLevel).padEnd(32)}║`);
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
}

// 配置程序
program
  .name('efficio-server')
  .description('Efficio Server - Work Record & Efficiency Analysis System')
  .version('0.1.0')
  .option('-p, --port <number>', 'Server port (default: 3001)')
  .option('-h, --host <address>', 'Server host (default: localhost, use 0.0.0.0 for all interfaces)')
  .option('-c, --config <path>', 'Path to configuration file (default: ~/.config/efficio.json or ./efficio.json)')
  .option('-d, --database <path>', 'Path to SQLite database file')
  .option('--log-level <level>', 'Log level: debug, info, warn, error (default: info)')
  .option('--open-browser', 'Open default browser on startup')
  .option('--init', 'Initialize database and exit')
  .action((options) => {
    // 查找并加载配置文件
    const configPath = findConfigFile(options.config);
    const fileConfig = loadConfig(configPath);

    // 合并配置
    const config = mergeConfig(fileConfig, options);

    // 设置环境变量（供主程序使用）
    if (config.port) {
      process.env.SERVER_PORT = String(config.port);
    }
    if (config.host) {
      process.env.SERVER_HOST = String(config.host);
    }
    if (config.database) {
      process.env.SQLITE_DB_PATH = String(config.database);
    }
    if (config.logLevel) {
      process.env.LOG_LEVEL = String(config.logLevel);
    }

    // 显示配置信息
    printStartupInfo(config);

    // 如果需要打开浏览器
    if (options.openBrowser) {
      process.env.OPEN_BROWSER = 'true';
    }

    // 如果需要初始化数据库
    if (options.init) {
      console.log('Database initialization requested. Run with: efficio-server db:init');
      process.exit(0);
    }

    // 启动主程序
    import('./index').then((module) => {
      // 主程序会自动使用 process.env 中的配置
    }).catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
  });

// 配置子命令：初始化
program
  .command('init')
  .description('Initialize the database')
  .action(() => {
    console.log('Running database initialization...');
    import('./scripts/init-db').then(() => {
      process.exit(0);
    }).catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
  });

// 配置子命令：显示配置
program
  .command('config')
  .description('Show current configuration')
  .option('--json', 'Output as JSON')
  .action((cmdOptions) => {
    const configPath = findConfigFile();
    const fileConfig = loadConfig(configPath);
    const config = mergeConfig(fileConfig, {});

    if (cmdOptions.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('\nCurrent Configuration:');
      console.log('═══════════════════════════════════');
      for (const [key, value] of Object.entries(config)) {
        console.log(`  ${key}: ${value}`);
      }
      console.log('═══════════════════════════════════\n');
    }
  });

// 解析命令行参数
program.parse(process.argv);
