import base64
from unittest import mock

import pytest
import requests

from ai import gemini

KEY = 'test-gemini-key'


@pytest.fixture(autouse=True)
def configured(settings):
    settings.GEMINI_API_KEY = KEY
    settings.GEMINI_TEXT_MODEL = 'text-model'
    settings.GEMINI_IMAGE_MODEL = 'image-model'
    settings.GEMINI_TIMEOUT_SECONDS = 5


def answer(parts, status=200):
    response = mock.Mock(status_code=status, text='{"error": "details"}')
    response.json.return_value = {'candidates': [{'content': {'parts': parts}}]}
    return response


class TestText:
    def test_sends_the_prompt_with_the_key_in_a_header_never_the_url(self):
        with mock.patch('ai.gemini.requests.post', return_value=answer([{'text': 'ok'}])) as post:
            assert gemini.generate_text('Say ok', system='Be brief.') == 'ok'

        url = post.call_args.args[0]
        assert url.endswith('/models/text-model:generateContent')
        assert KEY not in url
        assert post.call_args.kwargs['headers'] == {'x-goog-api-key': KEY}
        body = post.call_args.kwargs['json']
        assert body['contents'][0]['parts'] == [{'text': 'Say ok'}]
        assert body['systemInstruction'] == {'parts': [{'text': 'Be brief.'}]}

    def test_leaves_out_the_models_thoughts(self):
        parts = [{'text': 'thinking…', 'thought': True}, {'text': 'Answer.'}]
        with mock.patch('ai.gemini.requests.post', return_value=answer(parts)):
            assert gemini.generate_text('Q') == 'Answer.'

    def test_an_empty_answer_is_an_error(self):
        with (
            mock.patch('ai.gemini.requests.post', return_value=answer([])),
            pytest.raises(gemini.GeminiError, match='empty answer'),
        ):
            gemini.generate_text('Q')


class TestImage:
    def test_returns_the_picture_bytes_and_type(self):
        png = b'\x89PNG\r\n\x1a\nfake'
        parts = [
            {'text': 'Here it is.'},
            {'inlineData': {'mimeType': 'image/png', 'data': base64.b64encode(png).decode()}},
        ]
        with mock.patch('ai.gemini.requests.post', return_value=answer(parts)) as post:
            picture = gemini.generate_image('A gear')

        assert picture == gemini.GeneratedImage(data=png, mime_type='image/png', text='Here it is.')
        assert post.call_args.args[0].endswith('/models/image-model:generateContent')
        assert post.call_args.kwargs['json']['generationConfig'] == {
            'responseModalities': ['TEXT', 'IMAGE']
        }

    def test_an_answer_without_a_picture_is_an_error(self):
        with (
            mock.patch('ai.gemini.requests.post', return_value=answer([{'text': 'No.'}])),
            pytest.raises(gemini.GeminiError, match='did not return an image'),
        ):
            gemini.generate_image('A gear')


class TestFailures:
    def test_googles_transient_failures_are_retried(self):
        replies = [answer([], status=503), answer([], status=500), answer([{'text': 'ok'}])]
        with (
            mock.patch('ai.gemini.requests.post', side_effect=replies) as post,
            mock.patch('ai.gemini.time.sleep') as sleep,
        ):
            assert gemini.generate_text('Q') == 'ok'
        assert post.call_count == 3
        assert sleep.call_count == 2

    def test_retries_give_up_after_the_last_attempt(self):
        with (
            mock.patch('ai.gemini.requests.post', return_value=answer([], status=503)) as post,
            mock.patch('ai.gemini.time.sleep'),
            pytest.raises(gemini.GeminiError, match='busy'),
        ):
            gemini.generate_text('Q')
        assert post.call_count == gemini.RETRIES + 1

    def test_without_a_key_nothing_is_sent(self, settings):
        settings.GEMINI_API_KEY = ''
        with (
            mock.patch('ai.gemini.requests.post') as post,
            pytest.raises(gemini.GeminiError, match='not configured'),
        ):
            gemini.generate_text('Q')
        post.assert_not_called()

    @pytest.mark.parametrize(
        ('status', 'words'),
        [(429, 'quota is used up'), (503, 'busy'), (400, 'could not answer')],
    )
    def test_googles_refusals_become_safe_messages(self, status, words):
        with (
            mock.patch('ai.gemini.time.sleep'),
            mock.patch('ai.gemini.requests.post', return_value=answer([], status=status)),
            pytest.raises(gemini.GeminiError, match=words) as raised,
        ):
            gemini.generate_text('Q')
        assert raised.value.status == status
        assert KEY not in raised.value.message

    def test_a_network_failure_is_a_safe_message(self):
        with (
            mock.patch('ai.gemini.requests.post', side_effect=requests.ConnectionError(KEY)),
            pytest.raises(gemini.GeminiError, match='could not reach') as raised,
        ):
            gemini.generate_text('Q')
        assert KEY not in raised.value.message

    def test_a_blocked_prompt_is_an_error(self):
        response = mock.Mock(status_code=200)
        response.json.return_value = {'promptFeedback': {'blockReason': 'SAFETY'}}
        with (
            mock.patch('ai.gemini.requests.post', return_value=response),
            pytest.raises(gemini.GeminiError, match='declined'),
        ):
            gemini.generate_text('Q')
