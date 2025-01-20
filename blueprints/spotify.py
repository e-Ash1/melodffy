# blueprints/spotify.py
from flask import Blueprint, request, jsonify, session
from services.spotify_service import SpotifyService


spotify_bp = Blueprint('spotify', __name__)
spotify_service = SpotifyService()


# ------------------------------------------------------------------------
# 1. Search / Playback / Transfer
# ------------------------------------------------------------------------

@spotify_bp.route('/search', methods=['GET'])
def search_spotify():
    """Search for tracks, artists, etc. on Spotify via the SpotifyService."""
    query = request.args.get('query', '')
    search_type = request.args.get('type', 'track')
    print(f"Frontend Query: {query}, Type: {search_type}")  # Debugging
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    return spotify_service.search(query, search_type)

@spotify_bp.route('/transfer-playback', methods=['PUT'])
def transfer_playback():
    """Transfer Spotify playback to a given device (and start playing)."""
    data = request.get_json() or {}
    return spotify_service.transfer_playback(data)

@spotify_bp.route('/play', methods=['PUT'])
def play_song():
    """Start or resume playback of a specific track."""
    data = request.get_json() or {}
    if 'song_id' not in data:
        return jsonify({'error': 'song_id is required'}), 400
    return spotify_service.play_song(data)

@spotify_bp.route('/pause', methods=['PUT'])
def pause_song():
    """Pause the current Spotify playback."""
    return spotify_service.pause_song()

@spotify_bp.route('/next', methods=['PUT'])
def next_song():
    """Skip to the next track in Spotify playback."""
    return spotify_service.next_song()

@spotify_bp.route('/prev', methods=['PUT'])
def previous_song():
    """Go back to the previous track in Spotify playback."""
    return spotify_service.previous_song()


# ------------------------------------------------------------------------
# 2. Direct "Recently Played" (from Spotify) vs. Local
#    (If you still want direct remote fetch, keep it. Otherwise, you can remove.)
# ------------------------------------------------------------------------
@spotify_bp.route('/recent-tracks', methods=['GET'])
def get_recent_tracks():
    """
    Sync recent tracks from Spotify to the local database,
    then fetch and return them for the authenticated user.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401

    # Sync data from Spotify to the local database
    sync_result = spotify_service.sync_recent_tracks_from_spotify()
    if sync_result[1] != 200:  # Check if sync was unsuccessful
        return sync_result  # Return error response from sync

    # Fetch synced data from the local database
    recent_tracks = spotify_service.fetch_recent_tracks(user_id)
    return jsonify(recent_tracks), 200


# ------------------------------------------------------------------------
# 3. Liked Tracks: Sync from Spotify -> Local, then fetch from Local
# ------------------------------------------------------------------------
@spotify_bp.route('/liked-tracks', methods=['GET'])
def get_liked_tracks():
    """
    Sync liked tracks from Spotify to the local database,
    then fetch and return them for the authenticated user.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401

    # Sync data from Spotify to the local database
    sync_result = spotify_service.sync_liked_tracks_from_spotify()
    if sync_result[1] != 200:  # Check if sync was unsuccessful
        return sync_result  # Return error response from sync

    # Fetch synced data from the local database
    liked_tracks = spotify_service.fetch_liked_tracks(user_id)
    return jsonify(liked_tracks), 200


# ------------------------------------------------------------------------
# 4. Like/Unlike Tracks: Handles the User Liking and Unliking Tracks within the DB:
# ------------------------------------------------------------------------

@spotify_bp.route('/like', methods=['POST'])
def like_track():
    try:
        data = request.get_json()
        track_info = data.get('track')
        
        print(f'##### [DEBUG]: Incoming data: {data}')
        print(f'##### [DEBUG]: Extracted track_info: {track_info}')

        if not track_info or not track_info.get('id'):
            return jsonify({'error': 'Invalid track data provided'}), 400

        print(f"##### [DEBUG]: Calling toggle_like_track with: track_data={track_info}")
        response, status_code = spotify_service.toggle_like_track(track_data=track_info)
        return jsonify(response), status_code
    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({'error': 'An error occurred while liking the track'}), 500




@spotify_bp.route('/unlike', methods=['POST'])
def unlike_track():
    try:
        data = request.get_json()
        track_id = data.get('id')

        if not track_id:
            return jsonify({'error': 'Invalid track ID provided'}), 400

        response, status_code = spotify_service.toggle_unlike_track(track_id=track_id)
        return jsonify(response), status_code
    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({'error': 'An error occurred while unliking the track'}), 500


# ------------------------------------------------------------------------
# 5. Get Specific Track(s)
# ------------------------------------------------------------------------
@spotify_bp.route('/track/<id>', methods=['GET'])
def track(id):
    """Fetch a single track's info from Spotify API (not from local DB)."""
    return spotify_service.get_track(id)

@spotify_bp.route('/track-details', methods=['GET'])
def track_details_batch():
    """
    Fetch multiple tracks' details from Spotify in one go, 
    e.g. /track-details?trackIds=123,456,789
    """
    track_ids = request.args.get('trackIds', '')
    if not track_ids:
        return jsonify({'error': 'trackIds parameter is required'}), 400
    return spotify_service.get_multiple_tracks(track_ids.split(','))
