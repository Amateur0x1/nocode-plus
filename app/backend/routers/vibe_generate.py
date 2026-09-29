import logging
import os
from pathlib import Path
from typing import List, Literal

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.telemetry import observe_external_http
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/vibe", tags=["vibe"])

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class GenerateRequest(BaseModel):
    messages: List[ChatMessage]


class GenerateResponse(BaseModel):
    content: str
    model: str


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    data: GenerateRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """Call DeepSeek chat completions with the user's own API key."""
    if not (os.environ.get("DEEPSEEK_API_KEY") or "").strip():
        load_dotenv(ENV_PATH, override=True)
    api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY 未配置，请先在平台密钥设置中添加")
    base_url = (os.environ.get("DEEPSEEK_BASE_URL") or "https://api.deepseek.com").rstrip("/")
    model = os.environ.get("DEEPSEEK_MODEL") or "deepseek-flash"
    if not data.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")

    payload = {
        "model": model,
        "messages": [m.model_dump() for m in data.messages],
        "stream": False,
    }

    async def _call():
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as http:
            return await http.post(
                f"{base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )

    try:
        resp = await observe_external_http(_call())
    except httpx.HTTPError as exc:
        logger.error("DeepSeek request failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"DeepSeek 请求失败: {exc}") from exc

    if resp.status_code != 200:
        logger.error("DeepSeek error %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(status_code=502, detail=f"DeepSeek 返回错误 {resp.status_code}: {resp.text[:300]}")

    try:
        content = resp.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError) as exc:
        raise HTTPException(status_code=502, detail="DeepSeek 返回格式异常") from exc
    if not content.strip():
        raise HTTPException(status_code=502, detail="DeepSeek 返回内容为空，请重试")
    return GenerateResponse(content=content, model=model)
