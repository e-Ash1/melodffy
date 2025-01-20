import { generateTrackHTML, generateRecentHTML, generateLikedTracksHTML, generateQueueHTML } from './generateHTML.js';
import { displayLikedTracks } from './uiUpdates.js';

/*********************************************************
 * Playback Controls & Existing Endpoints ***TRUNCATED
 ********************************************************/
export function playSong(songId, timestamp = 0) {
    return $.ajax({
        url: '/play',
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ song_id: songId, timestamp: timestamp }),
    })
    .done(response => {
        console.log('Playback started successfully:', response);
    })
    .fail(xhr => {
        console.error('Failed to start playback:', xhr.responseText);
    });
}

export function pauseSong() {
    return $.ajax({
        url: '/pause', 
        method: 'PUT',
    })
    .done(response => {
        console.log('Playback paused successfully:', response);
    })
    .fail(xhr => {
        console.error('Failed to pause playback:', xhr.responseText);
    });
}

export function nextSong() {
    return $.ajax({
        url: '/next',
        method: 'PUT',
    })
    .done(response => {
        console.log('Skipped to next track:', response);
    })
    .fail(xhr => {
        console.error('Failed to skip to next track:', xhr.responseText);
    });
}

export function previousSong() {
    return $.ajax({
        url: '/prev',
        method: 'PUT',
    })
    .done(response => {
        console.log('Skipped to previous track:', response);
    })
    .fail(xhr => {
        console.error('Failed to skip to previous track:', xhr.responseText);
    });
}

export function getTrackDetails(trackId) {
    return $.ajax({
        url: `/track/${trackId}`,  
        method: 'GET',
    })
    .done(response => {
        console.log('Retrieved track details:', response);
    })
    .fail(xhr => {
        console.error('Failed to get track details:', xhr.responseText);
    });
}

export function fetchSpotifyToken() {
    return $.ajax({
        url: '/auth/token',
        method: 'GET',
        xhrFields: {
            withCredentials: true
        }
    })
    .done(response => {
        console.log('Successfully fetched token:', response);
        return response;
    })
    .fail((xhr, status, error) => {
        if (xhr.status === 401) {
            console.error('Unauthorized: Please log in.');
        } else {
            console.error('Failed to fetch Spotify token:', {
                status,
                error,
                response: xhr.responseText,
            });
        }
    });
}

/*********************************************************
 * Queue Logic:
 ********************************************************/
export function fetchQueuedTracks() {
    return $.ajax({
      url: '/queue',
      type: 'GET',
    })
    .then(response => {
      const queue = response.queue; 
      return queue;
    })
    .catch(error => {
      console.error('Error fetching queued tracks:', error);
      throw error;
    });
  }
  


export function addToQueue(track) {
    return $.ajax({
        url: '/queue/add',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(track),
    })
    .done(response => {
        console.log('Track added to queue:', response);
        alert('Track added to the Queue!');
    })
    .fail(error => {
        console.error('Error adding track to queue:', error);
    });
}

export function removeFromQueue(trackId) {
    return $.ajax({
        url: `/queue/remove/${trackId}`,
        type: 'POST',
    })
    .done(response => {
        console.log('Track removed from queue:', response);
        $(`#track-${trackId}`).fadeOut(function () {
            $(this).remove();
        });
        alert('Track removed from the Queue!');
    })
    .fail(error => {
        console.error('Error removing track from queue:', error);
    });
}

/*********************************************************
 * Search Functionality:
 ********************************************************/
export function performSearch(query, type) {
    return $.ajax({
        url: `/spotify/search?query=${encodeURIComponent(query)}&type=${type}`,
        type: 'GET',
    })
    .done(data => data)
    .fail(error => {
        console.error('Search failed:', error);
        throw error;
    });
}

/*********************************************************
 * Fetches the User's Liked and Recent Songs from the DB:
 ********************************************************/
export function fetchLikedTracks() {
    return $.ajax({
        url: '/spotify/liked-tracks',
        method: 'GET',
    })
    .done(response => {
        // response is an array of track objects from local DB
        console.log('Liked Tracks:', response);
        localStorage.setItem('likedTracks', JSON.stringify(response));
        return response;
    })
    .fail(error => {
        console.error('Error fetching local liked tracks:', error);
        throw error;
    });
};

export function fetchRecentTracks() {
    return $.ajax({
        url: '/spotify/recent-tracks',
        method: 'GET'
    })
    .done(response => {
        console.log('Recent Tracks:', response);
        localStorage.setItem('recentTracks', JSON.stringify(response));
        return response;
    })
    .fail(xhr => {
        console.error('Failed to sync recent tracks:', xhr.responseText);
        throw xhr;
    });
};

/*********************************************************
 * Fetches the last track played through Spotify:
 ********************************************************/
export function fetchLastPlayedTrack() {
    return $.ajax({
        url: '/spotify/recent-tracks',
        method: 'GET',
    })
    .done(function(response) {
        console.log('Local recent tracks:', response);
        if (response && response.length > 0) {
            const lastTrack = response[0];
            // Formats the incoming Data from the Server:
            const trackInfo = {
                id: lastTrack.id,
                name: lastTrack.name,
                artist: lastTrack.artist,
                album: lastTrack.album,
                albumArt: lastTrack.albumArt || 'default-image-url.jpg',
                uri: lastTrack.uri,
                durationMs: lastTrack.durationMs 
            };
            localStorage.setItem('currentTrack', JSON.stringify(trackInfo));
            return [trackInfo];
        } else {
            console.log('No recent tracks in local DB.');
            return [];
        }
    })
    .fail(function(xhr) {
        console.error('Failed to fetch local recently played tracks.', xhr.responseText);
        if (xhr.status === 401) {
            console.error('[ERROR]: Error in retrieving response in fetchLastPlayedTrack()')
        }
        throw new Error(xhr.responseText);
    });
};

/*********************************************************
 * Liking/Unliking Tracks Handling:
 ********************************************************/

/**
 * Handles liking a track and dynamically updates the UI for liked tracks.
 * @param {Object} track - The track object containing id, uri, name, etc.
 */
export function likeTrack(track) {
    return $.ajax({
        url: '/spotify/like', 
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ track }),
        success: function (response) {
            console.log('Track liked successfully:', response);

            // Update the liked tracks UI
            const likedTracksContainer = $('#search-results');

            // If liked tracks are already displayed, prepend the new liked track
            if (likedTracksContainer.find('h2:contains("Liked Tracks")').length > 0) {
                const newTrackHTML = generateLikedTracksHTML(track, 0);
                likedTracksContainer.prepend(newTrackHTML);

                // Re-index the existing liked tracks
                likedTracksContainer.children('.track-entry').each((index, element) => {
                    const trackIdElement = $(element).find('.track-id');
                    trackIdElement.text(index + 1); // Update the visible index
                    $(element).attr('id', `track-${index}`); // Update the track ID
                });
            } else {
                // If liked tracks are not displayed, fetch and display all liked tracks
                $.ajax({
                    url: '/spotify/liked-tracks', // Endpoint to fetch all liked tracks
                    method: 'GET',
                    success: function (likedTracks) {
                        displayLikedTracks(likedTracks); // Update the UI with all liked tracks
                    },
                    error: function (xhr, status, error) {
                        console.error('Failed to fetch liked tracks:', xhr.responseText || error);
                    },
                });
            }

            // Optionally update the UI state of the like button in other areas
            const button = $(`[data-track-id="${track.id}"]`);
            button.data('liked', true);
            button.attr('aria-label', `Unlike ${track.name}`);
            button.addClass('text-red-500');
        },
        error: function (xhr, status, error) {
            console.error('Failed to like track:', xhr.responseText || error);
            alert('Failed to like the track. Please try again.');
        }
    });
};


/**
 * Handles unliking a track and dynamically updates the UI for liked tracks.
 * @param {Object} track - The track object containing id, uri, name, etc.
 */
export function unlikeTrack(track) {
    return $.ajax({
        url: '/spotify/unlike', 
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ id: track.id }),
        success: function (response) {
            console.log('Track unliked successfully:', response);

            // Updates the liked tracks UI
            const likedTracksContainer = $('#search-results');

            // Check if the liked tracks list is currently displayed
            if (likedTracksContainer.find('h2:contains("Liked Tracks")').length > 0) {
                // Finds and remove the unliked track from the list
                const trackElement = likedTracksContainer.find(`[data-track-id="${track.id}"]`).closest('.track-entry');
                trackElement.remove();

                // Re-indexes the remaining tracks
                likedTracksContainer.children('.track-entry').each((index, element) => {
                    const trackIdElement = $(element).find('.track-id');
                    trackIdElement.text(index + 1); // Updates the visible index
                    $(element).attr('id', `track-${index}`); // Updates the track ID
                });
            } else {
                // If liked tracks are not displayed, fetch and update the full list
                $.ajax({
                    url: '/spotify/liked-tracks', 
                    method: 'GET',
                    success: function (likedTracks) {
                        displayLikedTracks(likedTracks); 
                    },
                    error: function (xhr, status, error) {
                        console.error('Failed to fetch liked tracks:', xhr.responseText || error);
                    },
                });
            }

            // Updates the UI state of the like button in other areas
            const button = $(`[data-track-id="${track.id}"]`);
            button.data('liked', false);
            button.attr('aria-label', `Like ${track.name}`);
            button.removeClass('text-red-500');
            button.html(`
                <!-- Like Icon -->
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5c2.75 0 5.25 2.25 5.25 6s-3 8.25-8.25 11.25C5.25 18.75 2.25 12 2.25 10.5S4.5 4.5 7.5 4.5c1.406 0 2.63.62 3.75 1.715C13.12 5.12 14.344 4.5 15.75 4.5z" />
                </svg>
            `);
        },
        error: function (xhr, status, error) {
            console.error('Failed to unlike track:', xhr.responseText || error);
            alert('Failed to unlike the track. Please try again.');
        }
    });
};


