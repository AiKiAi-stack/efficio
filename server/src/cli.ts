#!/usr/bin/env node
/**
 * Efficio Server CLI
 *
 * 命令行接口，支持启动参数和配置文件
 *
 * 配置优先级：CLI 参数 > 环境变量 > 配置文件 > 默认值
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const program = new Command();

// ==================== 类型定义 ====================

interface ServerConfig {
  port: number;
  host: string;
  env: 'development' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  allowedOrigins: string[];
}

interface DatabaseConfig {
  mode: 'memory' | 'sqlite' | 'turso' | 'supabase';
  sqlitePath: string;
  tursoUrl?: string;
  tursoToken?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

interface AIProviderConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

interface AIConfig {
  provider: string;
  providers: {
    anthropic?: AIProviderConfig;
    openai?: AIProviderConfig;
    deepseek?: AIProviderConfig;
    zhipu?: AIProviderConfig;
    kimi?: AIProviderConfig;
    nvidia?: AIProviderConfig;
    vllm?: AIProviderConfig;
    aliyun?: AIProviderConfig;
    volcengine?: AIProviderConfig;
    minimax?: AIProviderConfig;
    openrouter?: AIProviderConfig;
  };
}

interface CronConfig {
  enabled: boolean;
  weeklySummary?: string;
}

interface EfficioConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  ai: AIConfig;
  cron: CronConfig;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: EfficioConfig = {
  server: {
    port: 3001,
    host: 'localhost',
    env: 'production',
    logLevel: 'info',
    allowedOrigins: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']
  },
  database: {
    mode: 'sqlite',
    sqlitePath: './data/efficiency.db'
  },
  ai: {
    provider: 'anthropic',
    providers: {}
  },
  cron: {
    enabled: true,
    weeklySummary: '0 8 * * 1'
  }
};

// ==================== 配置文件路径查找 ====================

function findConfigFile(customPath?: string): string | null {
  if (customPath) {
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    console.warn(`Warning: Config file not found: ${customPath}`);
    return null;
  }

  const paths = [
    path.resolve(process.cwd(), 'efficio.json'),
    path.resolve(os.homedir(), '.config', 'efficio.json'),
    path.resolve(process.cwd(), 'config', 'efficio.json'),
    path.resolve(process.cwd(), '.efficio.json')
  ];

  for (const configPath of paths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

// ==================== 配置文件加载与合并 ====================

function loadConfig(configPath: string | null): Partial<EfficioConfig> {
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

// 深层合并配置
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key in source) {
    if (source[key] instanceof Object && key in result && result[key] instanceof Object) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }

  return result;
}

// 合并配置（优先级：CLI > 环境变量 > 配置文件 > 默认值）
function mergeConfig(
  defaultConfig: EfficioConfig,
  fileConfig: Partial<EfficioConfig>,
  cliOptions: Record<string, unknown>
): EfficioConfig {
  // 从环境变量读取配置
  const envConfig: Partial<EfficioConfig> = {
    server: {
      port: parseInt(process.env.SERVER_PORT || process.env.PORT || '0', 10) || undefined,
      host: process.env.SERVER_HOST || process.env.HOST,
      env: (process.env.NODE_ENV as 'development' | 'production') || undefined,
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || undefined,
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean)
    },
    database: {
      mode: (process.env.DATABASE_MODE as DatabaseConfig['mode']) || undefined,
      sqlitePath: process.env.SQLITE_DB_PATH,
      tursoUrl: process.env.TURSO_DATABASE_URL,
      tursoToken: process.env.TURSO_AUTH_TOKEN,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_KEY
    },
    ai: {
      provider: process.env.AI_PROVIDER,
      providers: {
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        openai: { apiKey: process.env.OPENAI_API_KEY },
        deepseek: { apiKey: process.env.DEEPSEEK_API_KEY },
        zhipu: { apiKey: process.env.ZHIPU_API_KEY },
        kimi: { apiKey: process.env.KIMI_API_KEY },
        nvidia: { apiKey: process.env.NVIDIA_API_KEY },
        vllm: {
          apiKey: process.env.VLLM_API_KEY,
          endpoint: process.env.VLLM_ENDPOINT,
          model: process.env.VLLM_MODEL
        },
        aliyun: { apiKey: process.env.ALIYUN_API_KEY },
        volcengine: { apiKey: process.env.VOLCENGINE_API_KEY },
        minimax: { apiKey: process.env.MINIMAX_API_KEY },
        openrouter: { apiKey: process.env.OPENROUTER_API_KEY }
      }
    },
    cron: {
      enabled: process.env.CRON_ENABLED !== 'false'
    }
  };

  // 处理 CLI 覆盖
  const cliConfig: Partial<EfficioConfig> = {};

  if (cliOptions.port) cliConfig.server = { ...cliConfig.server, port: cliOptions.port as number };
  if (cliOptions.host) cliConfig.server = { ...cliConfig.server, host: cliOptions.host as string };
  if (cliOptions.env) cliConfig.server = { ...cliConfig.server, env: cliOptions.env as 'development' | 'production' };
  if (cliOptions.logLevel) {
    const logLevel = cliOptions.logLevel as 'debug' | 'info' | 'warn' | 'error';
    cliConfig.server = { ...cliConfig.server, logLevel };
  }
  if (cliOptions.allowedOrigins) {
    cliConfig.server = {
      ...cliConfig.server,
      allowedOrigins: (cliOptions.allowedOrigins as string).split(',').filter(Boolean)
    };
  }
  if (cliOptions.dbMode) {
    cliConfig.database = {
      ...cliConfig.database,
      mode: cliOptions.dbMode as DatabaseConfig['mode']
    };
  }
  if (cliOptions.dbPath) {
    cliConfig.database = {
      ...cliConfig.database,
      sqlitePath: cliOptions.dbPath as string
    };
  }
  if (cliOptions.aiProvider) {
    cliConfig.ai = {
      ...cliConfig.ai,
      provider: cliOptions.aiProvider as string
    };
  }
  if (cliOptions.tursoUrl) {
    cliConfig.database = {
      ...cliConfig.database,
      tursoUrl: cliOptions.tursoUrl as string
    };
  }
  if (cliOptions.tursoToken) {
    cliConfig.database = {
      ...cliConfig.database,
      tursoToken: cliOptions.tursoToken as string
    };
  }
  if (cliOptions.supabaseUrl) {
    cliConfig.database = {
      ...cliConfig.database,
      supabaseUrl: cliOptions.supabaseUrl as string
    };
  }
  if (cliOptions.supabaseKey) {
    cliConfig.database = {
      ...cliConfig.database,
      supabaseKey: cliOptions.supabaseKey as string
    };
  }
  if (cliOptions.noCron) {
    cliConfig.cron = { enabled: false };
  }

  // 合并：CLI > 环境变量 > 配置文件 > 默认值
  const result = deepMerge(
    deepMerge(
      deepMerge(defaultConfig as unknown as Record<string, unknown>, envConfig as unknown as Record<string, unknown>),
      fileConfig as unknown as Record<string, unknown>
    ),
    cliConfig as unknown as Record<string, unknown>
  );

  return result as unknown as EfficioConfig;
}

// ==================== 环境变量导出 ====================

function exportConfigToEnv(config: EfficioConfig) {
  // Server
  process.env.SERVER_PORT = String(config.server.port);
  process.env.SERVER_HOST = config.server.host;
  process.env.NODE_ENV = config.server.env;
  process.env.LOG_LEVEL = config.server.logLevel;
  process.env.ALLOWED_ORIGINS = config.server.allowedOrigins.join(',');

  // Database
  process.env.DATABASE_MODE = config.database.mode;
  process.env.SQLITE_DB_PATH = config.database.sqlitePath;
  if (config.database.tursoUrl) {
    process.env.TURSO_DATABASE_URL = config.database.tursoUrl;
  }
  if (config.database.tursoToken) {
    process.env.TURSO_AUTH_TOKEN = config.database.tursoToken;
  }
  if (config.database.supabaseUrl) {
    process.env.SUPABASE_URL = config.database.supabaseUrl;
  }
  if (config.database.supabaseKey) {
    process.env.SUPABASE_SERVICE_KEY = config.database.supabaseKey;
  }

  // AI
  process.env.AI_PROVIDER = config.ai.provider;

  // AI Provider Keys
  const providerKeys = {
    anthropic: 'ANTHROPIC',
    openai: 'OPENAI',
    deepseek: 'DEEPSEEK',
    zhipu: 'ZHIPU',
    kimi: 'KIMI',
    nvidia: 'NVIDIA',
    vllm: 'VLLM',
    aliyun: 'ALIYUN',
    volcengine: 'VOLCENGINE',
    minimax: 'MINIMAX',
    openrouter: 'OPENROUTER'
  };

  for (const [provider, envPrefix] of Object.entries(providerKeys)) {
    const providerConfig = config.ai.providers[provider as keyof typeof config.ai.providers];
    if (providerConfig?.apiKey) {
      process.env[`${envPrefix}_API_KEY`] = providerConfig.apiKey;
    }
    if (providerConfig?.endpoint) {
      process.env[`${envPrefix}_ENDPOINT`] = providerConfig.endpoint;
    }
    if (providerConfig?.model) {
      process.env[`${envPrefix}_MODEL`] = providerConfig.model;
    }
  }

  // Cron
  process.env.CRON_ENABLED = config.cron.enabled ? 'true' : 'false';
  if (config.cron.weeklySummary) {
    process.env.CRON_WEEKLY_SUMMARY = config.cron.weeklySummary;
  }
}

// ==================== 启动信息展示 ====================

function printStartupInfo(config: EfficioConfig) {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║           Efficio Server Starting                     ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║  Server                                               ║`);
  console.log(`║    Host:        ${config.server.host.padEnd(34)}║`);
  console.log(`║    Port:        ${String(config.server.port).padEnd(34)}║`);
  console.log(`║    Env:         ${config.server.env.padEnd(34)}║`);
  console.log(`║    Log Level:   ${config.server.logLevel.padEnd(34)}║`);
  console.log(`║    CORS:        ${config.server.allowedOrigins.slice(0, 2).join(', ').padEnd(34)}║`);
  console.log(`║                                                       ║`);
  console.log(`║  Database                                             ║`);
  console.log(`║    Mode:        ${config.database.mode.padEnd(34)}║`);
  if (config.database.mode === 'sqlite') {
    console.log(`║    Path:        ${config.database.sqlitePath.padEnd(34)}║`);
  } else if (config.database.mode === 'turso') {
    const urlDisplay = config.database.tursoUrl?.substring(0, 30) + '...' || 'N/A';
    console.log(`║    URL:         ${urlDisplay.padEnd(34)}║`);
  } else if (config.database.mode === 'supabase') {
    const urlDisplay = config.database.supabaseUrl?.substring(0, 30) + '...' || 'N/A';
    console.log(`║    URL:         ${urlDisplay.padEnd(34)}║`);
  }
  console.log(`║                                                       ║`);
  console.log(`║  AI Provider                                          ║`);
  console.log(`║    Active:      ${config.ai.provider.padEnd(34)}║`);
  console.log(`║    Cron:        ${config.cron.enabled ? 'Enabled' : 'Disabled'} ${config.cron.enabled ? '(' + config.cron.weeklySummary + ')' : ''} ${' '.repeat(Math.max(0, 34 - (config.cron.enabled ? 10 + config.cron.weeklySummary!.length : 0)))}║`);
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
}

// ==================== 主命令 ====================

program
  .name('efficio-server')
  .description('Efficio Server - Work Record & Efficiency Analysis System')
  .version('0.1.0')
  // Server options
  .option('-p, --port <number>', 'Server port (default: 3001)')
  .option('-h, --host <address>', 'Server host (default: localhost, use 0.0.0.0 for all interfaces)')
  .option('-e, --env <environment>', 'Environment: development or production (default: production)')
  .option('--log-level <level>', 'Log level: debug, info, warn, error (default: info)')
  .option('--allowed-origins <origins>', 'Comma-separated list of allowed CORS origins')
  // Database options
  .option('--db-mode <mode>', 'Database mode: memory, sqlite, turso, supabase (default: sqlite)')
  .option('--db-path <path>', 'Path to SQLite database file (default: ./data/efficiency.db)')
  .option('--turso-url <url>', 'Turso database URL')
  .option('--turso-token <token>', 'Turso authentication token')
  .option('--supabase-url <url>', 'Supabase project URL')
  .option('--supabase-key <key>', 'Supabase service key')
  // AI options
  .option('--ai-provider <provider>', 'AI provider: anthropic, openai, deepseek, zhipu, kimi, nvidia, vllm, aliyun, volcengine, minimax, openrouter (default: anthropic)')
  // Cron options
  .option('--no-cron', 'Disable cron jobs')
  // Config file
  .option('-c, --config <path>', 'Path to configuration file (default: ~/.config/efficio.json or ./efficio.json)')
  // Other
  .option('--open-browser', 'Open default browser on startup')
  .action((options) => {
    // 查找并加载配置文件
    const configPath = findConfigFile(options.config);
    const fileConfig = loadConfig(configPath);

    // 合并配置
    const config = mergeConfig(DEFAULT_CONFIG, fileConfig, options);

    // 导出到环境变量
    exportConfigToEnv(config);

    // 显示配置信息
    printStartupInfo(config);

    // 如果需要打开浏览器
    if (options.openBrowser) {
      process.env.OPEN_BROWSER = 'true';
    }

    // 启动主程序
    import('./index').then(() => {
      // 主程序会自动使用 process.env 中的配置
    }).catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
  });

// ==================== 子命令：初始化数据库 ====================

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

// ==================== 子命令：配置管理 ====================

program
  .command('config')
  .description('Manage configuration')
  .option('--json', 'Output as JSON')
  .option('--show', 'Show current merged configuration')
  .option('--init', 'Create a new configuration file template')
  .option('--validate', 'Validate configuration file')
  .action((cmdOptions) => {
    const configPath = findConfigFile();
    const fileConfig = loadConfig(configPath);
    const mergedConfig = mergeConfig(DEFAULT_CONFIG, fileConfig, {});

    // --init: 创建配置文件模板
    if (cmdOptions.init) {
      const targetPath = path.resolve(process.cwd(), 'efficio.json');
      const template: Partial<EfficioConfig> = {
        server: {
          port: 3001,
          host: '0.0.0.0',
          env: 'production',
          logLevel: 'info',
          allowedOrigins: ['http://localhost:5173']
        },
        database: {
          mode: 'sqlite',
          sqlitePath: './data/efficiency.db'
        },
        ai: {
          provider: 'anthropic',
          providers: {
            anthropic: {
              apiKey: 'sk-ant-...',
              model: 'claude-sonnet-4-6'
            }
          }
        },
        cron: {
          enabled: true,
          weeklySummary: '0 8 * * 1'
        }
      };

      fs.writeFileSync(targetPath, JSON.stringify(template, null, 2));
      console.log(`✓ Configuration file created: ${targetPath}`);
      console.log('  Please edit the file with your actual API keys and settings.');
      process.exit(0);
    }

    // --validate: 验证配置文件
    if (cmdOptions.validate) {
      if (!configPath) {
        console.log('✗ No configuration file found.');
        process.exit(1);
      }

      const errors: string[] = [];

      // 验证 server 配置
      if (fileConfig.server) {
        if (fileConfig.server.port && (typeof fileConfig.server.port !== 'number' || fileConfig.server.port < 1 || fileConfig.server.port > 65535)) {
          errors.push('server.port must be a number between 1 and 65535');
        }
        if (fileConfig.server.host && typeof fileConfig.server.host !== 'string') {
          errors.push('server.host must be a string');
        }
        if (fileConfig.server.env && !['development', 'production'].includes(fileConfig.server.env)) {
          errors.push('server.env must be "development" or "production"');
        }
        if (fileConfig.server.logLevel && !['debug', 'info', 'warn', 'error'].includes(fileConfig.server.logLevel)) {
          errors.push('server.logLevel must be "debug", "info", "warn", or "error"');
        }
      }

      // 验证 database 配置
      if (fileConfig.database) {
        const validModes = ['memory', 'sqlite', 'turso', 'supabase'];
        if (fileConfig.database.mode && !validModes.includes(fileConfig.database.mode)) {
          errors.push(`database.mode must be one of: ${validModes.join(', ')}`);
        }
        if (fileConfig.database.mode === 'turso' && !fileConfig.database.tursoUrl) {
          errors.push('database.tursoUrl is required when mode is "turso"');
        }
        if (fileConfig.database.mode === 'supabase' && !fileConfig.database.supabaseUrl) {
          errors.push('database.supabaseUrl is required when mode is "supabase"');
        }
      }

      // 验证 ai 配置
      if (fileConfig.ai) {
        if (fileConfig.ai.provider && typeof fileConfig.ai.provider !== 'string') {
          errors.push('ai.provider must be a string');
        }
      }

      if (errors.length > 0) {
        console.log('✗ Configuration validation failed:');
        errors.forEach(err => console.log(`  - ${err}`));
        process.exit(1);
      } else {
        console.log('✓ Configuration file is valid.');
        console.log(`  File: ${configPath}`);
        process.exit(0);
      }
    }

    // --show 或默认：显示配置
    if (cmdOptions.json) {
      console.log(JSON.stringify({
        merged: mergedConfig,
        file: fileConfig,
        configFile: configPath || 'Not found'
      }, null, 2));
    } else {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('Current Configuration');
      console.log('═══════════════════════════════════════════════════════');

      console.log('\n📡 Server');
      console.log(`  Host:        ${mergedConfig.server.host}`);
      console.log(`  Port:        ${mergedConfig.server.port}`);
      console.log(`  Env:         ${mergedConfig.server.env}`);
      console.log(`  Log Level:   ${mergedConfig.server.logLevel}`);
      console.log(`  CORS:        ${mergedConfig.server.allowedOrigins.join(', ')}`);

      console.log('\n💾 Database');
      console.log(`  Mode:        ${mergedConfig.database.mode}`);
      console.log(`  Path:        ${mergedConfig.database.sqlitePath}`);

      console.log('\n🤖 AI Provider');
      console.log(`  Active:      ${mergedConfig.ai.provider}`);

      console.log('\n⏰ Cron');
      console.log(`  Enabled:     ${mergedConfig.cron.enabled}`);
      console.log(`  Schedule:    ${mergedConfig.cron.weeklySummary}`);

      console.log('\n📁 Config File');
      console.log(`  Path:        ${configPath || 'Not found'}`);
      console.log('═══════════════════════════════════════════════════════\n');
    }
  });

// ==================== 解析命令行 ====================

program.parse(process.argv);
