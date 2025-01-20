from flask import session, redirect, request, url_for, jsonify
import os
from requests_oauthlib import OAuth2Session
import requests
from dotenv import load_dotenv
import logging
from models import User
from db import db

load_dotenv()

class AuthService:
    
    # ------------------------------------------------------------------------
    # 1. Handles Login/Logout Functionality through Spotify:
    # ------------------------------------------------------------------------
    def login(self):
        """Initiates Spotify OAuth flow."""
        oauth_session = self.create_oauth_session()
        authorization_url, state = oauth_session.authorization_url(
            'https://accounts.spotify.com/authorize'
        )
        session['oauth_state'] = state
        logging.info(f"OAuth state saved: {state}")
        return redirect(authorization_url)

    def logout(self):
        """Clears session info to 'log out' the user."""
        # Remove the stored OAuth token and user info from session
        session.pop('oauth_token', None)
        session.pop('user_id', None)
        logging.info("User logged out.")
        return redirect(url_for('main.index'))
    
    # ------------------------------------------------------------------------
    # 2. Callback towards the Spotify API:
    # ------------------------------------------------------------------------

    def callback(self):
        """Spotify OAuth callback: exchange code for token, store in session, create/find user."""
        try:
            oauth_state = session.get('oauth_state')
            if not oauth_state:
                raise ValueError("Missing OAuth state in session.")

            oauth_session = self.create_oauth_session(state=oauth_state)
            token = oauth_session.fetch_token(
                'https://accounts.spotify.com/api/token',
                authorization_response=request.url,
                client_secret=os.getenv('SPOTIFY_CLIENT_SECRET')
            )
            session['oauth_token'] = token

            # Fetch user data from Spotify
            spotify_user_data = oauth_session.get('https://api.spotify.com/v1/me').json()
            username = spotify_user_data.get('display_name')
            email = spotify_user_data.get('email')
            spotify_id = spotify_user_data.get('id')

            # If Spotify provided user data, create/find user in DB
            if username and email and spotify_id:
                user = User.query.filter_by(email=email).first()
                if user:
                    pass
                else:
                    user = User(username=username, email=email, spotify_id=spotify_id)
                    db.session.add(user)
                    db.session.commit()
                session['user_id'] = user.id
            return redirect(url_for('main.index'))
        except Exception as e:
            return jsonify({'error': 'Callback failed', 'details': str(e)}), 500

    # ------------------------------------------------------------------------
    # 3. Token Management and Session Creation:
    # ------------------------------------------------------------------------

    def get_token(self):
        """Returns the user's current access token (refresh if needed)."""
        access_token = session.get('oauth_token', {}).get('access_token')
        if not access_token:
            refresh_token = session.get('oauth_token', {}).get('refresh_token')
            if refresh_token:
                access_token = self.refresh_access_token(refresh_token)
                if access_token:
                    session['oauth_token']['access_token'] = access_token
                else:
                    logging.error("Failed to refresh access token.")
                    return jsonify({'error': 'Failed to refresh access token'}), 401
        return jsonify({'access_token': access_token})

    def create_oauth_session(self, state=None):
        """Creates an OAuth2Session for Spotify OAuth."""
        client_id = os.getenv('SPOTIFY_CLIENT_ID')
        redirect_uri = os.getenv('SPOTIFY_REDIRECT_URI')
        scopes = [
            'user-library-read',
            'user-modify-playback-state',
            'user-read-playback-state',
            'user-read-currently-playing',
            'user-read-playback-position',
            'user-read-recently-played',
            'user-read-email',
            'streaming'
        ]
        if not client_id or not redirect_uri:
            raise ValueError("Missing Spotify client credentials or redirect URI.")

        logging.info("OAuth session created successfully.")
        return OAuth2Session(
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=scopes,
            state=state
        )

    def refresh_access_token(self, refresh_token):
        """Helper to refresh an expired Spotify token."""
        try:
            payload = {
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
                'client_id': os.getenv('SPOTIFY_CLIENT_ID'),
                'client_secret': os.getenv('SPOTIFY_CLIENT_SECRET')
            }
            response = requests.post('https://accounts.spotify.com/api/token', data=payload)
            if response.status_code == 200:
                new_tokens = response.json()
                logging.info("Access token refreshed successfully.")
                return new_tokens.get('access_token')
            else:
                logging.error(f"Failed to refresh token. Response: {response.json()}")
                return None
        except Exception as e:
            logging.error(f"Exception during token refresh: {str(e)}")
            return None
