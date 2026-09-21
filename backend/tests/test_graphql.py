import json

import pytest
from django.test import Client


@pytest.fixture
def gql(client: Client):
    """POST a GraphQL operation to the real /graphql/ endpoint."""

    def post(query, variables=None):
        payload = {'query': query}
        if variables is not None:
            payload['variables'] = variables
        return client.post('/graphql/', data=json.dumps(payload), content_type='application/json')

    return post


def test_api_status_query_returns_foundation_response(gql):
    response = gql('{ apiStatus { status version djangoVersion } }')

    assert response.status_code == 200
    body = response.json()
    assert 'errors' not in body
    api_status = body['data']['apiStatus']
    assert api_status['status'] == 'ok'
    assert api_status['version']
    assert api_status['djangoVersion']


def test_ping_mutation_echoes_message(gql):
    response = gql(
        'mutation Ping($message: String!) { ping(message: $message) }',
        {'message': 'hello'},
    )

    assert response.status_code == 200
    body = response.json()
    assert 'errors' not in body
    assert body['data']['ping'] == 'hello'


def test_invalid_field_returns_graphql_error(gql):
    response = gql('{ nonExistentField }')

    assert response.status_code == 200
    body = response.json()
    assert 'data' not in body or body['data'] is None
    assert "Cannot query field 'nonExistentField'" in body['errors'][0]['message']


def test_invalid_mutation_returns_graphql_error(gql):
    response = gql('mutation { nonExistentMutation }')

    body = response.json()
    assert "Cannot query field 'nonExistentMutation'" in body['errors'][0]['message']


def test_missing_required_variable_returns_graphql_error(gql):
    response = gql('mutation Ping($message: String!) { ping(message: $message) }', {})

    body = response.json()
    assert body['errors']
    assert 'message' in body['errors'][0]['message']


def test_syntax_error_returns_graphql_error(gql):
    response = gql('{ apiStatus ')

    body = response.json()
    assert body['errors']
    assert 'Syntax Error' in body['errors'][0]['message']


def test_get_without_query_is_rejected(client):
    assert client.get('/graphql/').status_code == 400


def test_graphiql_ide_is_not_served_when_debug_is_off(client):
    # Tests run with DEBUG=False, matching deployed environments.
    response = client.get('/graphql/', HTTP_ACCEPT='text/html')

    assert 'graphiql' not in response.content.decode().lower()
