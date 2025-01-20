from flask import Flask
from flask_migrate import Migrate
from flask_cors import CORS
from db import db
import os

from blueprints.main import main_bp
from blueprints.track_controls import track_controls_bp
from blueprints.auth import auth_bp
from blueprints.spotify import spotify_bp
from blueprints.queue import queue_bp

# --- Create the Flask app in global scope ---
app = Flask(__name__)
app.config['ENV'] = 'development'
app.config['DEBUG'] = True

CORS(app, supports_credentials=True)

# Database Configuration:
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///default.db')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_secret_key')

# Initializes the DB and sets Migrations:
db.init_app(app)
migrate = Migrate(app, db)

# Blueprint Registration:
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(main_bp)
app.register_blueprint(track_controls_bp)
app.register_blueprint(spotify_bp, url_prefix='/spotify')
app.register_blueprint(queue_bp, url_prefix='/queue')


with app.app_context():
    db.create_all()  
    
# --- Runs the app ---
if __name__ == '__main__':
    app.run(debug=True)
