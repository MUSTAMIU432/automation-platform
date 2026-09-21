def test_health_returns_200(client):
    response = client.get('/health/')

    assert response.status_code == 200


def test_health_returns_json_status_ok(client):
    response = client.get('/health/')

    assert response['Content-Type'] == 'application/json'
    assert response.json() == {'status': 'ok'}


def test_health_does_not_accept_unknown_paths(client):
    assert client.get('/health/nope/').status_code == 404
