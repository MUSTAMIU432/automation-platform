"""Ideas for sale: written and priced by administrators, unlocked by a confirmed payment."""

from datetime import timedelta

import pytest
from django.utils import timezone

from administration.models import AdminAuditEntry
from automation.tests.test_opportunity import make_user
from marketplace import services
from marketplace.models import MarketIdea, Purchase
from marketplace.services import MarketplaceError
from notifications.models import Notification
from reviews.tests.platform import grant_permission

CONSOLE = 'administration.access_console'
MANAGE = 'administration.manage_marketplace'
IDEA = services.IdeaInput(
    title='Automated tax collection',
    summary='Collect and reconcile taxes without paper.',
    documentation='- Architecture\n- Data model\n- Rollout plan',
    price=50_000,
)
MOBILE = services.MethodInput(
    kind='mobile_money',
    provider='M-Pesa',
    account_name='Mustanet Ltd',
    account_number='0754 000 000',
    instructions='Lipa na M-Pesa, then enter the reference.',
)


@pytest.fixture
def admin(db):
    user = make_user('admin@example.com')
    grant_permission(user, CONSOLE)
    grant_permission(user, MANAGE)
    return user


@pytest.fixture
def buyer(db):
    return make_user('buyer@example.com')


@pytest.fixture
def method(admin):
    return services.create_method(admin, MOBILE)


@pytest.fixture
def published(admin, method):
    idea = services.create_idea(admin, IDEA)
    return services.publish_idea(admin, idea.pk)


def pay(buyer, idea, method, reference='QK7H2X9P1A'):
    return services.submit_payment(
        buyer,
        idea.pk,
        method_id=method.pk,
        payer_name='Buyer Person',
        payer_account='0712 345 678',
        transaction_reference=reference,
    )


@pytest.mark.django_db
class TestSelling:
    def test_only_an_administrator_writes_ideas_and_methods(self, buyer):
        with pytest.raises(MarketplaceError):
            services.create_idea(buyer, IDEA)
        with pytest.raises(MarketplaceError):
            services.create_method(buyer, MOBILE)

    def test_an_idea_needs_its_parts_and_a_sensible_price(self, admin):
        with pytest.raises(MarketplaceError, match='Title is required'):
            services.create_idea(admin, services.IdeaInput('', 'S', 'D', 1))
        with pytest.raises(MarketplaceError, match='price'):
            services.create_idea(admin, services.IdeaInput('T', 'S', 'D', -5))

    def test_publishing_needs_somewhere_to_pay(self, admin):
        idea = services.create_idea(admin, IDEA)
        with pytest.raises(MarketplaceError, match='payment method'):
            services.publish_idea(admin, idea.pk)

    def test_publishing_and_withdrawing_are_audited(self, admin, published):
        assert published.status == 'published'
        services.unpublish_idea(admin, published.pk)
        actions = set(AdminAuditEntry.objects.values_list('action', flat=True))
        assert {'marketplace.idea_published', 'marketplace.idea_unpublished'} <= actions


@pytest.mark.django_db
class TestBuying:
    def test_users_see_only_published_ideas_and_no_documentation(self, admin, buyer, method):
        draft = services.create_idea(admin, IDEA)
        assert services.published_ideas(buyer) == []
        assert services.get_idea(buyer, draft.pk) is None

        services.publish_idea(admin, draft.pk)
        (idea,) = services.published_ideas(buyer)
        assert services.has_access(buyer, idea) is False
        assert services.has_access(admin, idea) is True

    def test_a_confirmed_payment_unlocks_the_idea(
        self, admin, buyer, method, published, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            purchase = pay(buyer, published, method)
        assert purchase.status == 'pending'
        assert purchase.amount == 50_000
        assert services.has_access(buyer, published) is False
        assert Notification.objects.filter(
            user=admin, kind='marketplace.payment_submitted'
        ).exists()

        with django_capture_on_commit_callbacks(execute=True):
            services.confirm_payment(admin, purchase.pk)

        assert services.has_access(buyer, published) is True
        assert Notification.objects.filter(
            user=buyer, kind='marketplace.payment_confirmed'
        ).exists()
        assert AdminAuditEntry.objects.filter(action='marketplace.payment_confirmed').exists()

    def test_one_payment_at_a_time_and_none_once_unlocked(self, admin, buyer, method, published):
        purchase = pay(buyer, published, method)
        with pytest.raises(MarketplaceError, match='already waiting'):
            pay(buyer, published, method, reference='OTHER')
        services.confirm_payment(admin, purchase.pk)
        with pytest.raises(MarketplaceError, match='already have access'):
            pay(buyer, published, method, reference='AGAIN')

    def test_a_rejected_payment_says_why_and_can_be_tried_again(
        self, admin, buyer, method, published, django_capture_on_commit_callbacks
    ):
        purchase = pay(buyer, published, method)
        with pytest.raises(MarketplaceError, match='Say why'):
            services.reject_payment(admin, purchase.pk, note='')
        with django_capture_on_commit_callbacks(execute=True):
            services.reject_payment(
                admin, purchase.pk, note='No such transaction on our statement.'
            )

        assert services.has_access(buyer, published) is False
        assert Notification.objects.filter(user=buyer, kind='marketplace.payment_rejected').exists()
        assert pay(buyer, published, method, reference='CORRECTED').status == 'pending'

    def test_only_an_administrator_confirms(self, buyer, method, published):
        purchase = pay(buyer, published, method)
        with pytest.raises(MarketplaceError):
            services.confirm_payment(buyer, purchase.pk)

    def test_a_price_change_does_not_rewrite_what_was_paid(self, admin, buyer, method, published):
        purchase = pay(buyer, published, method)
        services.update_idea(
            admin,
            published.pk,
            services.IdeaInput(IDEA.title, IDEA.summary, IDEA.documentation, 90_000),
        )
        purchase.refresh_from_db()
        assert purchase.amount == 50_000

    def test_a_withdrawn_method_cannot_be_paid_to(self, admin, buyer, method, published):
        services.set_method_active(admin, method.pk, False)
        with pytest.raises(MarketplaceError, match='how you paid'):
            pay(buyer, published, method)


@pytest.mark.django_db
def test_over_graphql_the_documentation_stays_locked_until_paid(admin, buyer, method, published):
    from automation.tests.test_api_journey import Api

    query = 'query($id: ID!){ marketIdea(id: $id){ title price currency hasAccess documentation } }'
    locked = Api(buyer)(query, {'id': str(published.pk)})['marketIdea']
    assert locked == {
        'title': 'Automated tax collection',
        'price': 50000,
        'currency': 'TZS',
        'hasAccess': False,
        'documentation': None,
    }

    purchase = pay(buyer, published, method)
    services.confirm_payment(admin, purchase.pk)
    unlocked = Api(buyer)(query, {'id': str(published.pk)})['marketIdea']
    assert unlocked['documentation'].startswith('- Architecture')
    assert Purchase.objects.get().status == 'confirmed'
    assert MarketIdea.objects.count() == 1


@pytest.mark.django_db
def test_an_administrator_sees_each_ideas_sales(admin, buyer, method, published):
    from automation.tests.test_api_journey import Api

    first = pay(buyer, published, method)
    services.confirm_payment(admin, first.pk)
    pay(make_user('second@example.com'), published, method, reference='SECOND')
    query = '{ adminMarketIdeas { purchasesConfirmed revenue paymentsWaiting } }'

    (row,) = Api(admin)(query)['adminMarketIdeas']
    assert row == {'purchasesConfirmed': 1, 'revenue': 50000, 'paymentsWaiting': 1}
    # A buyer never sees the takings.
    seen = Api(buyer)('{ marketIdeas { revenue paymentsWaiting } }')['marketIdeas']
    assert seen == [{'revenue': 0, 'paymentsWaiting': 0}]


# --- the uploaded document ---------------------------------------------------------------------

PDF = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\ntrailer\n<< >>\n%%EOF'


@pytest.fixture
def media(settings, tmp_path):
    settings.STORAGES = {
        **settings.STORAGES,
        'attachments': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
            'OPTIONS': {'location': str(tmp_path)},
        },
    }
    return tmp_path


def _document_url(idea) -> str:
    return f'/marketplace/ideas/{idea.pk}/document/'


def _upload(api, idea, data=PDF, name='plan.pdf'):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return api.client.post(
        _document_url(idea),
        {'file': SimpleUploadedFile(name, data)},
        HTTP_AUTHORIZATION=f'Bearer {api.token}',
    )


def _download(api, idea):
    return api.client.get(_document_url(idea), HTTP_AUTHORIZATION=f'Bearer {api.token}')


@pytest.mark.django_db
class TestDocument:
    def test_a_document_alone_is_enough_to_go_on_sale(self, admin, method, media):
        from automation.tests.test_api_journey import Api

        idea = services.create_idea(admin, services.IdeaInput('T', 'S', '', 1000))
        with pytest.raises(MarketplaceError, match='upload a document'):
            services.publish_idea(admin, idea.pk)

        response = _upload(Api(admin), idea)
        assert response.status_code == 200, response.content
        assert response.json()['document']['filename'] == 'plan.pdf'
        assert services.publish_idea(admin, idea.pk).status == 'published'

    def test_the_document_unlocks_with_the_payment(self, admin, buyer, method, published, media):
        from automation.tests.test_api_journey import Api

        assert _upload(Api(admin), published).status_code == 200
        as_buyer = Api(buyer)
        query = (
            'query($id: ID!){ marketIdea(id: $id){ hasDocument document { filename size }'
            ' documentInfo { filename format } hasWrittenDocumentation } }'
        )
        locked = as_buyer(query, {'id': str(published.pk)})['marketIdea']
        # What is included is shown before buying; the file itself is not.
        assert locked == {
            'hasDocument': True,
            'document': None,
            'documentInfo': {'filename': 'plan.pdf', 'format': 'PDF'},
            'hasWrittenDocumentation': True,
        }
        assert _download(as_buyer, published).status_code == 404

        services.confirm_payment(admin, pay(buyer, published, method).pk)
        unlocked = as_buyer(query, {'id': str(published.pk)})['marketIdea']
        assert unlocked['document'] == {'filename': 'plan.pdf', 'size': len(PDF)}
        response = _download(as_buyer, published)
        assert response.status_code == 200
        assert response['Content-Type'] == 'application/pdf'
        assert response['Content-Disposition'].startswith('attachment;')
        assert b''.join(response.streaming_content) == PDF

    def test_only_a_manager_uploads_and_only_real_documents(self, admin, buyer, published, media):
        from automation.tests.test_api_journey import Api

        assert _upload(Api(buyer), published).status_code == 404
        refused = _upload(Api(admin), published, data=b'MZ\x90\x00', name='plan.pdf')
        assert refused.status_code == 400
        assert _upload(Api(admin), published, name='plan.png').status_code == 400
        # A legacy .doc cannot be previewed in a browser, so it is not accepted.
        assert _upload(Api(admin), published, name='plan.doc').status_code == 400
        assert MarketIdea.objects.get().document_key == ''

    def test_replacing_removes_the_old_file_and_an_idea_on_sale_keeps_something(
        self, admin, method, media, django_capture_on_commit_callbacks
    ):
        from automation.tests.test_api_journey import Api

        api = Api(admin)
        idea = services.create_idea(admin, services.IdeaInput('T', 'S', '', 1000))
        _upload(api, idea)
        first = MarketIdea.objects.get().document_key
        with django_capture_on_commit_callbacks(execute=True):
            _upload(api, idea, name='plan-v2.pdf')
        assert not (media / first).exists()

        services.publish_idea(admin, idea.pk)
        response = api.client.delete(_document_url(idea), HTTP_AUTHORIZATION=f'Bearer {api.token}')
        assert response.status_code == 400
        assert MarketIdea.objects.get().document_name == 'plan-v2.pdf'


# --- paying by a prompt on the phone -----------------------------------------------------------

PUSH = services.MethodInput(
    kind='mobile_money',
    provider='Mixx by Yas (Tigo Pesa)',
    account_name='Automation Platform',
    account_number='',
    collection='push',
)


@pytest.fixture
def sandbox(settings):
    settings.DEBUG = True
    settings.MARKETPLACE_PAYMENT_GATEWAY = 'sandbox'
    settings.MARKETPLACE_SANDBOX_APPROVE_SECONDS = 0


@pytest.fixture
def mixx(admin):
    return services.create_method(admin, PUSH)


def push(buyer, idea, method, phone='0712 345 678'):
    return services.start_push_payment(buyer, idea.pk, method_id=method.pk, phone_number=phone)


@pytest.mark.django_db
class TestPushPayment:
    def test_an_approved_prompt_unlocks_the_idea_with_no_one_in_between(
        self, sandbox, buyer, mixx, published, django_capture_on_commit_callbacks
    ):
        purchase = push(buyer, published, mixx)
        assert purchase.status == 'awaiting'
        assert purchase.payer_account == '255712345678'
        assert purchase.gateway == 'sandbox'
        assert purchase.gateway_reference.startswith('SBX')

        with django_capture_on_commit_callbacks(execute=True):
            settled = services.refresh_purchase(buyer, purchase.pk)
        assert settled.status == 'confirmed'
        assert settled.transaction_reference
        assert services.has_access(buyer, published)
        assert Notification.objects.filter(
            user=buyer, kind='marketplace.payment_confirmed'
        ).exists()

    def test_a_declined_prompt_fails_and_can_be_tried_again(self, sandbox, buyer, mixx, published):
        declined = services.refresh_purchase(buyer, push(buyer, published, mixx, '0712345670').pk)
        assert declined.status == 'failed'
        assert 'declined' in declined.review_note
        assert not services.has_access(buyer, published)
        assert push(buyer, published, mixx).status == 'awaiting'

    def test_one_prompt_at_a_time_until_it_expires(self, sandbox, buyer, mixx, published):
        first = push(buyer, published, mixx)
        with pytest.raises(MarketplaceError, match='already on your phone'):
            push(buyer, published, mixx)
        Purchase.objects.filter(pk=first.pk).update(
            created_at=timezone.now() - services.PUSH_TIMEOUT - timedelta(seconds=1)
        )
        assert push(buyer, published, mixx).status == 'awaiting'
        assert Purchase.objects.get(pk=first.pk).status == 'failed'

    def test_the_number_must_be_a_tanzanian_mobile(self):
        for raw in ('0712 345 678', '+255 712 345 678', '255712345678', '712-345-678'):
            assert services.normalize_phone(raw) == '255712345678'
        for raw in ('', '12345', '0812345678', '+254712345678'):
            with pytest.raises(MarketplaceError, match='mobile number'):
                services.normalize_phone(raw)

    def test_the_sandbox_never_runs_without_debug(self, settings, buyer, mixx, published):
        settings.DEBUG = False
        settings.MARKETPLACE_PAYMENT_GATEWAY = 'sandbox'
        # A push method is hidden from buyers while no gateway can send the prompt.
        assert mixx not in services.active_methods()
        with pytest.raises(MarketplaceError, match='not available'):
            push(buyer, published, mixx)

    def test_a_push_method_is_not_paid_by_hand(self, sandbox, buyer, mixx, published):
        with pytest.raises(MarketplaceError, match='how you paid'):
            pay(buyer, published, mixx)


class FakeGateway:
    """A gateway whose callback is JSON carrying a shared secret, as real adapters verify."""

    name = 'fake'

    def start(self, purchase, phone):
        return f'FAKE-{purchase.pk}'

    def check(self, purchase):
        return None

    def parse_callback(self, request):
        import json

        from marketplace.gateways import PushOutcome

        body = json.loads(request.body)
        if body.get('secret') != 'shh':
            return None
        return PushOutcome(body['reference'], approved=body['approved'], receipt='MX123')


@pytest.mark.django_db
def test_the_gateway_callback_settles_a_payment_once(settings, buyer, mixx, published):
    import json

    from django.test import Client

    settings.MARKETPLACE_PAYMENT_GATEWAY = 'marketplace.tests.test_marketplace.FakeGateway'
    purchase = push(buyer, published, mixx)
    client = Client()

    def callback(**body):
        return client.post(
            '/marketplace/gateway/callback/',
            json.dumps({'reference': purchase.gateway_reference, **body}),
            content_type='application/json',
        )

    # A request the gateway cannot vouch for changes nothing.
    assert callback(approved=True, secret='guess').status_code == 400
    assert Purchase.objects.get().status == 'awaiting'

    assert callback(approved=True, secret='shh').status_code == 200
    assert callback(approved=False, secret='shh').status_code == 200  # a repeat changes nothing
    settled = Purchase.objects.get()
    assert (settled.status, settled.transaction_reference) == ('confirmed', 'MX123')


@pytest.mark.django_db
class TestEnquiries:
    def test_a_buyer_asks_and_the_team_answers(
        self, admin, buyer, published, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            enquiry = services.send_enquiry(buyer, published.pk, '  Does it work for M-Pesa?  ')
        assert enquiry.awaiting_reply
        assert Notification.objects.filter(user=admin, kind='marketplace.enquiry_received').exists()

        with django_capture_on_commit_callbacks(execute=True):
            services.reply_enquiry(admin, enquiry.pk, 'Yes - any mobile money network.')
        enquiry.refresh_from_db()
        assert not enquiry.awaiting_reply
        assert [(m.from_team, m.body) for m in enquiry.messages.all()] == [
            (False, 'Does it work for M-Pesa?'),
            (True, 'Yes - any mobile money network.'),
        ]
        assert Notification.objects.filter(user=buyer, kind='marketplace.enquiry_answered').exists()
        # Asking again continues the same conversation.
        assert services.send_enquiry(buyer, published.pk, 'Thanks!').pk == enquiry.pk

    def test_only_the_team_answers_and_sees_every_conversation(self, admin, buyer, published):
        enquiry = services.send_enquiry(buyer, published.pk, 'Hello?')
        with pytest.raises(MarketplaceError):
            services.reply_enquiry(buyer, enquiry.pk, 'Answering myself')
        assert services.enquiries(buyer) == []
        assert services.enquiries(admin) == [enquiry]
        with pytest.raises(MarketplaceError, match='Enquiries page'):
            services.send_enquiry(admin, published.pk, 'Testing')

    def test_a_message_needs_words_and_an_idea_on_sale(self, admin, buyer, published):
        with pytest.raises(MarketplaceError, match='Write your message'):
            services.send_enquiry(buyer, published.pk, '   ')
        draft = services.create_idea(admin, IDEA)
        with pytest.raises(MarketplaceError, match='not available'):
            services.send_enquiry(buyer, draft.pk, 'What is this?')

    def test_over_graphql(self, admin, buyer, published):
        from automation.tests.test_api_journey import Api

        as_buyer = Api(buyer)
        sent = as_buyer.ok(
            'mutation($i: ID!, $b: String!){ sendMarketEnquiry(ideaId: $i, body: $b){'
            ' success message field enquiry { awaitingReply messages { body fromTeam } } } }',
            'sendMarketEnquiry',
            {'i': str(published.pk), 'b': 'What is inside the guide?'},
        )
        assert sent['enquiry']['messages'] == [
            {'body': 'What is inside the guide?', 'fromTeam': False}
        ]
        mine = as_buyer(
            'query($i: ID!){ myMarketEnquiry(ideaId: $i){ ideaTitle awaitingReply } }',
            {'i': str(published.pk)},
        )['myMarketEnquiry']
        assert mine == {'ideaTitle': 'Automated tax collection', 'awaitingReply': True}
        assert as_buyer('{ marketEnquiries { id } }')['marketEnquiries'] == []


CARD = services.MethodInput(
    kind='bank',
    provider='Visa / Mastercard',
    account_name='Automation Platform',
    account_number='',
    collection='card',
)


@pytest.mark.django_db
class TestCardPayment:
    @pytest.fixture
    def card(self, admin):
        return services.create_method(admin, CARD)

    def charge(self, buyer, idea, method, last4='4242'):
        return services.start_card_payment(
            buyer,
            idea.pk,
            method_id=method.pk,
            card_token=f'sbx_card_{last4}',
            cardholder_name='Buyer Person',
            card_label=f'Visa •••• {last4}',
        )

    def test_a_card_payment_unlocks_the_idea_at_once(self, sandbox, buyer, card, published):
        purchase = self.charge(buyer, published, card)
        assert purchase.status == 'confirmed'
        assert purchase.payer_account == 'Visa •••• 4242'
        assert purchase.transaction_reference.startswith('SC')
        assert services.has_access(buyer, published)

    def test_a_declined_card_says_so_and_can_be_tried_again(self, sandbox, buyer, card, published):
        declined = self.charge(buyer, published, card, last4='0002')
        assert declined.status == 'failed'
        assert declined.review_note == 'Your bank declined the card.'
        assert self.charge(buyer, published, card).status == 'confirmed'

    def test_only_a_gateway_token_is_charged(self, sandbox, buyer, card, published):
        with pytest.raises(MarketplaceError, match='could not be read'):
            services.start_card_payment(
                buyer,
                published.pk,
                method_id=card.pk,
                card_token='4242424242424242',
                cardholder_name='Buyer Person',
            )
        assert Purchase.objects.get().status == 'failed'

    def test_cards_are_a_bank_method_and_need_a_gateway(self, settings, admin, card):
        with pytest.raises(MarketplaceError, match='bank method'):
            services.create_method(
                admin, services.MethodInput(**{**vars(CARD), 'kind': 'mobile_money'})
            )
        settings.MARKETPLACE_PAYMENT_GATEWAY = ''
        assert card not in services.active_methods()
