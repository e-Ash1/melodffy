from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import relationship
from db import db


# ------------------------------------------------------------------------
# 0. Base Model:
# ------------------------------------------------------------------------
class BaseModel(db.Model):
    """Base model with reusable save functionality."""
    __abstract__ = True

    def save(self):
        try:
            db.session.add(self)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise e


# ------------------------------------------------------------------------
# 1. User Model:
# ------------------------------------------------------------------------
class User(BaseModel):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True, index=True)
    username = db.Column(db.String(50), nullable=False, unique=True)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    spotify_id = db.Column(db.String(100), nullable=False, unique=True, index=True)

    liked_songs = relationship('Like', back_populates='user', cascade='all, delete-orphan', lazy='dynamic')
    recent_songs = relationship('Recent', back_populates='user', cascade='all, delete-orphan', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'spotify_id': self.spotify_id,
            'liked_songs': [song.to_dict() for song in self.liked_songs],
            'recent_songs': [song.to_dict() for song in self.recent_songs]
        }

    @classmethod
    def get_user_by_spotify_id(cls, spotify_id):
        return cls.query.filter_by(spotify_id=spotify_id).first()

    def __repr__(self):
        return f"<User {self.username}>"


# ------------------------------------------------------------------------
# 2. Like Model:
# ------------------------------------------------------------------------
class Like(BaseModel):
    __tablename__ = 'liked_songs'

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    artist = db.Column(db.String(100), nullable=False)
    album = db.Column(db.String(100), nullable=False)
    albumArt = db.Column(db.String(100), nullable=True)
    uri = db.Column(db.String(100), nullable=False)
    duration_ms = db.Column(db.Integer, nullable=True)

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    user = relationship('User', back_populates='liked_songs')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'artist': self.artist,
            'album': self.album,
            'albumArt': self.albumArt,
            'uri' : self.uri,
            'duration_ms': self.duration_ms,
            'user_id': self.user_id
        }

    def __repr__(self):
        return f"<Like {self.name} by {self.artist}>"


# ------------------------------------------------------------------------
# 3. Recent Model:
# ------------------------------------------------------------------------
class Recent(BaseModel):
    __tablename__ = 'recently_played'

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    artist = db.Column(db.String(100), nullable=False)
    album = db.Column(db.String(100), nullable=False)
    albumArt = db.Column(db.String(100), nullable=True)
    uri = db.Column(db.String(100), nullable=False)
    duration_ms = db.Column(db.Integer, nullable=True)

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    user = relationship('User', back_populates='recent_songs')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'artist': self.artist,
            'album': self.album,
            'albumArt': self.albumArt,
            'uri': self.uri,
            'duration_ms': self.duration_ms,
            'user_id': self.user_id
        }

    def __repr__(self):
        return f"<Recent {self.name} by {self.artist}>"
