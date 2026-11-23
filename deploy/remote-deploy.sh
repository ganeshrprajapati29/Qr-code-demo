#!/usr/bin/env bash
# Runs ON THE VPS (as root). Idempotent: safe to run on every deploy.
# Usage: DOMAIN=72-60-110-25.sslip.io bash remote-deploy.sh /path/to/extracted/release
set -euo pipefail

RELEASE_SRC="${1:?release dir required}"
APP=udhar-khata
BASE=/opt/$APP
SHARED=$BASE/shared
REL_ID=$(date +%Y%m%d%H%M%S)
REL_DIR=$BASE/releases/$REL_ID
MONGO_CONTAINER=udhar-khata-mongo
MONGO_PORT=27027

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*"; }

if [ -z "${DOMAIN:-}" ]; then
  IP=$(curl -fsS4 --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
  DOMAIN="${IP//./-}.sslip.io"
fi

log "Server info"
. /etc/os-release && echo "OS: $PRETTY_NAME"
echo "Domain: $DOMAIN"
echo "Ports in use:"; ss -ltnp | awk 'NR>1{print "  "$4" "$6}' | sort -u | head -30

export DEBIAN_FRONTEND=noninteractive
APT_UPDATED=0
apt_install() {
  local missing=()
  for p in "$@"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
  if [ ${#missing[@]} -gt 0 ]; then
    [ $APT_UPDATED -eq 1 ] || { apt-get update -y; APT_UPDATED=1; }
    apt-get install -y "${missing[@]}"
  fi
}

log "Base packages"
apt_install curl ca-certificates gnupg rsync

# ---------- Node.js ----------
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  log "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "node $(node -v)"

# ---------- MongoDB (isolated Docker container on 127.0.0.1:$MONGO_PORT) ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker (for MongoDB)"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

if ! docker ps --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
  log "Starting MongoDB container"
  docker rm -f "$MONGO_CONTAINER" >/dev/null 2>&1 || true
  MONGO_IMAGE=mongo:8.0
  # MongoDB 5+ needs a CPU with AVX; fall back to 4.4 on older VPS CPUs
  grep -qw avx /proc/cpuinfo || MONGO_IMAGE=mongo:4.4
  docker run -d --name "$MONGO_CONTAINER" --restart unless-stopped \
    -p 127.0.0.1:$MONGO_PORT:27017 -v udhar_khata_mongo:/data/db "$MONGO_IMAGE" >/dev/null
fi
for i in $(seq 1 30); do
  (echo > /dev/tcp/127.0.0.1/$MONGO_PORT) 2>/dev/null && break
  sleep 1
done
docker ps --filter name=$MONGO_CONTAINER --format 'mongo: {{.Image}} {{.Status}}'

# ---------- Release files ----------
log "Installing release $REL_ID"
mkdir -p "$REL_DIR" "$SHARED"
rsync -a --delete "$RELEASE_SRC"/ "$REL_DIR"/
cd "$REL_DIR/server"
npm ci --omit=dev --no-audit --no-fund

# ---------- .env (kept between deploys) ----------
port_free() { ! ss -ltn "( sport = :$1 )" | grep -q ":$1"; }
if [ ! -f "$SHARED/.env" ]; then
  PORT=5055
  while ! port_free $PORT; do PORT=$((PORT + 1)); done
  cat > "$SHARED/.env" <<ENV
NODE_ENV=production
PORT=$PORT
MONGO_URI=mongodb://127.0.0.1:$MONGO_PORT/udhar_khata
SHOP_NAME=शर्मा किराना स्टोर (डेमो)
# WhatsApp Cloud API (optional) - fill these to enable automatic messages
WA_TOKEN=
WA_PHONE_NUMBER_ID=
WA_TEMPLATE_NAME=
WA_TEMPLATE_LANG=hi
ENV
  chmod 600 "$SHARED/.env"
fi
ln -sfn "$SHARED/.env" "$REL_DIR/server/.env"
PORT=$(grep -E '^PORT=' "$SHARED/.env" | cut -d= -f2)

ln -sfn "$REL_DIR" "$BASE/current"

# ---------- systemd service ----------
log "Configuring systemd service on port $PORT"
id -u udharkhata >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin udharkhata
chown -R udharkhata:udharkhata "$BASE"
cat > /etc/systemd/system/$APP.service <<UNIT
[Unit]
Description=Udhar Khata API (Node.js)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=udharkhata
WorkingDirectory=$BASE/current/server
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable $APP >/dev/null
systemctl restart $APP

for i in $(seq 1 20); do
  curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/api/health" || { journalctl -u $APP -n 50 --no-pager; exit 1; }
echo

# Seed fake demo customers only when the database is empty
if [ ! -f "$SHARED/.seeded" ]; then
  log "Adding demo (fake) customers"
  (cd "$BASE/current/server" && runuser -u udharkhata -- node src/seed.js) && touch "$SHARED/.seeded"
fi

# ---------- nginx ----------
log "Configuring nginx for $DOMAIN"
if ss -ltnp '( sport = :80 )' | grep -q ':80' && ! ss -ltnp '( sport = :80 )' | grep -q nginx; then
  echo "Port 80 is used by another program (not nginx):"; ss -ltnp '( sport = :80 )'
  echo "Cannot attach a public URL automatically. The API is running on 127.0.0.1:$PORT."
  exit 1
fi
apt_install nginx certbot python3-certbot-nginx

if [ -d /etc/nginx/sites-available ]; then
  CONF=/etc/nginx/sites-available/$APP.conf
  ln -sfn "$CONF" /etc/nginx/sites-enabled/$APP.conf
else
  CONF=/etc/nginx/conf.d/$APP.conf
fi

CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
HAS_V6=0; [ -s /proc/net/if_inet6 ] && HAS_V6=1
write_nginx() {
  local tls="$1"
  local v6_80="" v6_443=""
  if [ "${HAS_V6:-0}" = 1 ]; then v6_80="listen [::]:80;"; v6_443="listen [::]:443 ssl http2;"; fi
  {
    if [ "$tls" = 1 ]; then
      cat <<NGX
server {
    listen 80;
    $v6_80
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    $v6_443
    server_name $DOMAIN;
    ssl_certificate $CERT;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:udharkhata:10m;
    ssl_session_timeout 1d;
    add_header Strict-Transport-Security "max-age=31536000" always;
NGX
    else
      cat <<NGX
server {
    listen 80;
    $v6_80
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
NGX
    fi
    cat <<NGX
    root $BASE/current/client/dist;
    index index.html;
    client_max_body_size 1m;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location /api/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location / {
        add_header Cache-Control "no-cache";
        try_files \$uri \$uri/ /index.html;
    }
}
NGX
  } > "$CONF"
}

mkdir -p /var/www/html
if [ -f "$CERT" ]; then
  write_nginx 1
else
  write_nginx 0
fi
nginx -t
systemctl enable --now nginx >/dev/null
systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

# ---------- HTTPS (Let's Encrypt) ----------
if [ ! -f "$CERT" ]; then
  log "Requesting HTTPS certificate for $DOMAIN"
  if certbot certonly --webroot -w /var/www/html -d "$DOMAIN" --non-interactive --agree-tos \
       --register-unsafely-without-email; then
    write_nginx 1
    nginx -t && systemctl reload nginx
  else
    warn "Certificate request failed - site stays on http://$DOMAIN"
  fi
fi

mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# ---------- cleanup old releases (keep 3) ----------
ls -1dt $BASE/releases/* | tail -n +4 | xargs -r rm -rf

log "Health check"
SCHEME=http; [ -f "$CERT" ] && SCHEME=https
sleep 1
curl -fsS "$SCHEME://$DOMAIN/api/health" && echo
curl -fsS "$SCHEME://$DOMAIN/api/summary" && echo
echo
echo "=============================================="
echo " LIVE:  $SCHEME://$DOMAIN"
echo "=============================================="
