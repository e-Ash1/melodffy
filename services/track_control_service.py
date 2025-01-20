from flask import session
from models import Like, db

class TrackControlService:
    def add_track(self, data):
        # Retrieve the user ID from the session
        user_id = session.get('user_id')  

        if not user_id:
            return {"error": "User is not authenticated."}, 401

        # Creates the liked track with the user_id
        liked_track = Like(
            id=data['id'],
            name=data['name'],
            artist=data['artist'],
            album=data['album'],
            albumArt=data['albumArt'],
            user_id=user_id  
        )

        db.session.add(liked_track)
        db.session.commit()
        return {"message": "Track added successfully."}

    def remove_track(self, data):
        # Retrieve the user ID from the session
        user_id = session.get('user_id')

        if not user_id:
            return {"error": "User is not authenticated."}, 401

        # Remove track for the authenticated user
        track = Like.query.filter_by(
            name=data['name'],
            artist=data['artist'],
            album=data['album'],
            user_id=user_id  # Ensure the track belongs to the user
        ).first()

        if track:
            db.session.delete(track)
            db.session.commit()
            return {"message": "Track removed successfully."}
        else:
            return {"error": "Track not found."}
