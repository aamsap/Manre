import io
import math
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import Response as FastResponse
from pydantic import BaseModel, Field, EmailStr
from starlette.middleware.cors import CORSMiddleware
import requests

from core import (db, hash_password, verify_password, create_jwt, get_current_user, get_admin_user,
                  init_storage, put_object, get_object, notify, push_to_user, now_utc, iso, parse_dt,
                  PILOT_CENTER, PILOT_RADIUS_M, APP_NAME, logger)

app = FastAPI(title="Manre API")
api = APIRouter(prefix="/api")

MAX_RADIUS_KM = 3.0
COOKED_MAX_H = 6
RAW_MAX_H = 48
CLAIM_LOCK_MIN = 15
MAX_ACTIVE_CLAIMS = 2
KG_PER_UNIT = {"cooked": 0.4, "raw": 1.0}


def estimate_kg(category: str, portions: int) -> float:
    return round(KG_PER_UNIT.get(category, 0.4) * max(1, portions), 2)


def week_key(dt) -> str:
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


def prev_week_key(dt) -> str:
    return week_key(dt - timedelta(days=7))


async def bump_post_streak(user: dict):
    today = now_utc().date().isoformat()
    yesterday = (now_utc().date() - timedelta(days=1)).isoformat()
    last = user.get("post_streak_last")
    if last == today:
        return
    streak = (user.get("post_streak_days", 0) + 1) if last == yesterday else 1
    best = max(streak, user.get("best_post_streak", 0))
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
        "post_streak_days": streak, "post_streak_last": today, "best_post_streak": best,
    }})
    if streak in (3, 7, 14, 30):
        await notify(user["user_id"], "streak", f"Streak posting {streak} hari!",
                     "Keren, kamu konsisten bagi makanan. Jangan sampai putus ya!", "/profile")


async def bump_handoff_streak(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        return
    now = now_utc()
    this_wk, last_wk = week_key(now), prev_week_key(now)
    if u.get("handoff_streak_week") == this_wk:
        return
    streak = (u.get("handoff_streak_weeks", 0) + 1) if u.get("handoff_streak_week") == last_wk else 1
    best = max(streak, u.get("best_handoff_streak", 0))
    await db.users.update_one({"user_id": user_id}, {"$set": {
        "handoff_streak_weeks": streak, "handoff_streak_week": this_wk, "best_handoff_streak": best,
    }})
    if streak in (2, 4, 8, 12):
        await notify(user_id, "streak", f"Streak {streak} minggu berturut-turut!",
                     "Kamu aktif berbagi tiap minggu. Terus jaga ya!", "/profile")


# ---------- helpers ----------
def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def in_pilot_zone(lat, lng):
    return True



def offset_point(lat, lng, meters=100):
    import random
    ang = random.random() * 2 * math.pi
    dlat = (meters * math.cos(ang)) / 111320
    dlng = (meters * math.sin(ang)) / (111320 * math.cos(math.radians(lat)))
    return round(lat + dlat, 6), round(lng + dlng, 6)


def public_user(u: dict):
    return {
        "user_id": u["user_id"], "name": u.get("name"), "picture": u.get("picture"),
        "trust_score": u.get("trust_score", 50), "thumbs_up": u.get("thumbs_up", 0),
        "thumbs_down": u.get("thumbs_down", 0), "role": u.get("role", "user"),
        "handoffs": u.get("handoffs", 0),
        "post_streak_days": u.get("post_streak_days", 0),
        "handoff_streak_weeks": u.get("handoff_streak_weeks", 0),
        "kg_shared": round(u.get("kg_shared", 0) or 0, 1),
    }


async def expire_stale():
    n = iso(now_utc())
    await db.posts.update_many({"status": "available", "window_end": {"$lt": n}}, {"$set": {"status": "expired"}})
    await db.claims.update_many({"status": "pending", "lock_expires_at": {"$lt": n}},
                                {"$set": {"status": "expired"}})
    async for c in db.claims.find({"status": "expired", "released": {"$ne": True}}, {"_id": 0}):
        await db.claims.update_one({"id": c["id"]}, {"$set": {"released": True}})
        await db.posts.update_one({"id": c["post_id"], "status": "claimed"}, {"$set": {"status": "available"}})


# ---------- models ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class LocationIn(BaseModel):
    lat: float
    lng: float


class PostIn(BaseModel):
    category: str  # cooked | raw
    title: str
    portions: int = Field(ge=1)
    unit: str = "porsi"
    notes: str = ""
    photo_url: str
    prep_time: Optional[str] = None
    best_before: str
    handoff: str  # pickup | dropoff | delivery
    dropoff_name: Optional[str] = None
    window_start: str
    window_end: str
    lat: float
    lng: float
    privacy_offset: bool = True
    responsibility_ack: bool
    weight_kg: Optional[float] = None
    auto_accept: bool = False


class PushSubIn(BaseModel):
    subscription: dict


class PushUnsubIn(BaseModel):
    endpoint: str


class ClaimIn(BaseModel):
    recipient_ack: bool
    note: str = ""


class RateIn(BaseModel):
    thumbs: str  # up | down
    note: str = ""


class MessageIn(BaseModel):
    text: str


class ReportIn(BaseModel):
    target_type: str  # post | user
    target_id: str
    reason: str
    detail: str = ""


# ---------- auth ----------
async def _issue_user(doc):
    await db.users.insert_one(doc)


@api.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    uid = f"user_{uuid.uuid4().hex[:12]}"
    await _issue_user({
        "user_id": uid, "email": email, "name": payload.name,
        "password_hash": hash_password(payload.password), "picture": None,
        "auth_provider": "password", "role": "user", "trust_score": 50,
        "thumbs_up": 0, "thumbs_down": 0, "handoffs": 0, "posts_count": 0,
        "no_shows": [], "is_banned": False, "location": None, "zone_verified": False,
        "onboarded": False, "created_at": iso(now_utc()),
    })
    user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    return {"token": create_jwt(uid), "user": user}


@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Akun kamu diblokir")
    user.pop("_id", None); user.pop("password_hash", None)
    return {"token": create_jwt(user["user_id"]), "user": user}


@api.post("/auth/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id wajib")
    r = requests.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                     headers={"X-Session-ID": session_id}, timeout=30)
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Session tidak valid")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if user:
        uid = user["user_id"]
        await db.users.update_one({"user_id": uid}, {"$set": {"name": data.get("name") or user.get("name"),
                                                              "picture": data.get("picture")}})
    else:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        await _issue_user({
            "user_id": uid, "email": email, "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"), "auth_provider": "google", "role": "user",
            "trust_score": 50, "thumbs_up": 0, "thumbs_down": 0, "handoffs": 0, "posts_count": 0,
            "no_shows": [], "is_banned": False, "location": None, "zone_verified": False,
            "onboarded": False, "created_at": iso(now_utc()),
        })
    token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": iso(now_utc() + timedelta(days=7)), "created_at": iso(now_utc()),
    })
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none",
                        path="/", max_age=7 * 24 * 3600)
    user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    return {"user": user, "token": token}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


@api.post("/me/location")
async def set_location(payload: LocationIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
        "location": {"type": "Point", "coordinates": [payload.lng, payload.lat]},
        "location_set": True,
    }})
    return {"location_set": True, "lat": payload.lat, "lng": payload.lng}


@api.post("/me/onboarded")
async def set_onboarded(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"onboarded": True}})
    return {"ok": True}


@api.get("/users/{user_id}")
async def get_user(user_id: str, _: dict = Depends(get_current_user)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return public_user(u)


# ---------- uploads ----------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    data = await file.read()
    if len(data) > 6 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Foto terlalu besar (maks 6MB)")
    ext = (file.filename or "img.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4()}.{ext}"
    ctype = file.content_type or "image/jpeg"
    result = put_object(path, data, ctype)
    await db.files.insert_one({
        "id": str(uuid.uuid4()), "storage_path": result["path"], "content_type": ctype,
        "owner": user["user_id"], "size": result.get("size", len(data)),
        "is_deleted": False, "created_at": iso(now_utc()),
    })
    return {"url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    data, ctype = get_object(path)
    return FastResponse(content=data, media_type=rec.get("content_type", ctype),
                        headers={"Cache-Control": "public, max-age=86400"})


# ---------- posts ----------
@api.post("/posts")
async def create_post(payload: PostIn, user: dict = Depends(get_current_user)):
    if not payload.responsibility_ack:
        raise HTTPException(status_code=400, detail="Wajib menyetujui pernyataan tanggung jawab")
    if payload.category not in ("cooked", "raw"):
        raise HTTPException(status_code=400, detail="Kategori tidak valid")
    if payload.handoff not in ("pickup", "dropoff", "delivery"):
        raise HTTPException(status_code=400, detail="Mode serah terima tidak valid")
    start, end = parse_dt(payload.window_start), parse_dt(payload.window_end)
    if end <= start:
        raise HTTPException(status_code=400, detail="Jam akhir harus setelah jam mulai")
    limit_h = COOKED_MAX_H if payload.category == "cooked" else RAW_MAX_H
    if (end - start) > timedelta(hours=limit_h):
        raise HTTPException(status_code=400, detail=f"Durasi maksimal {limit_h} jam untuk kategori ini")

    lat, lng = payload.lat, payload.lng
    if payload.privacy_offset:
        lat, lng = offset_point(lat, lng, 100)

    posts_count = user.get("posts_count", 0)
    flagged = posts_count < 3
    pid = str(uuid.uuid4())
    doc = {
        "id": pid, "donor_id": user["user_id"], "category": payload.category,
        "title": payload.title.strip(), "portions": payload.portions, "unit": payload.unit,
        "notes": payload.notes, "photo_url": payload.photo_url, "prep_time": payload.prep_time,
        "best_before": payload.best_before, "handoff": payload.handoff,
        "dropoff_name": payload.dropoff_name,
        "window_start": iso(start), "window_end": iso(end),
        "location": {"type": "Point", "coordinates": [lng, lat]},
        "privacy_offset": payload.privacy_offset,
        "weight_kg": round(payload.weight_kg, 2) if payload.weight_kg else estimate_kg(payload.category, payload.portions),
        "weight_estimated": payload.weight_kg is None,
        "auto_accept": payload.auto_accept,
        "status": "available", "flagged_review": flagged, "review_status": "pending" if flagged else "approved",
        "claims_count": 0, "created_at": iso(now_utc()),
    }
    await db.posts.insert_one(doc)
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"posts_count": 1}})
    await bump_post_streak(user)
    doc.pop("_id", None)
    return await enrich_post(doc, user)


async def enrich_post(p: dict, viewer: dict = None, origin=None):
    donor = await db.users.find_one({"user_id": p["donor_id"]}, {"_id": 0})
    out = {k: v for k, v in p.items() if k != "_id"}
    coords = p["location"]["coordinates"]
    out["lat"], out["lng"] = coords[1], coords[0]
    out.pop("location", None)
    out["donor"] = public_user(donor) if donor else None
    if origin is None and viewer and viewer.get("location"):
        vc = viewer["location"]["coordinates"]
        origin = (vc[1], vc[0])
    out["distance_m"] = round(haversine_m(origin[0], origin[1], coords[1], coords[0])) if origin else None
    return out


@api.get("/posts")
async def list_posts(category: Optional[str] = None, radius_km: Optional[float] = None,
                     handoff: Optional[str] = None, mine: bool = False,
                     lat: Optional[float] = None, lng: Optional[float] = None,
                     user: dict = Depends(get_current_user)):
    await expire_stale()
    q = {"status": "available"}
    if mine:
        q = {"donor_id": user["user_id"]}
    else:
        q["review_status"] = "approved"
    if category in ("cooked", "raw"):
        q["category"] = category
    if handoff in ("pickup", "dropoff", "delivery"):
        q["handoff"] = handoff

    origin = (lat, lng) if lat is not None and lng is not None else None
    docs = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)
    out = []
    for d in docs:
        e = await enrich_post(d, user, origin)
        if not mine and radius_km and e["distance_m"] is not None and e["distance_m"] > radius_km * 1000:
            continue
        out.append(e)
    if mine:
        return out
    out.sort(key=lambda x: (parse_dt(x["window_end"]),
                            x["distance_m"] if x["distance_m"] is not None else 1e12))
    return out


@api.get("/posts/{post_id}")
async def get_post(post_id: str, lat: Optional[float] = None, lng: Optional[float] = None,
                   user: dict = Depends(get_current_user)):
    await expire_stale()
    p = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Post tidak ditemukan")
    e = await enrich_post(p, user, (lat, lng) if lat is not None and lng is not None else None)
    claim = await db.claims.find_one({"post_id": post_id, "status": {"$in": ["pending", "accepted"]}}, {"_id": 0})
    e["active_claim"] = claim
    return e


@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    p = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Post tidak ditemukan")
    if p["donor_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bukan post kamu")
    await db.posts.update_one({"id": post_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


# ---------- claims ----------
@api.post("/posts/{post_id}/claim")
async def claim_post(post_id: str, payload: ClaimIn, user: dict = Depends(get_current_user)):
    await expire_stale()
    if not payload.recipient_ack:
        raise HTTPException(status_code=400, detail="Wajib menyetujui pernyataan penerima")
    p = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Post tidak ditemukan")
    if p["donor_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa klaim post sendiri")
    if p["status"] != "available":
        raise HTTPException(status_code=400, detail="Makanan ini sudah diklaim orang lain")

    cooldown = user.get("claim_cooldown_until")
    if cooldown and parse_dt(cooldown) > now_utc():
        raise HTTPException(status_code=403, detail="Kamu sedang dalam cooldown 24 jam karena 2x no-show")

    active = await db.claims.count_documents({"recipient_id": user["user_id"],
                                              "status": {"$in": ["pending", "accepted"]}})
    if active >= MAX_ACTIVE_CLAIMS:
        raise HTTPException(status_code=400, detail=f"Maksimal {MAX_ACTIVE_CLAIMS} klaim aktif sekaligus")

    cid = str(uuid.uuid4())
    auto = bool(p.get("auto_accept"))
    doc = {
        "id": cid, "post_id": post_id, "post_title": p["title"], "post_photo": p["photo_url"],
        "donor_id": p["donor_id"], "recipient_id": user["user_id"],
        "status": "accepted" if auto else "pending",
        "auto_accepted": auto,
        "note": payload.note, "recipient_ack": True,
        "lock_expires_at": iso(now_utc() + timedelta(minutes=CLAIM_LOCK_MIN)),
        "donor_done": False, "recipient_done": False,
        "created_at": iso(now_utc()),
    }
    if auto:
        doc["accepted_at"] = iso(now_utc())
    await db.claims.insert_one(doc)
    await db.posts.update_one({"id": post_id}, {"$set": {"status": "claimed"}, "$inc": {"claims_count": 1}})
    if auto:
        await notify(p["donor_id"], "claim", "Klaim otomatis diterima",
                     f"{user['name']} mengambil \"{p['title']}\". Atur waktu di chat ya.", f"/chat/{cid}")
        await notify(user["user_id"], "accepted", "Klaim langsung diterima!",
                     f"Donor mengaktifkan terima otomatis untuk \"{p['title']}\". Yuk atur waktu ambil.",
                     f"/chat/{cid}")
    else:
        await notify(p["donor_id"], "claim", "Ada yang klaim makananmu!",
                     f"{user['name']} mau ambil \"{p['title']}\". Konfirmasi dalam {CLAIM_LOCK_MIN} menit.",
                     f"/chat/{cid}")
    doc.pop("_id", None)
    return doc


async def _get_claim(claim_id, user):
    c = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Klaim tidak ditemukan")
    if user["user_id"] not in (c["donor_id"], c["recipient_id"]) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bukan klaim kamu")
    return c


@api.get("/claims")
async def my_claims(user: dict = Depends(get_current_user)):
    await expire_stale()
    docs = await db.claims.find({"$or": [{"donor_id": user["user_id"]}, {"recipient_id": user["user_id"]}]},
                                {"_id": 0}).sort("created_at", -1).to_list(200)
    for d in docs:
        other_id = d["recipient_id"] if d["donor_id"] == user["user_id"] else d["donor_id"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
        d["other_party"] = public_user(other) if other else None
        d["my_role"] = "donor" if d["donor_id"] == user["user_id"] else "recipient"
        d["unread"] = await db.messages.count_documents({"claim_id": d["id"], "sender_id": other_id,
                                                         "read": {"$ne": True}})
    return docs


@api.get("/claims/{claim_id}")
async def claim_detail(claim_id: str, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    other_id = c["recipient_id"] if c["donor_id"] == user["user_id"] else c["donor_id"]
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
    c["other_party"] = public_user(other) if other else None
    c["my_role"] = "donor" if c["donor_id"] == user["user_id"] else "recipient"
    post = await db.posts.find_one({"id": c["post_id"]}, {"_id": 0})
    c["post"] = await enrich_post(post, user) if post else None
    return c


@api.post("/claims/{claim_id}/accept")
async def accept_claim(claim_id: str, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    if c["donor_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya donor bisa menerima")
    if c["status"] != "pending":
        raise HTTPException(status_code=400, detail="Klaim tidak lagi pending")
    await db.claims.update_one({"id": claim_id}, {"$set": {"status": "accepted", "accepted_at": iso(now_utc())}})
    await notify(c["recipient_id"], "accepted", "Klaim kamu diterima!",
                 f"Donor setuju kasih \"{c['post_title']}\". Yuk atur waktu ambil di chat.", f"/chat/{claim_id}")
    return {"ok": True}


@api.post("/claims/{claim_id}/reject")
async def reject_claim(claim_id: str, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    if c["donor_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya donor bisa menolak")
    await db.claims.update_one({"id": claim_id}, {"$set": {"status": "rejected", "released": True}})
    await db.posts.update_one({"id": c["post_id"], "status": "claimed"}, {"$set": {"status": "available"}})
    await notify(c["recipient_id"], "rejected", "Klaim ditolak",
                 f"Donor menolak klaim \"{c['post_title']}\". Coba cari yang lain ya.", "/feed")
    return {"ok": True}


@api.post("/claims/{claim_id}/cancel")
async def cancel_claim(claim_id: str, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    if c["recipient_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya penerima bisa membatalkan")
    await db.claims.update_one({"id": claim_id}, {"$set": {"status": "cancelled", "released": True}})
    await db.posts.update_one({"id": c["post_id"], "status": "claimed"}, {"$set": {"status": "available"}})
    await notify(c["donor_id"], "cancelled", "Klaim dibatalkan",
                 f"Penerima membatalkan klaim \"{c['post_title']}\".", "/inbox")
    return {"ok": True}


@api.post("/claims/{claim_id}/no-show")
async def report_no_show(claim_id: str, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    if c["donor_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Hanya donor bisa lapor no-show")
    if c.get("no_show_reported"):
        raise HTTPException(status_code=400, detail="Sudah dilaporkan")
    await db.claims.update_one({"id": claim_id}, {"$set": {"status": "no_show", "no_show_reported": True,
                                                           "released": True}})
    await db.posts.update_one({"id": c["post_id"], "status": "claimed"}, {"$set": {"status": "available"}})
    rec = await db.users.find_one({"user_id": c["recipient_id"]}, {"_id": 0})
    recent = [s for s in (rec.get("no_shows") or []) if parse_dt(s) > now_utc() - timedelta(days=30)]
    recent.append(iso(now_utc()))
    update = {"no_shows": recent, "trust_score": max(0, rec.get("trust_score", 50) - 10)}
    msg = "Kamu dilaporkan tidak datang mengambil makanan."
    if len(recent) >= 2:
        update["claim_cooldown_until"] = iso(now_utc() + timedelta(hours=24))
        msg += " Karena 2x no-show dalam 30 hari, kamu tidak bisa klaim selama 24 jam."
    await db.users.update_one({"user_id": rec["user_id"]}, {"$set": update})
    await notify(rec["user_id"], "no_show", "Laporan no-show", msg, "/profile")
    return {"ok": True, "no_shows_30d": len(recent)}


@api.post("/claims/{claim_id}/done")
async def mark_done(claim_id: str, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    if c["status"] not in ("accepted", "pending"):
        raise HTTPException(status_code=400, detail="Klaim tidak aktif")
    field = "donor_done" if c["donor_id"] == user["user_id"] else "recipient_done"
    await db.claims.update_one({"id": claim_id}, {"$set": {field: True}})
    c = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if c["donor_done"] and c["recipient_done"]:
        await db.claims.update_one({"id": claim_id}, {"$set": {"status": "completed",
                                                               "completed_at": iso(now_utc())}})
        await db.posts.update_one({"id": c["post_id"]}, {"$set": {"status": "completed"}})
        post = await db.posts.find_one({"id": c["post_id"]}, {"_id": 0})
        portions = post.get("portions", 1) if post else 1
        kg = post.get("weight_kg") or estimate_kg(post.get("category", "cooked"), portions) if post else 0
        for uid in (c["donor_id"], c["recipient_id"]):
            await db.users.update_one({"user_id": uid}, {"$inc": {"handoffs": 1}})
            await bump_handoff_streak(uid)
        await db.users.update_one({"user_id": c["donor_id"]},
                                  {"$inc": {"portions_shared": portions, "kg_shared": kg}})
        for uid, other in ((c["donor_id"], "penerima"), (c["recipient_id"], "donor")):
            await notify(uid, "completed", "Serah terima selesai!",
                         f"Yuk kasih rating buat {other} di \"{c['post_title']}\".", f"/chat/{claim_id}")
    else:
        other = c["recipient_id"] if c["donor_id"] == user["user_id"] else c["donor_id"]
        await notify(other, "done_waiting", "Konfirmasi serah terima",
                     f"{user['name']} sudah tap Selesai untuk \"{c['post_title']}\". Konfirmasi ya!",
                     f"/chat/{claim_id}")
    c.pop("_id", None)
    return c


@api.post("/claims/{claim_id}/rate")
async def rate(claim_id: str, payload: RateIn, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    if c["status"] != "completed":
        raise HTTPException(status_code=400, detail="Rating hanya setelah selesai")
    if payload.thumbs not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Rating tidak valid")
    target = c["recipient_id"] if c["donor_id"] == user["user_id"] else c["donor_id"]
    if await db.ratings.find_one({"claim_id": claim_id, "rater_id": user["user_id"]}):
        raise HTTPException(status_code=400, detail="Kamu sudah memberi rating")
    await db.ratings.insert_one({"id": str(uuid.uuid4()), "claim_id": claim_id,
                                 "rater_id": user["user_id"], "target_id": target,
                                 "thumbs": payload.thumbs, "note": payload.note,
                                 "created_at": iso(now_utc())})
    delta = 5 if payload.thumbs == "up" else -8
    tu = await db.users.find_one({"user_id": target}, {"_id": 0})
    new_score = max(0, min(100, tu.get("trust_score", 50) + delta))
    inc = {"thumbs_up": 1} if payload.thumbs == "up" else {"thumbs_down": 1}
    await db.users.update_one({"user_id": target}, {"$set": {"trust_score": new_score}, "$inc": inc})
    await notify(target, "rating", "Kamu dapat rating baru",
                 ("👍 " if payload.thumbs == "up" else "👎 ") + (payload.note or "Tanpa catatan"), "/profile")
    return {"ok": True}


@api.get("/claims/{claim_id}/rating-mine")
async def my_rating(claim_id: str, user: dict = Depends(get_current_user)):
    r = await db.ratings.find_one({"claim_id": claim_id, "rater_id": user["user_id"]}, {"_id": 0})
    return {"rated": bool(r), "rating": r}


# ---------- chat ----------
@api.get("/claims/{claim_id}/messages")
async def get_messages(claim_id: str, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    msgs = await db.messages.find({"claim_id": claim_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.messages.update_many({"claim_id": claim_id, "sender_id": {"$ne": user["user_id"]}},
                                  {"$set": {"read": True}})
    return msgs


@api.post("/claims/{claim_id}/messages")
async def send_message(claim_id: str, payload: MessageIn, user: dict = Depends(get_current_user)):
    c = await _get_claim(claim_id, user)
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Pesan kosong")
    doc = {"id": str(uuid.uuid4()), "claim_id": claim_id, "sender_id": user["user_id"],
           "sender_name": user["name"], "text": text[:1000], "read": False,
           "created_at": iso(now_utc())}
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    other = c["recipient_id"] if c["donor_id"] == user["user_id"] else c["donor_id"]
    await ws_manager.broadcast(claim_id, doc)
    await notify(other, "message", f"Pesan dari {user['name']}", text[:80], f"/chat/{claim_id}")
    return doc


class WSManager:
    def __init__(self):
        self.rooms = {}

    async def connect(self, claim_id, ws):
        await ws.accept()
        self.rooms.setdefault(claim_id, []).append(ws)

    def disconnect(self, claim_id, ws):
        if claim_id in self.rooms and ws in self.rooms[claim_id]:
            self.rooms[claim_id].remove(ws)

    async def broadcast(self, claim_id, message):
        for ws in list(self.rooms.get(claim_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(claim_id, ws)


ws_manager = WSManager()


@app.websocket("/api/ws/chat/{claim_id}")
async def ws_chat(websocket: WebSocket, claim_id: str):
    await ws_manager.connect(claim_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(claim_id, websocket)


# ---------- notifications ----------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}) \
        .sort("created_at", -1).to_list(100)


@api.post("/notifications/read")
async def read_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- reports ----------
@api.post("/reports")
async def create_report(payload: ReportIn, user: dict = Depends(get_current_user)):
    await db.reports.insert_one({
        "id": str(uuid.uuid4()), "reporter_id": user["user_id"], "reporter_name": user["name"],
        "target_type": payload.target_type, "target_id": payload.target_id,
        "reason": payload.reason, "detail": payload.detail, "status": "open",
        "created_at": iso(now_utc()),
    })
    return {"ok": True}


# ---------- public stats ----------
@api.get("/stats/impact")
async def impact():
    completed = await db.claims.count_documents({"status": "completed"})
    posts = await db.posts.count_documents({})
    users = await db.users.count_documents({})
    agg = await db.users.aggregate([{"$group": {"_id": None,
                                                "p": {"$sum": "$portions_shared"},
                                                "k": {"$sum": "$kg_shared"}}}]).to_list(1)
    portions = (agg[0]["p"] if agg else 0) or 0
    kg = round((agg[0]["k"] if agg else 0) or 0, 1)
    return {"kg_saved": kg, "target_kg": 500,
            "portions_saved": portions, "target_portions": 1000,
            "handoffs": completed, "posts": posts, "members": users}


@api.get("/push/public-key")
async def push_public_key():
    return {"publicKey": os.environ["VAPID_PUBLIC_KEY"]}


@api.post("/push/subscribe", status_code=201)
async def push_subscribe(payload: PushSubIn, user: dict = Depends(get_current_user)):
    sub = payload.subscription
    endpoint, keys = sub.get("endpoint"), sub.get("keys")
    if not endpoint or not keys:
        raise HTTPException(status_code=400, detail="Langganan push tidak valid")
    await db.push_subscriptions.update_one(
        {"user_id": user["user_id"], "endpoint": endpoint},
        {"$set": {"user_id": user["user_id"], "endpoint": endpoint, "keys": keys,
                  "created_at": iso(now_utc())}},
        upsert=True)
    return {"ok": True}


@api.delete("/push/subscribe")
async def push_unsubscribe(payload: PushUnsubIn, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"user_id": user["user_id"], "endpoint": payload.endpoint})
    return {"ok": True}


@api.post("/push/test")
async def push_test(user: dict = Depends(get_current_user)):
    count = await db.push_subscriptions.count_documents({"user_id": user["user_id"]})
    if count == 0:
        raise HTTPException(status_code=400, detail="Belum ada perangkat yang berlangganan")
    await push_to_user(user["user_id"], "Notifikasi Manre aktif",
                       "Mantap! Kamu akan dapat kabar klaim & pesan di sini.", "/inbox", "test")
    return {"ok": True, "devices": count}


# ---------- admin ----------
@api.get("/admin/posts/flagged")
async def admin_flagged(_: dict = Depends(get_admin_user)):
    docs = await db.posts.find({"review_status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await enrich_post(d) for d in docs]


@api.post("/admin/posts/{post_id}/review")
async def admin_review(post_id: str, decision: str = Query(...), _: dict = Depends(get_admin_user)):
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="decision harus approve/reject")
    upd = {"review_status": "approved" if decision == "approve" else "rejected"}
    if decision == "reject":
        upd["status"] = "cancelled"
    await db.posts.update_one({"id": post_id}, {"$set": upd})
    p = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if p:
        await notify(p["donor_id"], "review",
                     "Post disetujui" if decision == "approve" else "Post ditolak moderator",
                     f"\"{p['title']}\"", "/profile")
    return {"ok": True}


@api.get("/admin/reports")
async def admin_reports(_: dict = Depends(get_admin_user)):
    return await db.reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/admin/reports/{report_id}/resolve")
async def admin_resolve(report_id: str, _: dict = Depends(get_admin_user)):
    await db.reports.update_one({"id": report_id}, {"$set": {"status": "resolved"}})
    return {"ok": True}


@api.get("/admin/users")
async def admin_users(_: dict = Depends(get_admin_user)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.post("/admin/users/{user_id}/ban")
async def admin_ban(user_id: str, ban: bool = Query(True), admin: dict = Depends(get_admin_user)):
    if ban and user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa memblokir akun sendiri")
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_banned": ban}})
    if ban:
        await db.posts.update_many({"donor_id": user_id, "status": "available"},
                                   {"$set": {"status": "cancelled"}})
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(get_admin_user)):
    total_claims = await db.claims.count_documents({})
    completed = await db.claims.count_documents({"status": "completed"})
    no_show = await db.claims.count_documents({"status": "no_show"})
    return {
        "users": await db.users.count_documents({}),
        "banned": await db.users.count_documents({"is_banned": True}),
        "posts": await db.posts.count_documents({}),
        "available": await db.posts.count_documents({"status": "available"}),
        "expired": await db.posts.count_documents({"status": "expired"}),
        "claims": total_claims,
        "completed": completed,
        "no_show": no_show,
        "completion_rate": round(completed / total_claims * 100, 1) if total_claims else 0.0,
        "no_show_rate": round(no_show / total_claims * 100, 1) if total_claims else 0.0,
        "open_reports": await db.reports.count_documents({"status": "open"}),
        "pending_review": await db.posts.count_documents({"review_status": "pending"}),
    }


# ---------- seed ----------
SEED_PHOTOS = {
    "cooked1": "https://images.unsplash.com/photo-1539755530862-00f623c00f52?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxpbmRvbmVzaWFuJTIwY29va2VkJTIwZm9vZHxlbnwwfHx8fDE3ODcxMTI5Mjd8MA&ixlib=rb-4.1.0&q=85&w=800",
    "cooked2": "https://images.unsplash.com/photo-1682139710677-cb02f6bc4211?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwzfHxpbmRvbmVzaWFuJTIwY29va2VkJTIwZm9vZHxlbnwwfHx8fDE3ODcxMTI5Mjd8MA&ixlib=rb-4.1.0&q=85&w=800",
    "raw1": "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwyfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjByYXclMjBpbmdyZWRpZW50c3xlbnwwfHx8fDE3ODcxMTI5Mjd8MA&ixlib=rb-4.1.0&q=85&w=800",
    "raw2": "https://images.unsplash.com/photo-1579113800032-c38bd7635818?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjByYXclMjBpbmdyZWRpZW50c3xlbnwwfHx8fDE3ODcxMTI5Mjd8MA&ixlib=rb-4.1.0&q=85&w=800",
}


async def ensure_user(email, name, password, role="user", offset=(0.0, 0.0)):
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        return existing
    uid = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": uid, "email": email, "name": name,
        "password_hash": hash_password(password), "picture": None, "auth_provider": "password",
        "role": role, "trust_score": 60, "thumbs_up": 3, "thumbs_down": 0, "handoffs": 3,
        "posts_count": 5, "portions_shared": 0, "no_shows": [], "is_banned": False,
        "location": {"type": "Point", "coordinates": [PILOT_CENTER["lng"] + offset[1],
                                                      PILOT_CENTER["lat"] + offset[0]]},
        "zone_verified": True, "onboarded": True, "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@api.post("/seed")
async def seed():
    admin = await ensure_user(os.environ["ADMIN_EMAIL"], "Admin Manre", os.environ["ADMIN_PASSWORD"], "admin")
    await db.users.update_one({"email": os.environ["ADMIN_EMAIL"]}, {"$set": {"role": "admin"}})
    budi = await ensure_user("budi@manre.id", "Budi Warung", "Password123!", offset=(0.004, 0.003))
    sari = await ensure_user("sari@manre.id", "Sari Catering", "Password123!", offset=(-0.006, 0.005))
    await ensure_user("rina@manre.id", "Rina Mahasiswa", "Password123!", offset=(0.002, -0.004))

    if await db.posts.count_documents({"seeded": True}) == 0:
        n = now_utc()
        seeds = [
            (budi, "cooked", "Nasi campur sisa katering 6 porsi", 6, SEED_PHOTOS["cooked1"], "pickup", 5,
             "Masih anget, dimasak 1 jam lalu. Bawa wadah sendiri ya.", (0.0015, 0.001)),
            (sari, "cooked", "Ayam goreng + sambal 4 porsi", 4, SEED_PHOTOS["cooked2"], "dropoff", 3,
             "Titip di pos ronda Jl. Veteran. Kabari kalau mau ambil.", (-0.006, 0.005)),
            (budi, "raw", "Sayur bayam & wortel segar", 3, SEED_PHOTOS["raw1"], "delivery", 30,
             "Beli kebanyakan, masih segar. Bisa diantar radius 1 km.", (0.007, -0.002)),
            (sari, "raw", "Tomat & cabai 1 kg", 2, SEED_PHOTOS["raw2"], "pickup", 40,
             "Panen kebun, agak matang tapi masih bagus.", (-0.003, -0.006)),
        ]
        for donor, cat, title, portions, photo, handoff, hours, notes, off in seeds:
            await db.posts.insert_one({
                "id": str(uuid.uuid4()), "donor_id": donor["user_id"], "category": cat,
                "title": title, "portions": portions, "unit": "porsi" if cat == "cooked" else "paket",
                "notes": notes, "photo_url": photo,
                "prep_time": iso(n - timedelta(hours=1)) if cat == "cooked" else None,
                "best_before": iso(n + timedelta(hours=hours)), "handoff": handoff,
                "dropoff_name": "Pos ronda Jl. Veteran" if handoff == "dropoff" else None,
                "window_start": iso(n), "window_end": iso(n + timedelta(hours=hours)),
                "location": {"type": "Point", "coordinates": [PILOT_CENTER["lng"] + off[1],
                                                              PILOT_CENTER["lat"] + off[0]]},
                "privacy_offset": True, "status": "available", "flagged_review": False,
                "weight_kg": estimate_kg(cat, portions), "weight_estimated": True,
                "auto_accept": handoff == "dropoff",
                "review_status": "approved", "claims_count": 0, "seeded": True,
                "created_at": iso(n),
            })
    else:
        n = now_utc()
        async for p in db.posts.find({"seeded": True}, {"_id": 0, "id": 1, "category": 1, "portions": 1}):
            hours = 5 if p["category"] == "cooked" else 36
            await db.posts.update_one({"id": p["id"]}, {"$set": {
                "window_start": iso(n), "window_end": iso(n + timedelta(hours=hours)),
                "best_before": iso(n + timedelta(hours=hours)),
                "weight_kg": estimate_kg(p["category"], p.get("portions", 1)),
                "weight_estimated": True,
                "prep_time": iso(n - timedelta(hours=1)) if p["category"] == "cooked" else None,
            }})
        await db.posts.update_many({"seeded": True, "status": {"$ne": "available"}},
                                   {"$set": {"status": "available"}})
    return {"ok": True, "admin": admin["email"]}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)


@app.on_event("startup")
async def startup():
    await db.posts.create_index([("location", "2dsphere")])
    await db.posts.create_index("status")
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.messages.create_index([("claim_id", 1), ("created_at", 1)])
    await db.push_subscriptions.create_index([("user_id", 1), ("endpoint", 1)], unique=True)
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    try:
        await seed()
    except Exception as e:
        logger.error(f"Seed failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    pass
