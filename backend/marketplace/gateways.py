"""
Payment gateways: what sends a payment prompt to a buyer's phone and tells us the outcome.

A mobile money push ("STK"/USSD push) is not something the platform can do on its own: it
goes through a gateway - an aggregator such as AzamPay, Selcom or ClickPesa, or a network's
own merchant API - with the platform's merchant account behind it. Every gateway is the same
three operations, `PushGateway` below, so the rest of the marketplace never knows which one
is in use:

- `start` asks the gateway to prompt a phone for an amount, and returns the gateway's
  reference for that request;
- `check` asks how a request ended, for gateways that can be asked (and for the sandbox);
- `parse_callback` reads the gateway's own notification of the outcome, sent to
  `/marketplace/gateway/callback/`. **It is the only thing that authenticates that
  request** - the endpoint has no user - so an adapter verifies the gateway's signature or
  shared secret there and returns `None` for anything it cannot verify.

`MARKETPLACE_PAYMENT_GATEWAY` names the gateway: `sandbox`, or the dotted path to an adapter
class. Empty means push payments are off, and buyers only see the manual methods.

A gateway that takes cards also has `supports_cards` and `charge_card`. **Card details
never reach the platform's server**: the browser gives them to the gateway's own card fields
(its tokenizer, `frontend/src/features/marketplace/utils/cardTokenizers.ts`), which return a
one-time token, and `charge_card` charges that token. Holding a card number or security code
here would put the whole platform in scope of the card industry's PCI DSS audit.

The sandbox approves a phone prompt a few seconds after it is sent, and declines one sent
to a number ending in 0; it approves a card at once, and declines one ending in 0002. It
works only while `DEBUG` is on, so a deployment can never take a pretend payment for a real
one.
"""

import re
import uuid
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone
from django.utils.module_loading import import_string


@dataclass(frozen=True)
class PushOutcome:
    """How one push request ended."""

    reference: str
    approved: bool
    #: The provider's own transaction ID, once the money has moved.
    receipt: str = ''
    #: Why it was not approved, in words a buyer can be shown.
    message: str = ''


class GatewayError(Exception):
    """The gateway refused or could not be reached; the message is safe to show a buyer."""


class PushGateway(Protocol):
    name: str

    def start(self, purchase, phone: str) -> str:
        """Prompt `phone` to pay `purchase.amount`; return the gateway's reference."""
        ...

    def check(self, purchase) -> PushOutcome | None:
        """How the request ended, or `None` while the buyer has not answered yet."""
        ...

    def parse_callback(self, request: HttpRequest) -> PushOutcome | None:
        """The outcome the gateway reports, or `None` for a request it did not send."""
        ...

    # Gateways that take cards also have:
    #   supports_cards = True
    #   def charge_card(self, purchase, token) -> tuple[str, PushOutcome | None]:
    #       the gateway's reference, and the outcome - or None while the bank verifies it.


class SandboxGateway:
    """A pretend gateway for development. See the module docstring."""

    name = 'sandbox'
    supports_cards = True

    def start(self, purchase, phone: str) -> str:
        return f'SBX{uuid.uuid4().hex[:12].upper()}'

    def check(self, purchase) -> PushOutcome | None:
        waited = (timezone.now() - purchase.created_at).total_seconds()
        if waited < settings.MARKETPLACE_SANDBOX_APPROVE_SECONDS:
            return None
        if purchase.payer_account.endswith('0'):
            return PushOutcome(
                purchase.gateway_reference,
                approved=False,
                message='The payment was declined on the phone.',
            )
        return PushOutcome(
            purchase.gateway_reference,
            approved=True,
            receipt=f'SB{purchase.gateway_reference[-8:]}',
        )

    def parse_callback(self, request: HttpRequest) -> PushOutcome | None:
        return None

    def charge_card(self, purchase, token: str) -> tuple[str, PushOutcome | None]:
        # The sandbox tokenizer's tokens carry only the last four digits.
        match = re.fullmatch(r'sbx_card_(\d{4})', token)
        if not match:
            raise GatewayError('The card could not be read. Check the details and try again.')
        reference = f'SBXC{uuid.uuid4().hex[:11].upper()}'
        if match.group(1) == '0002':
            return reference, PushOutcome(
                reference, approved=False, message='Your bank declined the card.'
            )
        return reference, PushOutcome(reference, approved=True, receipt=f'SC{reference[-8:]}')


def get_gateway() -> PushGateway | None:
    """The configured gateway, or `None` when push payments are not available."""
    name = settings.MARKETPLACE_PAYMENT_GATEWAY
    if not name:
        return None
    if name == 'sandbox':
        return SandboxGateway() if settings.DEBUG else None
    return import_string(name)()
