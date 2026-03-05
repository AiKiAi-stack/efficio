# Efficio VPS Deployment Guide

> VPS deployment for 1GB RAM / 1 Core / 5GB SSD

**[🌐 中文版本](deploy_vps_zh.md)**

---

## 📦 Recommended Requirements

| Requirement | Specification |
|-------------|---------------|
| RAM | 1GB (2GB recommended) |
| CPU | 1 Core |
| Storage | 5GB SSD |
| OS | Ubuntu 20.04+ / Debian 11+ |
| Node.js | 18.0.0+ |

---

## 🚀 One-Click Deployment

### 1. Login to VPS and run deployment script

```bash
# Download deployment script
curl -O https://raw.githubusercontent.com/AiKiAi-stack/efficio/main/deploy-vps.sh

# Add execute permission
chmod +x deploy-vps.sh

# Run deployment
sudo ./deploy-vps.sh
```

### 2. Configure Environment Variables

Edit `.env` file:

```bash
cd /var/www/efficio/server
nano .env
```

Required configuration:

```bash
# Server port
PORT=3001

# Database mode
DATABASE_MODE=sqlite

# AI Provider selection
AI_PROVIDER=anthropic

# API Key (replace with yours)
ANTHROPIC_API_KEY=your_anthropic_api_key

# CORS configuration (if deploying frontend)
ALLOWED_ORIGINS=http://your-domain.com
```

### 3. Restart Service

```bash
pm2 restart efficio-api
```

---

## 📋 Common Commands

### PM2 Management

```bash
# Check status
pm2 status

# View logs
pm2 logs efficio-api

# Restart service
pm2 restart efficio-api

# Stop service
pm2 stop efficio-api

# Delete service
pm2 delete efficio-api

# Configure auto-start on boot
pm2 save
pm2 startup
```

### Update Code

```bash
cd /var/www/efficio

# Pull latest code
git pull

# Reinstall dependencies
cd server
npm install --production

# Rebuild
npm run build
npm run build:ncc

# Restart service
pm2 restart efficio-api
```

---

## 🔧 Manual Deployment (Alternative)

If the automatic script fails, execute manually:

### 1. Install Node.js

```bash
# Install Node.js 20 using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Verify installation
node -v
npm -v
```

### 2. Clone Project

```bash
mkdir -p /var/www/efficio
cd /var/www/efficio
git clone git@github.com:AiKiAi-stack/efficio.git .
cd server
```

### 3. Install Dependencies

```bash
# Install production dependencies
npm install --production

# Install build tools
npm install --save-dev @vercel/ncc
```

### 4. Build Project

```bash
# TypeScript compilation
npm run build

# ncc bundling (optimized for memory)
npm run build:ncc
```

### 5. Initialize Database

```bash
npm run db:init
```

### 6. Start PM2

```bash
# Create logs directory
mkdir -p logs

# Start service
pm2 start ecosystem.config.js

# Save configuration
pm2 save
```

---

## 🔍 Troubleshooting

### Service Failed to Start

```bash
# View detailed logs
pm2 logs efficio-api --lines 100

# Check port occupancy
lsof -i :3001

# Check memory usage
free -h
```

### Insufficient Memory

```bash
# Create swap partition (2GB)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Database Locked

```bash
# Check database files
ls -la /var/www/efficio/server/data/

# Backup and recreate
cp data/efficiency.db data/efficiency.db.backup
rm data/efficiency.db
npm run db:init
```

---

## 📊 Resource Monitoring

### Check Memory Usage

```bash
# PM2 app memory
pm2 status

# System memory
free -h

# Process memory
ps aux | grep node
```

### Check CPU Usage

```bash
# Real-time view
top

# PM2 monitoring
pm2 monit
```

### Check Disk Usage

```bash
# Disk space
df -h

# Directory size
du -sh /var/www/efficio/*
```

---

## 🔒 Security Recommendations

### 1. Configure Firewall

```bash
# Open required ports
ufw allow 22/tcp    # SSH
ufw allow 3001/tcp  # API

# Enable firewall
ufw enable

# Check status
ufw status
```

### 2. Configure SSH Keys

```bash
# Generate key (execute locally)
ssh-keygen -t ed25519

# Upload public key to VPS
ssh-copy-id user@your-vps-ip
```

### 3. Disable Password Login (Optional)

Edit `/etc/ssh/sshd_config`:

```bash
PasswordAuthentication no
PubkeyAuthentication yes
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

---

## 📈 Performance Optimization

### 1. Use ncc Bundling

Configured in `ecosystem.config.js`, bundling reduces memory usage by ~30%.

### 2. Limit PM2 Memory

```javascript
// ecosystem.config.js
max_memory_restart: '400M'  // Auto-restart if exceeds 400MB
```

### 3. Add Swap

As described in troubleshooting, 2GB swap prevents out-of-memory errors.

---

## 🎯 Expected Resource Usage

| Resource | Usage |
|----------|-------|
| Application Memory | 60-100MB |
| Disk Space | ~300MB |
| CPU Idle | <5% |
| CPU Peak | ~50% (during AI requests) |

---

## 📞 Get Help

Having issues?

- View logs: `pm2 logs efficio-api`
- Check status: `pm2 status`
- GitHub Issues: https://github.com/AiKiAi-stack/efficio/issues
