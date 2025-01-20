
from queue_manager import QueueManager
from flask import jsonify

class QueueService:
    def __init__(self):
        self.queue_manager = QueueManager()

    def view_queue(self):
        return jsonify({'queue': self.queue_manager.get_queue(), 'current_index': self.queue_manager.current_index})

    def add_to_queue(self, track_info):
        self.queue_manager.add_to_queue([track_info])
        return jsonify({'message': 'Track successfully added to the queue!'}), 200

    def remove_from_queue(self, track_id):
        self.queue_manager.remove_from_queue(track_id)
        return jsonify({'message': 'Track successfully removed from the queue!'}), 200

    def clear_queue(self):
        self.queue_manager.clear_queue()
        return jsonify({'message': 'Queue successfully cleared!'}), 200
