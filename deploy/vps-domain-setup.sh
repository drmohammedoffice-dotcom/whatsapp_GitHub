#!/bin/bash
set -euo pipefail

DOMAIN="almutamayiziq.com"
PROJECT_DIR="/root/whatsapp_GitHub"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
BASE_URL="https://${DOMAIN}"

export DEBIAN_FRONTEND=noninteractive

echo "==> Installing Nginx and Certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "==> Preparing certbot webroot..."
mkdir -p /var/www/certbot

echo "==> Installing Nginx site config..."
cp "${PROJECT_DIR}/deploy/nginx-almutamayiziq.conf" "${NGINX_SITE}"
ln -sf "${NGINX_SITE}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing Nginx config..."
nginx -t

echo "==> Reloading Nginx..."
systemctl enable nginx
systemctl reload nginx

echo "==> Updating application environment..."
ENV_FILE="${PROJECT_DIR}/.env"
WEB_ENV="${PROJECT_DIR}/apps/web/.env.local"

update_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

update_env NODE_ENV production
update_env API_PUBLIC_URL "${BASE_URL}"
update_env WEB_PUBLIC_URL "${BASE_URL}"
update_env CORS_ORIGINS "${BASE_URL},https://www.${DOMAIN}"
update_env NEXT_PUBLIC_API_URL "${BASE_URL}"
update_env NEXT_PUBLIC_SOCKET_URL "${BASE_URL}"

cat > "$WEB_ENV" <<EOF
NEXT_PUBLIC_API_URL=${BASE_URL}
NEXT_PUBLIC_SOCKET_URL=${BASE_URL}
EOF

echo "==> Rebuilding web (NEXT_PUBLIC_* baked at build time)..."
cd "$PROJECT_DIR"
pnpm --filter @watsapp/web build

echo "==> Restarting PM2 services..."
pm2 restart api web worker --update-env

echo "==> Obtaining SSL certificate..."
certbot --nginx \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect \
  || certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect

echo "==> Configuring firewall..."
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
echo "y" | ufw enable || true

echo "==> Final Nginx test..."
nginx -t
systemctl reload nginx

echo "==> Verification..."
curl -sI "http://${DOMAIN}" | head -5
curl -sI "https://${DOMAIN}/api/v1/health" | head -5
curl -s "https://${DOMAIN}/api/v1/health" || true

echo "SETUP_COMPLETE"
