"""
The marketplace's rules.

Administrators (`administration.manage_marketplace`) write ideas, price them, publish or
withdraw them, set the accounts buyers pay into, and confirm or reject payments. Everyone
signed in sees published ideas' titles, summaries and prices; an idea's documentation is
returned only to someone whose payment for it has been confirmed (or to an administrator).

A payment is collected the way its method says (`marketplace.models`): pushed to the
buyer's phone through the payment gateway and settled by the gateway's answer, or made by
the buyer and confirmed by an administrator against their statement. Each administrator
decision is audited, and the people concerned are told. Refusals are `MarketplaceError`,
whose message is safe to show.

What a buyer unlocks can also be a document an administrator uploads (PDF or Word .docx).
Its bytes go through the same storage and the same checks as an idea attachment - an
allow-list of extensions, the file's own leading bytes, the size limit, a server-generated
key - and leave only through `marketplace.views`, to the same people who may read the
documentation.
"""

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import timedelta
from pathlib import PurePosixPath

from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from administration import authorization as admin_authorization
from administration import services as admin_services
from administration.models import AdminAuditEntry
from ideas import attachments as file_rules
from ideas import storage
from identity.models import User
from marketplace import gateways
from marketplace.models import (
    COLLECTION_CHOICES,
    CURRENCY,
    PAYMENT_KIND_CHOICES,
    Enquiry,
    EnquiryMessage,
    MarketIdea,
    PaymentMethod,
    Purchase,
)
from organizations.authorization import AuthorizationError

#: The most a price may be, in whole TZS - a guard against a slip of the keyboard.
MAX_PRICE = 100_000_000
UNAVAILABLE = 'This idea is not available.'
NEEDS_DOCUMENTATION = 'Write the documentation or upload a document before it goes on sale.'

#: The documents a buyer can be given: the extension, and the type recorded for it. Formats
#: a browser can preview - the legacy binary `.doc` is not one of them.
DOCUMENT_TYPES = {ext: file_rules.ALLOWED_ATTACHMENT_TYPES[ext] for ext in ('.pdf', '.docx')}

#: How long a buyer has to approve a payment prompt before it is given up on.
PUSH_TIMEOUT = timedelta(minutes=3)
IN_PROGRESS = ('awaiting', 'pending')

logger = logging.getLogger(__name__)


class MarketplaceError(AuthorizationError):
    """A refused marketplace operation, in the project's `(message, field, reason)` shape."""

    def __init__(self, message: str, field: str | None = None, reason: str = 'forbidden'):
        super().__init__(message, reason=reason, field=field)


def can_manage(user: User | None) -> bool:
    return admin_authorization.capabilities_for(user).can_manage_marketplace


def _require_manager(user: User | None) -> User:
    if not can_manage(user):
        raise MarketplaceError('You cannot manage the marketplace.')
    return user


def _require_user(user: User | None) -> User:
    if user is None or not user.is_active:
        raise MarketplaceError('Sign in to continue.', reason='unauthenticated')
    return user


def _text(value: str | None, field: str, *, required: bool = False, limit: int | None = None):
    text = (value or '').strip()
    if required and not text:
        raise MarketplaceError(f'{field.replace("_", " ").capitalize()} is required.', field=field)
    if limit is not None and len(text) > limit:
        raise MarketplaceError(
            f'{field.replace("_", " ").capitalize()} must be {limit} characters or fewer.',
            field=field,
        )
    return text


def _price(value: object) -> int:
    try:
        price = int(str(value).replace(',', '').strip())
    except (TypeError, ValueError):
        raise MarketplaceError(f'Enter the price in whole {CURRENCY}.', field='price') from None
    if price < 0 or price > MAX_PRICE:
        raise MarketplaceError(
            f'The price must be between 0 and {MAX_PRICE:,} {CURRENCY}.', field='price'
        )
    return price


def _audit(actor, action, target_type, target_id, label, **meta) -> None:
    admin_services.record_event(actor, action, target_type, target_id, label[:255], metadata=meta)


def _notify(recipients, kind, title, body) -> None:
    from notifications import services as notifications

    people = [p for p in recipients if p is not None and p.is_active]
    if people:
        notifications.deliver(
            recipients=people, kind=kind, title=title, body=body, send_email=False
        )


def _managers() -> list[User]:
    codename = admin_authorization.MANAGE_MARKETPLACE.split('.', 1)[1]
    return list(
        User.objects.filter(is_active=True)
        .filter(Q(groups__permissions__codename=codename) | Q(user_permissions__codename=codename))
        .distinct()
    )


# --- ideas for sale (administrators) -----------------------------------------------------------


@dataclass(frozen=True)
class IdeaInput:
    title: str
    summary: str
    documentation: str
    price: object


def _apply(idea: MarketIdea, data: IdeaInput) -> None:
    idea.title = _text(data.title, 'title', required=True, limit=200)
    idea.summary = _text(data.summary, 'summary', required=True)
    idea.documentation = _text(data.documentation, 'documentation')
    idea.price = _price(data.price)


def _require_documentation(idea: MarketIdea) -> None:
    """An idea on sale always has something to unlock: written text, a document, or both."""
    if not idea.has_documentation:
        raise MarketplaceError(NEEDS_DOCUMENTATION, field='documentation')


@transaction.atomic
def create_idea(user, data: IdeaInput) -> MarketIdea:
    _require_manager(user)
    idea = MarketIdea(created_by=user)
    _apply(idea, data)
    idea.save()
    return idea


def _locked_idea(idea_id) -> MarketIdea:
    try:
        pk = int(str(idea_id))
    except (TypeError, ValueError):
        raise MarketplaceError(UNAVAILABLE) from None
    idea = MarketIdea.objects.select_for_update().filter(pk=pk).first()
    if idea is None:
        raise MarketplaceError(UNAVAILABLE)
    return idea


@transaction.atomic
def update_idea(user, idea_id, data: IdeaInput) -> MarketIdea:
    _require_manager(user)
    idea = _locked_idea(idea_id)
    _apply(idea, data)
    if idea.status == 'published':
        _require_documentation(idea)
    idea.save()
    return idea


@transaction.atomic
def publish_idea(user, idea_id) -> MarketIdea:
    _require_manager(user)
    idea = _locked_idea(idea_id)
    if idea.status == 'published':
        raise MarketplaceError('This idea is already published.')
    _require_documentation(idea)
    if not active_methods() and idea.price > 0:
        raise MarketplaceError(
            'Add a payment method first, so buyers have somewhere to pay.', field='method'
        )
    idea.status = 'published'
    idea.published_at = idea.published_at or timezone.now()
    idea.save(update_fields=['status', 'published_at', 'updated_at'])
    _audit(
        user, AdminAuditEntry.Action.MARKETPLACE_IDEA_PUBLISHED, 'market_idea', idea.pk, idea.title
    )
    return idea


@transaction.atomic
def unpublish_idea(user, idea_id) -> MarketIdea:
    _require_manager(user)
    idea = _locked_idea(idea_id)
    if idea.status != 'published':
        raise MarketplaceError('Only a published idea can be withdrawn.')
    idea.status = 'unpublished'
    idea.save(update_fields=['status', 'updated_at'])
    _audit(
        user,
        AdminAuditEntry.Action.MARKETPLACE_IDEA_UNPUBLISHED,
        'market_idea',
        idea.pk,
        idea.title,
    )
    return idea


def all_ideas(user) -> list[MarketIdea]:
    if not can_manage(user):
        return []
    return list(MarketIdea.objects.all())


# --- the document a buyer unlocks (administrators upload, buyers download) ---------------------


def authorize_document_upload(user, idea_id) -> MarketIdea:
    """
    Whether `user` may change `idea_id`'s document, asked *before* the upload is read - the
    same early exit `ideas.views` takes, so a caller with no standing never makes the server
    parse a multipart body. `upload_document` applies the same check again.
    """
    _require_manager(user)
    idea = get_idea(user, idea_id)
    if idea is None:
        raise MarketplaceError(UNAVAILABLE)
    return idea


def upload_document(user, idea_id, uploaded) -> MarketIdea:
    """
    Store `uploaded` as the idea's document, replacing any earlier one.

    The file is checked in full before it touches storage, then written before the row
    points at it - a failed save removes the object just written, and the earlier document
    is removed only once the new one is committed, so the idea never points at nothing.
    """
    idea = authorize_document_upload(user, idea_id)
    try:
        name = file_rules.safe_display_filename(uploaded.name)
        extension = PurePosixPath(name).suffix.lower()
        if extension not in DOCUMENT_TYPES:
            raise file_rules.AttachmentValidationError(
                'Upload the document as a PDF or a Word (.docx) file.'
            )
        file_rules.validate_size(uploaded.size)
        head = uploaded.read(file_rules.SNIFF_BYTES)
        uploaded.seek(0)
        file_rules.validate_content(extension, head)
    except file_rules.AttachmentValidationError as exc:
        raise MarketplaceError(exc.message, field='document') from exc

    key = f'marketplace/{idea.pk}/{uuid.uuid4().hex}{extension}'
    try:
        saved_key = storage.save_object(key, uploaded)
    except storage.AttachmentStorageError as exc:
        raise MarketplaceError(
            'The document could not be stored. Please try again.', reason='storage_unavailable'
        ) from exc

    try:
        with transaction.atomic():
            idea = _locked_idea(idea.pk)
            previous = idea.document_key
            idea.document_key = saved_key
            idea.document_name = name
            idea.document_content_type = DOCUMENT_TYPES[extension]
            idea.document_size = uploaded.size
            idea.document_uploaded_at = timezone.now()
            idea.save()
            if previous:
                transaction.on_commit(lambda: storage.delete_object(previous))
    except (DatabaseError, MarketplaceError):
        storage.delete_object(saved_key)
        raise
    return idea


@transaction.atomic
def remove_document(user, idea_id) -> MarketIdea:
    """Take the document off the idea. An idea on sale keeps something to unlock."""
    _require_manager(user)
    idea = _locked_idea(idea_id)
    previous = idea.document_key
    if not previous:
        raise MarketplaceError('This idea has no document.', field='document')
    idea.document_key = ''
    idea.document_name = ''
    idea.document_content_type = ''
    idea.document_size = 0
    idea.document_uploaded_at = None
    if idea.status == 'published' and not idea.has_documentation:
        raise MarketplaceError(
            'An idea on sale needs its documentation: upload a replacement, or write the '
            'documentation first.',
            field='document',
        )
    idea.save()
    transaction.on_commit(lambda: storage.delete_object(previous))
    return idea


def document_for(user, idea_id) -> MarketIdea | None:
    """The idea, when it has a document and `user` may read it; `None` for every other case."""
    idea = get_idea(user, idea_id)
    if idea is None or not idea.document_key or not has_access(user, idea):
        return None
    return idea


# --- payment methods (administrators) ----------------------------------------------------------


@dataclass(frozen=True)
class MethodInput:
    kind: str
    provider: str
    account_name: str
    account_number: str
    instructions: str = ''
    collection: str = 'manual'


def _apply_method(method: PaymentMethod, data: MethodInput) -> None:
    if data.kind not in dict(PAYMENT_KIND_CHOICES):
        raise MarketplaceError('Choose mobile money or bank transfer.', field='kind')
    if data.collection not in dict(COLLECTION_CHOICES):
        raise MarketplaceError('Choose how the payment is collected.', field='collection')
    if data.collection == 'push' and data.kind != 'mobile_money':
        raise MarketplaceError(
            'Only mobile money can send a payment prompt to the phone.', field='collection'
        )
    if data.collection == 'card' and data.kind != 'bank':
        raise MarketplaceError('Card payments are a bank method.', field='collection')
    through_gateway = data.collection in ('push', 'card')
    method.kind = data.kind
    method.collection = data.collection
    method.provider = _text(data.provider, 'provider', required=True, limit=80)
    method.account_name = _text(data.account_name, 'account_name', required=True, limit=120)
    # A push or a card payment goes to the gateway's merchant account: no number to type.
    method.account_number = _text(
        data.account_number, 'account_number', required=not through_gateway, limit=60
    )
    method.instructions = _text(data.instructions, 'instructions')


@transaction.atomic
def create_method(user, data: MethodInput) -> PaymentMethod:
    _require_manager(user)
    method = PaymentMethod()
    _apply_method(method, data)
    method.save()
    return method


def _locked_method(method_id) -> PaymentMethod:
    try:
        pk = int(str(method_id))
    except (TypeError, ValueError):
        raise MarketplaceError('This payment method is not available.') from None
    method = PaymentMethod.objects.select_for_update().filter(pk=pk).first()
    if method is None:
        raise MarketplaceError('This payment method is not available.')
    return method


@transaction.atomic
def update_method(user, method_id, data: MethodInput) -> PaymentMethod:
    _require_manager(user)
    method = _locked_method(method_id)
    _apply_method(method, data)
    method.save()
    return method


@transaction.atomic
def set_method_active(user, method_id, active: bool) -> PaymentMethod:
    _require_manager(user)
    method = _locked_method(method_id)
    method.is_active = active
    method.save(update_fields=['is_active', 'updated_at'])
    return method


def push_available() -> bool:
    """Whether a gateway is set up to send payment prompts."""
    return gateways.get_gateway() is not None


def active_methods() -> list[PaymentMethod]:
    """The methods a buyer can use now: push and card only while the gateway takes them."""
    queryset = PaymentMethod.objects.filter(is_active=True)
    if not push_available():
        queryset = queryset.exclude(collection='push')
    if not card_payments_available():
        queryset = queryset.exclude(collection='card')
    return list(queryset)


def all_methods(user) -> list[PaymentMethod]:
    return list(PaymentMethod.objects.all()) if can_manage(user) else []


# --- buying (everyone signed in) --------------------------------------------------------------


def has_access(user, idea: MarketIdea) -> bool:
    """Whether `user` may read `idea`'s documentation: a confirmed purchase, or a manager."""
    if user is None or not user.is_active:
        return False
    if can_manage(user):
        return True
    return Purchase.objects.filter(idea=idea, buyer=user, status='confirmed').exists()


def published_ideas(user) -> list[MarketIdea]:
    if user is None or not user.is_active:
        return []
    return list(MarketIdea.objects.filter(status='published'))


def get_idea(user, idea_id) -> MarketIdea | None:
    """A published idea - or any idea, for a manager - or `None`."""
    if user is None or not user.is_active:
        return None
    try:
        pk = int(str(idea_id))
    except (TypeError, ValueError):
        return None
    queryset = (
        MarketIdea.objects.all()
        if can_manage(user)
        else MarketIdea.objects.filter(status='published')
    )
    return queryset.filter(pk=pk).first()


def latest_purchase(user, idea: MarketIdea) -> Purchase | None:
    if user is None:
        return None
    return Purchase.objects.filter(idea=idea, buyer=user).select_related('method').first()


@transaction.atomic
def submit_payment(
    user, idea_id, *, method_id, payer_name, payer_account, transaction_reference
) -> Purchase:
    """The buyer says they have paid; an administrator confirms it against the statement."""
    _require_user(user)
    idea = MarketIdea.objects.select_for_update().filter(pk=int(str(idea_id))).first()
    if idea is None or idea.status != 'published':
        raise MarketplaceError(UNAVAILABLE)
    if has_access(user, idea):
        raise MarketplaceError('You already have access to this idea.')
    _expire_stale_pushes(user, idea)
    if Purchase.objects.filter(idea=idea, buyer=user, status__in=IN_PROGRESS).exists():
        raise MarketplaceError('Your payment for this idea is already waiting for confirmation.')
    method = PaymentMethod.objects.filter(
        pk=int(str(method_id)), is_active=True, collection='manual'
    ).first()
    if method is None:
        raise MarketplaceError('Choose how you paid.', field='method')

    try:
        with transaction.atomic():
            purchase = Purchase.objects.create(
                idea=idea,
                buyer=user,
                amount=idea.price,
                method=method,
                payer_name=_text(payer_name, 'payer_name', required=True, limit=120),
                payer_account=_text(payer_account, 'payer_account', required=True, limit=60),
                transaction_reference=_text(
                    transaction_reference, 'transaction_reference', required=True, limit=80
                ),
            )
    except IntegrityError:
        raise MarketplaceError(
            'Your payment for this idea is already waiting for confirmation.'
        ) from None
    _notify(
        [m for m in _managers() if m.pk != user.pk],
        'marketplace.payment_submitted',
        'A marketplace payment is waiting for confirmation',
        f'{user.get_full_name() or user.email} paid {purchase.amount:,} {CURRENCY} for '
        f'"{idea.title}" by {method.provider} (reference {purchase.transaction_reference}).',
    )
    return purchase


# --- paying by a prompt on the phone (everyone signed in) -------------------------------------

_TZ_MOBILE = re.compile(r'^(?:\+?255|0)?([67]\d{8})$')


def normalize_phone(value: str | None) -> str:
    """A Tanzanian mobile number as the gateways want it, `2557XXXXXXXX`, or a refusal."""
    digits = re.sub(r'[\s\-()]', '', value or '')
    match = _TZ_MOBILE.match(digits)
    if not match:
        raise MarketplaceError(
            'Enter the mobile number that will pay, e.g. 0712 345 678.', field='phone_number'
        )
    return f'255{match.group(1)}'


def _expire_stale_pushes(user, idea) -> None:
    """A prompt nobody answered in time is given up on, so the buyer can try again."""
    Purchase.objects.filter(
        idea=idea,
        buyer=user,
        status='awaiting',
        created_at__lt=timezone.now() - PUSH_TIMEOUT,
    ).update(
        status='failed',
        review_note='The payment request expired before it was approved.',
        decided_at=timezone.now(),
    )


def _open_gateway_purchase(
    user, idea_id, method_id, *, collection, gateway, payer_name, payer_account, busy
) -> Purchase:
    """
    A purchase waiting on the gateway, after every check a buyer's payment needs: the idea
    on sale and not theirs already, no other payment in progress, the method usable.
    """
    try:
        idea_pk, method_pk = int(str(idea_id)), int(str(method_id))
    except (TypeError, ValueError):
        raise MarketplaceError(UNAVAILABLE) from None
    with transaction.atomic():
        idea = MarketIdea.objects.select_for_update().filter(pk=idea_pk).first()
        if idea is None or idea.status != 'published':
            raise MarketplaceError(UNAVAILABLE)
        if has_access(user, idea):
            raise MarketplaceError('You already have access to this idea.')
        _expire_stale_pushes(user, idea)
        if Purchase.objects.filter(idea=idea, buyer=user, status='awaiting').exists():
            raise MarketplaceError(busy)
        if Purchase.objects.filter(idea=idea, buyer=user, status='pending').exists():
            raise MarketplaceError(
                'Your payment for this idea is already waiting for confirmation.'
            )
        method = PaymentMethod.objects.filter(
            pk=method_pk, is_active=True, collection=collection
        ).first()
        if method is None:
            raise MarketplaceError('Choose how you want to pay.', field='method')
        return Purchase.objects.create(
            idea=idea,
            buyer=user,
            amount=idea.price,
            method=method,
            payer_name=payer_name[:120],
            payer_account=payer_account[:60],
            status='awaiting',
            gateway=gateway.name,
        )


def start_push_payment(user, idea_id, *, method_id, phone_number) -> Purchase:
    """
    Send a payment prompt to the buyer's phone. The purchase waits, `awaiting`, until the
    gateway reports the outcome - by its callback or when asked (`refresh_purchase`).
    """
    _require_user(user)
    gateway = gateways.get_gateway()
    if gateway is None:
        raise MarketplaceError(
            'Paying by phone prompt is not available right now. Choose another method.',
            field='method',
        )
    phone = normalize_phone(phone_number)
    purchase = _open_gateway_purchase(
        user,
        idea_id,
        method_id,
        collection='push',
        gateway=gateway,
        payer_name=user.get_full_name() or user.email,
        payer_account=phone,
        busy='A payment request is already on your phone. Approve it, or wait a few '
        'minutes and try again.',
    )

    # The gateway is called outside the transaction: it is a network call, and the
    # purchase must exist for its answer to find.
    try:
        reference = gateway.start(purchase, phone)
    except gateways.GatewayError as exc:
        _settle(purchase.pk, gateways.PushOutcome('', approved=False, message=str(exc)))
        raise MarketplaceError(str(exc)) from exc
    purchase.gateway_reference = reference
    purchase.save(update_fields=['gateway_reference'])
    return purchase


def card_payments_available() -> bool:
    """Whether the gateway takes cards."""
    gateway = gateways.get_gateway()
    return bool(gateway and getattr(gateway, 'supports_cards', False))


def start_card_payment(
    user, idea_id, *, method_id, card_token, cardholder_name, card_label=''
) -> Purchase:
    """
    Charge a card. **The card's number and security code never reach this server**: the
    browser hands them to the gateway, which returns `card_token`; `card_label` ("Visa ••••
    4242") is only for display. Most charges are settled at once; one the bank wants to
    verify first stays `awaiting` like a phone prompt.
    """
    _require_user(user)
    gateway = gateways.get_gateway()
    if not card_payments_available():
        raise MarketplaceError(
            'Card payments are not available right now. Choose another method.', field='method'
        )
    holder = _text(cardholder_name, 'cardholder_name', required=True, limit=120)
    label = _text(card_label, 'card_label', limit=60) or 'Card'
    token = (card_token or '').strip()
    if not token:
        raise MarketplaceError('The card could not be read. Check the details.', field='card')
    purchase = _open_gateway_purchase(
        user,
        idea_id,
        method_id,
        collection='card',
        gateway=gateway,
        payer_name=holder,
        payer_account=label,
        busy='A card payment for this idea is already being processed.',
    )
    try:
        reference, outcome = gateway.charge_card(purchase, token)
    except gateways.GatewayError as exc:
        _settle(purchase.pk, gateways.PushOutcome('', approved=False, message=str(exc)))
        raise MarketplaceError(str(exc)) from exc
    purchase.gateway_reference = reference
    purchase.save(update_fields=['gateway_reference'])
    return _settle(purchase.pk, outcome) if outcome else purchase


@transaction.atomic
def _settle(purchase_pk: int, outcome: gateways.PushOutcome) -> Purchase:
    """Record how a push ended. Only a waiting purchase changes, so answers can repeat."""
    purchase = (
        Purchase.objects.select_for_update().select_related('idea', 'buyer').get(pk=purchase_pk)
    )
    if purchase.status != 'awaiting':
        return purchase
    purchase.decided_at = timezone.now()
    if outcome.approved:
        purchase.status = 'confirmed'
        purchase.transaction_reference = (outcome.receipt or purchase.gateway_reference)[:80]
        purchase.save(update_fields=['status', 'transaction_reference', 'decided_at'])
        _notify(
            [purchase.buyer],
            'marketplace.payment_confirmed',
            'Payment received',
            f'You can now read the full documentation of "{purchase.idea.title}".',
        )
    else:
        purchase.status = 'failed'
        purchase.review_note = outcome.message or 'The payment was not approved.'
        purchase.save(update_fields=['status', 'review_note', 'decided_at'])
    return purchase


def refresh_purchase(user, purchase_id) -> Purchase | None:
    """
    The buyer's own purchase, brought up to date: a prompt left unanswered too long is
    given up on, and the gateway is asked about one still waiting.
    """
    if user is None or not user.is_active:
        return None
    try:
        pk = int(str(purchase_id))
    except (TypeError, ValueError):
        return None
    purchase = Purchase.objects.select_related('idea', 'method').filter(pk=pk, buyer=user).first()
    if purchase is None or purchase.status != 'awaiting':
        return purchase
    if timezone.now() - purchase.created_at > PUSH_TIMEOUT:
        return _settle(
            purchase.pk,
            gateways.PushOutcome(
                purchase.gateway_reference,
                approved=False,
                message='The payment request expired before it was approved.',
            ),
        )
    gateway = gateways.get_gateway()
    if gateway is None or gateway.name != purchase.gateway or not purchase.gateway_reference:
        return purchase
    try:
        outcome = gateway.check(purchase)
    except gateways.GatewayError:
        logger.warning('Could not check push payment %s', purchase.pk, exc_info=True)
        return purchase
    return _settle(purchase.pk, outcome) if outcome else purchase


def handle_gateway_callback(request) -> bool:
    """The gateway's report of an outcome. False for anything it cannot vouch for."""
    gateway = gateways.get_gateway()
    outcome = gateway.parse_callback(request) if gateway else None
    if outcome is None or not outcome.reference:
        return False
    purchase = Purchase.objects.filter(
        gateway=gateway.name, gateway_reference=outcome.reference
    ).first()
    if purchase is None:
        return False
    _settle(purchase.pk, outcome)
    return True


def my_purchases(user) -> list[Purchase]:
    if user is None or not user.is_active:
        return []
    return list(Purchase.objects.filter(buyer=user).select_related('idea', 'method'))


# --- confirming payments (administrators) -----------------------------------------------------


def payments(user, *, status: str | None = None) -> list[Purchase]:
    if not can_manage(user):
        return []
    queryset = Purchase.objects.select_related('idea', 'buyer', 'method', 'decided_by')
    if status:
        queryset = queryset.filter(status=status)
    return list(queryset)


def _locked_purchase(purchase_id) -> Purchase:
    try:
        pk = int(str(purchase_id))
    except (TypeError, ValueError):
        raise MarketplaceError('This payment is not available.') from None
    purchase = (
        Purchase.objects.select_for_update().select_related('idea', 'buyer').filter(pk=pk).first()
    )
    if purchase is None:
        raise MarketplaceError('This payment is not available.')
    return purchase


@transaction.atomic
def confirm_payment(user, purchase_id, *, note='') -> Purchase:
    _require_manager(user)
    purchase = _locked_purchase(purchase_id)
    if purchase.status != 'pending':
        raise MarketplaceError('Only a payment waiting for confirmation can be confirmed.')
    purchase.status = 'confirmed'
    purchase.review_note = _text(note, 'note')
    purchase.decided_by, purchase.decided_at = user, timezone.now()
    purchase.save(update_fields=['status', 'review_note', 'decided_by', 'decided_at'])
    _audit(
        user,
        AdminAuditEntry.Action.MARKETPLACE_PAYMENT_CONFIRMED,
        'market_purchase',
        purchase.pk,
        f'{purchase.idea.title} - {purchase.buyer.email}',
        amount=purchase.amount,
        reference=purchase.transaction_reference,
    )
    _notify(
        [purchase.buyer],
        'marketplace.payment_confirmed',
        'Your payment was confirmed',
        f'You can now read the full documentation of "{purchase.idea.title}".',
    )
    return purchase


@transaction.atomic
def reject_payment(user, purchase_id, *, note) -> Purchase:
    _require_manager(user)
    purchase = _locked_purchase(purchase_id)
    if purchase.status != 'pending':
        raise MarketplaceError('Only a payment waiting for confirmation can be rejected.')
    reason = _text(note, 'note')
    if not reason:
        raise MarketplaceError('Say why the payment cannot be confirmed.', field='note')
    purchase.status = 'rejected'
    purchase.review_note = reason
    purchase.decided_by, purchase.decided_at = user, timezone.now()
    purchase.save(update_fields=['status', 'review_note', 'decided_by', 'decided_at'])
    _audit(
        user,
        AdminAuditEntry.Action.MARKETPLACE_PAYMENT_REJECTED,
        'market_purchase',
        purchase.pk,
        f'{purchase.idea.title} - {purchase.buyer.email}',
        amount=purchase.amount,
        reference=purchase.transaction_reference,
    )
    _notify(
        [purchase.buyer],
        'marketplace.payment_rejected',
        'Your payment could not be confirmed',
        f'Your payment for "{purchase.idea.title}" could not be confirmed: {reason}',
    )
    return purchase


# --- enquiries: buyers asking the team about an idea ------------------------------------------

ENQUIRY_MAX_LENGTH = 2000


def _message_body(value: str | None) -> str:
    body = (value or '').strip()
    if not body:
        raise MarketplaceError('Write your message first.', field='body')
    if len(body) > ENQUIRY_MAX_LENGTH:
        raise MarketplaceError(
            f'Keep the message to {ENQUIRY_MAX_LENGTH:,} characters or fewer.', field='body'
        )
    return body


def _excerpt(body: str, limit: int = 160) -> str:
    return body if len(body) <= limit else f'{body[: limit - 1]}…'


def my_enquiry(user, idea_id) -> Enquiry | None:
    """The reader's own conversation about an idea they can see, now marked read."""
    idea = get_idea(user, idea_id)
    if idea is None:
        return None
    enquiry = Enquiry.objects.filter(idea=idea, buyer=user).first()
    if enquiry is not None:
        enquiry.buyer_read_at = timezone.now()
        enquiry.save(update_fields=['buyer_read_at'])
    return enquiry


def send_enquiry(user, idea_id, body) -> Enquiry:
    """A buyer asks the team about an idea. Everyone who manages the marketplace is told."""
    _require_user(user)
    idea = get_idea(user, idea_id)
    if idea is None:
        raise MarketplaceError(UNAVAILABLE)
    if can_manage(user):
        raise MarketplaceError('Answer buyers from the Enquiries page in the console.')
    text = _message_body(body)
    now = timezone.now()
    with transaction.atomic():
        enquiry, _ = Enquiry.objects.select_for_update().get_or_create(
            idea=idea, buyer=user, defaults={'latest_message_at': now}
        )
        EnquiryMessage.objects.create(enquiry=enquiry, author=user, body=text)
        enquiry.latest_message_at = now
        enquiry.awaiting_reply = True
        enquiry.buyer_read_at = now
        enquiry.save(update_fields=['latest_message_at', 'awaiting_reply', 'buyer_read_at'])
    _notify(
        _managers(),
        'marketplace.enquiry_received',
        f'A question about "{idea.title}"',
        f'{user.get_full_name() or user.email}: {_excerpt(text)}',
    )
    return enquiry


def enquiries(user) -> list[Enquiry]:
    """Every conversation, those waiting for an answer first. Empty without the permission."""
    if not can_manage(user):
        return []
    return list(
        Enquiry.objects.select_related('idea', 'buyer')
        .prefetch_related('messages__author')
        .order_by('-awaiting_reply', '-latest_message_at', '-pk')
    )


def reply_enquiry(user, enquiry_id, body) -> Enquiry:
    """The team answers. The buyer is told."""
    _require_manager(user)
    text = _message_body(body)
    try:
        pk = int(str(enquiry_id))
    except (TypeError, ValueError):
        raise MarketplaceError('This conversation is not available.') from None
    with transaction.atomic():
        enquiry = (
            Enquiry.objects.select_for_update()
            .select_related('idea', 'buyer')
            .filter(pk=pk)
            .first()
        )
        if enquiry is None:
            raise MarketplaceError('This conversation is not available.')
        EnquiryMessage.objects.create(enquiry=enquiry, author=user, body=text, from_team=True)
        enquiry.latest_message_at = timezone.now()
        enquiry.awaiting_reply = False
        enquiry.save(update_fields=['latest_message_at', 'awaiting_reply'])
    _notify(
        [enquiry.buyer],
        'marketplace.enquiry_answered',
        f'The team answered your question about "{enquiry.idea.title}"',
        _excerpt(text),
    )
    return enquiry
