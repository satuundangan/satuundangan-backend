#!/usr/bin/env bash
# ==============================================================================
# Fail2ban + Telegram Alert Automated Installer for SatuUndangan (Biznet Server)
# Usage: sudo ./install-fail2ban.sh [TELEGRAM_BOT_TOKEN] [TELEGRAM_CHAT_ID]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🛡️  Memulai Instalasi & Konfigurasi Fail2ban SatuUndangan..."

# 1. Pastikan dijalankan sebagai root / sudo
if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Error: Skrip ini harus dijalankan dengan hak akses root atau sudo." >&2
  exit 1
fi

# 2. Ambil token dan chat ID dari argumen atau dari .env aplikasi
TG_TOKEN="${1:-}"
TG_CHAT_ID="${2:-}"

ENV_FILE=""
for candidate in \
  "$HOME/apps/satu-undangan/.env" \
  "/home/refda21/apps/satu-undangan/.env" \
  "/home/ubuntu/apps/satu-undangan/.env"; do
  if [ -f "$candidate" ]; then
    ENV_FILE="$candidate"
    break
  fi
done

if [ -z "$TG_TOKEN" ] && [ -n "$ENV_FILE" ]; then
  TG_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"'\'' ' || true)
fi

if [ -z "$TG_CHAT_ID" ] && [ -n "$ENV_FILE" ]; then
  # Ambil ID pertama dari daftar TELEGRAM_CHAT_IDS
  TG_CHAT_ID=$(grep -E "^TELEGRAM_CHAT_IDS=" "$ENV_FILE" | cut -d '=' -f2- | cut -d ',' -f1 | tr -d '"'\'' ' || true)
fi

if [ -z "$TG_TOKEN" ]; then
  read -rp "Masukkan TELEGRAM_BOT_TOKEN: " TG_TOKEN
fi

if [ -z "$TG_CHAT_ID" ]; then
  read -rp "Masukkan TELEGRAM_CHAT_ID (contoh: -100xxxxxxx atau 12345678): " TG_CHAT_ID
fi

if [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT_ID" ]; then
  echo "❌ Error: TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID wajib diisi." >&2
  exit 1
fi

# 3. Install fail2ban jika belum ada
if ! command -v fail2ban-client &>/dev/null; then
  echo "📦 Menginstall paket fail2ban via apt..."
  apt-get update -y
  apt-get install -y fail2ban curl iptables
fi

# 4. Salin Telegram action config
echo "⚙️  Mengonfigurasi Telegram action..."
mkdir -p /etc/fail2ban/action.d
cp "${SCRIPT_DIR}/action.d/telegram.conf" /etc/fail2ban/action.d/telegram.conf
chmod 644 /etc/fail2ban/action.d/telegram.conf

# 5. Salin Jail config dengan substitusi token & chat ID
echo "⚙️  Mengonfigurasi Jail satuundangan..."
mkdir -p /etc/fail2ban/jail.d
sed \
  -e "s|telegram_token = YOUR_TELEGRAM_BOT_TOKEN|telegram_token = ${TG_TOKEN}|g" \
  -e "s|telegram_chat_id = YOUR_TELEGRAM_CHAT_ID|telegram_chat_id = ${TG_CHAT_ID}|g" \
  "${SCRIPT_DIR}/jail.d/satuundangan.conf" > /etc/fail2ban/jail.d/satuundangan.conf
chmod 644 /etc/fail2ban/jail.d/satuundangan.conf

# 6. Uji sintaks konfigurasi fail2ban
echo "🔍 Menguji validitas konfigurasi fail2ban..."
if ! fail2ban-client -t &>/dev/null; then
  echo "❌ Error: Konfigurasi fail2ban tidak valid!" >&2
  fail2ban-client -t
  exit 1
fi

# 7. Aktifkan & restart service fail2ban
echo "🚀 Mengaktifkan & merestart service fail2ban..."
systemctl enable fail2ban
systemctl restart fail2ban
sleep 2

# 8. Install Daily Security Digest Script & Cron (08:05 WIB = 01:05 UTC)
echo "⏰ Mengonfigurasi Daily Security Digest Scheduler (08:05 WIB)..."
mkdir -p /etc/fail2ban/scripts
cp "${SCRIPT_DIR}/fail2ban-daily-report.sh" /etc/fail2ban/scripts/fail2ban-daily-report.sh
chmod +x /etc/fail2ban/scripts/fail2ban-daily-report.sh

cat << 'EOF' > /etc/cron.d/satuundangan-fail2ban-report
# Daily Fail2ban Security Digest for SatuUndangan Ops (01:05 UTC = 08:05 WIB)
5 1 * * * root /etc/fail2ban/scripts/fail2ban-daily-report.sh > /dev/null 2>&1
EOF
chmod 644 /etc/cron.d/satuundangan-fail2ban-report

echo ""
echo "✅ Fail2ban & Daily Digest Berhasil Dikonfigurasi & Aktif!"
echo "--------------------------------------------------------"
fail2ban-client status
echo "--------------------------------------------------------"
echo "• Serangan SSH brute-force diblokir secara otomatis tanpa spamming notifikasi instan."
echo "• Serangan Web exploit / probe Nginx tetap mengirimkan notifikasi instan ke Telegram."
echo "• Rekapitulasi keamanan lengkap akan dikirim otomatis setiap pagi pukul 08:05 WIB ke chat ID: ${TG_CHAT_ID}"
