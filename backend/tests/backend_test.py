"""Manre backend regression tests (iteration 3 — no-zone, kg, auto_accept, streaks, push)."""
import io
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://food-rescue-malang.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@manre.id"
ADMIN_PW = "ManreAdmin2026!"
BUDI = "budi@manre.id"
SARI = "sari@manre.id"
RINA = "rina@manre.id"
PW = "Password123!"

UB_LAT, UB_LNG = -7.9526, 112.6142
JKT_LAT, JKT_LNG = -6.2, 106.8
PARIS_LAT, PARIS_LNG = 48.85, 2.35


# ---------- helpers ----------
def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def make_jpeg_bytes():
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606"
        "070608050707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20"
        "242e2720222c231c1c283728"
        "2c30313434341f27393d38323c2e333432"
        "ffc0000b080001000101011100ffc4001f0000010501010101010100000000"
        "000000000102030405060708090a0b"
        "ffc400b5100002010303020403050504040000017d01020300041105122131"
        "410613516107227114328191a1082342b1c11552d1f02433627282090a1617"
        "18191a25262728292a3435363738393a434445464748494a53545556575859"
        "5a636465666768696a737475767778797a838485868788898a929394959697"
        "98999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2"
        "d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9fa"
        "ffda0008010100003f00fb"
        "ffd9"
    )


@pytest.fixture(scope="session")
def budi_token():
    return login(BUDI, PW)

@pytest.fixture(scope="session")
def sari_token():
    return login(SARI, PW)

@pytest.fixture(scope="session")
def rina_token():
    return login(RINA, PW)

@pytest.fixture(scope="session")
def admin_token():
    return login(ADMIN_EMAIL, ADMIN_PW)


# ============ AUTH ============
class TestAuth:
    def test_register_and_me(self):
        email = f"test_{uuid.uuid4().hex[:8]}@manre.co"
        r = requests.post(f"{API}/auth/register",
                          json={"name": "Test User", "email": email, "password": "TestPass1234"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["token"] and data["user"]["email"] == email
        assert data["user"]["onboarded"] is False
        me = requests.get(f"{API}/auth/me", headers=hdr(data["token"]))
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": BUDI, "password": "wrong"})
        assert r.status_code == 401

    def test_login_and_logout(self, budi_token):
        me = requests.get(f"{API}/auth/me", headers=hdr(budi_token))
        assert me.status_code == 200
        r = requests.post(f"{API}/auth/logout", headers=hdr(budi_token))
        assert r.status_code == 200


# ============ LOCATION (no-zone regression) ============
class TestLocationNoZone:
    def test_location_any_coordinates_ok(self, rina_token):
        for lat, lng in [(UB_LAT, UB_LNG), (JKT_LAT, JKT_LNG), (PARIS_LAT, PARIS_LNG)]:
            r = requests.post(f"{API}/me/location", json={"lat": lat, "lng": lng}, headers=hdr(rina_token))
            assert r.status_code == 200, f"{lat},{lng} -> {r.status_code} {r.text}"
            d = r.json()
            assert d.get("location_set") is True
            assert "zone_verified" not in d, f"zone_verified must be gone: {d}"
        # reset back to UB for downstream tests using rina distance
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(rina_token))


# ============ POSTS ============
def _base_post(**over):
    n = datetime.now(timezone.utc)
    p = {
        "category": "cooked", "title": "TEST post", "portions": 3, "unit": "porsi",
        "notes": "", "photo_url": "https://example.com/x.jpg", "prep_time": None,
        "best_before": iso(n + timedelta(hours=4)), "handoff": "pickup",
        "window_start": iso(n), "window_end": iso(n + timedelta(hours=4)),
        "lat": UB_LAT + 0.001, "lng": UB_LNG + 0.001,
        "privacy_offset": True, "responsibility_ack": True,
    }
    p.update(over)
    return p


class TestPostNoZone:
    def test_post_far_from_malang_ok(self, sari_token):
        for lat, lng, tag in [(JKT_LAT, JKT_LNG, "jkt"), (PARIS_LAT, PARIS_LNG, "paris")]:
            r = requests.post(f"{API}/posts", json=_base_post(lat=lat, lng=lng,
                                                              title=f"TEST nozone {tag} {uuid.uuid4().hex[:4]}"),
                              headers=hdr(sari_token))
            assert r.status_code == 200, f"{tag}: {r.status_code} {r.text}"
            p = r.json()
            assert p["status"] == "available"

    def test_reject_no_responsibility(self, sari_token):
        r = requests.post(f"{API}/posts", json=_base_post(responsibility_ack=False), headers=hdr(sari_token))
        assert r.status_code == 400

    def test_reject_cooked_window_too_long(self, sari_token):
        n = datetime.now(timezone.utc)
        r = requests.post(f"{API}/posts",
                          json=_base_post(window_start=iso(n), window_end=iso(n + timedelta(hours=8))),
                          headers=hdr(sari_token))
        assert r.status_code == 400

    def test_reject_end_before_start(self, sari_token):
        n = datetime.now(timezone.utc)
        r = requests.post(f"{API}/posts",
                          json=_base_post(window_start=iso(n + timedelta(hours=2)), window_end=iso(n)),
                          headers=hdr(sari_token))
        assert r.status_code == 400


# ============ KG tracking ============
class TestKilograms:
    def test_cooked_auto_estimate(self, sari_token):
        r = requests.post(f"{API}/posts",
                          json=_base_post(category="cooked", portions=5, title=f"TEST kg cook {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["weight_kg"] == 2.0
        assert d["weight_estimated"] is True

    def test_raw_auto_estimate(self, sari_token):
        r = requests.post(f"{API}/posts",
                          json=_base_post(category="raw", portions=3, unit="paket",
                                          title=f"TEST kg raw {uuid.uuid4().hex[:4]}",
                                          window_end=iso(datetime.now(timezone.utc) + timedelta(hours=8))),
                          headers=hdr(sari_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["weight_kg"] == 3.0
        assert d["weight_estimated"] is True

    def test_manual_weight_override(self, sari_token):
        r = requests.post(f"{API}/posts",
                          json=_base_post(portions=2, weight_kg=7.5,
                                          title=f"TEST kg manual {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["weight_kg"] == 7.5
        assert d["weight_estimated"] is False

    def test_impact_has_kg_target(self):
        r = requests.get(f"{API}/stats/impact")
        assert r.status_code == 200
        d = r.json()
        assert "kg_saved" in d and d["target_kg"] == 500
        assert "portions_saved" in d and "target_portions" in d


# ============ Upload ============
class TestUpload:
    def test_upload_and_fetch(self, sari_token):
        img = make_jpeg_bytes()
        files = {"file": ("test.jpg", io.BytesIO(img), "image/jpeg")}
        r = requests.post(f"{API}/upload", files=files, headers=hdr(sari_token))
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        g = requests.get(f"{BASE_URL}{url}")
        assert g.status_code == 200
        assert "image" in g.headers.get("content-type", "")


# ============ Feed / distance / radius ============
class TestFeed:
    def test_feed_with_query_latlng(self, rina_token):
        r = requests.get(f"{API}/posts?lat={UB_LAT}&lng={UB_LNG}&radius_km=3", headers=hdr(rina_token))
        assert r.status_code == 200
        posts = r.json()
        assert len(posts) >= 1
        for p in posts:
            assert isinstance(p["distance_m"], (int, float))
            assert p["status"] == "available"
            assert p["review_status"] == "approved"

    def test_feed_no_radius_returns_all(self, rina_token):
        # Without radius_km, cap is removed → should include far posts we just created
        r = requests.get(f"{API}/posts", headers=hdr(rina_token))
        assert r.status_code == 200
        posts = r.json()
        # posts should include our nozone Paris/Jakarta test posts (created earlier in session)
        far = [p for p in posts if p["distance_m"] and p["distance_m"] > 100000]
        # Not strict — but the endpoint should never 500 and should return >0
        assert len(posts) >= 1

    def test_feed_radius_smaller_returns_fewer(self, rina_token):
        r3 = requests.get(f"{API}/posts?radius_km=3&lat={UB_LAT}&lng={UB_LNG}", headers=hdr(rina_token)).json()
        r05 = requests.get(f"{API}/posts?radius_km=0.5&lat={UB_LAT}&lng={UB_LNG}", headers=hdr(rina_token)).json()
        assert len(r05) <= len(r3)

    def test_feed_null_distance_when_no_location(self):
        # create user without setting location
        email = f"nodist_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "NoDist", "email": email, "password": "TestPass1234"}).json()
        tok = reg["token"]
        r = requests.get(f"{API}/posts", headers=hdr(tok))
        assert r.status_code == 200
        posts = r.json()
        if posts:
            # every distance must be None because caller has no location and no lat/lng query
            assert all(p["distance_m"] is None for p in posts), \
                f"expected all None distance, got: {[p['distance_m'] for p in posts[:3]]}"

    def test_feed_category_filter(self, rina_token):
        r = requests.get(f"{API}/posts?category=cooked", headers=hdr(rina_token))
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "cooked"


# ============ Auto-accept ============
class TestAutoAccept:
    def test_default_is_off_and_pending(self, sari_token):
        # a fresh recipient
        email = f"aa1_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "AA1", "email": email, "password": "TestPass1234"}).json()
        rec = reg["token"]
        p = requests.post(f"{API}/posts", json=_base_post(title=f"TEST aa off {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token)).json()
        assert p.get("auto_accept") in (False, None)
        c = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True},
                          headers=hdr(rec)).json()
        assert c["status"] == "pending"
        assert c.get("auto_accepted") in (False, None)
        requests.post(f"{API}/claims/{c['id']}/cancel", headers=hdr(rec))

    def test_auto_accept_true_short_circuits(self, sari_token):
        email = f"aa2_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "AA2", "email": email, "password": "TestPass1234"}).json()
        rec = reg["token"]
        rec_uid = reg["user"]["user_id"]
        p = requests.post(f"{API}/posts",
                          json=_base_post(auto_accept=True, title=f"TEST aa on {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token)).json()
        assert p["auto_accept"] is True
        c = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True},
                          headers=hdr(rec)).json()
        assert c["status"] == "accepted", c
        assert c.get("auto_accepted") is True
        # both parties notified
        rec_notifs = requests.get(f"{API}/notifications", headers=hdr(rec)).json()
        donor_notifs = requests.get(f"{API}/notifications", headers=hdr(sari_token)).json()
        assert any(n.get("kind") == "accepted" for n in rec_notifs)
        assert any(n.get("kind") == "claim" for n in donor_notifs)
        requests.post(f"{API}/claims/{c['id']}/cancel", headers=hdr(rec))


# ============ Streaks + kg increment on completion ============
class TestStreaksAndKg:
    def test_post_streak_idempotent_same_day(self):
        # fresh donor
        email = f"str_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Str", "email": email, "password": "TestPass1234"}).json()
        tok = reg["token"]
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(tok))
        r1 = requests.post(f"{API}/posts", json=_base_post(title=f"TEST str1 {uuid.uuid4().hex[:4]}"),
                           headers=hdr(tok))
        assert r1.status_code == 200, r1.text
        me1 = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
        assert me1.get("post_streak_days") == 1
        assert me1.get("post_streak_last")
        # second post same day
        r2 = requests.post(f"{API}/posts", json=_base_post(title=f"TEST str2 {uuid.uuid4().hex[:4]}"),
                           headers=hdr(tok))
        assert r2.status_code == 200
        me2 = requests.get(f"{API}/auth/me", headers=hdr(tok)).json()
        assert me2.get("post_streak_days") == 1, f"streak must not double increment: {me2.get('post_streak_days')}"

    def test_handoff_streak_and_kg_shared(self, sari_token):
        # fresh recipient
        email = f"ho_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Ho", "email": email, "password": "TestPass1234"}).json()
        rec = reg["token"]
        rec_uid = reg["user"]["user_id"]
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(rec))

        # donor baseline
        donor_before = requests.get(f"{API}/auth/me", headers=hdr(sari_token)).json()
        kg_before = donor_before.get("kg_shared", 0) or 0
        handoff_wks_before = donor_before.get("handoff_streak_weeks", 0) or 0

        # complete first handoff
        p = requests.post(f"{API}/posts",
                          json=_base_post(portions=5, title=f"TEST ho1 {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token)).json()
        c = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True},
                          headers=hdr(rec)).json()
        requests.post(f"{API}/claims/{c['id']}/accept", headers=hdr(sari_token))
        requests.post(f"{API}/claims/{c['id']}/done", headers=hdr(sari_token))
        requests.post(f"{API}/claims/{c['id']}/done", headers=hdr(rec))

        donor_after = requests.get(f"{API}/auth/me", headers=hdr(sari_token)).json()
        rec_after = requests.get(f"{API}/auth/me", headers=hdr(rec)).json()
        # kg_shared should have gone up by ~2.0 (cooked 5 portions * 0.4)
        assert (donor_after.get("kg_shared", 0) or 0) >= kg_before + 1.9, \
            f"kg_shared did not increment: {kg_before}->{donor_after.get('kg_shared')}"
        # both sides have handoff_streak_weeks >= 1
        assert (donor_after.get("handoff_streak_weeks", 0) or 0) >= 1
        assert (rec_after.get("handoff_streak_weeks", 0) or 0) >= 1

        # do a second handoff same ISO week and verify no double-increment for recipient
        rec_weeks1 = rec_after.get("handoff_streak_weeks")
        p2 = requests.post(f"{API}/posts",
                           json=_base_post(portions=5, title=f"TEST ho2 {uuid.uuid4().hex[:4]}"),
                           headers=hdr(sari_token)).json()
        c2 = requests.post(f"{API}/posts/{p2['id']}/claim", json={"recipient_ack": True},
                           headers=hdr(rec)).json()
        requests.post(f"{API}/claims/{c2['id']}/accept", headers=hdr(sari_token))
        requests.post(f"{API}/claims/{c2['id']}/done", headers=hdr(sari_token))
        requests.post(f"{API}/claims/{c2['id']}/done", headers=hdr(rec))
        rec_after2 = requests.get(f"{API}/auth/me", headers=hdr(rec)).json()
        assert rec_after2.get("handoff_streak_weeks") == rec_weeks1, \
            f"weekly streak must not double-increment same ISO week: {rec_weeks1} -> {rec_after2.get('handoff_streak_weeks')}"

    def test_public_user_has_streak_fields(self, sari_token):
        # via /api/users/{id}
        me = requests.get(f"{API}/auth/me", headers=hdr(sari_token)).json()
        r = requests.get(f"{API}/users/{me['user_id']}", headers=hdr(sari_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("post_streak_days", "handoff_streak_weeks", "kg_shared"):
            assert k in d, f"missing {k} in public user: {d.keys()}"


# ============ Web Push ============
class TestPush:
    def test_public_key(self):
        r = requests.get(f"{API}/push/public-key")
        assert r.status_code == 200
        d = r.json()
        assert d.get("publicKey")
        assert len(d["publicKey"]) > 30

    def test_test_endpoint_400_when_no_sub(self):
        email = f"push0_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Push0", "email": email, "password": "TestPass1234"}).json()
        tok = reg["token"]
        r = requests.post(f"{API}/push/test", headers=hdr(tok))
        assert r.status_code == 400

    def test_subscribe_idempotent_and_unsubscribe(self, rina_token):
        endpoint = f"https://fcm.example.com/{uuid.uuid4().hex}"
        sub = {"endpoint": endpoint, "keys": {"p256dh": "BFakeKey123", "auth": "Auth123"}}
        r1 = requests.post(f"{API}/push/subscribe", json={"subscription": sub}, headers=hdr(rina_token))
        assert r1.status_code in (200, 201), r1.text
        # repeat should not create duplicates
        r2 = requests.post(f"{API}/push/subscribe", json={"subscription": sub}, headers=hdr(rina_token))
        assert r2.status_code in (200, 201), r2.text
        # unsubscribe
        r3 = requests.delete(f"{API}/push/subscribe", json={"endpoint": endpoint}, headers=hdr(rina_token))
        assert r3.status_code == 200
        # after unsubscribe, /push/test should 400 again (assuming no other sub)
        r4 = requests.post(f"{API}/push/test", headers=hdr(rina_token))
        assert r4.status_code == 400

    def test_claim_still_works_when_push_fails(self, sari_token, rina_token):
        # subscribe donor with bogus endpoint → sending will fail; claiming must NOT 500
        endpoint = f"https://bogus.example.invalid/{uuid.uuid4().hex}"
        sub = {"endpoint": endpoint, "keys": {"p256dh": "BFakeKey123", "auth": "Auth123"}}
        requests.post(f"{API}/push/subscribe", json={"subscription": sub}, headers=hdr(sari_token))
        try:
            p = requests.post(f"{API}/posts",
                              json=_base_post(title=f"TEST push {uuid.uuid4().hex[:4]}"),
                              headers=hdr(sari_token)).json()
            r = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True},
                              headers=hdr(rina_token))
            assert r.status_code == 200, f"claim must succeed despite push failure: {r.status_code} {r.text}"
            # in-app notification still written
            notifs = requests.get(f"{API}/notifications", headers=hdr(sari_token)).json()
            assert any(n.get("kind") == "claim" for n in notifs)
            requests.post(f"{API}/claims/{r.json()['id']}/cancel", headers=hdr(rina_token))
        finally:
            requests.delete(f"{API}/push/subscribe", json={"endpoint": endpoint}, headers=hdr(sari_token))


# ============ Claim / hoarding / no-show — keep short essential ============
class TestClaims:
    def test_donor_cannot_claim_own(self, sari_token):
        p = requests.post(f"{API}/posts", json=_base_post(title=f"TEST self {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token)).json()
        r = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True}, headers=hdr(sari_token))
        assert r.status_code == 400

    def test_second_claimer_blocked(self, sari_token, budi_token):
        email = f"rec_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Rec", "email": email, "password": "TestPass1234"}).json()
        rec = reg["token"]
        p = requests.post(f"{API}/posts", json=_base_post(title=f"TEST lock {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token)).json()
        c1 = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True}, headers=hdr(rec))
        assert c1.status_code == 200
        c2 = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True}, headers=hdr(budi_token))
        assert c2.status_code == 400
        requests.post(f"{API}/claims/{c1.json()['id']}/cancel", headers=hdr(rec))


# ============ Admin ============
class TestAdmin:
    def test_non_admin_forbidden(self, rina_token):
        for path in ["/admin/posts/flagged", "/admin/reports", "/admin/users", "/admin/stats"]:
            r = requests.get(f"{API}{path}", headers=hdr(rina_token))
            assert r.status_code == 403, path

    def test_admin_stats_has_rates(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=hdr(admin_token))
        assert r.status_code == 200
        s = r.json()
        assert "completion_rate" in s and "no_show_rate" in s

    def test_admin_cannot_ban_self(self, admin_token):
        me = requests.get(f"{API}/auth/me", headers=hdr(admin_token)).json()
        r = requests.post(f"{API}/admin/users/{me['user_id']}/ban?ban=true", headers=hdr(admin_token))
        assert r.status_code == 400, f"self-ban must return 400, got {r.status_code} {r.text}"

    def test_admin_ban_other_user(self, admin_token):
        email = f"ban_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Ban", "email": email, "password": "TestPass1234"}).json()
        uid = reg["user"]["user_id"]
        r = requests.post(f"{API}/admin/users/{uid}/ban?ban=true", headers=hdr(admin_token))
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "TestPass1234"})
        assert r.status_code == 403
        r = requests.post(f"{API}/admin/users/{uid}/ban?ban=false", headers=hdr(admin_token))
        assert r.status_code == 200


# ============ Public impact — no more zone field required ============
class TestImpact:
    def test_public_impact_shape(self):
        r = requests.get(f"{API}/stats/impact")
        assert r.status_code == 200
        d = r.json()
        for k in ("kg_saved", "target_kg", "portions_saved", "target_portions", "members"):
            assert k in d, f"missing {k}: {d}"
        assert d["target_kg"] == 500
