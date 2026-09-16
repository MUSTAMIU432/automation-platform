from django.http import JsonResponse


def health(request):
    """Liveness check for deploy tooling and CI. No auth, no dependencies."""
    return JsonResponse({'status': 'ok'})
