from flask import Blueprint
from services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__)
auth_service = AuthService()

@auth_bp.route('/login')
def login():
    """Initiates the Spotify OAuth flow."""
    return auth_service.login()

@auth_bp.route('/logout')
def logout():
    """Logs the user out (removes user from session)."""
    return auth_service.logout()

@auth_bp.route('/callback')
def callback():
    """Spotify redirect URI; handles the auth code exchange."""
    return auth_service.callback()

@auth_bp.route('/token')
def token():
    """Returns the user's current Spotify access token (if in session)."""
    return auth_service.get_token()
