"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path

from administration.views import admin_download_attachment_view
from config.views import health
from graphql_api.views import graphql_view
from ideas.views import download_attachment_view, upload_attachment_view
from identity.views import avatar_view, user_avatar_view
from marketplace.views import document_view as market_document_view
from marketplace.views import gateway_callback_view as market_gateway_callback_view
from reviews.views import admin_proposal_pdf_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health, name='health'),
    path('graphql/', graphql_view, name='graphql'),
    # Attachment binary transfer (S2-007) - the one HTTP surface for Ideas
    # beyond GraphQL, and only for the bytes themselves. See
    # `ideas/views.py`'s module docstring for why these two exist outside
    # GraphQL and everything else about an attachment does not.
    path(
        'ideas/<int:idea_id>/attachments/',
        upload_attachment_view,
        name='idea-attachment-upload',
    ),
    path(
        'ideas/<int:idea_id>/attachments/<int:attachment_id>/download/',
        download_attachment_view,
        name='idea-attachment-download',
    ),
    # Profile photos: bytes only, like attachments. See `identity/views.py`.
    path('account/avatar/', avatar_view, name='account-avatar'),
    path('users/<int:user_id>/avatar/', user_avatar_view, name='user-avatar'),
    # The administration console's evidence download: a separate endpoint
    # with its own platform-permission check and an audit record per
    # download, sharing the safe-download response with the one above. See
    # `administration/views.py`.
    path(
        'administration/attachments/<int:attachment_id>/download/',
        admin_download_attachment_view,
        name='admin-attachment-download',
    ),
    # A proposal as a watermarked PDF, for the platform admin. See `reviews/views.py`.
    path(
        'administration/proposals/<int:idea_id>/pdf/',
        admin_proposal_pdf_view,
        name='admin-proposal-pdf',
    ),
    # A marketplace idea's document: uploaded by an administrator, downloaded by a buyer
    # once their payment is confirmed. See `marketplace/views.py`.
    path(
        'marketplace/ideas/<int:idea_id>/document/',
        market_document_view,
        name='market-idea-document',
    ),
    # The payment gateway's report of a phone payment's outcome. Server to server: not in
    # CORS. See `marketplace/gateways.py`.
    path(
        'marketplace/gateway/callback/',
        market_gateway_callback_view,
        name='market-gateway-callback',
    ),
]
