"""
The one rule for an external resource's web address, shared by the console
(`learning.authoring`) and the course files (`learning.content`).

Only http and https, with a host: `javascript:`, `data:`, `file:` and the like
never reach a learner's page. Credentials in the address are refused too - a
resource is a public page, and `user:pass@` is also a classic way to disguise
where a link really goes. The address is checked as written; nothing here (or
anywhere on the server) fetches it.
"""

from urllib.parse import urlsplit

MAX_LENGTH = 2000


def check_resource_url(value: str) -> str:
    """`value` as a safe web address, or a `ValueError` whose message says why it is not."""
    value = (value or '').strip()
    if not value:
        raise ValueError('A web address is required.')
    if len(value) > MAX_LENGTH:
        raise ValueError('That web address is too long.')
    if any(char.isspace() or ord(char) < 32 for char in value):
        raise ValueError('A web address cannot contain spaces.')
    try:
        parts = urlsplit(value)
        hostname = parts.hostname
    except ValueError:
        raise ValueError('That is not a web address.') from None
    if parts.scheme.lower() not in {'http', 'https'}:
        raise ValueError('Use a web address that starts with https:// or http://.')
    if not hostname or '.' not in hostname.strip('.'):
        raise ValueError('That web address has no site in it.')
    if parts.username is not None or parts.password is not None:
        raise ValueError('Leave sign-in details out of the web address.')
    return value
