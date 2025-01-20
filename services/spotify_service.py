# services/spotify_service.py

from flask import session, jsonify, request
import requests
import os
import base64
from db import db
from models import Like, Recent

class SpotifyService:
    def __init__(self):
        """Optionally, place config or init logic here."""
        pass

    # ------------------------------------------------------------------------
    # 0. Example: Searching Spotify (Existing Logic)
    # ------------------------------------------------------------------------
    def search(self, query, search_type='track'):
        """Searches Spotify's catalog for the given query."""
        endpoint = f"search?q={query}&type={search_type}"
        response = self.spotify_api_call(endpoint, method='GET', player_related=False)
        return self.handle_response(response)

    # ------------------------------------------------------------------------
    # 1. Liked Tracks: Syncs the User's Liked Songs from Spotify ---> DB
    # ------------------------------------------------------------------------
    def sync_liked_tracks_from_spotify(self):
        """
        Fetch user's liked tracks from Spotify's /v1/me/tracks and upsert 
        them into our local 'liked_songs' table (Like model).
        """
        # 1. Check session
        user_id = session.get('user_id')
        access_token = session.get('oauth_token', {}).get('access_token')
        if not user_id or not access_token:
            return jsonify({'error': 'User not authenticated'}), 401

        # 2. Hit Spotify's endpoint
        url = 'https://api.spotify.com/v1/me/tracks?limit=5'
        headers = {'Authorization': f'Bearer {access_token}'}
        resp = requests.get(url, headers=headers)
        
        if resp.status_code != 200:
            return jsonify({'error': 'Failed to fetch liked tracks'}), resp.status_code

        data = resp.json()
        items = data.get('items', [])

        # 3. Insert or update local DB
        for item in items:
            track = item.get('track', {})
            track_id = track.get('id')

            if not track_id:
                continue

            existing = Like.query.filter_by(id=track_id, user_id=user_id).first()
            if not existing:
                new_like = Like(
                    id=track_id,
                    user_id=user_id,
                    name=track.get('name', 'Unknown'),
                    artist=', '.join(artist['name'] for artist in track.get('artists', [])),
                    album=track.get('album', {}).get('name', 'Unknown Album'),
                    albumArt=self._extract_album_art(track),
                    uri=track.get('uri'),
                    duration_ms=track.get('duration_ms', 0)
                )
                db.session.add(new_like)

        db.session.commit()
        return jsonify({'message': 'Synced liked tracks from Spotify to local DB'}), 200
    
    def toggle_like_track(self, track_data):
        """
        Toggle the like state of a track. Adds a new entry if not liked.
        """
        user_id = session.get('user_id')  
        track_id = track_data.get('id')

        if not user_id or not track_id:
            return {'error': 'User not authenticated or invalid track ID'}, 401

        # Checks if the track is already liked
        existing_like = Like.query.filter_by(id=track_id, user_id=user_id).first()
        if existing_like:
            return {'message': 'Track already liked', 'liked': True}, 200

        try:
            # Extracts the artist names
            artist_names = ', '.join(
                artist.get('name', 'Unknown Artist') for artist in track_data.get('artists', [])
            ) or track_data.get('artist', 'Unknown Artist') 

            # Extracts the album data
            album = track_data.get('album', {})
            album_name = album.get('name', 'Unknown Album') if isinstance(album, dict) else album
            album_art = (
                album.get('images', [{}])[0].get('url', '') if isinstance(album, dict) else track_data.get('albumArt', '')
            )

            # Formats the data for a new transaction into the liked_songs table
            new_like = Like(
                id=track_id,
                user_id=user_id,
                name=track_data.get('name', 'Unknown'),
                artist=artist_names,
                album=album_name,
                albumArt=album_art,
                uri=track_data.get('uri', ''),
                duration_ms=track_data.get('duration_ms', 0)
            )
            db.session.add(new_like)
            db.session.commit()
            return {'message': 'Track liked', 'liked': True}, 200

        except Exception as e:
            db.session.rollback()
            return {'error': 'Failed to like track'}, 500



    def toggle_unlike_track(self, track_id):
        """
        Toggle the unlike state of a track. Removes the entry if liked.
        """
        user_id = session.get('user_id')

        if not user_id or not track_id:
            return {'error': 'User not authenticated or invalid track ID'}, 401

        # Check if track is already liked
        existing_like = Like.query.filter_by(id=track_id, user_id=user_id).first()

        if not existing_like:
            return {'message': 'Track not liked', 'liked': False}, 200

        try:
            # Remove the liked track
            db.session.delete(existing_like)
            db.session.commit()
            return {'message': 'Track unliked', 'liked': False}, 200
        except Exception as e:
            db.session.rollback()
            return {'error': 'Failed to unlike track'}, 500

    
    def fetch_liked_tracks(self, user_id):
        """
        Fetches the User's Liked_Tracks from the local database
        """
        liked_tracks = Like.query.filter_by(user_id=user_id).all()
        return [track.to_dict() for track in liked_tracks]

    # ------------------------------------------------------------------------
    # 2. Recently Played: Syncs the User's Recent Track History from Spotify ---> DB
    # ------------------------------------------------------------------------
    def sync_recent_tracks_from_spotify(self):
        """
        Fetch user's recently played tracks from Spotify's 
        /v1/me/player/recently-played and upsert them into 'recently_played' table.
        """
        user_id = session.get('user_id')
        access_token = session.get('oauth_token', {}).get('access_token')
        if not user_id or not access_token:
            return jsonify({'error': 'User not authenticated'}), 401

        url = 'https://api.spotify.com/v1/me/player/recently-played?limit=5'
        headers = {'Authorization': f'Bearer {access_token}'}
    
        resp = requests.get(url, headers=headers)

        if resp.status_code != 200:
            return jsonify({'error': 'Failed to fetch recent tracks'}), resp.status_code

        data = resp.json()
        items = data.get('items', [])

        for item in items:
            track = item.get('track', {})
            track_id = track.get('id')

            if not track_id:
                continue

            existing = Recent.query.filter_by(id=track_id, user_id=user_id).first()
            if not existing:
                new_recent = Recent(
                    id=track_id,
                    user_id=user_id,
                    name=track.get('name', 'Unknown'),
                    artist=', '.join(artist['name'] for artist in track.get('artists', [])),
                    album=track.get('album', {}).get('name', 'Unknown Album'),
                    albumArt=self._extract_album_art(track),
                    uri=track.get('uri'),
                    duration_ms=track.get('duration_ms', 0)
                )
                db.session.add(new_recent)

        db.session.commit()

        return jsonify({'message': 'Synced recent tracks from Spotify to local DB'}), 200
    
    
    def fetch_recent_tracks(self, user_id):
        """
        Fetches the User's Liked_Tracks from the local database
        """
        recent_tracks = Recent.query.filter_by(user_id=user_id).all()
        return [track.to_dict() for track in recent_tracks]

    # ------------------------------------------------------------------------
    # 3. Playback Controls & Other Existing Logic
    # ------------------------------------------------------------------------
    def play_song(self, data):
        song_id = data.get('song_id')
        timestamp = data.get('timestamp', 0)
        if not song_id:
            return jsonify({'error': 'Invalid song ID'}), 400
        
        body = {
            'uris': [f'spotify:track:{song_id}'],
            'position_ms': int(timestamp)
        }
        response = self.spotify_api_call('me/player/play', 'PUT', body=body)
        return self.handle_response(response)

    def pause_song(self):
        response = self.spotify_api_call('me/player/pause', 'PUT')
        return self.handle_response(response)

    def next_song(self):
        response = self.spotify_api_call('me/player/next', 'POST')
        return self.handle_response(response)

    def previous_song(self):
        response = self.spotify_api_call('me/player/previous', 'POST')
        return self.handle_response(response)

    def get_track(self, track_id):
        response = self.spotify_api_call(f'tracks/{track_id}', 'GET', player_related=False)
        return self.handle_response(response)

    def get_active_device(self):
        """Retrieve the active Spotify device."""
        response = self.spotify_api_call('me/player/devices', 'GET')
        if not response:
            return jsonify({'error': 'No response from Spotify API'}), 500

        devices = response.json().get('devices', [])
        active_device = next((d for d in devices if d.get('is_active')), None)
        if not active_device:
            return jsonify({
                'error': 'No active device found. Please open Spotify on a device and try again.'
            }), 400
        return jsonify(active_device), 200
    
    # ------------------------------------------------------------------------
    # 4. Transfer Playback
    # ------------------------------------------------------------------------
    def transfer_playback(self, data):
        """
        Transfers Spotify playback to a given device.
        
        Args:
            data (dict): A dictionary containing 'device_ids' (list) or 'device_id' (str),
                         and an optional 'play' (bool) to start playback immediately.
                         
        Returns:
            Flask Response: JSON response indicating success or failure.
        """
        device_ids = data.get('device_ids')
        device_id = data.get('device_id')  
        play = data.get('play', False)

        # Checks if device_ids is a list
        
        if device_ids:
            if not isinstance(device_ids, list):
                device_ids = [device_ids]
        elif device_id:
            device_ids = [device_id]
        else:
            return jsonify({'error': 'No device ID provided.'}), 400

        payload = {
            "device_ids": device_ids,
            "play": play
        }

        response = self.spotify_api_call('me/player', 'PUT', body=payload)
        return self.handle_response(response)

    # ------------------------------------------------------------------------
    # 5. Spotify API Helper: making calls with the user's token
    # ------------------------------------------------------------------------
    def spotify_api_call(self, endpoint, method='POST', body=None, player_related=True):
        access_token = session.get('oauth_token', {}).get('access_token')
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        base_url = 'https://api.spotify.com/v1/'
        url = f'{base_url}{endpoint}'
        
        try:
            if method == 'POST':
                response = requests.post(url, headers=headers, json=body)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=body)
            elif method == 'GET':
                response = requests.get(url, headers=headers)
            else:
                return None  # or handle other HTTP methods
            return response
        except requests.RequestException as e:
            print(f"Request to Spotify API failed: {e}")
            return None

    # ------------------------------------------------------------------------
    # 6. Response Handling
    # ------------------------------------------------------------------------
    def handle_response(self, response):
        if not response:
            return jsonify({'error': 'No response from Spotify API'}), 500
        if response.status_code == 204:
            return jsonify({'message': 'Action completed successfully'}), 200
        elif response.status_code == 200:
            return jsonify(response.json()), 200
        else:
            return jsonify({
                'error': 'Action failed',
                'status_code': response.status_code,
                'details': response.json()
            }), response.status_code

    # ------------------------------------------------------------------------
    # 7. Helper for extracting album art
    # ------------------------------------------------------------------------
    def _extract_album_art(self, track):
        """Extracts the first album art URL from a Spotify track object (if any)."""
        images = track.get('album', {}).get('images', [])
        if images:
            return images[0].get('url', '')
        return ''
