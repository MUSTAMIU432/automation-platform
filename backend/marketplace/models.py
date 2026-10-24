"""
The marketplace: ideas the platform publishes for anyone signed in to see, whose full
documentation is unlocked by paying for it.

Everyone sees an idea's title, summary and price. The documentation - the part with the
value in it - is shown to a buyer only once their payment is confirmed. A payment is
collected one of two ways, chosen per payment method:

- **push**: the buyer gives their phone number, a payment gateway sends a prompt to that
  phone, and the buyer approves it with their PIN. The gateway tells us the outcome
  (`marketplace.gateways`) and the idea unlocks with no one in between.
- **manual**: the buyer sends money to the number or account shown, then gives the
  transaction reference, and an administrator confirms it against their statement.
- **card**: the buyer pays by Visa or Mastercard. The card's details go from the browser
  straight to the gateway, which returns a one-time token; the platform only ever sees that
  token and a label such as "Visa •••• 4242".

Prices are whole Tanzanian shillings.
"""

from typing import ClassVar

from django.conf import settings
from django.db import models

CURRENCY = 'TZS'

PAYMENT_KIND_CHOICES = (('mobile_money', 'Mobile money'), ('bank', 'Bank transfer'))
COLLECTION_CHOICES = (
    ('push', "Payment prompt on the buyer's phone"),
    ('manual', 'Buyer sends the money; an administrator confirms'),
    ('card', 'Card payment (Visa, Mastercard) through the gateway'),
)
IDEA_STATUS_CHOICES = (
    ('draft', 'Draft'),
    ('published', 'Published'),
    ('unpublished', 'Withdrawn'),
)
PURCHASE_STATUS_CHOICES = (
    ('awaiting', 'Waiting for the buyer to approve on their phone'),
    ('pending', 'Waiting for confirmation'),
    ('confirmed', 'Confirmed'),
    ('rejected', 'Rejected'),
    ('failed', 'Not approved on the phone'),
)


def _known(field: str, choices, name: str) -> models.CheckConstraint:
    return models.CheckConstraint(condition=models.Q(**{f'{field}__in': dict(choices)}), name=name)


class PaymentMethod(models.Model):
    """
    Where buyers pay: one mobile money number or one bank account. Turned off rather than
    deleted, so a payment already made to it keeps saying where it went.
    """

    kind = models.CharField(max_length=16, choices=PAYMENT_KIND_CHOICES)
    collection = models.CharField(max_length=8, choices=COLLECTION_CHOICES, default='manual')
    provider = models.CharField(max_length=80, help_text='M-Pesa, Tigo Pesa, CRDB Bank, ...')
    account_name = models.CharField(max_length=120)
    account_number = models.CharField(
        max_length=60,
        blank=True,
        help_text='The phone number, till or account number paid into. Not needed for push.',
    )
    instructions = models.TextField(blank=True, help_text='How to pay, step by step.')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering: ClassVar[list[str]] = ['kind', 'provider', 'pk']
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _known('kind', PAYMENT_KIND_CHOICES, 'payment_method_kind_is_known'),
            _known('collection', COLLECTION_CHOICES, 'payment_method_collection_is_known'),
        ]

    def __str__(self) -> str:
        return f'{self.provider} {self.account_number}'


class MarketIdea(models.Model):
    """
    An idea the platform offers: a public title, summary and price; documentation for buyers.

    What a buyer unlocks is written documentation, an uploaded document, or both; an idea
    needs at least one of them to go on sale. The document's bytes are not here - like an
    idea attachment, they live in the `attachments` storage under `document_key`, a key the
    server generates, and leave only through `marketplace.views`.
    """

    title = models.CharField(max_length=200)
    summary = models.TextField(help_text='What everyone signed in sees.')
    documentation = models.TextField(blank=True, help_text='What a buyer unlocks.')
    document_key = models.CharField(
        max_length=500, blank=True, help_text='Key of the uploaded document in storage.'
    )
    document_name = models.CharField(max_length=255, blank=True)
    document_content_type = models.CharField(max_length=255, blank=True)
    document_size = models.PositiveBigIntegerField(default=0, help_text='Size in bytes.')
    document_uploaded_at = models.DateTimeField(null=True, blank=True)
    price = models.PositiveIntegerField(help_text=f'Whole {CURRENCY}.')
    status = models.CharField(max_length=12, choices=IDEA_STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+'
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering: ClassVar[list[str]] = ['-published_at', '-created_at', '-pk']
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _known('status', IDEA_STATUS_CHOICES, 'market_idea_status_is_known'),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def has_documentation(self) -> bool:
        """Whether a buyer would unlock anything: written text or an uploaded document."""
        return bool(self.documentation.strip() or self.document_key)


class Purchase(models.Model):
    """
    One buyer paying for one idea. The amount is copied from the price when the buyer pays,
    so a later price change never rewrites what was paid. At most one payment in progress
    (on the phone, or waiting for an administrator) and one confirmed purchase per buyer and
    idea; a rejected or failed one can be followed by another.

    A push payment carries the gateway's name and its reference for the request, which is
    how the gateway's answer finds its way back here; `transaction_reference` is then the
    provider's receipt.
    """

    idea = models.ForeignKey(MarketIdea, on_delete=models.PROTECT, related_name='purchases')
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='market_purchases'
    )
    amount = models.PositiveIntegerField()
    method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT, related_name='purchases')
    payer_name = models.CharField(max_length=120)
    payer_account = models.CharField(
        max_length=60, help_text='The phone number or account the buyer paid from.'
    )
    transaction_reference = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=10, choices=PURCHASE_STATUS_CHOICES, default='pending')
    gateway = models.CharField(max_length=40, blank=True)
    gateway_reference = models.CharField(max_length=128, blank=True)
    review_note = models.TextField(blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering: ClassVar[list[str]] = ['-created_at', '-pk']
        constraints: ClassVar[list[models.BaseConstraint]] = [
            _known('status', PURCHASE_STATUS_CHOICES, 'purchase_status_is_known'),
            models.UniqueConstraint(
                fields=['idea', 'buyer'],
                condition=models.Q(status='pending'),
                name='purchase_one_pending_per_buyer_and_idea',
            ),
            models.UniqueConstraint(
                fields=['idea', 'buyer'],
                condition=models.Q(status='confirmed'),
                name='purchase_one_confirmed_per_buyer_and_idea',
            ),
            models.UniqueConstraint(
                fields=['idea', 'buyer'],
                condition=models.Q(status='awaiting'),
                name='purchase_one_awaiting_per_buyer_and_idea',
            ),
            models.UniqueConstraint(
                fields=['gateway', 'gateway_reference'],
                condition=~models.Q(gateway_reference=''),
                name='purchase_gateway_reference_is_unique',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.buyer_id} for {self.idea_id} ({self.status})'


class Enquiry(models.Model):
    """
    A buyer's conversation with the marketplace team about one idea - what is in it, whether
    it fits, how to pay - before or after buying. It is addressed to the team, not to one
    person: anyone who manages the marketplace reads and answers it. One per buyer and idea.
    """

    idea = models.ForeignKey(MarketIdea, on_delete=models.CASCADE, related_name='enquiries')
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='market_enquiries'
    )
    latest_message_at = models.DateTimeField()
    awaiting_reply = models.BooleanField(
        default=True, help_text="The last word is the buyer's: the team owes an answer."
    )
    buyer_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering: ClassVar[list[str]] = ['-latest_message_at', '-pk']
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=['idea', 'buyer'], name='enquiry_one_per_buyer_and_idea'
            ),
        ]

    def __str__(self) -> str:
        return f'{self.buyer_id} about {self.idea_id}'


class EnquiryMessage(models.Model):
    """One message in an enquiry: the buyer's, or the team's answer."""

    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    from_team = models.BooleanField(default=False)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering: ClassVar[list[str]] = ['created_at', 'pk']

    def __str__(self) -> str:
        return f'{"team" if self.from_team else "buyer"} in {self.enquiry_id}'
