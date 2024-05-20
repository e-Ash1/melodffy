import logging

class QueueManager:
    def __init__(self):
        self.queue = []
        self.current_index = -1
        logging.debug("QueueManager initialized with an empty queue and index set to -1.")

    def set_queue(self, tracks):
        self.queue = tracks
        self.current_index = 0 if tracks else -1  # Reset the current index
        logging.debug(f"Set queue to {tracks}. Current queue: {self.queue}")

    def add_to_queue(self, tracks):
        # Flatten the list if it's a list of lists
        if tracks and isinstance(tracks[0], list):
            tracks = [track for sublist in tracks for track in sublist]
        
        # Extend sthe existing queue with the new tracks
        self.queue.extend(tracks)
        if self.current_index == -1:  # If the queue was previously empty, update the index
            self.current_index = 0
        logging.debug(f"Added tracks {tracks} to queue. Current queue: {self.queue}")

    def remove_from_queue(self, track_id):
        initial_length = len(self.queue)
        self.queue = [track for track in self.queue if track['id'] != track_id]
        if self.current_index >= initial_length:
            self.current_index = len(self.queue) - 1
        if self.current_index == -1 and self.queue:
            self.current_index = 0
        logging.debug(f"Removed track ID {track_id} from queue. Current queue: {self.queue}")

    def next_track(self):
        if self.current_index + 1 < len(self.queue):
            self.current_index += 1
            logging.debug(f"Moved to next track. Current index is now {self.current_index}.")
            return self.queue[self.current_index]
        else:
            logging.debug("No next track available. Reached the end of the queue.")
            return None

    def prev_track(self):
        if self.current_index > 0:
            self.current_index -= 1
            logging.debug(f"Moved to previous track. Current index is now {self.current_index}.")
            return self.queue[self.current_index]
        else:
            logging.debug("No previous track available. At the start of the queue.")
            return None

    def get_queue(self):
        logging.debug(f"Current queue: {self.queue}")
        return self.queue

    def clear_queue(self):
        self.queue = []
        self.current_index = -1
        logging.debug("Cleared the queue and reset the index to -1.")
