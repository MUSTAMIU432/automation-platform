import pytest

LOCAL_ORIGIN = 'http://localhost:5173'


@pytest.fixture(autouse=True)
def cors_origins(settings):
    # Pin the allow-list so the tests don't depend on a developer's .env.
    settings.CORS_ALLOWED_ORIGINS = [LOCAL_ORIGIN]


def preflight(client, path, origin):
    return client.options(
        path,
        HTTP_ORIGIN=origin,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type',
    )


def test_vite_dev_origin_is_allowed_on_graphql(client):
    response = preflight(client, '/graphql/', LOCAL_ORIGIN)

    assert response['Access-Control-Allow-Origin'] == LOCAL_ORIGIN


def test_unknown_origin_is_not_allowed_on_graphql(client):
    response = preflight(client, '/graphql/', 'http://evil.example')

    assert 'Access-Control-Allow-Origin' not in response


def test_cors_is_limited_to_graphql(client):
    response = client.get('/health/', HTTP_ORIGIN=LOCAL_ORIGIN)

    assert 'Access-Control-Allow-Origin' not in response
