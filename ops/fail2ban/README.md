# 🛡️ Fail2ban + Notifikasi Telegram — SatuUndangan Production Server

Panduan proteksi server production SatuUndangan di Biznet menggunakan **Fail2ban** yang terintegrasi langsung dengan **Telegram Bot API**.

---

## 🎯 Manfaat & Kemampuan
1. **Anti Brute-Force SSH (`[sshd]`)**:
   - Membatasi percobaan login SSH port 22 ke server.
   - Gagal 3 kali dalam 10 menit $\rightarrow$ IP diblokir selama **24 jam**.
2. **Anti Scanner & Vulnerability Probes (`[nginx-botsearch]`)**:
   - Memblokir otomatis IP scanner yang mencoba mengakses `/.env`, `/.git`, `/wp-login.php`, `/xmlrpc.php`, `phpmyadmin`, `eval-stdin.php`.
   - Gagal 2 kali dalam 5 menit $\rightarrow$ IP diblokir **24 jam**.
3. **Anti Bad Bots (`[nginx-badbots]`)**:
   - Memblokir user agent bot perusak atau scraper agresif.
4. **Anti Rate-Limit Abuse (`[nginx-limit-req]`)**:
   - Memblokir IP yang melanggar batas request rate-limiting Nginx.
5. **🚨 Notifikasi Real-Time ke Telegram**:
   - Setiap kali ada IP yang diban atau unban, Fail2ban otomatis mengirim pesan alert ke grup Telegram tim ops/developer.

---

## 🚀 Cara Pasang di Server (Ubuntu / Biznet)

### Langkah 1: Masuk ke Server via SSH
```bash
ssh -i ~/.ssh/Prod-MSS-Server.pem ubuntu@43.218.58.110
# Atau host server production SatuUndangan
```

### Langkah 2: Jalankan Skrip Installer
Masuk ke direktori aplikasi dan jalankan script installer dengan `sudo`:
```bash
cd ~/apps/satu-undangan/ops/fail2ban
sudo ./install-fail2ban.sh
```
*Skrip otomatis membaca `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_IDS` dari `.env`, menyalin konfigurasi jail dan action, lalu merestart service fail2ban.*

---

## 🔍 Perintah Berguna Memantau Fail2ban di Server

- **Cek status seluruh jail yang aktif:**
  ```bash
  sudo fail2ban-client status
  ```
- **Cek detail IP yang sedang diblokir pada jail tertentu (contoh: `nginx-botsearch`):**
  ```bash
  sudo fail2ban-client status nginx-botsearch
  sudo fail2ban-client status sshd
  ```
- **Membuka blokir (unban) manual untuk IP tertentu jika salah ban:**
  ```bash
  sudo fail2ban-client set <jail_name> unbanip <IP_ADDRESS>
  # Contoh:
  sudo fail2ban-client set sshd unbanip 203.0.113.45
  ```
- **Melihat log aktivitas fail2ban:**
  ```bash
  sudo tail -f /var/log/fail2ban.log
  ```
