# PRD — Manre (Hyperlocal Food Rescue PWA)

## Original problem statement
Mobile-first installable PWA for sharing surplus cooked food and raw ingredients with neighbours
before it goes to waste. Community-driven, non-commercial, proximity + time-window based.
Bahasa Indonesia, casual tone ("Bagi makanan yuk"), warm earthy palette, bottom nav
(Feed / Post / Inbox / Profile), card-heavy feed with countdown timers as primary urgency signal.

### User decisions
- Auth: **both** Emergent Google Sign-In and email/password JWT.
- Images: **Emergent Object Storage** (client-side compression).
- Firebase FCM push: **skipped in v1** → in-app inbox + nav badge instead.
- Scope: **all phases 1–5 at once**, with a progress-notes markdown in the repo (`/app/PROGRESS.md`).
- Design: delegated to design agent; unconventional/custom animation encouraged.
- Impact counter: "target makanan diselamatkan" (portions / 1000 target).
- T&C: boilerplate template (no lawyer).
- **v1.1 change:** UB pilot-zone gate removed — users share their own location when posting.
- **v1.2 change:** discovery radius reduced to **max 1 km** (options 0.5 km / 1 km, default 1 km,
  capped server-side by `MAX_RADIUS_KM`).

## Architecture
- Frontend: React 19 (CRA, JS) + Tailwind + framer-motion + @phosphor-icons/react + sonner;
  plain-Leaflet wrapper `components/MiniMap.js` (react-leaflet breaks under React 19 StrictMode).
  PWA: `public/manifest.json` + `public/sw.js` (offline shell, `/api` bypass).
- Backend: FastAPI — `server.py` (routes) + `core.py` (db, auth, object storage, notify).
- DB: MongoDB — `users`, `posts` (2dsphere index), `claims`, `messages`, `notifications`,
  `reports`, `ratings`, `files`, `user_sessions`.
- Realtime chat: REST messages + WebSocket `/api/ws/chat/{claim_id}`.

## User personas
- **Donor:** household, anak kos, warung/UMKM kecil, catering rumahan with surplus food.
- **Recipient:** mahasiswa, freelancer, tetangga, relawan looking for free nearby food.
- **Admin (owner):** moderates first-3 posts of each user, reports, bans, watches zone stats.

## Core requirements (static)
Dual auth · profile + trust score · two post categories with distinct fields · required photo ·
handoff modes · pickup window + auto-expiry (cooked 6 h / raw 48 h) · privacy pin offset ·
nearby feed with filters and countdowns · 15-min claim lock · acknowledgment checkboxes both sides ·
in-app chat · mutual Selesai + thumbs rating · anti-abuse guards · admin panel · T&C.

## Implemented (2026-06)
- Phase 1: PWA shell, dual auth, Mongo schema + geo index, location capture.
- Phase 2: 4-step post flow, object-storage upload with canvas compression, Leaflet pin with
  "Lokasiku" + tap-to-move + ~100 m privacy offset, feed filters/sort, `expire_stale()` auto-expiry.
- Phase 3: claim lock, accept/reject/cancel, chat (REST + WS), dual Selesai, mutual rating,
  in-app notifications + nav badge.
- Phase 4: no-show penalty + 24 h cooldown, 2-active-claim cap, first-3-post admin review,
  report button, admin panel (review / reports / users / stats), T&C + both acknowledgments.
- Phase 5: onboarding (donor vs recipient + location), idempotent seed, public impact counter,
  basic analytics in `/api/admin/stats`.
- v1.1: pilot-zone gate removed. v1.2: radius capped to 1 km.
- Backend pytest suite `/app/backend/tests/backend_test.py` — 31 tests passing.

## Backlog
- **P0:** none blocking.
- **P1:** Firebase FCM web push (needs user's Firebase credentials); auto-accept option per post;
  edit an existing post.
- **P2:** weight (kg) input for a more accurate impact counter; English locale; expansion beyond
  one neighbourhood; saved searches / "notify me when food appears nearby"; KYC / ID upload.

## Next tasks
1. Wire FCM once Firebase credentials are provided.
2. Donor "auto-accept claims" toggle.
3. Nearby-alert notifications for recipients.
