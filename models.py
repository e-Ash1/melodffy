from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()

class Like(db.Model):
    __tablename__ = 'liked_songs'
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    artist = db.Column(db.String(100), nullable=False)
    album = db.Column(db.String(100), nullable=False)
    albumArt = db.Column(db.String(100), nullable=True)
    
class Recent(db.Model):
    __tablename__ = 'recently_played'
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    artist = db.Column(db.String(100), nullable=False)
    album = db.Column(db.String(100), nullable=False)
    albumArt = db.Column(db.String(100), nullable=True)
    

