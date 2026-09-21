"""
Base Django settings for the Automation Platform backend.

Shared by every environment. Environment-specific settings (local,
production) import from this module and override only what differs.
"""

from pathlib import Path

import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# BASE_DIR is backend/ (three levels up from this file: settings/base.py).
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# backend/.env is a local-development convenience. Variables already set in
# the real environment (deploy platform, CI, secret manager) take precedence.
environ.Env.read_env(BASE_DIR / '.env')


# Deployment environment label. This is informational (logging, docs, future
# feature gating); security behavior is selected by DJANGO_SETTINGS_MODULE.
# local.py serves `local`; production.py serves development/staging/production.
ENVIRONMENT = env('ENVIRONMENT', default='local')

# Required in every environment - there is deliberately no default, so a
# missing secret fails at startup instead of falling back to a known value.
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('DJANGO_SECRET_KEY')

# Safe by default; local.py opts in to debug behavior.
DEBUG = env.bool('DJANGO_DEBUG', default=False)

ALLOWED_HOSTS = env.list('DJANGO_ALLOWED_HOSTS', default=[])

# Browser origins allowed to call the API cross-origin / submit CSRF-protected
# requests. Empty by default; local.py supplies the Vite dev server origin.
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[])


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'strawberry_django',
    'graphql_api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Must sit above any middleware that can generate responses (CommonMiddleware).
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# DATABASE_URL is required and has no fallback, so credentials only ever come
# from the environment. Driver options such as TLS go in the URL query string,
# e.g. ?sslmode=require.
DATABASES = {
    'default': env.db('DATABASE_URL'),
}
DATABASES['default']['CONN_MAX_AGE'] = env.int('DATABASE_CONN_MAX_AGE', default=0)
DATABASES['default']['CONN_HEALTH_CHECKS'] = DATABASES['default']['CONN_MAX_AGE'] > 0


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'


# CORS
# Only the GraphQL API is meant to be called from the browser app. The
# allowed origins themselves come from CORS_ALLOWED_ORIGINS (never a wildcard).

CORS_URLS_REGEX = r'^/graphql/'

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
