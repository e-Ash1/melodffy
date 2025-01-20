import { nextTrack, getQueue, setCurrentTrackIndex } from './queueManager.js';
import { playTrack, startProgressUpdate, stopProgressUpdate, seekToPosition, getPlayerInstance } from './player.js';
import { formatTime } from './utils.js';

/*********************************************************
 * Progress Bar Logic:
 ********************************************************/

$('#progress-bar').on('input', function () {
    const position = parseInt($(this).val());
    const duration = parseInt($(this).attr('max'));
    const percentage = (position / duration) * 100;

    // Updates visual elements
    $('.progress-fill').css('width', `${percentage}%`);
    $('.progress-thumb').css('left', `${percentage}%`);
    $('#current-time').text(formatTime(position * 1000));
    $('#remaining-time').text(`-${formatTime((duration - position) * 1000)}`);
});

// Event Listener: Progress Bar Change (Track Seeking)
$('#progress-bar').on('change', function () {
    const position = $(this).val() * 1000; // Convert slider value to milliseconds
    console.log(`Seeking to position: ${position} ms`);

    const player = getPlayerInstance();
    if (player) {
        player.getCurrentState().then((state) => {
            if (state) {
                const duration = state.track_window.current_track.duration_ms; // Get duration dynamically
                console.log(`Track duration: ${duration} ms`);

                // Seek to the new position
                seekToPosition(position / 1000); // Convert back to seconds for seekToPosition

                // Start progress updates with the new position and dynamic duration
                startProgressUpdate(position, duration, updateProgressCallback);
            }
        }).catch((err) => console.error("Error fetching player state:", err));
    }
});


/*********************************************************
 * State Management of Player Changes:
 ********************************************************/
/**
 * Handles changes in the player state.
 * @param {Object} state - The current state of the player.
 */
export function handlePlayerStateChanged(state) {
    // No state available, update UI accordingly
    if (!state) {
        updateUIForNoPlayback();
        return;
    }

    const currentTrack = state.track_window.current_track;
    const isPlaying = !state.paused;
    const trackUri = currentTrack.uri;
    const position = state.position;
    const duration = currentTrack.duration_ms;

    // Updates the progress bar
    $('#progress-bar').attr('max', duration / 1000).val(position / 1000); // Update attributes in seconds
    console.log("Progress Bar Attributes:", {
        max: $('#progress-bar').attr('max'),
        value: $('#progress-bar').val(),
        step: $('#progress-bar').attr('step'),
    });
    
    // Updates the current track index in the queue
    updateCurrentTrackIndex(trackUri);

    // Checks if the track has ended and move to the next track
    if (hasTrackEnded(state)) {
        const nextTrackUri = nextTrack();
        if (nextTrackUri) {
            playTrack(nextTrackUri);
        }
        return; // Exits the code block to avoid updating the UI with old track info
    }

    // Updates the localStorage and UI
    const trackInfo = extractTrackInfo(currentTrack);
    localStorage.setItem('currentTrack', JSON.stringify(trackInfo));

    updateFooter(trackInfo);
    updateProgressBar(position, duration); // Dynamically updates the progress bar visuals
    updatePlayPauseButton(isPlaying); // Reflects the play/pause state in the UI

    // Starts or stops the progress update
    isPlaying ? startProgressUpdate(position, duration, updateProgressCallback) : stopProgressUpdate();
};


/*********************************************************
 * Helper Functions:
 ********************************************************/

function updateCurrentTrackIndex(trackUri) {
    const queue = getQueue();
    const index = queue.indexOf(trackUri);
    if (index !== -1) {
        setCurrentTrackIndex(index);
    }
}

function hasTrackEnded(state) {
    return state.position === 0 && state.paused;
}

function extractTrackInfo(currentTrack) {
    return {
        id: currentTrack.id,
        name: currentTrack.name,
        artists: currentTrack.artists.map(artist => artist.name),
        album: currentTrack.album.name,
        albumArt: currentTrack.album.images[0]?.url || '/static/images/default_album_art.jpg',
        uri: currentTrack.uri
    };
}

function updateFooter(trackInfo) {
    $('#footer-track').text(trackInfo.name);
    $('#footer-artist').text(trackInfo.artists.join(', '));
    $('#footer-album-art').attr('src', trackInfo.albumArt);
}

function updateProgressBar(position, duration) {
    const progressPercentage = (position / duration) * 100;

    // Updates the progress bar's attributes and fill color
    $('#progress-bar').val(position / 1000); // Convert ms to seconds
    $('#progress-bar').css('background', `linear-gradient(to right, #6B46C1 ${progressPercentage}%, #808080 ${progressPercentage}%)`);

    // Updates the time displays
    $('#current-time').text(formatTime(position));
    $('#remaining-time').text(`-${formatTime(duration - position)}`);
};


function updatePlayPauseButton(isPlaying) {
    const playPauseIcon = isPlaying
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF" class="w-6 h-6"> <path d="M6 5h4v14H6zm8 0h4v14h-4z"/> </svg>` // Pause icon
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF" class="w-6 h-6"> <path d="M8 5v14l11-7z"/> </svg>`; // Play icon;

    $('#play-pause-btn').html(playPauseIcon);
};

function updateUIForNoPlayback() {
    updatePlayPauseButton(false);
    stopProgressUpdate();
    updateProgressBar(0, 0);
    $('#current-time').text('0:00');
    $('#remaining-time').text('-0:00');
    $('#footer-track').text('No Track Playing');
    $('#footer-artist').text('');
    $('#footer-album-art').attr('src', '/static/images/default_album_art.jpg');
};

export function updateProgressCallback(position, duration) {
    if (position > duration) position = duration;

    // Update progress bar value and fill color
    const percentage = (position / duration) * 100;
    $('#progress-bar').val(position).css('background', `linear-gradient(to right, #10b981 ${percentage}%, #808080 ${percentage}%)`);

    // Update time displays
    $('#current-time').text(formatTime(position));
    let remainingTime = duration - position;
    if (remainingTime < 0) remainingTime = 0;
    $('#remaining-time').text(`-${formatTime(remainingTime)}`);
}


