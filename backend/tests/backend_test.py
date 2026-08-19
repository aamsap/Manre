"""Manre backend regression tests"""
import io
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://food-rescue-malang.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@manre.id"
ADMIN_PW = "ManreAdmin2026!"
BUDI = "budi@manre.id"
SARI = "sari@manre.id"
RINA = "rina@manre.id"
PW = "Password123!"

UB_LAT, UB_LNG = -7.9526, 112.6142


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
    # tiny valid JPEG (1x1)
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606"
        "07060805070707090908"
        + "0a0c14"
        + "0d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c283728"
        + "2c30313434341f27393d38323c2e333432"
        + "ffc0000b080001000101011100ffc4001f0000010501010101010100000000"
        + "000000000102030405060708090a0b"
        + "ffc400b5100002010303020403050504040000017d01020300041105122131"
        + "410613516107227114328191a1082342b1c11552d1f02433627282090a1617"
        + "18191a25262728292a3435363738393a434445464748494a53545556575859"
        + "5a636465666768696a737475767778797a838485868788898a929394959697"
        + "98999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2"
        + "d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9fa"
        + "ffda0008010100003f00fb"
        + "ffd9"
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
        assert me.json()["email"] == BUDI
        r = requests.post(f"{API}/auth/logout", headers=hdr(budi_token))
        assert r.status_code == 200


# ============ LOCATION / ZONE ============
class TestLocation:
    def test_zone_inside(self, rina_token):
        r = requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(rina_token))
        assert r.status_code == 200
        d = r.json()
        assert d["zone_verified"] is True
        assert isinstance(d["distance_m"], int)
        assert d["distance_m"] < 500

    def test_zone_outside(self, rina_token):
        r = requests.post(f"{API}/me/location", json={"lat": -6.2, "lng": 106.8}, headers=hdr(rina_token))
        assert r.status_code == 200
        d = r.json()
        assert d["zone_verified"] is False
        assert d["distance_m"] > 500000  # ~800km
        # reset back
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(rina_token))


# ============ POSTS validation ============
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


class TestPostValidation:
    def test_reject_no_responsibility(self, sari_token):
        r = requests.post(f"{API}/posts", json=_base_post(responsibility_ack=False), headers=hdr(sari_token))
        assert r.status_code == 400

    def test_reject_outside_zone(self, sari_token):
        r = requests.post(f"{API}/posts", json=_base_post(lat=-6.2, lng=106.8), headers=hdr(sari_token))
        assert r.status_code == 400

    def test_reject_cooked_window_too_long(self, sari_token):
        n = datetime.now(timezone.utc)
        r = requests.post(f"{API}/posts",
                          json=_base_post(window_start=iso(n), window_end=iso(n + timedelta(hours=8))),
                          headers=hdr(sari_token))
        assert r.status_code == 400

    def test_reject_raw_window_too_long(self, sari_token):
        n = datetime.now(timezone.utc)
        r = requests.post(f"{API}/posts",
                          json=_base_post(category="raw", window_start=iso(n),
                                          window_end=iso(n + timedelta(hours=60))),
                          headers=hdr(sari_token))
        assert r.status_code == 400

    def test_reject_end_before_start(self, sari_token):
        n = datetime.now(timezone.utc)
        r = requests.post(f"{API}/posts",
                          json=_base_post(window_start=iso(n + timedelta(hours=2)), window_end=iso(n)),
                          headers=hdr(sari_token))
        assert r.status_code == 400

    def test_create_valid_cooked(self, sari_token):
        r = requests.post(f"{API}/posts", json=_base_post(title="TEST valid cooked"), headers=hdr(sari_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "available"
        assert d["category"] == "cooked"
        # sari has posts_count >= 3 due to seed (5), so should be approved
        assert d["review_status"] == "approved"


# ============ Upload ============
class TestUpload:
    def test_upload_and_fetch(self, sari_token):
        img = make_jpeg_bytes()
        files = {"file": ("test.jpg", io.BytesIO(img), "image/jpeg")}
        r = requests.post(f"{API}/upload", files=files, headers=hdr(sari_token))
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        full = f"{BASE_URL}{url}"
        g = requests.get(full)
        assert g.status_code == 200
        assert "image" in g.headers.get("content-type", "")
        assert len(g.content) > 0


# ============ Feed filters ============
class TestFeed:
    def test_feed_sorted_and_distance(self, rina_token):
        r = requests.get(f"{API}/posts?radius_km=3&lat={UB_LAT}&lng={UB_LNG}", headers=hdr(rina_token))
        assert r.status_code == 200
        posts = r.json()
        assert len(posts) >= 1
        for p in posts:
            assert "distance_m" in p
            assert p["status"] == "available"
            assert p["review_status"] == "approved"
        # sorted by window_end asc
        ends = [p["window_end"] for p in posts]
        assert ends == sorted(ends)

    def test_feed_category_filter(self, rina_token):
        r = requests.get(f"{API}/posts?category=cooked", headers=hdr(rina_token))
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "cooked"

    def test_feed_handoff_filter(self, rina_token):
        r = requests.get(f"{API}/posts?handoff=pickup", headers=hdr(rina_token))
        assert r.status_code == 200
        for p in r.json():
            assert p["handoff"] == "pickup"

    def test_feed_radius(self, rina_token):
        r = requests.get(f"{API}/posts?radius_km=0.5&lat={UB_LAT}&lng={UB_LNG}", headers=hdr(rina_token))
        assert r.status_code == 200
        for p in r.json():
            assert p["distance_m"] <= 500


# ============ Flagged posts (new user first 3) ============
class TestFlagged:
    def test_new_user_first_posts_flagged(self, admin_token):
        email = f"newu_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "NewU", "email": email, "password": "TestPass1234"}).json()
        tok = reg["token"]
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(tok))
        # create post
        r = requests.post(f"{API}/posts", json=_base_post(title="TEST flagged post"), headers=hdr(tok))
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["review_status"] == "pending"
        pid = post["id"]

        # not in public feed
        feed = requests.get(f"{API}/posts?radius_km=3", headers=hdr(tok)).json()
        assert not any(p["id"] == pid for p in feed)

        # admin can list flagged
        flagged = requests.get(f"{API}/admin/posts/flagged", headers=hdr(admin_token))
        assert flagged.status_code == 200
        assert any(p["id"] == pid for p in flagged.json())

        # admin approve
        rev = requests.post(f"{API}/admin/posts/{pid}/review?decision=approve", headers=hdr(admin_token))
        assert rev.status_code == 200

        feed2 = requests.get(f"{API}/posts?radius_km=3", headers=hdr(tok)).json()
        assert any(p["id"] == pid for p in feed2)


# ============ Claim flow ============
@pytest.fixture
def fresh_post(sari_token):
    r = requests.post(f"{API}/posts", json=_base_post(title=f"TEST claim {uuid.uuid4().hex[:6]}"),
                      headers=hdr(sari_token))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def fresh_recipient():
    email = f"rec_{uuid.uuid4().hex[:8]}@manre.co"
    reg = requests.post(f"{API}/auth/register",
                        json={"name": "Rec", "email": email, "password": "TestPass1234"}).json()
    assert "token" in reg, reg
    tok = reg["token"]
    requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(tok))
    return tok


class TestClaims:
    def test_donor_cannot_claim_own(self, sari_token, fresh_post):
        r = requests.post(f"{API}/posts/{fresh_post['id']}/claim",
                          json={"recipient_ack": True}, headers=hdr(sari_token))
        assert r.status_code == 400

    def test_ack_required(self, fresh_recipient, fresh_post):
        r = requests.post(f"{API}/posts/{fresh_post['id']}/claim",
                          json={"recipient_ack": False}, headers=hdr(fresh_recipient))
        assert r.status_code == 400

    def test_claim_success_and_second_user_blocked(self, fresh_recipient, budi_token, sari_token, fresh_post):
        pid = fresh_post["id"]
        r = requests.post(f"{API}/posts/{pid}/claim", json={"recipient_ack": True}, headers=hdr(fresh_recipient))
        assert r.status_code == 200, r.text
        claim = r.json()
        assert claim["status"] == "pending"
        assert claim["lock_expires_at"]
        p = requests.get(f"{API}/posts/{pid}", headers=hdr(fresh_recipient)).json()
        assert p["status"] == "claimed"
        r2 = requests.post(f"{API}/posts/{pid}/claim", json={"recipient_ack": True}, headers=hdr(budi_token))
        assert r2.status_code == 400
        notifs = requests.get(f"{API}/notifications", headers=hdr(sari_token)).json()
        assert any(n.get("kind") == "claim" for n in notifs)
        requests.post(f"{API}/claims/{claim['id']}/cancel", headers=hdr(fresh_recipient))

    def test_donor_reject_releases(self, fresh_recipient, sari_token, fresh_post):
        pid = fresh_post["id"]
        c = requests.post(f"{API}/posts/{pid}/claim", json={"recipient_ack": True},
                          headers=hdr(fresh_recipient)).json()
        assert "id" in c, c
        r = requests.post(f"{API}/claims/{c['id']}/reject", headers=hdr(sari_token))
        assert r.status_code == 200
        p = requests.get(f"{API}/posts/{pid}", headers=hdr(fresh_recipient)).json()
        assert p["status"] == "available"

    def test_recipient_cancel_releases(self, fresh_recipient, fresh_post):
        pid = fresh_post["id"]
        c = requests.post(f"{API}/posts/{pid}/claim", json={"recipient_ack": True},
                          headers=hdr(fresh_recipient)).json()
        assert "id" in c, c
        r = requests.post(f"{API}/claims/{c['id']}/cancel", headers=hdr(fresh_recipient))
        assert r.status_code == 200
        p = requests.get(f"{API}/posts/{pid}", headers=hdr(fresh_recipient)).json()
        assert p["status"] == "available"

    def test_donor_accept(self, fresh_recipient, sari_token, fresh_post):
        pid = fresh_post["id"]
        c = requests.post(f"{API}/posts/{pid}/claim", json={"recipient_ack": True},
                          headers=hdr(fresh_recipient)).json()
        assert "id" in c, c
        r = requests.post(f"{API}/claims/{c['id']}/accept", headers=hdr(sari_token))
        assert r.status_code == 200
        d = requests.get(f"{API}/claims/{c['id']}", headers=hdr(fresh_recipient)).json()
        assert d["status"] == "accepted"
        requests.post(f"{API}/claims/{c['id']}/cancel", headers=hdr(fresh_recipient))


class TestHoardingCap:
    def test_max_2_active_claims(self, sari_token, budi_token):
        # fresh recipient user to avoid leftover claims from other tests
        email = f"hoard_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Hoard", "email": email, "password": "TestPass1234"}).json()
        assert "token" in reg, reg
        rec = reg["token"]
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(rec))

        posts = []
        for i in range(3):
            donor_tok = sari_token if i % 2 == 0 else budi_token
            r = requests.post(f"{API}/posts",
                              json=_base_post(title=f"TEST hoard {i} {uuid.uuid4().hex[:4]}"),
                              headers=hdr(donor_tok))
            assert r.status_code == 200
            posts.append(r.json()["id"])
        claims = []
        for pid in posts[:2]:
            r = requests.post(f"{API}/posts/{pid}/claim", json={"recipient_ack": True}, headers=hdr(rec))
            assert r.status_code == 200, r.text
            claims.append(r.json()["id"])
        r = requests.post(f"{API}/posts/{posts[2]}/claim", json={"recipient_ack": True}, headers=hdr(rec))
        assert r.status_code == 400
        for cid in claims:
            requests.post(f"{API}/claims/{cid}/cancel", headers=hdr(rec))


# ============ Chat + Handoff + Rate ============
class TestChatHandoffRate:
    def test_full_flow(self, sari_token, budi_token):
        # fresh recipient to avoid leftover claim caps
        email = f"flow_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Flow", "email": email, "password": "TestPass1234"}).json()
        assert "token" in reg, reg
        rec = reg["token"]
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(rec))

        p = requests.post(f"{API}/posts", json=_base_post(title=f"TEST flow {uuid.uuid4().hex[:4]}"),
                         headers=hdr(sari_token)).json()
        pid = p["id"]
        c = requests.post(f"{API}/posts/{pid}/claim", json={"recipient_ack": True},
                         headers=hdr(rec)).json()
        assert "id" in c, c
        cid = c["id"]
        # chat: third user forbidden
        r = requests.get(f"{API}/claims/{cid}/messages", headers=hdr(budi_token))
        assert r.status_code == 403
        m1 = requests.post(f"{API}/claims/{cid}/messages", json={"text": "Halo"}, headers=hdr(rec))
        assert m1.status_code == 200
        m2 = requests.post(f"{API}/claims/{cid}/messages", json={"text": "Oke"}, headers=hdr(sari_token))
        assert m2.status_code == 200
        msgs = requests.get(f"{API}/claims/{cid}/messages", headers=hdr(sari_token)).json()
        assert len(msgs) >= 2

        r = requests.post(f"{API}/claims/{cid}/rate", json={"thumbs": "up"}, headers=hdr(rec))
        assert r.status_code == 400

        requests.post(f"{API}/claims/{cid}/accept", headers=hdr(sari_token))
        r = requests.post(f"{API}/claims/{cid}/done", headers=hdr(sari_token))
        assert r.status_code == 200
        r = requests.post(f"{API}/claims/{cid}/done", headers=hdr(rec))
        assert r.status_code == 200
        d = requests.get(f"{API}/claims/{cid}", headers=hdr(sari_token)).json()
        assert d["status"] == "completed"

        me = requests.get(f"{API}/auth/me", headers=hdr(sari_token)).json()
        assert me.get("portions_shared", 0) >= p["portions"]

        r = requests.post(f"{API}/claims/{cid}/rate", json={"thumbs": "up", "note": "Mantap"},
                         headers=hdr(rec))
        assert r.status_code == 200
        r = requests.post(f"{API}/claims/{cid}/rate", json={"thumbs": "up"}, headers=hdr(rec))
        assert r.status_code == 400
        r = requests.post(f"{API}/claims/{cid}/rate", json={"thumbs": "up"}, headers=hdr(sari_token))
        assert r.status_code == 200


# ============ No-show + cooldown ============
class TestNoShow:
    def test_two_no_shows_trigger_cooldown(self, sari_token):
        # create a fresh recipient
        email = f"noshow_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "NoShow", "email": email, "password": "TestPass1234"}).json()
        tok = reg["token"]
        requests.post(f"{API}/me/location", json={"lat": UB_LAT, "lng": UB_LNG}, headers=hdr(tok))

        for i in range(2):
            p = requests.post(f"{API}/posts",
                              json=_base_post(title=f"TEST ns {i} {uuid.uuid4().hex[:4]}"),
                              headers=hdr(sari_token)).json()
            c = requests.post(f"{API}/posts/{p['id']}/claim", json={"recipient_ack": True},
                              headers=hdr(tok)).json()
            r = requests.post(f"{API}/claims/{c['id']}/no-show", headers=hdr(sari_token))
            assert r.status_code == 200

        # third attempt to claim should hit cooldown 403
        p3 = requests.post(f"{API}/posts",
                          json=_base_post(title=f"TEST ns final {uuid.uuid4().hex[:4]}"),
                          headers=hdr(sari_token)).json()
        r = requests.post(f"{API}/posts/{p3['id']}/claim", json={"recipient_ack": True}, headers=hdr(tok))
        assert r.status_code == 403


# ============ Admin ============
class TestAdmin:
    def test_non_admin_forbidden(self, rina_token):
        for path in ["/admin/posts/flagged", "/admin/reports", "/admin/users", "/admin/stats"]:
            r = requests.get(f"{API}{path}", headers=hdr(rina_token))
            assert r.status_code == 403, path

    def test_admin_endpoints(self, admin_token):
        for path in ["/admin/posts/flagged", "/admin/reports", "/admin/users"]:
            r = requests.get(f"{API}{path}", headers=hdr(admin_token))
            assert r.status_code == 200
        r = requests.get(f"{API}/admin/stats", headers=hdr(admin_token))
        assert r.status_code == 200
        s = r.json()
        assert "completion_rate" in s and "no_show_rate" in s

    def test_ban_unban(self, admin_token):
        # create a throwaway user
        email = f"ban_{uuid.uuid4().hex[:8]}@manre.co"
        reg = requests.post(f"{API}/auth/register",
                            json={"name": "Ban", "email": email, "password": "TestPass1234"}).json()
        uid = reg["user"]["user_id"]
        r = requests.post(f"{API}/admin/users/{uid}/ban?ban=true", headers=hdr(admin_token))
        assert r.status_code == 200
        # login blocked
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "TestPass1234"})
        assert r.status_code == 403
        # unban
        r = requests.post(f"{API}/admin/users/{uid}/ban?ban=false", headers=hdr(admin_token))
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "TestPass1234"})
        assert r.status_code == 200


# ============ Reports + public impact ============
class TestReportsImpact:
    def test_report_and_admin_visibility(self, rina_token, admin_token):
        r = requests.post(f"{API}/reports",
                          json={"target_type": "post", "target_id": "some-pid",
                                "reason": "TEST reason", "detail": "TEST"},
                          headers=hdr(rina_token))
        assert r.status_code == 200
        lst = requests.get(f"{API}/admin/reports", headers=hdr(admin_token)).json()
        assert any(x["reason"] == "TEST reason" for x in lst)

    def test_public_impact_no_auth(self):
        r = requests.get(f"{API}/stats/impact")
        assert r.status_code == 200
        d = r.json()
        assert "portions_saved" in d
        assert "target_portions" in d
        assert "members" in d
        assert "zone" in d and d["zone"]["name"] and d["zone"]["radius_m"] == 3000
        assert d["zone"]["lat"] and d["zone"]["lng"]

    def test_feed_radius_3km_returns_all_seeded(self, rina_token):
        # radius 3km should return all 4 seeded posts (they're within 1km of PILOT_CENTER)
        r = requests.get(f"{API}/posts?radius_km=3", headers=hdr(rina_token))
        assert r.status_code == 200
        posts = r.json()
        seeded = [p for p in posts if p.get("donor", {}).get("name") in ("Budi Warung", "Sari Catering")]
        assert len(seeded) >= 4, f"expected >=4 seeded posts, got {len(seeded)}"
        for p in posts:
            assert isinstance(p["distance_m"], (int, float)), f"distance_m must be numeric: {p['distance_m']}"

    def test_feed_radius_smaller_returns_fewer(self, rina_token):
        r3 = requests.get(f"{API}/posts?radius_km=3", headers=hdr(rina_token)).json()
        r05 = requests.get(f"{API}/posts?radius_km=0.5", headers=hdr(rina_token)).json()
        assert len(r05) <= len(r3)
