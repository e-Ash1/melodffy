import { updateProgressCallback, handlePlayerStateChanged } from "./playerTrack.js";

let playerInstance = null;
let deviceId = null;
let accessToken = null;

  /*********************************************************
     * Track Progress Bar
  ********************************************************/
  $('.progress-bar-container').on('click', function (e) {
    const progressContainer = $(this);
    const containerWidth = progressContainer.width();
    const clickPosition = e.offsetX;
    const newTime = (clickPosition / containerWidth) * playerInstance.duration;
    
    seekToPosition(newTime); 
});

$('#volume-slider').on('input', function () {
    let volume = parseFloat($(this).val());
    const percentage = volume;

    // Updates the fill of the volume color dynamically
    $(this).css('background', `linear-gradient(to right, #10b981 ${percentage}%, #808080 ${percentage}%)`);

    // Scales the volume to range [0, 1]
    volume /= 100;

    if (playerInstance) {
        playerInstance.setVolume(volume).then(() => {
            console.log(`Volume set to: ${volume}`);
        }).catch(error => {
            console.error('Failed to set volume:', error);
        });
    }
});


  /*********************************************************
     * Initializes the Spotify Player thorugh SDK:
  ********************************************************/
export function initializeSpotifyPlayer(token, onStateChanged, onReady) {
    if (!token) {
        console.error("Spotify token is required to initialize the player.");
        return;
    };

    // Check if the player instance is already initialized
    if (window.playerInstance) {
        console.log("Player instance already exists.");
        return window.playerInstance;
    }

    // Instantiates the Spotify Player Object
    playerInstance = new Spotify.Player({
        name: 'MELODFFY Web Player',
        getOAuthToken: (cb) => cb(token),
        volume: 0.5,
    });

    window.playerInstance = playerInstance;
    
    // Event Listeners
    playerInstance.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player is ready with Device ID:', device_id);
        deviceId = device_id; 
        transferPlaybackHere(device_id);    
    });

    playerInstance.addListener('not_ready', ({ device_id }) => {
        console.warn('Device ID has gone offline:', device_id);
        console.error(device_id);
    });

    playerInstance.addListener('initialization_error', ({ message }) =>
        console.error('Initialization Error:', message)
    );
    playerInstance.addListener('authentication_error', ({ message }) =>
        console.error('Authentication Error:', message)
    );
    playerInstance.addListener('account_error', ({ message }) =>
        console.error('Account Error:', message)
    );
    playerInstance.addListener('playback_error', ({ message }) =>
        console.error('Playback Error:', message)
    );

    // State Change Listener
    playerInstance.addListener('player_state_changed', (state) => {
        handlePlayerStateChanged(state);
    });

    playerInstance.getVolume().then((volume) => {
        $('#volume-slider').val(volume); // Set slider value to match initial volume
        console.log(`Initial volume: ${volume}`);
    }).catch(error => {
        console.error('Failed to get initial volume:', error);
    });

    // Connect the Player
    playerInstance.connect();
}

export function onPlayerReady(device_id) {
    console.log('Player is ready with Device ID:', device_id);
    transferPlaybackHere(device_id);

    const player = getPlayerInstance();
    if (player) {
        // Fetch the current player state
        player.getCurrentState().then(state => {
            if (state) {
                handlePlayerStateChanged(state);
            } else {
                console.log('User is not playing music through the Web Playback SDK');
            }
        });
    }
}


/*********************************************************
 * Track Playing Logic:
 ********************************************************/

/**
 * Plays a specific track via the backend.
 * @param {string} trackUri - The Spotify URI of the track to play.
 */
export function playTrack(trackUri) {
    // Extract song ID from track URI
    const songIdMatch = trackUri.match(/spotify:track:(\w+)/);
    if (!songIdMatch) {
        console.error('Invalid track URI:', trackUri);
        alert('The selected track has an invalid URI and cannot be played.');
        return;
    }
    const song_id = songIdMatch[1];

    // Retrieves the current playback position
    const timestamp = 0; // Sets the position in milliseconds

    // Prepares a payload
    const payload = {
        song_id: song_id,
        timestamp: timestamp
    };

    $.ajax({
        url: '/spotify/play',
        method: 'PUT',
        data: JSON.stringify(payload),
        contentType: 'application/json',
        success: function() {
            console.log('Track started playing successfully.');
            const player = getPlayerInstance();
            if (player) {
                player.getCurrentState().then(state => {
                    if (state) {
                        handlePlayerStateChanged(state);
                    } else {
                        console.warn('Player state is unavailable.');
                    }
                }).catch(error => {
                    console.error('Error fetching player state:', error);
                });
            }
        },
        error: function(xhr, status, error) {
            console.error('Failed to play track:', xhr.responseText || error);
            if (xhr.status === 401) {
                console.error('Unauthorized: Access token may have expired.');
                alert('Session expired. Please log in again.');
            } else if (xhr.status === 404) {
                console.error('Device not found or user is not playing anything.');
                alert('Playback device not found. Please ensure Spotify is active on a device.');
            } else if (xhr.status === 400) {
                console.error('Bad Request: Invalid song ID.');
                alert('Cannot play the selected track. Please try another one.');
            } else {
                console.error(`Error (${xhr.status}):`, xhr.responseText || error);
                alert('An error occurred while trying to play the track. Please try again.');
            }
        }
    });
}




export function resumeLastTrack() {
    const player = getPlayerInstance();
    console.log(`[DEBUG] RESUME LAST TRACK: ${player}`)
    const storedTrack = JSON.parse(localStorage.getItem('currentTrack'));
    if (player && storedTrack && storedTrack.uri) {
        playTrack(storedTrack.uri);
    } else {
        console.error('No track available to play.');
        alert('No track available to play. Please select a track.');
    }
};

/**
 * Retrieves the initialized Spotify player instance.
 * @returns {Spotify.Player|null} The Spotify player instance or null if not initialized.
 */
export function getPlayerInstance() {
    return window.playerInstance || null;
}

export function getDeviceId() {
    return deviceId;
};

export function getAccessToken() {
    return accessToken;
};


/*********************************************************
 * Playback Logic:
 ********************************************************/

/**
 * Transfers Spotify playback to the specified device via the backend.
 * @param {string} device_id - The Spotify device ID to transfer playback to.
 */
export function transferPlaybackHere(device_id) {
    $.ajax({
        url: '/spotify/transfer-playback', 
        method: 'PUT',
        data: JSON.stringify({ device_ids: [device_id], play: true }), // Correct payload structure
        contentType: 'application/json',
        success: () => {
            console.log(`Playback successfully transferred to the device: ${device_id}`);
        },
        error: (xhr, status, error) => {
            console.error('Failed to transfer playback:', xhr.responseText || error);
            alert('Failed to transfer playback. Please try again.');
        },
    });
}


// Makes an AJAX call to verify the active Spotify device
export function ensureActiveDevice(trackId, callback) {
    $.ajax({
        url: '/spotify/device', 
        method: 'GET',
        success: (response) => {
            if (response.error) {
                console.error("Active device issue:", response.error);
                alert(
                    "No active Spotify device detected. Please ensure Spotify is open and active on one of your devices."
                );
            } else if (response.device) {
                console.log("Active device confirmed:", response.device);
                callback(trackId);
            } else {
                console.error("No active device found.");
                alert(
                    "No active device available for playback. Please select a device in your Spotify app."
                );
            }
        },
        error: (xhr, status, error) => {
            console.error("Error ensuring active device:", xhr.responseText || error);
            alert(
                "Failed to verify active device. Please check your Spotify connection and try again."
            );
        },
    });
}


export function togglePlayPause() {
    if (!playerInstance) {
        console.error('Player instance is not initialized.');
        return;
    }
    playerInstance.togglePlay().then(() => console.log('Toggled playback state.'));
}

export function seekToPosition(positionInSeconds) {
    const player = getPlayerInstance();
    if (!player) {
        console.error('Player instance is not initialized.');
        return;
    }

    const positionInMilliseconds = Math.round(positionInSeconds * 1000); // Convert seconds to milliseconds
    player.seek(positionInMilliseconds)
        .then(() => console.log(`Seeked to position: ${positionInMilliseconds} ms`))
        .catch((error) => console.error('Failed to seek position:', error));
};

let progressInterval = null;
export function startProgressUpdate(initialPosition, duration, updateProgressCallback) {
    stopProgressUpdate(); 
    let position = initialPosition;
    progressInterval = setInterval(() => {
        const player = getPlayerInstance();
        if (player) {
            player.getCurrentState().then((state) => {
                if (state) {
                    const { position, duration } = state;
                    updateProgressCallback(position, duration);
    
                    if (position >= duration) {
                        stopProgressUpdate();
                    }
                }
            }).catch((err) => console.error("Error fetching playback state:", err));
        }
    }, 1000);
    updateProgressCallback(position, duration); 
};


export function stopProgressUpdate() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
};







