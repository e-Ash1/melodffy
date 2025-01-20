import logging
import json
import urllib.parse

# ------------------------------------------------------------------------
# 0. Server Queue Management System:
# ------------------------------------------------------------------------
class QueueManager:
    def __init__(self):
        self.queue = []
        self.current_index = -1

    def set_queue(self, tracks):
        """Replace the entire queue with `tracks` (list of dicts or strings)."""
        self.queue = tracks
        self.current_index = 0 if tracks else -1
        
    def add_to_queue(self, tracks):
        """
        Add `tracks` to the current queue.
        - If front end sends raw JSON as a dict, we store it directly.
        - If front end sends URL-encoded JSON strings, we decode + parse each one.
        """
        parsed_tracks = []
        for t in tracks:
            # If it's already a dict, just add it
            if isinstance(t, dict):
                parsed_tracks.append(t)
            elif isinstance(t, str):
                try:
                    # Step 1: URL-decode the string
                    decoded_str = urllib.parse.unquote(t)
                    # Step 2: parse JSON
                    track_dict = json.loads(decoded_str)
                    parsed_tracks.append(track_dict)
                except (json.JSONDecodeError, ValueError):
                    logging.error(f"Could not parse track string: {t}")
            else:
                # Edge-case:
                parsed_tracks.append(t)

        self.queue.extend(parsed_tracks)

        # If queue was empty before, set current_index to 0
        if self.current_index == -1 and self.queue:
            self.current_index = 0

    def remove_from_queue(self, track_id: str) -> bool:
        """
        Remove a track with matching 'id' from the queue.
        If the track is stored as a dict, compare track['id'] directly.
        If the track is stored as a URL-encoded JSON string, decode + parse first.
        """
        initial_length = len(self.queue)
        new_queue = []

        for track in self.queue:
            if isinstance(track, str):
                try:
                    decoded_str = urllib.parse.unquote(track)
                    track = json.loads(decoded_str)
                except (json.JSONDecodeError, ValueError) as e:
                    # Skips invalid track
                    continue

            # Only keep the track if its 'id' doesn't match
            if track.get('id') != track_id:
                new_queue.append(track)

        self.queue = new_queue

        # If something was removed, adjust current_index
        if len(self.queue) < initial_length:
            if self.current_index >= len(self.queue):
                self.current_index = len(self.queue) - 1
            if not self.queue:
                self.current_index = -1
            return True
        else:
            return False

    def next_track(self):
        """Advance to the next track in the queue (if any) and return it."""
        if self.current_index + 1 < len(self.queue):
            self.current_index += 1
            return self.queue[self.current_index]
        else:
            return None

    def prev_track(self):
        """Go back to the previous track (if any) and return it."""
        if self.current_index > 0:
            self.current_index -= 1
            return self.queue[self.current_index]
        else:
            return None

    def get_queue(self):
        """Return the entire current queue."""
        return self.queue

    def clear_queue(self):
        """Clear out the entire queue."""
        self.queue = []
        self.current_index = -1
