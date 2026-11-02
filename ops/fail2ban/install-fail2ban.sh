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

ENV_FILE="/home/ubuntu/apps/satu-undangan/.env"
if [ -z "$TG_TOKEN" ] && [ -f "$ENV_FILE" ]; then
  TG_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"'\'' ' || true)
fi

if [ -z "$TG_CHAT_ID" ] && [ -f "$ENV_FILE" ]; then
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

echo ""
echo "✅ Fail2ban Berhasil Dikonfigurasi & Aktif!"
echo "----------------------------------------"
fail2ban-client status
echo "----------------------------------------"
echo "Setiap ada IP penyerang yang di-ban, bot Telegram akan mengirimkan notifikasi instan ke chat ID: ${TG_CHAT_ID}"
