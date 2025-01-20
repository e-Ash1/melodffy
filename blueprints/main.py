from flask import Blueprint, render_template, session, redirect, url_for

main_bp = Blueprint('main', __name__)

# Routes
@main_bp.route('/')
def index():
    logged_in = bool(session.get('user_id'))
    return render_template('index.html', logged_in=logged_in)

