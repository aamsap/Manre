# Manre — Catatan Progres Pengembangan

Manre adalah aplikasi komunitas untuk berbagi makanan surplus — **bisa dipakai di mana pun**,
lokasi ditentukan sendiri oleh tiap pengguna saat memposting. Tidak ada batas zona.
Bahasa: Bahasa Indonesia. Stack: React (CRA, JS) + Tailwind + FastAPI + MongoDB.
UI: **mobile-first + layout web (tablet/laptop)** — bottom nav di mobile, sidebar + grid multi-kolom di ≥768px.

---

## Phase 1 — Foundation ✅
- PWA shell: `public/manifest.json`, `public/sw.js` (cache-first shell, `/api` bypass, handler push), SW didaftarkan di `src/index.js`.
- Auth ganda: Emergent-managed Google Sign-In (cookie `session_token`) + email/password JWT (`localStorage manre_token`).
  - Backend: `POST /api/auth/register|login|session|logout`, `GET /api/auth/me`.
- Skema MongoDB: `users`, `posts`, `claims`, `messages`, `notifications`, `reports`, `files`, `user_sessions`, `ratings`, `push_subscriptions`.
- Index geospasial `2dsphere` pada `posts.location`.
- Lokasi: `POST /api/me/location` menyimpan titik pengguna (`location_set`) — dipakai untuk jarak & urutan feed. **Tidak ada pembatasan zona.**

## Phase 2 — Posting & Feed ✅
- Flow post 4 langkah (`pages/PostCreate.js`): kategori (matang/bahan) → detail, berat & waktu → serah terima + pin peta → konfirmasi.
- Upload foto: kompresi canvas JPEG q0.72 max 1080px → `POST /api/upload` → Emergent Object Storage; disajikan via `GET /api/files/{path}`.
- Pin peta Leaflet + OSM (komponen `MiniMap`, plain Leaflet), tombol "Lokasiku", privacy offset acak ~100 m.
- Feed: filter kategori / radius 0.5-1-3 km / **Semua (tanpa batas)** / mode serah terima; urut kadaluarsa tercepat lalu terdekat. Jarak dihitung dari lokasi pengguna (null jika belum ada lokasi).
- Auto-expiry via `expire_stale()`: matang maks 6 jam, bahan maks 48 jam.

## Phase 3 — Claim & Handoff ✅
- Klaim: lock 15 menit, wajib `recipient_ack`, cek maks 2 klaim aktif + cooldown no-show.
- **Auto-accept (v1.1)**: donor bisa mengaktifkan per post (`auto_accept`, default mati) → klaim langsung `accepted`, kedua pihak dapat notifikasi.
- Chat: REST `GET/POST /api/claims/{id}/messages` + WebSocket `/api/ws/chat/{claim_id}`.
- Serah terima: kedua pihak tap Selesai → `completed`; porsi **dan kg** ditambahkan ke donor.
- Rating timbal balik thumbs up/down → trust score ±5/−8.

## Phase 4 — Trust & Safety ✅
- No-show (2× dalam 30 hari → cooldown klaim 24 jam, trust −10), hoarding cap 2 klaim aktif.
- Foto wajib; 3 post pertama ditinjau admin. Tombol Laporkan → koleksi `reports`.
- T&C (`pages/Terms.js`, boilerplate v1, tanpa klausa zona), ack donor per post + ack penerima per klaim.
- Admin panel: review post, laporan, ban/unban warga (admin tidak bisa memblokir diri sendiri), statistik.

## Phase 5 — Launch Prep ✅
- Onboarding 3 langkah (donor vs penerima) + simpan lokasi.
- Seed konten demo idempotent (`POST /api/seed`, juga saat startup) — 1 admin, 3 warga demo, 4 post; jendela & berat di-refresh saat restart supaya feed demo tidak pernah kosong.
- Counter dampak publik: **kg diselamatkan / target 500 kg**, porsi sebagai angka pendukung.
- Analitik `GET /api/admin/stats`: post, klaim, completion rate, no-show rate, laporan terbuka.

---

## v1.1 — Fitur lanjutan ✅

### Web Push (VAPID standar, tanpa Firebase)
- `pywebpush` + kunci VAPID di `backend/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- Endpoint: `GET /api/push/public-key`, `POST /api/push/subscribe`, `DELETE /api/push/subscribe`, `POST /api/push/test`.
- `core.notify()` sekarang menulis inbox **dan** mengirim web push ke semua perangkat pengguna; langganan mati (404/410) otomatis dihapus.
- Service worker menangani event `push` + `notificationclick` (buka tab yang ada atau tab baru).
- UI: tombol nyalakan/matikan notifikasi di Profil, mengirim notifikasi percobaan saat diaktifkan.

### Kilogram Tracking
- Estimasi otomatis: matang 0.4 kg/porsi, bahan 1.0 kg/paket (`estimate_kg`), dengan opsi **koreksi manual** di form post.
- `posts.weight_kg` + `weight_estimated`; `users.kg_shared` bertambah saat serah terima selesai.
- Ditampilkan di kartu feed, halaman detail, Postku, Profil, dan counter landing (kg jadi angka utama).

### Auto Accept
- Checkbox per post (default mati) di langkah serah terima; badge "Terima otomatis" di kartu & detail.

### Neighbour Streaks + Lencana
- **Streak posting harian** (`post_streak_days`, `post_streak_last`, `best_post_streak`) — bertambah saat posting di hari berurutan.
- **Streak berbagi mingguan** (`handoff_streak_weeks`) — bertambah saat ada minimal 1 serah terima selesai di minggu ISO berurutan.
- Notifikasi milestone (posting 3/7/14/30 hari; mingguan 2/4/8/12).
- Lencana di Profil: Pemula Baik, Tetangga Andalan, Pahlawan Pangan, 10 kg Diselamatkan, Rajin Posting, Konsisten Mingguan.

### Web UI (tablet & laptop)
- `components/layout/SideNav.js` — sidebar kiri ≥768px (logo, tombol Bagi makanan, Feed/Inbox/Profil, Admin, kartu user).
- `Shell` responsif: bottom nav hanya di mobile, konten `max-w-3xl`/`max-w-6xl` di desktop.
- Feed grid 2 kolom (md) / 3 kolom (xl); Landing punya layout hero dua kolom khusus desktop; halaman detail/chat/admin/post/onboarding jadi kartu terpusat dengan sudut membulat.

---

## Ditunda ke v2
- MBG / redistribusi institusional, KYC/upload ID, asuransi liabilitas.
- Versi bahasa Inggris, notifikasi email, moderasi foto otomatis, lampiran gambar di chat.
- `expire_stale()` sebagai cron platform (`.emergent/crons.yml`) menggantikan sweep saat request.

## Kredensial uji
Lihat `/app/memory/test_credentials.md`.
