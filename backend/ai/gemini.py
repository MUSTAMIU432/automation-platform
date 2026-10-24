"""
Google Gemini: text and image generation.

One small client over the Gemini REST API (`generateContent`), so the platform needs no
SDK beyond `requests`, which Google sign-in already brings. The key is a server-side
secret (`GEMINI_API_KEY`): it is sent only to Google, in the `x-goog-api-key` header,
never in a URL, a log line or an error message.

Failures are `GeminiError`, whose message is safe to show a user verbatim; what Google
actually said is logged for the operator. Nothing here decides *what* to generate or who
may ask - that belongs to the feature that calls it.
"""

import base64
import logging
import time
from dataclasses import dataclass

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models'

# Google's own transient failures ("the model is overloaded"), which are common and
# usually gone in seconds; asked again this many more times, waiting longer each time.
RETRY_STATUSES = frozenset({500, 502, 503, 504})
RETRIES = 2
RETRY_BACKOFF_SECONDS = 1.5


class GeminiError(Exception):
    """Generation failed; the message is safe to show verbatim."""

    def __init__(self, message: str, *, status: int | None = None):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class GeneratedImage:
    data: bytes
    mime_type: str
    # Any words the model returned alongside the picture (often empty).
    text: str


def is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _generate(model: str, body: dict) -> dict:
    if not is_configured():
        raise GeminiError('AI generation is not configured on this server.')
    for attempt in range(RETRIES + 1):
        try:
            response = requests.post(
                f'{API_ROOT}/{model}:generateContent',
                json=body,
                headers={'x-goog-api-key': settings.GEMINI_API_KEY},
                timeout=settings.GEMINI_TIMEOUT_SECONDS,
            )
        except requests.RequestException:
            logger.exception('Gemini request to %s failed', model)
            raise GeminiError('We could not reach the AI service. Please try again.') from None
        if response.status_code not in RETRY_STATUSES or attempt == RETRIES:
            break
        logger.info('Gemini %s answered %s; retrying', model, response.status_code)
        time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))

    if response.status_code != 200:
        logger.warning(
            'Gemini %s answered %s: %s', model, response.status_code, response.text[:500]
        )
        if response.status_code == 429:
            raise GeminiError(
                'The AI service quota is used up for now. Please try again later.', status=429
            )
        if response.status_code == 503:
            raise GeminiError(
                'The AI service is busy right now. Please try again shortly.', status=503
            )
        raise GeminiError(
            'The AI service could not answer this request.', status=response.status_code
        )
    return response.json()


def _parts(answer: dict) -> list[dict]:
    candidates = answer.get('candidates') or []
    if not candidates:
        reason = (answer.get('promptFeedback') or {}).get('blockReason')
        logger.warning('Gemini returned no candidates (block reason: %s)', reason)
        raise GeminiError('The AI service declined to answer this request.')
    return (candidates[0].get('content') or {}).get('parts') or []


def generate_text(prompt: str, *, system: str | None = None, model: str | None = None) -> str:
    """The model's answer to `prompt`, optionally steered by a `system` instruction."""
    body: dict = {'contents': [{'role': 'user', 'parts': [{'text': prompt}]}]}
    if system:
        body['systemInstruction'] = {'parts': [{'text': system}]}
    answer = _generate(model or settings.GEMINI_TEXT_MODEL, body)
    text = ''.join(part.get('text', '') for part in _parts(answer) if not part.get('thought'))
    if not text.strip():
        raise GeminiError('The AI service returned an empty answer.')
    return text


def generate_image(prompt: str, *, model: str | None = None) -> GeneratedImage:
    """One image drawn from `prompt`."""
    body = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE']},
    }
    parts = _parts(_generate(model or settings.GEMINI_IMAGE_MODEL, body))
    text = ''.join(part.get('text', '') for part in parts if not part.get('thought'))
    for part in parts:
        inline = part.get('inlineData')
        if inline and inline.get('data') and not part.get('thought'):
            return GeneratedImage(
                data=base64.b64decode(inline['data']),
                mime_type=inline.get('mimeType', 'image/png'),
                text=text,
            )
    raise GeminiError('The AI service did not return an image.')
