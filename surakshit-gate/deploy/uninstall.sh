#!/usr/bin/env bash
# Removes Surakshit Gate completely. Touches nothing that the installer did not create.
# Usage:  bash /opt/surakshit-gate/app/deploy/uninstall.sh        (asks for confirmation)
#         bash /opt/surakshit-gate/app/deploy/uninstall.sh --yes
set -uo pipefail
APP=surakshit-gate
BASE=/opt/$APP
[ "$(id -u)" = 0 ] || { echo "Run as root"; exit 1; }

if [ "${1:-}" != "--yes" ]; then
  read -r -p "This deletes the Surakshit Gate app AND its database in $BASE. Type 'yes' to continue: " a < /dev/tty
  [ "$a" = yes ] || { echo "Cancelled"; exit 0; }
fi

for u in $APP $APP-mongo $APP-ssl-renew.timer $APP-ssl-renew.service; do
  systemctl disable --now "$u" >/dev/null 2>&1
  rm -f "/etc/systemd/system/${u%.service}.service" "/etc/systemd/system/$u"
done
systemctl daemon-reload

for f in /etc/nginx/sites-enabled/$APP.conf /etc/nginx/sites-available/$APP.conf /etc/nginx/conf.d/$APP.conf; do
  [ -e "$f" ] && grep -q "managed by $BASE" "$f" 2>/dev/null && rm -f "$f"
  [ -L "$f" ] && [ ! -e "$f" ] && rm -f "$f"
done
if command -v nginx >/dev/null && nginx -t >/dev/null 2>&1; then systemctl reload nginx; fi
rm -f /etc/letsencrypt/renewal-hooks/deploy/$APP-nginx.sh

rm -rf "$BASE"
id -u sgate >/dev/null 2>&1 && userdel sgate
echo "Surakshit Gate removed. (nginx/certbot packages, if installed by the installer, were left in place.)"
