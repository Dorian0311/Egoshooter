import asyncio
import time
import jwt
import pytest
from fastapi import HTTPException
from app.modules.casino.shooter import game_ticket

def test_ticket_requires_feature_and_support_agent(monkeypatch):
    monkeypatch.setenv('SHOOTER_ENABLED', 'false')
    with pytest.raises(HTTPException) as failure:
        asyncio.run(game_ticket({}))
    assert failure.value.status_code == 404
    monkeypatch.setenv('SHOOTER_ENABLED', 'true')
    with pytest.raises(HTTPException) as failure:
        asyncio.run(game_ticket({'roles': ['Support.Manager']}))
    assert failure.value.status_code == 403

def test_signed_short_lived_ticket(monkeypatch):
    secret = 'test-secret-that-is-longer-than-32-characters'
    monkeypatch.setenv('SHOOTER_ENABLED', 'true')
    monkeypatch.setenv('SHOOTER_TICKET_SECRET', secret)
    monkeypatch.setenv('SHOOTER_PUBLIC_URL', 'https://game.example')
    result = asyncio.run(game_ticket({'roles':['Support.Agent'],'tid':'tenant','oid':'user','name':'Anna'}))
    claims = jwt.decode(result['ticket'], secret, algorithms=['HS256'], audience='altstadt-1940', issuer='supporthub')
    assert claims['sub'] == 'tenant:user'
    assert claims['exp'] - claims['iat'] == 120
    assert claims['exp'] > time.time()
    assert result['playerId'] == claims['sub']
