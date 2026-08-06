# Deploying to a VPS — Paid Mode (MySQL + PM2 + Nginx)

## Server Requirements
- Ubuntu 22.04 LTS (or Debian 12)
- 1 vCPU, 1 GB RAM minimum (2 vCPU / 2 GB recommended)
- 20 GB SSD
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)


server {
    # ... ssl and other config above ...

    # ── Paid mode: allow uploads up to 6 MB (slightly above the 5 MB app limit
    # so Nginx never rejects a request the app would otherwise accept) ──────────
    client_max_body_size 6M;

    # Increase read timeout for large file uploads on slow connections
    client_body_timeout 60s;

    location / {
        # ... existing proxy config ...
    }

location /uploads/ {
        alias      /var/www/cms/public/uploads/;
        add_header Cache-Control "public, max-age=86400";
        # Efficient direct-serve: bypass Node.js entirely for static uploads
        sendfile   on;
        tcp_nopush on;
        # Security: block server-side script execution of uploaded files
        location ~* \.(php|php5|phtml|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }

---

## Step 1 — Server Preparation

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools (required for bcrypt native module)
sudo apt install -y build-essential python3

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for HTTPS
sudo apt install -y certbot python3-certbot-nginx

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation
