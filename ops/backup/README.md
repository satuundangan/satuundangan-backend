# 💾 Backup & Restore Database SatuUndangan

Panduan backup otomatis dan restore database MySQL SatuUndangan (`satu_undangan_db`) di Biznet Server.

---

## ⚙️ Kebijakan Penyimpanan (Retention Policy)
1. **Lokal Server Biznet (`~/apps/satu-undangan/backups/`)**:
   - Disimpan selama **2 hari** terakhir.
   - Rotasi otomatis berjalan setiap kali script backup dieksekusi (file > 2 hari otomatis dihapus).
2. **GitHub Actions Artifacts**:
   - Di-upload otomatis setiap hari pukul **03:00 WIB** (20:00 UTC).
   - Disimpan di GitHub selama **7 hari** (`retention-days: 7`).
   - Hari ke-8 otomatis musnah/dibersihkan oleh GitHub.
   - Dapat di-download kapan saja dari tab **GitHub Actions $\rightarrow$ Daily Database Backup $\rightarrow$ Artifacts**.

---

## 🚀 Menjalankan Backup Manual
### Dari Server via SSH:
```bash
ssh satuundangan
bash ~/apps/satu-undangan/ops/backup/backup-db.sh
```

### Dari GitHub:
Masuk ke repository GitHub $\rightarrow$ **Actions** $\rightarrow$ **Daily Database Backup** $\rightarrow$ klik **Run workflow**.

---

## 🔄 Cara Restore Database dari Backup
Jika ingin me-restore database dari salah satu file backup `.sql.gz`:

```bash
# 1. Masuk ke server
ssh satuundangan

# 2. Ekstrak dan masukkan ke container MySQL
zcat /home/refda21/apps/satu-undangan/backups/backup_satu_undangan_db_YYYYMMDD_HHMMSS.sql.gz | docker exec -i satu-undangan-db mysql -u root -p'PASSWORD_DB' satu_undangan_db
```
