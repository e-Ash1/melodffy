from flask import Blueprint, request, jsonify
from services.queue_service import QueueService

queue_bp = Blueprint('queue_bp', __name__)
queue_service = QueueService()

@queue_bp.route('/', methods=['GET'])
def view_queue():
    return queue_service.view_queue()

@queue_bp.route('/add', methods=['POST'])
def add_to_queue():
    track_info = request.get_json()
    return queue_service.add_to_queue(track_info)

@queue_bp.route('/remove/<track_id>', methods=['POST'])
def remove_from_queue(track_id):
    return queue_service.remove_from_queue(track_id)


@queue_bp.route('/clear', methods=['POST'])
def clear_queue():
    return queue_service.clear_queue()
