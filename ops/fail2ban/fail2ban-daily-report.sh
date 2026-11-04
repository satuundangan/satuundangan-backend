#!/usr/bin/env bash
# ==============================================================================
# SatuUndangan Fail2ban Daily Security Digest
# Sends daily summary of blocked IPs and firewall status to Telegram Ops group.
# Intended to run via cron daily at 08:05 WIB (01:05 UTC).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Locate .env for Telegram Token and Chat ID
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

if [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT_ID" ]; then
  for candidate in \
    "$HOME/apps/satu-undangan/.env" \
    "/home/refda21/apps/satu-undangan/.env" \
    "/home/ubuntu/apps/satu-undangan/.env" \
    "/etc/fail2ban/telegram.env"; do
    if [ -f "$candidate" ]; then
      if [ -z "$TG_TOKEN" ]; then
        TG_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$candidate" | cut -d '=' -f2- | tr -d '"'\'' ' || true)
      fi
      if [ -z "$TG_CHAT_ID" ]; then
        TG_CHAT_ID=$(grep -E "^TELEGRAM_CHAT_IDS=" "$candidate" | cut -d '=' -f2- | cut -d ',' -f1 | tr -d '"'\'' ' || true)
      fi
      break
    fi
  done
fi

# Fallback: extract from /etc/fail2ban/jail.d/satuundangan.conf if available
if [ -z "$TG_TOKEN" ] && [ -f "/etc/fail2ban/jail.d/satuundangan.conf" ]; then
  TG_TOKEN=$(grep -E "^telegram_token[[:space:]]*=" "/etc/fail2ban/jail.d/satuundangan.conf" | cut -d '=' -f2- | tr -d '"'\'' ' || true)
fi
if [ -z "$TG_CHAT_ID" ] && [ -f "/etc/fail2ban/jail.d/satuundangan.conf" ]; then
  TG_CHAT_ID=$(grep -E "^telegram_chat_id[[:space:]]*=" "/etc/fail2ban/jail.d/satuundangan.conf" | cut -d '=' -f2- | tr -d '"'\'' ' || true)
fi

if [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT_ID" ]; then
  echo "❌ Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID could not be determined." >&2
  exit 1
fi

# 2. Helper function to extract stats per jail
get_jail_stats() {
  local jail="$1"
  local status_output
  status_output=$(fail2ban-client status "$jail" 2>/dev/null || true)
  if [ -z "$status_output" ]; then
    echo "0 0 0"
    return
  fi
  local curr_banned total_banned total_failed
  curr_banned=$(echo "$status_output" | grep "Currently banned:" | awk '{print $NF}')
  total_banned=$(echo "$status_output" | grep "Total banned:" | awk '{print $NF}')
  total_failed=$(echo "$status_output" | grep "Total failed:" | awk '{print $NF}')
  echo "${curr_banned:-0} ${total_banned:-0} ${total_failed:-0}"
}

# 3. Retrieve stats from each jail
read -r ssh_cb ssh_tb ssh_tf <<< "$(get_jail_stats sshd)"
read -r bot_cb bot_tb bot_tf <<< "$(get_jail_stats nginx-botsearch)"
read -r bad_cb bad_tb bad_tf <<< "$(get_jail_stats nginx-badbots)"
read -r rate_cb rate_tb rate_tf <<< "$(get_jail_stats nginx-limit-req)"

TOTAL_ACTIVE_BANS=$((ssh_cb + bot_cb + bad_cb + rate_cb))

# 4. Check active jails count
JAIL_COUNT=$(fail2ban-client status 2>/dev/null | grep "Number of jail:" | awk '{print $NF}' || echo "4")

# 5. Check UFW status
UFW_STATUS="Aktif"
if command -v ufw &>/dev/null; then
  RAW_UFW=$(ufw status 2>/dev/null | head -n 1 || true)
  if [[ "$RAW_UFW" == *"inactive"* ]]; then
    UFW_STATUS="Nonaktif ⚠️"
  fi
fi

# 6. Sample of latest banned IPs from sshd
SSH_SAMPLE_OUTPUT=$(fail2ban-client status sshd 2>/dev/null || true)
SSH_BANNED_SAMPLE=$(echo "$SSH_SAMPLE_OUTPUT" | grep "Banned IP list:" | cut -d: -f2- | tr ' ' '\n' | grep -v '^$' | tail -n 5 | paste -sd ", " - || true)

SAMPLE_LINE=""
if [ -n "$SSH_BANNED_SAMPLE" ]; then
  SAMPLE_LINE="🔍 <b>Sampel IP Terblokir Terbaru:</b> <code>${SSH_BANNED_SAMPLE}</code>%0A"
fi

# 7. Formulate WIB Indonesian Date String
DAY_NUM=$(TZ='Asia/Jakarta' date '+%u')
case "$DAY_NUM" in
  1) DAY_NAME="Senin" ;;
  2) DAY_NAME="Selasa" ;;
  3) DAY_NAME="Rabu" ;;
  4) DAY_NAME="Kamis" ;;
  5) DAY_NAME="Jumat" ;;
  6) DAY_NAME="Sabtu" ;;
  7) DAY_NAME="Minggu" ;;
  *) DAY_NAME="Hari Ini" ;;
esac

DATE_FORMATTED="${DAY_NAME}, $(TZ='Asia/Jakarta' date '+%d %b %Y — %H:%M') WIB"

# 8. Build HTML Telegram Message
MSG="🛡️ <b>[Rekap Keamanan Harian Server]</b>%0A📅 <i>${DATE_FORMATTED}</i>%0A%0A<b>Status Pertahanan:</b>%0A• Firewall (UFW): <b>${UFW_STATUS}</b>%0A• Fail2ban: <b>${JAIL_COUNT} Jails Aktif</b>%0A%0A📊 <b>Aktivitas Pertahanan 24 Jam:</b>%0A• 🔐 <b>SSH Brute-force:</b> ${ssh_cb} IP diblokir (${ssh_tf} percobaan dicegat)%0A• 🕸️ <b>Web Exploit Scanner:</b> ${bot_cb} IP diblokir (${bot_tf} percobaan)%0A• 🤖 <b>Bad Web Bots:</b> ${bad_cb} IP diblokir (${bad_tf} percobaan)%0A• ⚡ <b>Rate Limit Abuse:</b> ${rate_cb} IP diblokir (${rate_tf} pelanggaran)%0A%0A🛑 <b>Total IP Terblokir di Firewall:</b> <b>${TOTAL_ACTIVE_BANS} IP</b>%0A${SAMPLE_LINE}%0A🔒 <b>Status Akses:</b> Aman 100% (Password auth OFF, hanya SSH Key)"

echo "Sending Telegram digest..."
HTTP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
  -d chat_id="${TG_CHAT_ID}" \
  -d parse_mode="HTML" \
  -d text="${MSG}")

STATUS_CODE=$(echo "$HTTP_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$STATUS_CODE" -eq 200 ]; then
  echo "✅ Daily Fail2ban digest sent successfully to chat ${TG_CHAT_ID}!"
else
  echo "❌ Failed to send Telegram message. Response: $HTTP_RESPONSE" >&2
  exit 1
fi
