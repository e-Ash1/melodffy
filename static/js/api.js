import {
    fetchSpotifyToken,
    fetchLastPlayedTrack,
    fetchRecentTracks,      
    fetchLikedTracks,      
    fetchQueuedTracks,
    addToQueue,
    removeFromQueue,
    unlikeTrack,
    likeTrack,
    performSearch,
} from './apiRequests.js';

import {
    displayLikedTracks,
    displayRecentTracks,
    displayQueuedTracks,
    displaySearchResults,
} from './uiUpdates.js';

import { 
    setQueue, 
    getQueue,
    nextTrack,
    prevTrack, 
    setCurrentTrackIndex, 
    getCurrentTrackUri 
} from './queueManager.js';

import {
    initializeSpotifyPlayer,
    playTrack,
    resumeLastTrack,
    getPlayerInstance,
    ensureActiveDevice,
    transferPlaybackHere,
    startProgressUpdate,
    stopProgressUpdate,
} from './player.js';

import {
    handlePlayerStateChanged,
    updateProgressCallback
} from './playerTrack.js';

import {
    formatTime,
    updateTimeDisplays
} from './utils.js';

/*********************************************************
 * Initialize Spotify Web Playback SDK:
 ********************************************************/
window.onSpotifyWebPlaybackSDKReady = () => {
    fetchSpotifyToken()
      .then(response => {
        if (response?.error === 'Unauthorized') {
          window.location.href = '/auth/login';
        } else {
          const token = response?.access_token;
          if (!token) {
            throw new Error('Failed to fetch Spotify token.');
          }
          initializeSpotifyPlayer(
              token,
              handlePlayerStateChanged,
              transferPlaybackHere,
          );
        }
      })
      .catch((error) => {
        console.error('Error fetching token:', error);
      });
};

$(document).ready(function () {
    /*********************************************************
     * Search Form Submission:
     ********************************************************/
    $('form').on('submit', function (event) {
        event.preventDefault();
        const query = $('#search-query').val();
        const type = $('#search-type').val();

        performSearch(query, type)
        .then((data) => {
            displaySearchResults(data, type);
            // If it's track results, set the queue
            if (type === 'track' && data.tracks?.items?.length) {
                const tracks = data.tracks.items.map(track => track.uri);
                setQueue(tracks);
            }
        })
        .catch(() => {
            $('#search-results').html(
                '<p class="text-red-500 text-center">Failed to retrieve data. Please try again.</p>'
            );
        });
    });

    /*********************************************************
     * Queue Button: fetch queued tracks:
     ********************************************************/
    $(document).on('click', '#queued-tracks-btn', function () {
        fetchQueuedTracks()
            .then(queue => {
                console.log('Fetched queue:', queue);
                if (queue && queue.length > 0) {
                    displayQueuedTracks(queue);
                } else {
                    $('#search-results')
                        .html('<p class="text-white text-center">No tracks in the queue.</p>')
                        .fadeIn();
                }
            })
            .catch(error => {
                console.error('Error fetching queued tracks:', error);
            });
    });

    /*********************************************************
     * Liked Tracks Button:
     ********************************************************/
    $(document).on('click', '#liked-tracks-btn', function () {
        fetchLikedTracks()
            .then(tracks => {
                if (tracks && tracks.length > 0) {
                    displayLikedTracks(tracks);
                } else {
                    $('#search-results')
                        .html('<p class="text-white text-center">You have no liked songs yet.</p>')
                        .fadeIn();
                }
            })
            .catch(error => {
                console.error('Error fetching liked tracks:', error);
                $('#search-results')
                    .html('<p class="text-white text-center">An error occurred while fetching liked songs. Please try again later.</p>')
                    .fadeIn();
            });
    });

    /*********************************************************
     * Recently Played Button:
     ********************************************************/
    $(document).on('click', '#recent-tracks-btn', function () {
        fetchRecentTracks()
            .then(tracks => {
                if (tracks && tracks.length > 0) {
                    displayRecentTracks(tracks);
                } else {
                    $('#search-results')
                        .html('<p class="text-white text-center">No recently played tracks found.</p>')
                        .fadeIn();
                }
            })
            .catch(error => {
                console.error('Error fetching recently played tracks:', error);
            });
    });


    /*********************************************************
     * Queue: Add / Remove:
     ********************************************************/
    $(document).on('click', '.add-queue-btn', function () {
        const trackData = $(this).data('track');
        addToQueue(trackData);
    });

    $(document).on('click', '.remove-queue-btn', function() {
        const trackData = $(this).data('id');
        removeFromQueue(trackData);
    });

    /*********************************************************
     * Like Button Toggle:
     ********************************************************/
    $(document).on('click', '.like-btn', function () {
        try {
            const button = $(this); 
            const likeTrackData = button.data('track');

            // Toggles the like state
            if (button.data('liked')) {
                unlikeTrack(likeTrackData).then(() => {
                    button.data('liked', false);
                    button.removeClass('text-red-500');
                });
            } else {
                likeTrack(likeTrackData).then(() => {
                    button.data('liked', true);
                    button.addClass('text-red-500');
                });
            }
        } catch (error) {
            console.error('Error toggling like state:', error);
        };
    });

    /*********************************************************
     * Remove Like Button:
     ********************************************************/
    $(document).on('click', '.remove-like-btn', function () {
        try {
            const button = $(this); // Selects the button element
            const trackData = JSON.parse(button.attr('data-track')); // Parse the track data
            console.log(`[DEBUG] Remove Like Track Data:`, trackData);

            unlikeTrack(trackData).then(() => {
                // Removes the track from the UI
                button.closest('.track-entry').remove();

                // Re-indexes the remaining liked tracks
                const likedTracksContainer = $('#search-results');
                likedTracksContainer.children('.track-entry').each((index, element) => {
                    const trackIdElement = $(element).find('.track-id');
                    trackIdElement.text(index + 1); // Update the visible index
                    $(element).attr('id', `track-${index}`); // Update the track ID
                });
            });
        } catch (error) {
            console.error('Error removing like:', error);
        }
    });


    /*********************************************************
     * Play Buttons:
     ********************************************************/
    $(document).on('click', '.search-play-btn', function () {
        const player = getPlayerInstance();
        if (player) {
            player.getCurrentState().then((state) => {
                if (state) {
                    // Toggle play/pause
                    player.togglePlay().catch(error => {
                        console.error('Error toggling play/pause:', error);
                    });
                } else {
                    // No active playback, attempt to resume last track
                    resumeLastTrack();
                }
            }).catch(error => {
                console.error('Error getting current state:', error);
            });
        } else {
            console.error('Player instance is not initialized.');
        };

        const trackUri = $(this).data('track-uri');
        const trackId = $(this).data('track-id');

        console.log('Search Play Button Clicked - Track ID:', trackId);
        console.log('Track URI:', trackUri);

        // Validates the track URI
        if (!trackUri || typeof trackUri !== 'string' || !trackUri.startsWith('spotify:track:')) {
            console.error('Invalid track URI:', trackUri);
            alert('The selected track has an invalid URI and cannot be played.');
            return;
        }

        // Adds the track to the queue
        const queue = getQueue();
        const trackExists = queue.some(track => track.id === trackId);

        if (!trackExists) {
            const trackName = $(this).data('track-name');
            const albumName = $(this).data('album-name');
            const albumArtUrl = $(this).data('album-art-url');
            const artistNames = $(this).data('artist-names');

            queue.push({
                id: trackId,
                uri: trackUri,
                name: trackName,
                albumName: albumName,
                albumArtUrl: albumArtUrl,
                artistNames: artistNames
            });

            localStorage.setItem('queue', JSON.stringify(queue));
        }

        // Sets current track into localStorage 
        localStorage.setItem('currentTrack', JSON.stringify({ id: trackId }));

        // Initiates the playback
        playTrack(trackUri);
    });

    $(document).on('click', '.queue-play-btn', function () {
        const player = getPlayerInstance();
        if (player) {
            player.getCurrentState().then((state) => {
                if (state) {
                    // Toggle play/pause
                    player.togglePlay().catch(error => {
                        console.error('Error toggling play/pause:', error);
                    });
                } else {
                    // No active playback, attempt to resume last track
                    resumeLastTrack();
                }
            }).catch(error => {
                console.error('Error getting current state:', error);
            });
        } else {
            console.error('Player instance is not initialized.');
        };

        const trackUri = $(this).data('track-uri');
        const trackId = $(this).data('track-id'); // Optional, if needed
    
        console.log('Queue Play Button Clicked - Track URI:', trackUri);
    
        // Validates the track URI
        if (!trackUri || typeof trackUri !== 'string' || !trackUri.startsWith('spotify:track:')) {
            console.error('Invalid track URI:', trackUri);
            alert('The selected track has an invalid URI and cannot be played.');
            return;
        }
    
        // Sets the current track in localStorage
        localStorage.setItem('currentTrack', JSON.stringify({ id: trackId, uri: trackUri }));
    
        // Initiate playback
        playTrack(trackUri);
    });

    $(document).on('click', '.recents-play-btn', function () {
        
        const player = getPlayerInstance();
        if (player) {
            player.getCurrentState().then((state) => {
                if (state) {
                    // Toggle play/pause
                    player.togglePlay().catch(error => {
                        console.error('Error toggling play/pause:', error);
                    });
                } else {
                    // No active playback, attempt to resume last track
                    resumeLastTrack();
                }
            }).catch(error => {
                console.error('Error getting current state:', error);
            });
        } else {
            console.error('Player instance is not initialized.');
        };

        const trackUri = $(this).data('track-uri');
        const trackId = $(this).data('track-id');
    
        console.log('Recent Play Button Clicked - Track ID:', trackId);
        console.log('Track URI from recent tracks:', trackUri);
    
        // Validates the track URI
        if (!trackUri || typeof trackUri !== 'string' || !trackUri.startsWith('spotify:track:')) {
            console.error('Invalid track URI:', trackUri);
            alert('The selected track has an invalid URI and cannot be played.');
            return;
        }
    
        // Sets the current track in localStorage or application state
        localStorage.setItem('currentTrack', JSON.stringify({ id: trackId, uri: trackUri }));
    
        // Initiate playback
        playTrack(trackUri);
    });

    $(document).on('click', '.likes-play-btn', function () {
        
        const player = getPlayerInstance();
        if (player) {
            player.getCurrentState().then((state) => {
                if (state) {
                    // Toggle play/pause
                    player.togglePlay().catch(error => {
                        console.error('Error toggling play/pause:', error);
                    });
                } else {
                    // No active playback, attempt to resume last track
                    resumeLastTrack();
                }
            }).catch(error => {
                console.error('Error getting current state:', error);
            });
        } else {
            console.error('Player instance is not initialized.');
        };
        
        const trackUri = $(this).data('track-uri');
        const trackId = $(this).data('track-id');
    
    
        // Validates the track URI
        if (!trackUri || typeof trackUri !== 'string' || !trackUri.startsWith('spotify:track:')) {
            console.error('Invalid track URI:', trackUri);
            alert('The selected track has an invalid URI and cannot be played.');
            return;
        }
    
        // Sets the current track data into localStorage or application state
        localStorage.setItem('currentTrack', JSON.stringify({ id: trackId, uri: trackUri }));
    
        // Initiates the playback
        playTrack(trackUri);
    });

    /*********************************************************
     * Play/Pause Button in the Footer:
     ********************************************************/
    $('#play-pause-btn').on('click', function () {
        const player = getPlayerInstance();
        console.log(`[DEBUG] #play-pause-btn: PLAYER INSTANCE - ${player}`)
        if (player) {
            player.getCurrentState().then((state) => {
                if (state) {
                    // Toggle play/pause
                    player.togglePlay().catch(error => {
                        console.error('Error toggling play/pause:', error);
                    });
                } else {
                    // Tries to resume the last track if there isn't an active player
                    resumeLastTrack();
                }
            }).catch(error => {
                console.error('Error getting current state:', error);
            });
        } else {
            console.error('Player instance is not initialized.');
        }
    });
    
    /*********************************************************
     * Next / Previous Track Buttons: 
     ********************************************************/
    $('#next-btn').on('click', function () {
        const nextTrackUri = nextTrack();
        if (nextTrackUri) {
            playTrack(nextTrackUri);
        } else {
            console.log('No next track in the queue.');
        }
    });

    $('#prev-btn').on('click', function () {
        const prevTrackUri = prevTrack();
        if (prevTrackUri) {
            playTrack(prevTrackUri);
        } else {
            console.log('No previous track in the queue.');
        }
    });

    /*********************************************************
     * Theme Initialization & Toggle:
     ********************************************************/
    initializeTheme();

    $('#theme-toggle').change(function () {
        requestAnimationFrame(() => {
            $('body').toggleClass('dark', !$(this).is(':checked'));
            updateThemeStyles();
        });
    });

    /*********************************************************
     * Footer Animations:
     ********************************************************/
    $('#footer-container')
        .css('bottom', '-100px')
        .data('visible', false)
        .animate({ bottom: '0px' }, 850, () => {
            $(this).data('visible', true);
        });

    $('.footer-toggle').click(function () {
        const isFooterVisible = $('#footer-container').data('visible');
        if (!isFooterVisible) {
            $('#footer-container').animate({ bottom: '-100px' }, 650, function () {
                $(this).data('visible', true);
            });
        } else {
            $('#footer-container').animate({ bottom: '0px' }, 650, function () {
                $(this).data('visible', false);
            });
        }
    });

    /*********************************************************
     * Player Logic: Progress Bar:
     ********************************************************/
    $('#progress-bar').on('input', function () {
        const player = getPlayerInstance();
        if (player) {
            const newPosition = parseInt($(this).val(), 10);
            player.seek(newPosition).then(() => {
                console.log(`Seeked to position: ${newPosition}`);
                const duration = parseInt($('#progress-bar').attr('max'), 10);
                updateProgressCallback(newPosition, duration);
            });
        } else {
            console.error('Player instance is not initialized.');
        }
    });

    /*********************************************************
     * Restore Playback State on Page Load:
     ********************************************************/
    const storedTrack = JSON.parse(localStorage.getItem('currentTrack'));
    const storedPosition = parseInt(localStorage.getItem('currentTrackPosition'), 10) || 0;
    const isPlaying = localStorage.getItem('isPlaying') === 'true';

    const player = getPlayerInstance();

    if (!player) {
        console.error('Player instance is not initialized.');
        return;
    }

    // Wait for the player to be ready
    player.connect().then(success => {
        if (success) {
            console.log('Player connected successfully.');
            // Update UI with stored track info
            if (storedTrack) {
                updateFooterWithTrackInfo(storedTrack);
            } else {
                // Fetches the last played track if none is stored
                fetchLastPlayedTrack().then(track => {
                    if (track) {
                        updateFooterWithTrackInfo(track);
                    }
                });
            }

            // Resumes the playback, if a track and state are stored
            if (storedTrack && isPlaying) {
                ensureActiveDevice(storedTrack.id, () => {
                    player.seek(storedPosition).then(() => {
                        togglePlayPause(true, storedTrack.id);
                    }).catch(err => console.error('Error seeking to position:', err));
                });
            }
        } else {
            console.error('Failed to connect the player.');
        }
    }).catch(error => {
        console.error('Error connecting player:', error);
    });


    /*********************************************************
     * Theme Helper Functions: 
     ********************************************************/
    function initializeTheme() {
        if (!$('body').hasClass('dark')) {
            $('body').addClass('dark');
        }
        updateThemeStyles();
    }

    function updateThemeStyles() {
        if ($('body').hasClass('dark')) {
            updateStylesForDarkMode();
        } else {
            updateStylesForLightMode();
        }
    }

    function updateStylesForDarkMode() {
        $('body').css({ 'background-color': '#111827', color: '#f9fafb' });
        $('nav, footer').css({ 'background-color': '#1a202c', color: '#f9fafb' });
        $('#search-query, #search-type').css({ 'background-color': '#374151', color: '#f9fafb' });
        $('#footer-track, #footer-album-name').css({ color: '#f9fafb' });
    }

    function updateStylesForLightMode() {
        $('body').css({ 'background-color': '#f9fafb', color: '#111827' });
        $('nav, footer').css({ 'background-color': '#ffffff', color: '#111827' });
        $('#search-query, #search-type').css({ 'background-color': '#F2F4F5', color: '#111827' });
        $('#footer-track, #footer-album-name').css({ color: '#111827' });
    }
});
