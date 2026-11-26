#!/usr/bin/env bash
# =====================================================================
#  Surakshit Gate - one-command installer / updater (isolated)
#
#  curl -fsSL https://raw.githubusercontent.com/ganeshrprajapati29/Qr-code-demo/main/deploy/install.sh | bash
#
#  Safe for servers that already run other projects:
#   - Everything lives in /opt/surakshit-gate (own Node.js, own MongoDB, own user)
#   - System Node.js / MongoDB / Docker are NOT installed or changed
#   - MongoDB listens only on 127.0.0.1:27028, RAM-limited
#   - nginx: only ONE new site file is added for the sslip.io domain;
#     if the nginx config test fails, that file is removed again
#   - If port 80 belongs to another program (apache, caddy, docker...),
#     it is not touched; the app is served on its own port instead
#  Re-run the same command any time to update to the latest code.
#  Remove everything: bash /opt/surakshit-gate/app/deploy/uninstall.sh
# =====================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ganeshrprajapati29/Qr-code-demo.git}"
BRANCH="${BRANCH:-main}"
SUBDIR="${SUBDIR:-surakshit-gate}"   # project folder inside the repo
APP=surakshit-gate
BASE=/opt/$APP
RUN_USER=sgate
NODE_VER=22.23.5
MONGO_VER=8.0.4
MONGO_PORT=27028
APP_PORT_START=5070

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "Run as root (sudo -i)"
command -v systemctl >/dev/null || die "systemd is required"

# ---------------------------------------------------------------- info
. /etc/os-release
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  NODE_ARCH=x64;   MONGO_ARCH=x86_64 ;;
  aarch64) NODE_ARCH=arm64; MONGO_ARCH=aarch64 ;;
  *) die "Unsupported CPU: $ARCH" ;;
esac

if [ -z "${DOMAIN:-}" ]; then
  PUBLIC_IP=$(curl -fsS4 --max-time 6 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  DOMAIN="gate.${PUBLIC_IP//./-}.sslip.io"
fi
log "Surakshit Gate installer  |  $PRETTY_NAME ($ARCH)  |  $DOMAIN"

port_in_use() { ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q .; }
port_owner()  { ss -ltnpH "( sport = :$1 )" 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | cut -d'"' -f2; }

export DEBIAN_FRONTEND=noninteractive
APT_UPDATED=0
apt_add() {   # installs only packages that are missing; never upgrades anything
  local miss=()
  for p in "$@"; do dpkg -s "$p" >/dev/null 2>&1 || miss+=("$p"); done
  [ ${#miss[@]} -eq 0 ] && return 0
  [ $APT_UPDATED = 1 ] || { apt-get update -y -qq; APT_UPDATED=1; }
  apt-get install -y -qq --no-upgrade "${miss[@]}"
}

command -v apt-get >/dev/null || die "This installer supports Ubuntu/Debian"
apt_add git curl ca-certificates tar gzip

mkdir -p $BASE/{shared,logs,data/db,data/app,acme,downloads}
id -u $RUN_USER >/dev/null 2>&1 || useradd --system --home-dir $BASE --no-create-home --shell /usr/sbin/nologin $RUN_USER

# ---------------------------------------------------------------- private Node.js
if [ "$($BASE/node/bin/node -v 2>/dev/null)" != "v$NODE_VER" ]; then
  log "Installing private Node.js $NODE_VER  ->  $BASE/node"
  f=node-v$NODE_VER-linux-$NODE_ARCH.tar.gz
  curl -fSL --retry 3 -o $BASE/downloads/$f https://nodejs.org/dist/v$NODE_VER/$f
  rm -rf $BASE/node && mkdir -p $BASE/node
  tar -xzf $BASE/downloads/$f -C $BASE/node --strip-components=1
fi
export PATH=$BASE/node/bin:$PATH
echo "node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------- private MongoDB
if [ ! -x $BASE/mongodb/bin/mongod ] || ! $BASE/mongodb/bin/mongod --version 2>/dev/null | grep -q "v$MONGO_VER"; then
  log "Installing private MongoDB $MONGO_VER  ->  $BASE/mongodb"
  if [ "$MONGO_ARCH" = x86_64 ] && ! grep -qw avx /proc/cpuinfo; then
    die "This CPU has no AVX support, MongoDB 5+ cannot run. Use MongoDB Atlas: set MONGO_URI in $BASE/shared/.env"
  fi
  case "$ID-${VERSION_ID%%.*}" in
    ubuntu-20) MD=ubuntu2004 ;; ubuntu-22) MD=ubuntu2204 ;; ubuntu-2[4-9]) MD=ubuntu2404 ;;
    debian-12|debian-13) MD=debian12 ;; debian-11) MD=debian11 ;;
    *) MD=ubuntu2204; warn "Unknown distro $ID $VERSION_ID, trying ubuntu2204 build" ;;
  esac
  f=mongodb-linux-$MONGO_ARCH-$MD-$MONGO_VER.tgz
  curl -fSL --retry 3 -o $BASE/downloads/$f https://fastdl.mongodb.org/linux/$f
  rm -rf $BASE/mongodb && mkdir -p $BASE/mongodb
  tar -xzf $BASE/downloads/$f -C $BASE/mongodb --strip-components=1
fi
if ldd $BASE/mongodb/bin/mongod | grep -q 'not found'; then
  log "Adding missing shared libraries for MongoDB"
  apt_add libcurl4 2>/dev/null || apt_add libcurl4t64 || true
  apt_add openssl liblzma5 || true
  if ldd $BASE/mongodb/bin/mongod | grep 'not found'; then die "MongoDB libraries missing (see above)"; fi
fi

cat > /etc/systemd/system/$APP-mongo.service <<UNIT
[Unit]
Description=Surakshit Gate - private MongoDB (127.0.0.1:$MONGO_PORT)
After=network.target

[Service]
User=$RUN_USER
ExecStart=$BASE/mongodb/bin/mongod --dbpath $BASE/data/db --bind_ip 127.0.0.1 --port $MONGO_PORT --wiredTigerCacheSizeGB 0.25 --logpath $BASE/logs/mongod.log --logappend
Restart=always
RestartSec=5
MemoryMax=700M
LimitNOFILE=64000
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
chown -R $RUN_USER:$RUN_USER $BASE/data $BASE/logs
chmod 700 $BASE/data
systemctl daemon-reload
systemctl enable $APP-mongo >/dev/null 2>&1
systemctl restart $APP-mongo
for i in $(seq 1 30); do (echo > /dev/tcp/127.0.0.1/$MONGO_PORT) 2>/dev/null && break; sleep 1; done
(echo > /dev/tcp/127.0.0.1/$MONGO_PORT) 2>/dev/null || { journalctl -u $APP-mongo -n 30 --no-pager; tail -20 $BASE/logs/mongod.log; die "MongoDB did not start"; }
echo "MongoDB running on 127.0.0.1:$MONGO_PORT"

# ---------------------------------------------------------------- code
log "Fetching code ($BRANCH)"
GIT=(git -c "safe.directory=$BASE/repo")
if [ -n "${GITHUB_TOKEN:-}" ]; then   # private repo: token used only for this run, never stored
  GIT+=(-c "http.extraHeader=Authorization: Basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)")
fi
if [ -d $BASE/repo/.git ]; then
  "${GIT[@]}" -C $BASE/repo remote set-url origin "$REPO_URL"
  "${GIT[@]}" -C $BASE/repo fetch --depth 1 origin $BRANCH
  "${GIT[@]}" -C $BASE/repo reset --hard FETCH_HEAD
else
  rm -rf $BASE/repo
  "${GIT[@]}" clone --depth 1 -b $BRANCH "$REPO_URL" $BASE/repo
fi
"${GIT[@]}" -C $BASE/repo log -1 --format='commit %h  %s'
[ -d $BASE/repo/$SUBDIR/server ] || die "Folder $SUBDIR not found in the repository"
ln -sfn $BASE/repo/$SUBDIR $BASE/app

log "Installing dependencies & building the React app"
export npm_config_cache=$BASE/.npm-cache
(cd $BASE/app/server && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
(cd $BASE/app/client && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent)

# ---------------------------------------------------------------- web mode
MODE=nginx
if port_in_use 80; then
  OWNER=$(port_owner 80)
  if [ "$OWNER" != nginx ]; then
    MODE=direct
    warn "Port 80 is used by '${OWNER:-unknown}' - not touching it. App will run on its own port."
  fi
fi

# ---------------------------------------------------------------- .env
ENVF=$BASE/shared/.env
if [ ! -f $ENVF ]; then
  P=$APP_PORT_START
  while port_in_use $P; do P=$((P + 1)); done
  cat > $ENVF <<ENV
NODE_ENV=production
PORT=$P
HOST=127.0.0.1
MONGO_URI=mongodb://127.0.0.1:$MONGO_PORT/surakshit_gate
DATA_DIR=$BASE/data/app
PUBLIC_URL=http://$DOMAIN
CLIENT_DIST=
# messages: demo (no real SMS/WhatsApp) | whatsapp
MESSAGE_PROVIDER=demo
# WhatsApp Cloud API (fill and set MESSAGE_PROVIDER=whatsapp)
WA_TOKEN=
WA_PHONE_NUMBER_ID=
WA_APP_SECRET=
WA_VERIFY_TOKEN=
WA_TEMPLATE_LANG=hi
ENV
fi
set_env() { if grep -q "^$1=" $ENVF; then sed -i "s#^$1=.*#$1=$2#" $ENVF; else echo "$1=$2" >> $ENVF; fi; }
APP_PORT=$(grep -E '^PORT=' $ENVF | cut -d= -f2)

configure_direct() {
  set_env HOST 0.0.0.0
  set_env CLIENT_DIST $BASE/app/client/dist
  if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then ufw allow $APP_PORT/tcp >/dev/null; fi
  return 0
}
if [ $MODE = direct ]; then configure_direct; else set_env HOST 127.0.0.1; set_env CLIENT_DIST ""; fi
ln -sfn $ENVF $BASE/app/server/.env
chmod 640 $ENVF
chown -R $RUN_USER:$RUN_USER $BASE/shared $BASE/repo $BASE/data/app

# ---------------------------------------------------------------- app service
log "Starting app service (port $APP_PORT)"
cat > /etc/systemd/system/$APP.service <<UNIT
[Unit]
Description=Surakshit Gate - Node.js API
After=network.target $APP-mongo.service
Requires=$APP-mongo.service

[Service]
User=$RUN_USER
WorkingDirectory=$BASE/app/server
ExecStart=$BASE/node/bin/node --max-old-space-size=256 src/server.js
Restart=always
RestartSec=3
MemoryMax=400M
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable $APP >/dev/null 2>&1
restart_app() {
  systemctl restart $APP
  for i in $(seq 1 25); do curl -fsS http://127.0.0.1:$APP_PORT/api/health >/dev/null 2>&1 && return 0; sleep 1; done
  journalctl -u $APP -n 40 --no-pager; die "App did not start"
}
restart_app
curl -fsS http://127.0.0.1:$APP_PORT/api/health; echo

if [ ! -f $BASE/shared/.seeded ]; then
  log "Adding FAKE demo school data + first logins"
  (cd $BASE/app/server && runuser -u $RUN_USER -- env SEED_LOGINS_FILE=$BASE/shared/first-logins.txt $BASE/node/bin/node src/seed.js) && touch $BASE/shared/.seeded
fi

# ---------------------------------------------------------------- nginx + https
URL="http://$DOMAIN:$APP_PORT"
if [ $MODE = nginx ]; then
  log "nginx site for $DOMAIN"
  apt_add nginx
  systemctl is-active --quiet nginx || systemctl enable --now nginx
  if [ -d /etc/nginx/sites-enabled ]; then CONF=/etc/nginx/sites-available/$APP.conf; LINK=/etc/nginx/sites-enabled/$APP.conf
  else CONF=/etc/nginx/conf.d/$APP.conf; LINK=""; fi
  pick_cert() {   # sets CERT/KEY if a certificate for $DOMAIN exists (certbot or acme.sh)
    CERT=""; KEY=""
    if [ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
      CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem; KEY=/etc/letsencrypt/live/$DOMAIN/privkey.pem
    elif [ -s $BASE/ssl/fullchain.pem ]; then
      CERT=$BASE/ssl/fullchain.pem; KEY=$BASE/ssl/privkey.pem
    fi
    return 0
  }
  pick_cert
  V6=0; if [ -s /proc/net/if_inet6 ]; then V6=1; fi

  write_site() {   # $1 = 1 for https
    {
      echo "# Surakshit Gate - managed by $BASE/app/deploy/install.sh"
      echo "server {"
      echo "    listen 80;"; if [ $V6 = 1 ]; then echo "    listen [::]:80;"; fi
      echo "    server_name $DOMAIN;"
      echo "    location /.well-known/acme-challenge/ { root $BASE/acme; }"
      if [ "$1" = 1 ]; then
        echo "    location / { return 301 https://\$host\$request_uri; }"
        echo "}"
        echo "server {"
        echo "    listen 443 ssl;"; if [ $V6 = 1 ]; then echo "    listen [::]:443 ssl;"; fi
        echo "    server_name $DOMAIN;"
        echo "    ssl_certificate $CERT;"
        echo "    ssl_certificate_key $KEY;"
        echo "    ssl_protocols TLSv1.2 TLSv1.3;"
        echo "    ssl_session_timeout 1d;"
        echo "    add_header Strict-Transport-Security \"max-age=31536000\" always;"
      fi
      cat <<NGX
    root $BASE/app/client/dist;
    index index.html;
    client_max_body_size 4m;
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    location /api/ {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; try_files \$uri =404; }
    location / { add_header Cache-Control "no-cache"; try_files \$uri \$uri/ /index.html; }
}
NGX
    } > $CONF
    if [ -n "$LINK" ]; then ln -sfn $CONF $LINK; fi
    if nginx -t >/dev/null 2>&1; then systemctl reload nginx; return 0; fi
    nginx -t || true
    return 1
  }

  remove_site() { rm -f $CONF; if [ -n "$LINK" ]; then rm -f $LINK; fi; nginx -t >/dev/null 2>&1 && systemctl reload nginx || true; }

  get_cert_certbot() {
    apt_add certbot >/dev/null 2>&1 || return 1
    certbot certonly --webroot -w $BASE/acme -d $DOMAIN --non-interactive --agree-tos \
      --register-unsafely-without-email -q 2>/dev/null || { warn "certbot failed, trying acme.sh"; return 1; }
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/$APP-nginx.sh
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/$APP-nginx.sh
  }
  get_cert_acmesh() {   # pure shell ACME client, kept inside $BASE (no Python needed)
    local A=$BASE/acme.sh
    mkdir -p $A $BASE/ssl
    curl -fsSL --retry 3 -o $A/acme.sh https://raw.githubusercontent.com/acmesh-official/acme.sh/3.1.1/acme.sh || return 1
    chmod +x $A/acme.sh
    (cd $A && ./acme.sh --home $A --config-home $A/data --server letsencrypt --issue -d $DOMAIN -w $BASE/acme) || return 1
    (cd $A && ./acme.sh --home $A --config-home $A/data --install-cert -d $DOMAIN \
        --key-file $BASE/ssl/privkey.pem --fullchain-file $BASE/ssl/fullchain.pem \
        --reloadcmd "nginx -t && systemctl reload nginx") || return 1
    cat > /etc/systemd/system/$APP-ssl-renew.service <<UNIT
[Unit]
Description=Surakshit Gate - renew HTTPS certificate
[Service]
Type=oneshot
WorkingDirectory=$A
ExecStart=$A/acme.sh --cron --home $A --config-home $A/data
UNIT
    cat > /etc/systemd/system/$APP-ssl-renew.timer <<UNIT
[Unit]
Description=Surakshit Gate - daily HTTPS renewal check
[Timer]
OnCalendar=daily
RandomizedDelaySec=3h
Persistent=true
[Install]
WantedBy=timers.target
UNIT
    systemctl daemon-reload
    systemctl enable --now $APP-ssl-renew.timer >/dev/null 2>&1 || true
  }

  HTTPS=0; if [ -n "$CERT" ]; then HTTPS=1; fi
  chmod 755 $BASE; chmod -R o+rX $BASE/app/client/dist $BASE/acme
  if ! write_site $HTTPS; then
    warn "nginx config test failed - removing our site file, other sites untouched"
    remove_site; MODE=direct; configure_direct; restart_app
  else
    URL="http://$DOMAIN"
    if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi
    if [ $HTTPS = 0 ]; then
      log "Getting free HTTPS certificate (Let's Encrypt)"
      if get_cert_certbot || get_cert_acmesh; then
        pick_cert; HTTPS=1
        write_site 1 || { warn "HTTPS config failed, staying on HTTP"; write_site 0; HTTPS=0; }
      else
        warn "Certificate not issued (is port 80 open in the VPS/Hostinger firewall?). Site works on HTTP; re-run later for HTTPS."
      fi
    fi
    if [ $HTTPS = 1 ]; then URL="https://$DOMAIN"; fi
  fi
fi

# parent links in messages must point to the public URL; cookies Secure on https
if [ "$(grep -E '^PUBLIC_URL=' $ENVF | cut -d= -f2-)" != "$URL" ]; then set_env PUBLIC_URL "$URL"; restart_app; fi

rm -f $BASE/downloads/*.tgz $BASE/downloads/*.tar.gz

# ---------------------------------------------------------------- verify
log "Checking public link"
sleep 1
if curl -fsS --max-time 10 "$URL/api/health" >/dev/null 2>&1; then OK=1; else OK=0; fi

cat <<DONE

  ============================================================
    Surakshit Gate is LIVE
    Link   :  $URL
    Health :  $URL/api/health   ($( [ $OK = 1 ] && echo reachable || echo 'not reachable from this server - check VPS firewall' ))
  ------------------------------------------------------------
    Files  :  $BASE            Settings: $BASE/shared/.env
    Logs   :  journalctl -u $APP -f
    Update :  re-run the same install command
    Remove :  bash $BASE/app/deploy/uninstall.sh
  ============================================================
DONE
if [ -f $BASE/shared/first-logins.txt ]; then
  echo; cat $BASE/shared/first-logins.txt
  echo "(saved in $BASE/shared/first-logins.txt - delete it after noting the passwords)"
fi
