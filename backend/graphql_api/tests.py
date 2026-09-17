import json

from django.test import Client, TestCase


class GraphQLFoundationTests(TestCase):
    """
    Infrastructure tests proving the GraphQL endpoint is wired up end to
    end: HTTP -> Strawberry -> root Query/Mutation -> response. No
    business-domain behaviour is exercised here.
    """

    def setUp(self):
        self.client = Client()

    def post_graphql(self, query, variables=None):
        payload = {'query': query}
        if variables is not None:
            payload['variables'] = variables
        return self.client.post(
            '/graphql/',
            data=json.dumps(payload),
            content_type='application/json',
        )

    def test_api_status_query_resolves(self):
        response = self.post_graphql('{ apiStatus { status version djangoVersion } }')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertNotIn('errors', body)
        self.assertEqual(body['data']['apiStatus']['status'], 'ok')
        self.assertTrue(body['data']['apiStatus']['version'])
        self.assertTrue(body['data']['apiStatus']['djangoVersion'])

    def test_ping_mutation_echoes_input(self):
        response = self.post_graphql(
            'mutation Ping($message: String!) { ping(message: $message) }',
            variables={'message': 'hello'},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertNotIn('errors', body)
        self.assertEqual(body['data']['ping'], 'hello')

    def test_malformed_query_returns_graphql_error(self):
        response = self.post_graphql('{ nonExistentField }')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn('errors', body)

    def test_health_endpoint_still_works(self):
        response = self.client.get('/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
