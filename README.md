# Sim Racing Mobile Community Website

Website komunitas sim racing mobile — tampilan publik + panel admin tersembunyi.
Deploy gratis di Cloudflare Pages + Workers + R2.

---

## Struktur File

```
sim-racing-community/
├── index.html          # Halaman publik
├── admin.html          # Panel admin (diproteksi password)
├── css/
│   ├── style.css       # Tema silver/metalik halaman publik
│   └── admin.css       # Gaya panel admin
├── js/
│   ├── config.js       # ← Edit di sini untuk ubah konten
│   ├── main.js         # Logic halaman publik
│   └── admin.js        # Logic panel admin
└── worker/
    ├── index.js        # Cloudflare Worker (API gateway)
    └── wrangler.toml   # Konfigurasi Worker
```

---

## Edit Konten (Tanpa Coding)

Buka `js/config.js` dan ubah:

| Field | Keterangan |
|---|---|
| `communityName` | Nama komunitas |
| `tagline` | Tagline di hero section |
| `about.description` | Deskripsi komunitas |
| `about.stats` | Statistik (anggota, game, event) |
| `members` | 5 anggota tim (nama, role, avatar) |
| `social.youtube/whatsapp/discord` | URL sosial media |
| `apiBaseUrl` | URL Worker setelah deploy |

Untuk ganti foto profil: ubah nilai `avatar` di setiap member ke path gambar, contoh:
```js
{ name: "NamaKamu", role: "Owner", avatar: "assets/members/owner.jpg" }
```

---

## Jalankan Lokal

### Frontend
```bash
cd sim-racing-community
# Butuh static server supaya CORS tidak bermasalah
npx serve .
# atau: python -m http.server 5500
```
Buka `http://localhost:5500`

### Worker (backend)
```bash
cd sim-racing-community/worker
npm install -g wrangler       # install sekali
wrangler login                # login ke akun Cloudflare
wrangler dev                  # jalankan lokal di port 8787
```

### Hubungkan frontend ke Worker lokal
Di `js/config.js`, pastikan:
```js
apiBaseUrl: "http://localhost:8787"
```

---

## Deploy ke Cloudflare

### Langkah 1 — Buat R2 Bucket
1. Login [dash.cloudflare.com](https://dash.cloudflare.com)
2. Menu **R2** → **Create Bucket**
3. Nama bucket: `srmc-apks`
4. Catat **Account ID** (muncul di sidebar kanan)

### Langkah 2 — Generate Password Hash
Jalankan di terminal (butuh Node.js):
```bash
node -e "
  const c    = require('crypto');
  const salt = c.randomBytes(16).toString('hex');
  const pw   = 'PASSWORD_KAMU_DI_SINI';
  const hash = c.createHash('sha256').update(salt + pw).digest('hex');
  console.log(salt + ':' + hash);
"
```
Simpan output-nya — ini yang akan dipakai sebagai `ADMIN_PASSWORD_HASH`.

### Langkah 3 — Deploy Worker
```bash
cd sim-racing-community/worker
wrangler deploy
```

Lalu set secrets (jalankan satu per satu, paste nilainya saat diminta):
```bash
wrangler secret put ADMIN_PASSWORD_HASH    # output dari langkah 2
wrangler secret put API_KEY                # string acak panjang
wrangler secret put CF_ACCOUNT_ID         # Account ID dari dashboard
wrangler secret put CF_API_TOKEN          # API Token Cloudflare (izin R2:Read)
wrangler secret put ALLOWED_ORIGIN        # URL Pages setelah deploy, contoh: https://srmc.pages.dev
```

Membuat CF_API_TOKEN:
- Buka [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
- **Create Token** → pilih template **Read All Resources** atau buat custom dengan izin `R2 Object Read`

### Langkah 4 — Catat URL Worker
Setelah deploy, Wrangler menampilkan URL Worker, contoh:
```
https://srmc-worker.username.workers.dev
```

Update `js/config.js`:
```js
apiBaseUrl: "https://srmc-worker.username.workers.dev"
```

### Langkah 5 — Deploy ke Cloudflare Pages
1. Push folder `sim-racing-community/` ke GitHub (boleh repo tersendiri atau subfolder)
2. Dashboard Cloudflare → **Pages** → **Create a Project** → **Connect to Git**
3. Pilih repo, lalu setting:
   - **Build command**: (kosongkan)
   - **Build output directory**: `/` atau `sim-racing-community` (tergantung struktur repo)
4. Deploy!

### Langkah 6 — Update CORS
Setelah Pages live (dapat URL `*.pages.dev`), update `ALLOWED_ORIGIN` secret:
```bash
wrangler secret put ALLOWED_ORIGIN
# masukkan: https://nama-project.pages.dev
```

---

## Catatan Keamanan

- Password admin **tidak pernah tersimpan plaintext** — hanya hash SHA-256 + salt
- Upload/delete dilindungi token HMAC yang expire 24 jam
- Download APK bersifat publik (tidak butuh login)
- CORS hanya mengizinkan domain Pages kamu sendiri

---

## Cara Akses Panel Admin

Buka: `https://domain-kamu.pages.dev/admin.html`

Halaman ini **tidak muncul di navbar** — hanya kamu yang tahu URL-nya.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| APK list tidak muncul | Cek `apiBaseUrl` di `config.js` sudah benar |
| Login gagal terus | Pastikan `ADMIN_PASSWORD_HASH` di-generate dengan password yang benar |
| Upload gagal | Cek `API_KEY` dan `ALLOWED_ORIGIN` secrets sudah di-set |
| Storage info tidak muncul | Pastikan `CF_API_TOKEN` punya izin R2:Read |
| CORS error | Tambahkan domain Pages ke `ALLOWED_ORIGIN` secret |
