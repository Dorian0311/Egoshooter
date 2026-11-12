"""Shooter ticket issuer. Lives inside the casino module, outside Jira workflows."""
from __future__ import annotations
import os
import time
import secrets
import jwt
from fastapi import APIRouter, HTTPException
from ...auth import SupporterClaims
from ...platform.modules import ensure_module_enabled

router = APIRouter(prefix="/api/shooter", tags=["shooter"])

@router.post("/ticket")
async def game_ticket(claims: SupporterClaims):
    ensure_module_enabled("casino")
    if os.environ.get("SHOOTER_ENABLED", "false").lower() != "true":
        raise HTTPException(404, "Shooter is disabled")
    roles = claims.get("roles", [])
    if "Support.Agent" not in (roles if isinstance(roles, list) else [roles]):
        raise HTTPException(403, "Support.Agent is required")
    secret = os.environ.get("SHOOTER_TICKET_SECRET", "")
    server = os.environ.get("SHOOTER_PUBLIC_URL", "")
    if len(secret) < 32 or not server.startswith(("https://", "wss://")):
        raise HTTPException(503, "Shooter is not configured")
    now = int(time.time())
    subject = f"{claims['tid']}:{claims['oid']}"
    token = jwt.encode({"iss": "supporthub", "aud": "altstadt-1940", "sub": subject,
        "iat": now, "exp": now + 120, "jti": secrets.token_urlsafe(16),
        "name": str(claims.get("name") or "Spieler")[:48], "role": "Support.Agent"}, secret, algorithm="HS256")
    return {"ticket": token, "serverUrl": server, "playerId": subject}
