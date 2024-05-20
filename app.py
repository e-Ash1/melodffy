from flask import Flask, request, session, redirect, render_template, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from asgiref.wsgi import WsgiToAsgi
from dotenv import load_dotenv
from requests_oauthlib import OAuth2Session
from queue_manager import QueueManager
from models import db, Like, Recent
import logging
import requests
import certifi  
import os

# Load environment variables from a .env file
load_dotenv()

# Initialize the Flask application & Vercel Entry Point
app = Flask(__name__)
asgi_app = WsgiToAsgi(app) 

# Configure the database URI
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'definately_not_a_password')

# Initializes the database with the Flask app
db.init_app(app)  

# Initialize the queue manager
queue_manager = QueueManager()

# Set up logging
logging.basicConfig(level=logging.INFO)  



def create_oauth_session(state=None):
    """Creates an OAuth2 session for Spotify API authentication."""
    client_id = os.getenv('SPOTIFY_CLIENT_ID')
    redirect_uri = os.getenv('REDIRECT_URI')
    scope = [
        'user-library-read', 
        'user-read-currently-playing',
        'user-read-recently-played',
        'user-modify-playback-state',
        'user-read-playback-state', 
        'streaming' 
    ]
    oauth_session = OAuth2Session(client_id=client_id, redirect_uri=redirect_uri, scope=scope, state=state)
    oauth_session.verify = certifi.where()  # Uses certifi for SSL verification
    return oauth_session

def refresh_access_token(refresh_token):
    """Refreshes the Spotify access token using the provided refresh token."""
    client_id = os.getenv('SPOTIFY_CLIENT_ID')
    client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
    refresh_token_url = "https://accounts.spotify.com/api/token"
    payload = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': client_id,
        'client_secret': client_secret
    }

    try:
        response = requests.post(refresh_token_url, data=payload)
        if response.status_code == 200:
            new_tokens = response.json()
            access_token = new_tokens.get('access_token')

            # Update the session with the new access token
            session['oauth_token']['access_token'] = access_token
            session['oauth_token']['refresh_token'] = new_tokens.get('refresh_token', refresh_token)  # Update if a new refresh token is provided

            return access_token
        else:
            logging.error(f"Failed to refresh token: {response.json()}")
            return None
    except Exception as e:
        logging.error(f"Exception during token refresh: {str(e)}")
        return None

def spotify_api_call(endpoint, method='POST', body=None, player_related=True):
    """Makes an API call to Spotify's web API."""
    access_token = session.get('oauth_token', {}).get('access_token')
    headers = {'Authorization': f'Bearer {access_token}'}
    base_url = 'https://api.spotify.com/v1/'
    if player_related:
        base_url += 'me/player/'
    url = f'{base_url}{endpoint}'

    try:
        if method == 'POST':
            response = requests.post(url, headers=headers, json=body)
        elif method == 'PUT':
            response = requests.put(url, headers=headers, json=body)
        elif method == 'GET':
            response = requests.get(url, headers=headers)
        else:
            return 'Unsupported HTTP method', 400

        return response
    except requests.RequestException as e:
        logging.error(f"Request failed: {str(e)}")
        return None, 500

@app.route('/callback')
def callback():
    """Handles the callback from Spotify after user authorization."""
    if 'code' not in request.args:
        return redirect(url_for('login'))

    try:
        oauth_session = create_oauth_session(state=session.get('oauth_state'))
        token = oauth_session.fetch_token(
            'https://accounts.spotify.com/api/token',
            authorization_response=request.url,
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET')
        )
        session['oauth_token'] = token  # Save the token in the session
        session['logged_in'] = True
        oauth_session.token = token
        
        with app.app_context():
            try:
                db.create_all()
            except IntegrityError:
                db.session.rollback()


        return redirect(url_for('index'))
    except Exception as e:
        logging.error(f"Error retrieving token: {str(e)}")
        return redirect(url_for('login'))

@app.route('/token')
def token():
    """Endpoint to retrieve or refresh the OAuth access token."""
    if 'logged_in' not in session or not session['logged_in']:
        return 'Unauthorized', 401

    try:
        access_token = session.get('oauth_token', {}).get('access_token')
        if not access_token:
            refresh_token = session.get('oauth_token', {}).get('refresh_token')
            if refresh_token:
                new_token = refresh_access_token(refresh_token)  
                session['oauth_token']['access_token'] = new_token
                return new_token
            return 'Token expired and no refresh token available', 401
        return access_token
    except Exception as e:
        logging.error(f"Error during token retrieval: {str(e)}")
        return jsonify({'error': 'Token retrieval failed', 'details': str(e)}), 500

@app.route('/transfer-playback', methods=['PUT'])
def transfer_playback():
    """Endpoint to transfer playback to a new device."""
    device_id = request.json.get('device_id')
    if not device_id:
        return jsonify({'error': 'No device ID provided'}), 400

    response = spotify_api_call('', 'PUT', body={'device_ids': [device_id], 'play': True})
    if isinstance(response, tuple):
        response_data, status_code = response
    else:
        response_data = response
        status_code = response.status_code

    if status_code == 403:
        return jsonify({'error': 'This action is not allowed'}), 403
    elif status_code not in [200, 204]:
        error_message = response_data if isinstance(response_data, str) else response_data.get('error', 'Failed to transfer playback')
        return jsonify({'error': error_message}), status_code

    return jsonify({'message': 'Playback transferred successfully'}), 200

@app.route('/login')
def login():
    """Initiates the login process by redirecting to Spotify's authorization page."""
    if 'logged_in' in session and session['logged_in']:
        return redirect(url_for('index'))  

    oauth_session = create_oauth_session()
    authorization_url, state = oauth_session.authorization_url('https://accounts.spotify.com/authorize')
    session['oauth_state'] = state
    return redirect(authorization_url)


@app.route('/logout')
def logout():
    """Logs the user out by clearing the session."""
    session.pop('oauth_token', None)  # Clear the access token
    session.pop('logged_in', None)
    session['logged_in'] = False  # Update the logged-in status
    return redirect(url_for('index'))

@app.route('/spotify-data')
def spotify_data():
    """Fetches data from Spotify based on a query parameter."""
    if 'oauth_token' not in session or 'access_token' not in session['oauth_token']:
        return jsonify({'error': 'Authentication required'}), 401

    query = request.args.get('query', '')
    type = request.args.get('type', 'track') 
    try:
        access_token = session['oauth_token']['access_token']
        headers = {'Authorization': f'Bearer {access_token}'}
        url = f'https://api.spotify.com/v1/search?q={query}&type={type}&limit=10'
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            logging.error(f"Failed to fetch data from Spotify: {response.json()}")
            return jsonify({'error': response.json()}), response.status_code
        
        data = response.json()
        formatted_data = format_search_data(data)
        
        return jsonify(formatted_data)
    except Exception as e:
        logging.exception("Error retrieving Spotify data.")
        return jsonify({'error': str(e)}), 500

def format_search_data(data):
    """Structures the meta-data returned from the Spotify API for easier data-formatting."""
    return {
        'tracks': {
            'items': [
                {
                    'id': track['id'],
                    'name': track['name'],
                    'album': {
                        'name': track['album'].get('name', 'Unknown Album'),
                        'images': track['album'].get('images', [{'url': url_for('static', filename='images/logo.png')}])
                    },
                    'artists': [{'name': artist['name']} for artist in track.get('artists', [])]
                } for track in data.get('tracks', {}).get('items', [])
            ]
        },
        'artists': {
            'items': [
                {
                    'id': artist['id'],
                    'name': artist['name'],
                    'images': artist.get('images', [{'url': url_for('static', filename='images/logo.png')}])
                } for artist in data.get('artists', {}).get('items', [])
            ]
        },
        'albums': {
            'items': [
                {
                    'id': album['id'],
                    'name': album['name'],
                    'release_date': album.get('release_date', 'Unknown')[:4],
                    'images': album.get('images', [{'url': url_for('static', filename='images/logo.png')}]),
                    'artists': [{'name': artist['name']} for artist in album.get('artists', [])]
                } for album in data.get('albums', {}).get('items', [])
            ]
        }
    }

@app.route('/recommendations/<track_id>', methods=['GET'])
def get_recommendations(track_id):
    """Fetches recommendations based on a given track and adds them to the queue."""
    access_token = session.get('oauth_token', {}).get('access_token')
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'seed_tracks': track_id, 'limit': 4}

    response = requests.get('https://api.spotify.com/v1/recommendations', headers=headers, params=params)
    if response.status_code == 200:
        recommendations = response.json().get('tracks', [])
        queued_tracks = []
        for track in recommendations:
            track_info = {
                'id': track['id'],
                'name': track['name'],
                'artists': ', '.join(artist['name'] for artist in track['artists']),
                'albumName': track['album']['name'],
                'albumArtUrl': track['album']['images'][0]['url'] if track['album']['images'] else 'path/to/default/art'
            }
            queued_tracks.append(track_info)
        
        queue_manager.add_to_queue(queued_tracks)

        return jsonify({'message': 'Queue updated successfully', 'queue': queued_tracks}), 200
    else:
        return jsonify({'error': 'Failed to fetch recommendations'}), response.status_code

@app.route('/queue', methods=['GET'])
def view_queue():
    """Endpoint to view the current queue."""
    return jsonify({'queue': queue_manager.get_queue(), 'current_index': queue_manager.current_index}), 200

@app.route('/queue/add', methods=['POST'])
def add_to_queue():
    """Endpoint to add a track to the current queue."""
    track_id = request.json.get('track_id')
    if track_id:
        queue_manager.add_to_queue([{
            'id': track_id,
            'name': request.json.get('name'),
            'albumName': request.json.get('albumName'),
            'artists': request.json.get('artists'),
            'albumArtUrl': request.json.get('albumArtUrl')
        }])
    return jsonify({'message': 'Track successfully added to the queue!'}), 200

@app.route('/queue/remove', methods=['POST'])
def remove_from_queue():
    """Endpoint to remove a track from the current queue."""
    track_id = request.json.get('track_id')
    if track_id:
        queue_manager.remove_from_queue(track_id)
    return jsonify({'message': 'Track successfully removed from the queue!'}), 200

@app.route('/queue/clear', methods=['POST'])
def clear_queue():
    """Endpoint to clear the track queue."""
    queue_manager.clear_queue()
    return jsonify({'message': 'Queue successfully cleared!'}), 200

@app.route('/getTracks', methods=['GET'])
def get_liked_tracks():
    """Endpoint to get all liked tracks."""
    tracks = Like.query.all()
    liked_tracks = [{
        'id': track.id,
        'name': track.name,
        'artist': track.artist,
        'album': track.album,
        'albumArt': track.albumArt
    } for track in tracks]
    return jsonify(liked_tracks)

@app.route('/addTrack', methods=['POST'])
def add_track():
    """Endpoint to add a track to the liked tracks."""
    data = request.get_json()
    if not all(key in data for key in ['id', 'name', 'artist', 'album', 'albumArt']):
        return "Missing data", 400 

    liked_track = Like(id=data['id'], name=data['name'], artist=data['artist'], album=data['album'], albumArt=data['albumArt'])
    db.session.add(liked_track)
    db.session.commit()
    return "Track added successfully."

@app.route('/removeTrack', methods=['POST'])
def remove_track():
    """Endpoint to remove a track from the liked tracks."""
    data = request.get_json()
    track = Like.query.filter_by(name=data['name'], artist=data['artist'], album=data['album']).first()
    if track:
        db.session.delete(track)
        db.session.commit()
        return "Track removed successfully."
    else:
        return "Track not found.", 404

@app.route('/recently-played', methods=['POST'])
def recently_played():
    """Endpoint to add a track to the recently played list."""
    data = request.get_json()
    if not all(key in data for key in ['id', 'name', 'artist', 'album', 'albumArt']):
        return "Missing data", 400  

    recently_played = Recent(id=data['id'], name=data['name'], artist=data['artist'], album=data['album'], albumArt=data['albumArt'])
    db.session.add(recently_played)
    db.session.commit()
    return "Track added successfully."

@app.route('/play', methods=['PUT'])
def play_song():
    """Endpoint to play a song."""
    data = request.json
    song_id = data.get('song_id')
    timestamp = data.get('timestamp', 0)

    body = {}
    if song_id:
        body['uris'] = [f'spotify:track:{song_id}']
    if timestamp is not None:
        body['position_ms'] = int(timestamp)

    response = spotify_api_call('play', 'PUT', body=body if body else {})
    if response and response.status_code == 204:
        return jsonify({'message': 'Playback continued successfully'}), 200
    else:
        return jsonify({'message': 'Error in the Playing!'}), response.status_code if response else 500

@app.route('/pause', methods=['PUT'])
def pause_song():
    """Endpoint to pause the current song."""
    response = spotify_api_call('pause', 'PUT')
    if response.status_code == 202 or response.status_code == 204:
        return jsonify({'message': 'Playback paused successfully'}), 200
    else:
        try:
            return jsonify(response.json()), response.status_code
        except ValueError:
            return jsonify({'error': 'Invalid response from Spotify API'}), 500

@app.route('/next', methods=['PUT'])
def next_song():
    """Endpoint to skip to the next song in the queue."""
    next_track = queue_manager.next_track()
    if next_track:
        response = spotify_api_call('play', 'PUT', body={'uris': [f'spotify:track:{next_track["id"]}']} if next_track else {})
        if response.status_code == 204:
            return jsonify({'message': 'Skipped to next song successfully'}), 200
        else:
            return jsonify({'error': 'Failed to skip to next song'}), response.status_code
    else:
        return jsonify({'error': 'No next track in the queue'}), 404

@app.route('/prev', methods=['PUT'])
def previous_song():
    """Endpoint to skip to the previous song in the queue."""
    prev_track = queue_manager.prev_track()
    if prev_track:
        response = spotify_api_call('play', 'PUT', body={'uris': [f'spotify:track:{prev_track["id"]}']} if prev_track else {})
        if response.status_code == 204:
            return jsonify({'message': 'Skipped to previous song successfully'}), 200
        else:
            return jsonify({'error': 'Failed to skip to previous song'}), response.status_code
    else:
        return jsonify({'error': 'No previous track in the queue'}), 404

@app.route('/track', methods=['GET'])
def current_track():
    """Endpoint to get the currently playing track."""
    try:
        response = spotify_api_call('currently-playing', 'GET')
        if response.status_code == 200:
            data = response.json()
            track_data = {
                'trackName': data['item']['name'],
                'artistName': data['item']['artists'][0]['name'],
                'albumName': data['item']['album']['name'],
                'albumArtUrl': data['item']['album']['images'][0]['url']
            }
            return jsonify(track_data)
        elif response.status_code == 204:
            return jsonify({'message': 'No current track playing.'}), 204
        else:
            logging.error("Error fetching currently playing track: ", response.text)
            return jsonify({'error': 'Failed to fetch data', 'details': response.text}), response.status_code
    except Exception as e:
        logging.error(f"Exception in current_track: {str(e)}")
        return jsonify({'error': 'Server error', 'details': str(e)}), 500

@app.route('/track/<id>', methods=['GET'])
def track(id):
    """Endpoint to get a track's metadata."""
    response = spotify_api_call(f'tracks/{id}', 'GET', player_related=False)
    if response.status_code == 200:
        track_data = response.json()
        track_name = track_data["name"]
        artist_name = track_data["artists"][0]["name"] if track_data["artists"] else ""
        album_name = track_data["album"]["name"]
        album_art_url = track_data["album"]["images"][0]["url"] if (track_data["album"] and "images" in track_data["album"] and track_data["album"]["images"]) else ""
        
        formatted_track_data = {
            "name": track_name,
            "artist": artist_name,
            "albumName": album_name,
            "albumArtUrl": album_art_url
        }
        return jsonify(formatted_track_data), response.status_code
    else:
        return jsonify({"error": "Failed to fetch track metadata"}), response.status_code

@app.route('/track-details', methods=['GET'])
def track_details_batch():
    """Endpoint to get metadata for multiple tracks."""
    track_ids = request.args.get('trackIds', '')
    track_ids = track_ids.split(',') if track_ids else []
    
    tracks = []
    for track_id in track_ids:
        response = spotify_api_call(f'tracks/{track_id}', 'GET')
        if response.status_code == 200:
            track_data = response.json()
            tracks.append({
                'name': track_data['name'],
                'artists': [artist['name'] for artist in track_data['artists']],
                'albumArtUrl': track_data['album']['images'][0]['url'] if track_data['album']['images'] else 'path/to/default/art',
                'album': track_data['album']['name']
            })
    return jsonify(tracks)

@app.route('/')
def index():
    """Renders the index page."""
    logged_in = 'logged-in' if session.get('logged_in') else 'logged-out'
    return render_template('index.html', logged_in=logged_in)

if __name__ == '__main__':
    app.run(ssl_context='adhoc', debug=True)
