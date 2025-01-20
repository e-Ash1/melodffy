
from flask import Blueprint, request, jsonify
from services.track_control_service import TrackControlService

track_controls_bp = Blueprint('track_controls', __name__)

track_service = TrackControlService()

@track_controls_bp.route('/addTrack', methods=['POST'])
def add_track():
    data = request.get_json()
    if not all(key in data for key in ['id', 'name', 'artist', 'album', 'albumArt']):
        return jsonify({"error": "Missing data"}), 400

    result = track_service.add_track(data)
    return jsonify(result), 200

@track_controls_bp.route('/removeTrack', methods=['POST'])
def remove_track():
    data = request.get_json()
    result = track_service.remove_track(data)
    return jsonify(result), 200
