# Manre — Catatan Progres Pengembangan

Zona: **terbuka** — setiap pengguna membagikan lokasinya sendiri saat posting; feed diurutkan berdasarkan
jarak ke lokasi pengguna (live geolocation, fallback lokasi tersimpan). Tidak ada gate zona pilot.
Bahasa: Bahasa Indonesia. Stack: React (CRA, JS) + Tailwind + FastAPI + MongoDB.

> Perubahan v1.1 (permintaan user): gate zona pilot UB dihapus. `POST /api/me/location` hanya menyimpan
> lokasi (`location_set`), pembuatan post tidak lagi menolak koordinat di luar radius, dan
> `GET /api/posts` menerima `lat`/`lng` + `radius_km` opsional (`radius_km` kosong = tanpa batas jarak).

---

## Phase 1 — Foundation ✅
- PWA shell: `public/manifest.json`, `public/sw.js` (cache-first shell, `/api` bypass), registrasi SW di `src/index.js`.
- Auth ganda: Emergent-managed Google Sign-In (cookie `session_token`) + email/password JWT (`localStorage manre_token`).
  - Backend: `POST /api/auth/register|login|session|logout`, `GET /api/auth/me` (`core.get_current_user` cek cookie → JWT).
- Skema MongoDB: `users`, `posts`, `claims`, `messages`, `notifications`, `reports`, `files`, `user_sessions`, `ratings`.
- Index geospasial `2dsphere` pada `posts.location` + index `status`, `messages(claim_id, created_at)`.
- Pilot-zone gate: **dihapus di v1.1** — `POST /api/me/location` menyimpan lokasi pengguna saja.

## Phase 2 — Posting & Feed ✅
- Flow post 4 langkah (`pages/PostCreate.js`): kategori (matang/bahan) → detail & waktu → serah terima + pin peta → konfirmasi.
- Upload foto: kompresi canvas ke JPEG q0.72 max 1080px → `POST /api/upload` → Emergent Object Storage; disajikan via `GET /api/files/{path}`.
- Pin peta Leaflet + OSM (komponen `components/MiniMap.js`, plain Leaflet agar aman di React 19 StrictMode), tombol "Lokasiku" (geolocation) + tap peta untuk geser pin, opsi privacy offset acak ~100 m.
- Feed (`pages/Feed.js`): filter kategori / radius **maks 1 km** (pilihan 0.5 km & 1 km, default 1 km, di-cap server-side via `MAX_RADIUS_KM`) / mode serah terima; urut kadaluarsa tercepat lalu terdekat dari lokasi live pengguna.
- Auto-expiry: `expire_stale()` dipanggil di endpoint feed/detail/klaim — post lewat `window_end` → `expired`, klaim pending lewat lock → `expired` + post dibuka lagi. Durasi maks: matang 6 jam, bahan 48 jam.

## Phase 3 — Claim & Handoff ✅
- Klaim: `POST /api/posts/{id}/claim` — lock 15 menit, wajib `recipient_ack`, cek max 2 klaim aktif + cooldown no-show.
- Donor terima/tolak: `/claims/{id}/accept|reject`; penerima batal: `/cancel`.
- Chat: REST `GET/POST /api/claims/{id}/messages` + WebSocket `/api/ws/chat/{claim_id}` untuk realtime.
- Serah terima: kedua pihak tap Selesai (`/done`) → status `completed`, porsi ditambah ke `portions_shared` donor.
- Rating timbal balik: `/rate` thumbs up/down + catatan → trust score ±5/−8.
- Notifikasi in-app: koleksi `notifications`, badge di bottom nav (polling 20 s), tab Notifikasi di Inbox. **FCM web push ditunda ke v2 sesuai pilihan user.**

## Phase 4 — Trust & Safety ✅
- No-show: `/claims/{id}/no-show` oleh donor → trust −10; 2× dalam 30 hari → cooldown klaim 24 jam.
- Hoarding cap: maksimal 2 klaim aktif.
- Fake donor: foto wajib; 3 post pertama `review_status=pending` (tidak tampil di feed publik) sampai admin setujui.
- Reselling: dilarang di T&C + tombol Laporkan di halaman detail → koleksi `reports`; admin bisa ban permanen.
- Liability: T&C (`pages/Terms.js`, boilerplate v1), checkbox tanggung jawab donor per post, checkbox pemahaman penerima per klaim.
- Admin panel (`pages/Admin.js`): review post, laporan, ban/unban warga, statistik zona.

## Phase 5 — Launch Prep ✅
- Onboarding 3 langkah (donor vs penerima) + simpan lokasi (bisa di-skip).
- Seed konten demo: `POST /api/seed` (idempotent, jalan otomatis saat startup) — 1 admin, 3 warga demo, 4 post di area Malang.
- Counter dampak publik di landing: **target makanan diselamatkan** (porsi terselamatkan / target 1000).
- Analitik dasar di `GET /api/admin/stats`: post, klaim, completion rate, no-show rate, laporan terbuka.

---

## Ditunda ke v2
- Firebase Cloud Messaging web push (butuh kredensial Firebase user).
- MBG / redistribusi institusional, KYC/upload ID, asuransi liabilitas.
- Ekspansi ke seluruh Malang, versi bahasa Inggris, input berat (kg) untuk counter dampak.
- Ambassador outreach kit (materi non-teknis).

## Kredensial uji
Lihat `/app/memory/test_credentials.md`.
