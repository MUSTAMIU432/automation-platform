"""
GraphQL for the marketplace.

What is shown to whom is `marketplace.services`' to decide; this module asks and reports.
An idea's `documentation` and `document` are null unless the reader has access to them.
A refusal is a `success: false` payload naming its field, like every other domain.
"""

from datetime import datetime

import strawberry
from django.db.models import Sum

from marketplace import services
from marketplace.models import CURRENCY, Enquiry, MarketIdea, PaymentMethod, Purchase
from marketplace.services import MarketplaceError
from marketplace.views import document_path


def _id(value) -> strawberry.ID:
    return strawberry.ID(str(value))


def _camel(name: str | None) -> str | None:
    if not name:
        return None
    head, *rest = name.split('_')
    return head + ''.join(part.capitalize() for part in rest)


def _name(user) -> str | None:
    return (user.get_full_name() or user.email) if user else None


@strawberry.type
class PaymentMethodType:
    id: strawberry.ID
    kind: str
    collection: str = strawberry.field(
        description="'push': a prompt on the buyer's phone; 'manual': the buyer sends the money."
    )
    provider: str
    account_name: str
    account_number: str
    instructions: str
    is_active: bool


def _method(m: PaymentMethod) -> PaymentMethodType:
    return PaymentMethodType(
        id=_id(m.pk),
        kind=m.kind,
        collection=m.collection,
        provider=m.provider,
        account_name=m.account_name,
        account_number=m.account_number,
        instructions=m.instructions,
        is_active=m.is_active,
    )


@strawberry.type
class PurchaseType:
    id: strawberry.ID
    idea_id: strawberry.ID
    idea_title: str
    buyer_name: str
    buyer_email: str
    amount: int
    currency: str
    method: PaymentMethodType
    payer_name: str
    payer_account: str
    transaction_reference: str
    status: str
    review_note: str
    decided_by_name: str | None
    decided_at: datetime | None
    created_at: datetime


def _purchase(p: Purchase) -> PurchaseType:
    return PurchaseType(
        id=_id(p.pk),
        idea_id=_id(p.idea_id),
        idea_title=p.idea.title,
        buyer_name=_name(p.buyer),
        buyer_email=p.buyer.email,
        amount=p.amount,
        currency=CURRENCY,
        method=_method(p.method),
        payer_name=p.payer_name,
        payer_account=p.payer_account,
        transaction_reference=p.transaction_reference,
        status=p.status,
        review_note=p.review_note,
        decided_by_name=_name(p.decided_by),
        decided_at=p.decided_at,
        created_at=p.created_at,
    )


@strawberry.type
class MarketDocumentType:
    """The uploaded document; its bytes come from `downloadPath`, with the bearer token."""

    filename: str
    content_type: str
    size: int
    uploaded_at: datetime | None
    download_path: str


def _document(i: MarketIdea) -> MarketDocumentType | None:
    if not i.document_key:
        return None
    return MarketDocumentType(
        filename=i.document_name,
        content_type=i.document_content_type,
        size=i.document_size,
        uploaded_at=i.document_uploaded_at,
        download_path=document_path(i.pk),
    )


@strawberry.type
class MarketDocumentInfoType:
    """What the document is, shown before buying so a buyer knows what they get."""

    filename: str
    format: str = strawberry.field(description="'PDF' or 'Word'.")
    size: int


def _document_info(i: MarketIdea) -> MarketDocumentInfoType | None:
    if not i.document_key:
        return None
    pdf = i.document_content_type == 'application/pdf'
    return MarketDocumentInfoType(
        filename=i.document_name, format='PDF' if pdf else 'Word', size=i.document_size
    )


@strawberry.type
class MarketIdeaType:
    id: strawberry.ID
    title: str
    summary: str
    price: int
    currency: str
    status: str
    published_at: datetime | None
    updated_at: datetime
    has_access: bool
    documentation: str | None = strawberry.field(
        description='The full documentation: null unless the reader has paid for it.'
    )
    has_document: bool = strawberry.field(
        description='Whether a document comes with the idea; shown to everyone.'
    )
    document: MarketDocumentType | None = strawberry.field(
        description='The uploaded document: null unless the reader has paid for it.'
    )
    document_info: MarketDocumentInfoType | None = strawberry.field(
        description="The document's name, format and size - never its content; shown to everyone."
    )
    has_written_documentation: bool = strawberry.field(
        description='Whether written documentation comes with the idea; shown to everyone.'
    )
    my_purchase: PurchaseType | None = strawberry.field(
        description="The reader's latest payment for this idea, if any."
    )
    purchases_confirmed: int = strawberry.field(
        description='How many buyers have paid; for administrators only (0 otherwise).'
    )
    revenue: int = strawberry.field(
        description='What confirmed payments add up to, in whole TZS; administrators only.'
    )
    payments_waiting: int = strawberry.field(
        description='Payments waiting for confirmation; administrators only.'
    )


def _idea(i: MarketIdea, user) -> MarketIdeaType:
    access = services.has_access(user, i)
    mine = services.latest_purchase(user, i)
    manager = services.can_manage(user)
    return MarketIdeaType(
        id=_id(i.pk),
        title=i.title,
        summary=i.summary,
        price=i.price,
        currency=CURRENCY,
        status=i.status,
        published_at=i.published_at,
        updated_at=i.updated_at,
        has_access=access,
        documentation=i.documentation if access else None,
        has_document=bool(i.document_key),
        document=_document(i) if access else None,
        document_info=_document_info(i),
        has_written_documentation=bool(i.documentation.strip()),
        my_purchase=_purchase(mine) if mine else None,
        purchases_confirmed=i.purchases.filter(status='confirmed').count() if manager else 0,
        revenue=(
            i.purchases.filter(status='confirmed').aggregate(total=Sum('amount'))['total'] or 0
        )
        if manager
        else 0,
        payments_waiting=i.purchases.filter(status='pending').count() if manager else 0,
    )


@strawberry.type
class MarketIdeaPayload:
    success: bool
    message: str
    field: str | None = None
    idea: MarketIdeaType | None = None


@strawberry.type
class PaymentMethodPayload:
    success: bool
    message: str
    field: str | None = None
    method: PaymentMethodType | None = None


@strawberry.type
class PurchasePayload:
    success: bool
    message: str
    field: str | None = None
    purchase: PurchaseType | None = None


@strawberry.type
class EnquiryMessageType:
    id: strawberry.ID
    body: str
    from_team: bool
    author_name: str
    created_at: datetime


@strawberry.type
class EnquiryType:
    """A buyer's conversation with the marketplace team about one idea."""

    id: strawberry.ID
    idea_id: strawberry.ID
    idea_title: str
    buyer_name: str
    buyer_email: str
    awaiting_reply: bool
    latest_message_at: datetime
    messages: list[EnquiryMessageType]


def _enquiry(e: Enquiry) -> EnquiryType:
    return EnquiryType(
        id=_id(e.pk),
        idea_id=_id(e.idea_id),
        idea_title=e.idea.title,
        buyer_name=_name(e.buyer),
        buyer_email=e.buyer.email,
        awaiting_reply=e.awaiting_reply,
        latest_message_at=e.latest_message_at,
        messages=[
            EnquiryMessageType(
                id=_id(m.pk),
                body=m.body,
                from_team=m.from_team,
                author_name=_name(m.author),
                created_at=m.created_at,
            )
            for m in e.messages.all()
        ],
    )


@strawberry.type
class EnquiryPayload:
    success: bool
    message: str
    field: str | None = None
    enquiry: EnquiryType | None = None


@strawberry.input
class MarketIdeaInput:
    title: str
    summary: str
    price: int
    documentation: str = ''


@strawberry.input
class PaymentMethodInput:
    kind: str
    provider: str
    account_name: str
    account_number: str
    instructions: str = ''
    collection: str = 'manual'


@strawberry.input
class MarketPaymentInput:
    idea_id: strawberry.ID
    method_id: strawberry.ID
    payer_name: str
    payer_account: str
    transaction_reference: str


@strawberry.input
class MarketCardPaymentInput:
    """A card payment: the gateway's one-time token, never the card's own details."""

    idea_id: strawberry.ID
    method_id: strawberry.ID
    card_token: str
    cardholder_name: str
    card_label: str = ''


@strawberry.input
class MarketPushPaymentInput:
    idea_id: strawberry.ID
    method_id: strawberry.ID
    phone_number: str


def _refused(cls, exc: MarketplaceError):
    return cls(success=False, message=exc.message, field=_camel(exc.field))


@strawberry.type
class Query:
    @strawberry.field(description='Published ideas, for everyone signed in.')
    def market_ideas(self, info: strawberry.Info) -> list[MarketIdeaType]:
        user = info.context.user
        return [_idea(i, user) for i in services.published_ideas(user)]

    @strawberry.field(description='One idea, or null when it is not available to the caller.')
    def market_idea(self, info: strawberry.Info, id: strawberry.ID) -> MarketIdeaType | None:
        user = info.context.user
        idea = services.get_idea(user, id)
        return _idea(idea, user) if idea else None

    @strawberry.field(description='Where buyers can pay. Active methods only.')
    def market_payment_methods(self, info: strawberry.Info) -> list[PaymentMethodType]:
        if info.context.user is None:
            return []
        return [_method(m) for m in services.active_methods()]

    @strawberry.field(
        description="One of the caller's own payments, brought up to date with the gateway."
    )
    def market_purchase(self, info: strawberry.Info, id: strawberry.ID) -> PurchaseType | None:
        purchase = services.refresh_purchase(info.context.user, id)
        return _purchase(purchase) if purchase else None

    @strawberry.field(
        description='The card tokenizer the browser must use, or null when cards are off.'
    )
    def market_card_tokenizer(self, info: strawberry.Info) -> str | None:
        if info.context.user is None or not services.card_payments_available():
            return None
        return services.gateways.get_gateway().name

    @strawberry.field(description='Whether payment prompts to the phone are set up.')
    def market_push_available(self, info: strawberry.Info) -> bool:
        return info.context.user is not None and services.push_available()

    @strawberry.field(description="The caller's own conversation with the team about an idea.")
    def my_market_enquiry(
        self, info: strawberry.Info, idea_id: strawberry.ID
    ) -> EnquiryType | None:
        enquiry = services.my_enquiry(info.context.user, idea_id)
        return _enquiry(enquiry) if enquiry else None

    @strawberry.field(description='Every buyer conversation. Empty without the permission.')
    def market_enquiries(self, info: strawberry.Info) -> list[EnquiryType]:
        return [_enquiry(e) for e in services.enquiries(info.context.user)]

    @strawberry.field(description="The caller's own payments.")
    def my_market_purchases(self, info: strawberry.Info) -> list[PurchaseType]:
        return [_purchase(p) for p in services.my_purchases(info.context.user)]

    @strawberry.field(description='Every idea, any status. Empty without the permission.')
    def admin_market_ideas(self, info: strawberry.Info) -> list[MarketIdeaType]:
        user = info.context.user
        return [_idea(i, user) for i in services.all_ideas(user)]

    @strawberry.field(description='Every payment method. Empty without the permission.')
    def admin_payment_methods(self, info: strawberry.Info) -> list[PaymentMethodType]:
        return [_method(m) for m in services.all_methods(info.context.user)]

    @strawberry.field(description='Payments to confirm, and the history. Empty without permission.')
    def market_payments(
        self, info: strawberry.Info, status: str | None = None
    ) -> list[PurchaseType]:
        return [_purchase(p) for p in services.payments(info.context.user, status=status)]


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_market_idea(
        self, info: strawberry.Info, input: MarketIdeaInput
    ) -> MarketIdeaPayload:
        user = info.context.user
        try:
            idea = services.create_idea(user, services.IdeaInput(**vars(input)))
        except MarketplaceError as exc:
            return _refused(MarketIdeaPayload, exc)
        return MarketIdeaPayload(success=True, message='Saved.', idea=_idea(idea, user))

    @strawberry.mutation
    def update_market_idea(
        self, info: strawberry.Info, id: strawberry.ID, input: MarketIdeaInput
    ) -> MarketIdeaPayload:
        user = info.context.user
        try:
            idea = services.update_idea(user, id, services.IdeaInput(**vars(input)))
        except MarketplaceError as exc:
            return _refused(MarketIdeaPayload, exc)
        return MarketIdeaPayload(success=True, message='Saved.', idea=_idea(idea, user))

    @strawberry.mutation
    def publish_market_idea(self, info: strawberry.Info, id: strawberry.ID) -> MarketIdeaPayload:
        user = info.context.user
        try:
            idea = services.publish_idea(user, id)
        except MarketplaceError as exc:
            return _refused(MarketIdeaPayload, exc)
        return MarketIdeaPayload(success=True, message='Published.', idea=_idea(idea, user))

    @strawberry.mutation
    def unpublish_market_idea(self, info: strawberry.Info, id: strawberry.ID) -> MarketIdeaPayload:
        user = info.context.user
        try:
            idea = services.unpublish_idea(user, id)
        except MarketplaceError as exc:
            return _refused(MarketIdeaPayload, exc)
        return MarketIdeaPayload(success=True, message='Withdrawn.', idea=_idea(idea, user))

    @strawberry.mutation
    def create_payment_method(
        self, info: strawberry.Info, input: PaymentMethodInput
    ) -> PaymentMethodPayload:
        try:
            method = services.create_method(info.context.user, services.MethodInput(**vars(input)))
        except MarketplaceError as exc:
            return _refused(PaymentMethodPayload, exc)
        return PaymentMethodPayload(success=True, message='Saved.', method=_method(method))

    @strawberry.mutation
    def update_payment_method(
        self, info: strawberry.Info, id: strawberry.ID, input: PaymentMethodInput
    ) -> PaymentMethodPayload:
        try:
            method = services.update_method(
                info.context.user, id, services.MethodInput(**vars(input))
            )
        except MarketplaceError as exc:
            return _refused(PaymentMethodPayload, exc)
        return PaymentMethodPayload(success=True, message='Saved.', method=_method(method))

    @strawberry.mutation
    def set_payment_method_active(
        self, info: strawberry.Info, id: strawberry.ID, active: bool
    ) -> PaymentMethodPayload:
        try:
            method = services.set_method_active(info.context.user, id, active)
        except MarketplaceError as exc:
            return _refused(PaymentMethodPayload, exc)
        return PaymentMethodPayload(success=True, message='Saved.', method=_method(method))

    @strawberry.mutation(description='Tell the platform you have paid for an idea.')
    def submit_market_payment(
        self, info: strawberry.Info, input: MarketPaymentInput
    ) -> PurchasePayload:
        try:
            purchase = services.submit_payment(
                info.context.user,
                input.idea_id,
                method_id=input.method_id,
                payer_name=input.payer_name,
                payer_account=input.payer_account,
                transaction_reference=input.transaction_reference,
            )
        except MarketplaceError as exc:
            return _refused(PurchasePayload, exc)
        return PurchasePayload(success=True, message='Submitted.', purchase=_purchase(purchase))

    @strawberry.mutation(description="Send a payment prompt to the buyer's phone.")
    def start_market_push_payment(
        self, info: strawberry.Info, input: MarketPushPaymentInput
    ) -> PurchasePayload:
        try:
            purchase = services.start_push_payment(
                info.context.user,
                input.idea_id,
                method_id=input.method_id,
                phone_number=input.phone_number,
            )
        except MarketplaceError as exc:
            return _refused(PurchasePayload, exc)
        return PurchasePayload(
            success=True, message='Check your phone.', purchase=_purchase(purchase)
        )

    @strawberry.mutation(description='Ask the marketplace team about an idea.')
    def send_market_enquiry(
        self, info: strawberry.Info, idea_id: strawberry.ID, body: str
    ) -> EnquiryPayload:
        try:
            enquiry = services.send_enquiry(info.context.user, idea_id, body)
        except MarketplaceError as exc:
            return _refused(EnquiryPayload, exc)
        return EnquiryPayload(success=True, message='Sent.', enquiry=_enquiry(enquiry))

    @strawberry.mutation(description="Administrator: answer a buyer's question.")
    def reply_market_enquiry(
        self, info: strawberry.Info, id: strawberry.ID, body: str
    ) -> EnquiryPayload:
        try:
            enquiry = services.reply_enquiry(info.context.user, id, body)
        except MarketplaceError as exc:
            return _refused(EnquiryPayload, exc)
        return EnquiryPayload(success=True, message='Sent.', enquiry=_enquiry(enquiry))

    @strawberry.mutation(description='Pay by card, with a token from the gateway.')
    def start_market_card_payment(
        self, info: strawberry.Info, input: MarketCardPaymentInput
    ) -> PurchasePayload:
        try:
            purchase = services.start_card_payment(
                info.context.user,
                input.idea_id,
                method_id=input.method_id,
                card_token=input.card_token,
                cardholder_name=input.cardholder_name,
                card_label=input.card_label,
            )
        except MarketplaceError as exc:
            return _refused(PurchasePayload, exc)
        return PurchasePayload(success=True, message='Paid.', purchase=_purchase(purchase))

    @strawberry.mutation(description='Administrator: the payment arrived; unlock the idea.')
    def confirm_market_payment(
        self, info: strawberry.Info, id: strawberry.ID, note: str | None = None
    ) -> PurchasePayload:
        try:
            purchase = services.confirm_payment(info.context.user, id, note=note or '')
        except MarketplaceError as exc:
            return _refused(PurchasePayload, exc)
        return PurchasePayload(success=True, message='Confirmed.', purchase=_purchase(purchase))

    @strawberry.mutation(description='Administrator: the payment could not be found.')
    def reject_market_payment(
        self, info: strawberry.Info, id: strawberry.ID, note: str
    ) -> PurchasePayload:
        try:
            purchase = services.reject_payment(info.context.user, id, note=note)
        except MarketplaceError as exc:
            return _refused(PurchasePayload, exc)
        return PurchasePayload(success=True, message='Rejected.', purchase=_purchase(purchase))
