$(document).ready(function () {
    // Event listener for submitting search queries
    $('form').on('submit', function(event) {
        event.preventDefault();
        performSearch();
    });

    // Initialize global variables and retrieve values from localStorage
    let isPlaying = localStorage.getItem('isPlaying') === 'true';
    let currentTrack = JSON.parse(localStorage.getItem('currentTrack')) || [];
    let likedTracks = JSON.parse(localStorage.getItem('likedTracks')) || [];
    let queuedTracks = JSON.parse(localStorage.getItem('queuedTracks')) || [];
    let recentTracks = JSON.parse(localStorage.getItem('recentTracks')) || [];

    // Check if a track is the current track
    function isCurrentTrack (trackId){
        return currentTrack.id === trackId;
    }

    // Fetch liked tracks from the server and store them in localStorage
    function fetchLikedTracks() {
        $.ajax({
            url: '/getTracks',
            type: 'GET',
            success: function(data) {
                console.log('Liked tracks:', data);
                localStorage.setItem('likedTracks', JSON.stringify(data));
            },
            error: function(error) {
                console.error('Error fetching liked tracks:', error);
            }
        });
    }

    // Fetch queued tracks from the server and store them in localStorage
    function generateQueuedTracks(){
        $.ajax({
            url: '/queue',
            type: 'GET',
            success: function(data) {
                console.log('Queued tracks:', data);
                localStorage.setItem('queuedTracks', JSON.stringify(data))
            },
            error: function(error) {
                console.error('Error fetching queued tracks:', error);
            }
        });
    }

    // Initial function calls to set up the player and fetch data
    updatePlayPause();
    updateFooter(currentTrack); 
    queueRecommendations(currentTrack.id);
    fetchLikedTracks();
    generateQueuedTracks();

    // Fetch an access token from the server and initialize the Spotify SDK
    window.onSpotifyWebPlaybackSDKReady = () => {
        $.ajax({
            url: '/token',
            method: 'GET',
            success: (token) => {
                initializeSDK(token)
            }
        });
    };

    // Initialize the Spotify SDK with the provided token
    function initializeSDK(token) {
        const player = new Spotify.Player({
            name: 'MELODFFY',
            getOAuthToken: cb => { cb(token); },
            volume: 1.0
        });

        // Add event listeners for various player events
        player.addListener('initialization_error', ({ message }) => {
            console.error('Failed to initialize', message);
        });
        player.addListener('authentication_error', ({ message }) => {
            console.error('Authentication error', message);
        });
        player.addListener('account_error', ({ message }) => {
            console.error('Account error', message);
        });
        player.addListener('playback_error', ({ message }) => {
            console.error('Playback error', message);
        });

        // Handle player state changes
        player.addListener('player_state_changed', state => {
            if (!state) return;
        
            let currentTrackId = state.track_window.current_track.id;
            let currentTrackDuration = state.duration;
            let currentPosition = state.position;
        
            currentTrack = {
                id: currentTrackId,
                name: state.track_window.current_track.name,
                artist: state.track_window.current_track.artists.map(artist => artist.name).join(', '),
                albumName: state.track_window.current_track.album.name,
                albumArtUrl: state.track_window.current_track.album.images[0].url,
                duration: currentTrackDuration,
                position: currentPosition
            };
        
            localStorage.setItem('currentTrack', JSON.stringify(currentTrack));
            localStorage.setItem('isPlaying', !state.paused);
            localStorage.setItem('currentTrackPosition', currentPosition); // Store the current position
        
            if (!state.paused) {
                startProgressUpdate(currentPosition, currentTrackDuration);
            } else {
                stopProgressUpdate();
            }
        });
        
        // Handle player ready state
        player.addListener('ready', ({ device_id }) => {
            console.log('Ready with Device ID', device_id);
            transferPlaybackHere(device_id);
    
            // Retrieve the position from localStorage and seek to that position
            const storedTrack = JSON.parse(localStorage.getItem('currentTrack'));
            const storedPosition = parseInt(localStorage.getItem('currentTrackPosition'), 10) || 0;
    
            if (storedTrack && storedPosition) {
                player.getCurrentState().then(state => {
                    if (state) {
                        player.seek(storedPosition).then(() => {
                            console.log(`Resumed playback from position ${storedPosition}`);
                            if (localStorage.getItem('isPlaying') === 'true') {
                                player.resume().then(() => {
                                    console.log('Resumed playback after page refresh');
                                });
                            }
                        });
                    }
                });
            }
        });

        // Handle player not ready state
        player.addListener('not_ready', ({ device_id }) => {
            console.log('Device ID has gone offline', device_id);
        });

        // Adjust volume based on the slider input
        $('#volume-slider').on('input change', function() {
            let volume = $(this).val();
            setVolume(volume);
        });

        // Set the player's volume and update the slider's color
        function setVolume(volume) {
            player.setVolume(volume / 100).then(() => {
            }).catch(e => console.error("Failed to set volume: ", e));
        
            let percentage = volume * 100 / $('#volume-slider').attr('max');
            $('#volume-slider').css('background', 'linear-gradient(to right, #10b981 0%, #10b981 ' + percentage + '%, black ' + percentage + '%, black 100%)');
        }

        player.connect();
    }

    // Transfer playback to the web player on page load
    function transferPlaybackHere(device_id) {
        $.ajax({
            url: '/transfer-playback',
            method: 'PUT',
            data: JSON.stringify({ device_id: device_id }),
            contentType: 'application/json',
            success: function(response) {
                console.log('Playback transferred to the web player.');
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Failed to transfer playback', textStatus, errorThrown);
            }
        });
    }

    // Start updating the progress bar and time displays
    let updateInterval;
    function startProgressUpdate(position, duration) {
        stopProgressUpdate();  
        updateProgressBar(position, duration);  
        updateInterval = setInterval(() => {
            position += 250;  
            if (position > duration) {
                position = duration;
                stopProgressUpdate(); 
            }
            updateProgressBar(position, duration);
            updateTimeDisplays(position, duration);
        }, 250);  
    }

    // Stop updating the progress bar and time displays
    function stopProgressUpdate() {
        clearInterval(updateInterval); 
    }

    // Update the current time and remaining time displays
    function updateTimeDisplays(position, duration) {
        let remaining = duration - position;
        $('#current-time').text(formatTime(position));
        $('#remaining-time').text(`-${formatTime(remaining)}`);
    }
    
    // Format time in mm:ss format
    function formatTime(milliseconds) {
        let totalSeconds = Math.floor(milliseconds / 1000);
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    // Update the progress bar's width
    function updateProgressBar(position, duration) {
        let progress = (position / duration) * 100;
        $('#progress-bar').css('width', progress + '%').attr('aria-valuenow', position).attr('aria-valuemax', duration);
    }

    // Queue recommendations based on the current track
    function queueRecommendations(track_id) {
        $.ajax({
            url: `/recommendations/${track_id}`,
            method: 'GET',
            success: function (newRecs) {
                // Update the queue with new recommendations
                newRecs.forEach(track => {
                    queueTrack(track.id);
                });
            },
            error: function (xhr, textStatus) {
                console.error("Error fetching queue:", textStatus);
            }
        });
    }

    // Add a track to the queue
    const queueTrack = (track_id) => {
        $.ajax({
            url: `/queue/add/${track_id}`,
            method: 'POST',
            data: JSON.stringify({ track_id: track_id }),
            contentType: 'application/json',
            success: function () {
                console.log(`Track ${track_id} added to queue.`);
            },
            error: function (xhr, textStatus) {
                console.error(`Error adding track ${track_id} to queue:`, textStatus);
            }
        });
    }

    // Toggle play/pause state
    function togglePlay() {
        const action = isPlaying ? 'pause' : 'play';
        const currentTrackPosition = parseInt(localStorage.getItem('currentTrackPosition'), 10) || 0;
        const playData = { song_id: currentTrack.id };
    
        if (action === 'play') {
            playData.timestamp = currentTrackPosition;
        }
    
        $.ajax({
            url: `/${action}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(playData),
            success: function(response) {
                setIsPlaying(!isPlaying);
            },
            error: function(xhr, textStatus) {
                console.error("Error toggling play/pause:", textStatus);
            }
        });
    }
    
    // Restore playback state on page load
    if (isPlaying) {
        $.ajax({
            url: '/play',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                song_id: currentTrack.id,
                timestamp: currentTrackPosition
            }),
            success: function() {
                console.log('Resumed playback from saved state.');
                updatePlayPause();
            },
            error: function(xhr, textStatus) {
                console.error("Error resuming playback:", textStatus);
            }
        });
    }

    // Set the isPlaying state and update the play/pause button
    function setIsPlaying(value) {
        isPlaying = value;
        localStorage.setItem('isPlaying', value.toString());
        updatePlayPause();
    }

    // Update the play/pause button icon
    function updatePlayPause() {
        const pauseCircleFill = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM9 9V15H11V9H9ZM13 9V15H15V9H13Z"></path></svg>';
        const playCircleFill = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path></svg>';
        $('#play-pause-btn').html(isPlaying ? pauseCircleFill : playCircleFill);
    }

    // Change the current track based on the direction (next/previous)
    function changeTrack(direction) {
        // Disable the buttons to prevent multiple requests
        $('#next-btn, #prev-btn').prop('disabled', true);
    
        $.ajax({
            url: `/${direction}`,
            method: 'PUT',
            success: () => {
                // Fetch current track details from the server
                fetchCurrentTrackDetails(currentTrack.id).then(newTrack => {
                    console.log(`Fetched new track details: ${JSON.stringify(newTrack)}`);
                    setIsPlaying(true);
                    updateFooter(newTrack);  
                    recentlyPlayed();
                    console.log(`${direction.toUpperCase()} TRACK IS PLAYING!`);
                    // Re-enable the buttons after update
                    $('#next-btn, #prev-btn').prop('disabled', false);
                }).catch(error => {
                    console.error('Failed to fetch track details:', error);
                    // Handle error
                    $('#next-btn, #prev-btn').prop('disabled', false);
                });
            },
            error: () => {
                console.log(`ERROR IN PLAYING THE ${direction.toUpperCase()} TRACK`);
                // Handle error
                $('#next-btn, #prev-btn').prop('disabled', false);
            }
        });
    }

    // Event listeners for next and previous track buttons
    $('#next-btn').on('click', function() {
        changeTrack('next');
    });
    
    $('#prev-btn').on('click', function() {
        changeTrack('prev');
    });
    
    // Add the current track to the recently played list
    function recentlyPlayed() {
        if (recentTracks.find(track => track.id === currentTrack.id)) {
            console.log('Track already in Recent Table!');
            return; // Stop if track is already added
        }
    
        // Add the current track to the recentTracks array and update local storage
        recentTracks.push({
            id: currentTrack.id,
            name: currentTrack.name,
            artist: currentTrack.artist,
            album: currentTrack.albumName,
            albumArt: currentTrack.albumArtUrl
        });
    
        // Keep the local storage from growing indefinitely
        if (recentTracks.length > 20) { 
            recentTracks.shift(); 
        }
    
        localStorage.setItem('recentTracks', JSON.stringify(recentTracks));
    
        // Continue with the AJAX call if the track is not in the recentTracks
        $.ajax({
            url: '/recently-played',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                id: currentTrack.id,
                name: currentTrack.name,
                artist: currentTrack.artist,
                album: currentTrack.albumName,
                albumArt: currentTrack.albumArtUrl
            }),
            success: function() {
                console.log('Track successfully added to the Recent Table!');
            },
            error: function(error) {
                console.log('Error adding track to the Recent Table:', error.statusText);
            }
        });
    }

    // Perform a search query and fetch data from the server
    function performSearch() {
        let query = $('#search-query').val();
        let type = $('#search-type').val();
        $.ajax({
            url: `/spotify-data?query=${encodeURIComponent(query)}&type=${type}`,
            method: 'GET',
            success: function (data) {
                displayResults(data, type);
            },
            error: function () {
                $('#search-results').html('<p class="text-red-500 text-center">Failed to retrieve data. Please try again.</p>').fadeIn();
            }
        });
    }

    // Display search results based on the query type
    function displayResults(data, type) {
        const resultsContainer = $('#search-results');
        resultsContainer.empty();

        let headerText = type === 'track' ? 'Tracks' : (type === 'artist' ? 'Artists' : 'Albums');
        let htmlContent = `<h2 class="text-xl text-center text-white font-bold my-4 font-family-TheBoldFont">${headerText}</h2>`;

        if (type === 'track' && data.tracks && data.tracks.items.length) {
            data.tracks.items.forEach((track, index) => {
                htmlContent += generateTrackHTML(track, index);
            });
        } else if (type === 'artist' && data.artists && data.artists.items.length) {
            data.artists.items.forEach((artist, index) => {
                htmlContent += generateArtistHTML(artist, index);
            });
        } else if (type === 'album' && data.albums && data.albums.items.length) {
            data.albums.items.forEach((album, index) => {
                htmlContent += generateAlbumHTML(album, index);
            });
        } else {
            htmlContent += '<div class="text-yellow-500 text-center p-4">No results found. Try a different query.</div>';
        }

        resultsContainer.html(htmlContent).fadeIn();
        $('#welcome-section').hide();
    }

    // Generate HTML for each track result
    const generateTrackHTML = (track, index) => {
        const { id, name, album, artists } = track;
        const albumName = album.name;
        const albumArtUrl = album.images[0] ? album.images[0].url : `{{ url_for('static', filename='images/logo.png') }}`; 
        const artistNames = artists.map(artist => artist.name).join(', '); 
        const isCurrent = isCurrentTrack(id);
    
        return `
            <div id="track-${index}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} track-entry font-tbf bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
                <p class="track-id text-sm text-gray-300 font-bold">${index}</p>
                <img class="w-16 h-16 rounded-lg object-cover" src="${albumArtUrl}" alt="Album Art for ${albumName}">
                <div class="info flex-grow">
                    <p class="track-name text-lg text-white font-semibold">${name}</p>
                    <p class="artist-name text-sm text-gray-300">${artistNames}</p>
                    <p class="album-name text-sm text-gray-300">${albumName}</p>
                </div>
                <div class="controls flex space-x-2">
                    <button class="add-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in"
                            data-id="${id}" data-name="${name}" data-album-name="${albumName}" data-artists="${artistNames}" data-album-art-url="${albumArtUrl}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                    <button class="like-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" 
                            data-id="${id}" data-name="${name}" data-artist="${artistNames}" data-album-name="${albumName}" data-album-art="${albumArtUrl}" data-control="like">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5c2.75 0 5.25 2.25 5.25 6s-3 8.25-8.25 11.25C5.25 18.75 2.25 12 2.25 10.5S4.5 4.5 7.5 4.5c1.406 0 2.63.62 3.75 1.715C13.12 5.12 14.344 4.5 15.75 4.5z" />
                        </svg>
                    </button>
                    <button id="play-btn" class="play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${id}" data-control="play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                            <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                        </svg>
                    </button>
                </div>
            </div>`;
    }

    // Play/Pause button on the Player-Controller
    $('#play-pause-btn').click(togglePlay);

    // Event listener that sends a play request to play the selected track
    $(document).on('click', '#play-btn', function() {
        const trackId = $(this).data('track-id');
        console.log(currentTrack.id);
        console.log(trackId);

        $.ajax({
            url: '/play',
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ song_id: trackId }),
            success: function(response) {
                console.log('Track started playing successfully.');

                // Fetch current track details from the server
                fetchCurrentTrackDetails(trackId).then(newTrack => {
                    console.log(`Fetched new track details: ${JSON.stringify(newTrack)}`);
                    setIsPlaying(true);
                    recentlyPlayed();
                    updateFooter(newTrack);  
                });
            },
            error: function(xhr, textStatus) {
                console.error('Failed to start playing the track:', textStatus);
            }
        });
    });

    // Fetch current track details from the server
    function fetchCurrentTrackDetails(trackId) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `/track/${trackId}`, 
                method: 'GET',
                success: function(response) {
                    resolve(response);  
                },
                error: function(xhr, textStatus, errorThrown) {
                    console.error('Failed to fetch track details:', textStatus);
                    console.error('Error:', errorThrown); // Log the specific error
                    reject(errorThrown);
                }
            });
        });
    }

    // Event listener to add tracks to the liked tracks list
    $(document).on('click', '.like-btn', function() {
        const id = $(this).data('id');
        const name = $(this).data('name');
        const artist = $(this).data('artist'); 
        const albumName = $(this).data('album-name'); 
        const albumArt = $(this).data('album-art');

        console.log('Adding track to the DB:', { id, name, artist, albumName, albumArt });

        $.ajax({
            url: '/addTrack',
            method: 'POST',
            data: JSON.stringify({
                id: id,
                name: name,
                artist: artist,
                album: albumName,
                albumArt: albumArt
            }),
            contentType: 'application/json',
            success: function(response) {
                alert('Track added successfully.');
                fetchLikedTracks();
                console.log('Track successfully added to the Table!', response);
            },
            error: function(xhr, status, error) {
                console.log('Error in adding track to the Table:', xhr.responseText);
            }
        });
    });

    // Event listener to remove tracks from the liked tracks list
    $(document).on('click', '.remove-btn', function() {
        const id = $(this).data('id');
        const name = $(this).data('name');
        const artist = $(this).data('artist');
        const albumName = $(this).data('album-name');
        const albumArt = $(this).data('album-art');
        const index = $(this).data('index');

        if (confirm(`Are you sure you want to remove "${name}" by ${artist} from your liked songs?`)) {
            $.ajax({
                url: '/removeTrack',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ id: id, name: name, artist: artist, album: albumName, albumArt: albumArt }),
                success: function(response) {
                    console.log(response);
                    alert('Track removed successfully.');
                    $(`#track-${index}`).fadeOut(500, function() {
                        $(this).remove();  // Remove the element after the fade out completes
                    });
                },
                error: function(xhr, status, error) {
                    console.error('Failed to remove track:', xhr.responseText);
                    alert('Failed to remove track. Please try again.');
                }
            });
        }
    });

    // Event listeners for track buttons
    $('#recent-tracks-btn').on('click', function() {
        toggleDisplay('recent');
    });

    $('#liked-tracks-btn').on('click', function() {
        toggleDisplay('liked');
    });

    $('#queued-tracks-btn').on('click', function() {
        toggleDisplay('queue');
    });

    // State variable to track which content is currently displayed
    let currentlyDisplayed = null;

    // Toggle display function to show different track lists
    function toggleDisplay(type) {
        let tracks = JSON.parse(localStorage.getItem(`${type}Tracks`)) || [];
        tracks.reverse();  // Display the most recent or liked tracks first

        if (currentlyDisplayed !== type) {
            let htmlContent = `<h2 class="text-xl text-center text-white font-bold my-4 font-tbf">${getTitleForType(type)}</h2>`;
            if (type === 'recent') {
                htmlContent += tracks.map((track, index) => generateRecentHTML(track, index)).join('');
            } else if (type === 'liked') {
                htmlContent += tracks.map((track, index) => generateLikedTracksHTML(track, index)).join('');
            } else if (type === 'queue') {
                fetchQueue();
                return;
            }
            $('#search-results').html(htmlContent).fadeIn();
            $('#welcome-section').fadeOut();
            currentlyDisplayed = type;
        } else {
            $('#search-results').fadeOut();
            $('#welcome-section').fadeIn();
            currentlyDisplayed = null;
        }
    }

    // Helper function to get the title based on the type
    function getTitleForType(type) {
        switch(type) {
            case 'recent':
                return 'Recently Played Songs';
            case 'liked':
                return 'Liked Songs';
            case 'queue':
                return 'Queue';
            default:
                return '';
        }
    }

    // Generate HTML for each recently played track
    const generateRecentHTML = (track, index) => {
        const { id, name, album, artist, albumArt } = track;
        const isCurrent = isCurrentTrack(id);

        return `
            <div id="track-${index}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} font-tbf bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
                <p class="track-id text-sm text-gray-300 font-bold">${index}</p>
                <img class="w-16 h-16 rounded-lg object-cover" src="${albumArt}" alt="Album Art">
                <div class="info flex-grow">
                    <p class="track-name text-lg text-white font-semibold">${name}</p>
                    <p class="artist-name text-sm text-gray-300">${artist}</p>
                    <p class="album-name text-sm text-gray-300">${album}</p>
                </div>
                <div class="controls flex space-x-2">
                <button class="add-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in"data-id="${id}" data-name="${name}" data-album-name="${album}" data-artists="${artist}" data-album-art-url="${albumArt}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                    <button class="like-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" data-id="${id}" data-name="${name}" data-artist="${artist}" data-album-name="${album}" data-album-art="${albumArt}" data-control="like">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5c2.75 0 5.25 2.25 5.25 6s-3 8.25-8.25 11.25C5.25 18.75 2.25 12 2.25 10.5S4.5 4.5 7.5 4.5c1.406 0 2.63.62 3.75 1.715C13.12 5.12 14.344 4.5 15.75 4.5z" />
                        </svg>
                    </button>
                    <button id="play-btn" class="play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${id}" data-control="play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                            <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                        </svg>
                    </button>
                </div>
            </div>`;
    }

    // Generate HTML for each liked track
    const generateLikedTracksHTML = (track, index) => {
        const { id, name, artist, album, albumArt } = track;
        const isCurrent = isCurrentTrack(id);

        return `
            <div id="track-${index}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} font-tbf bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
                <p class="track-id text-sm text-gray-300 font-bold">${index}</p>
                <img class="w-16 h-16 rounded-lg object-cover" src="${albumArt}" alt="Album Art">
                <div class="info flex-grow">
                    <p class="track-name text-lg text-white font-semibold">${name}</p>
                    <p class="artist-name text-sm text-gray-300">${artist}</p>
                    <p class="album-name text-sm text-gray-300">${album}</p>
                </div>
                <div class="controls flex space-x-2">
                    <button class="add-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in"data-id="${track.id}" data-name="${track.name}" data-album-name="${track.albumName}" data-artists="${track.artists}" data-album-art-url="${track.albumArtUrl}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                    <button class="remove-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" data-index="${index}" data-id="${id}" data-name="${name}" data-artist="${artist}" data-album-name="${album}" data-album-art="${albumArt}" data-control="like">
                        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="21" height="21" viewBox="0 0 26 26" fill="currentColor">
                            <path d="M 13 0.1875 C 5.925781 0.1875 0.1875 5.925781 0.1875 13 C 0.1875 20.074219 5.925781 25.8125 13 25.8125 C 20.074219 25.8125 25.8125 20.074219 25.8125 13 C 25.8125 5.925781 20.074219 0.1875 13 0.1875 Z M 18.78125 17.394531 L 17.390625 18.78125 C 17.136719 19.035156 16.722656 19.035156 16.46875 18.78125 L 13 15.3125 L 9.53125 18.78125 C 9.277344 19.035156 8.863281 19.035156 8.609375 18.777344 L 7.21875 17.394531 C 6.96875 17.136719 6.96875 16.726563 7.21875 16.46875 L 10.6875 13 L 7.222656 9.535156 C 6.96875 9.277344 6.96875 8.863281 7.222656 8.609375 L 8.609375 7.222656 C 8.863281 6.964844 9.28125 6.964844 9.535156 7.222656 L 13 10.6875 L 16.46875 7.222656 C 16.722656 6.964844 17.140625 6.964844 17.390625 7.222656 L 18.78125 8.605469 C 19.035156 8.863281 19.035156 9.277344 18.78125 9.535156 L 15.3125 13 L 18.78125 16.46875 C 19.03125 16.726563 19.03125 17.136719 18.78125 17.394531 Z"></path>
                        </svg>
                    </button>
                    <button id="play-btn" class="play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${id}" data-control="play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                            <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                        </svg>
                    </button>
                </div>
            </div>`;
    }

    // Generate HTML for each track in the queue
    function generateQueueHTML(track) {
        const { id, name, artist, album, albumArt } = track;
        const isCurrent = isCurrentTrack(id);
        return `
            <div id="track-${track.id}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} font-tbf hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
                <img class="w-16 h-16 rounded-lg object-cover" src="${track.albumArtUrl || 'default_album_art.jpg'}" alt="Album Art">
                <div class="info flex-grow">
                    <p class="track-name text-lg text-white font-semibold">${track.name}</p>
                    <p class="artist-name text-sm text-gray-300">${track.artists}</p>
                </div>
                <div class="controls flex space-x-2">
                    <button class="remove-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in" data-id="${track.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <button class="like-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" data-id="${track.id}" data-name="${track.name}" data-artist="${track.artists}" data-album-name="${track.albumName}" data-album-art="${track.albumArtUrl}" data-control="like">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5c2.75 0 5.25 2.25 5.25 6s-3 8.25-8.25 11.25C5.25 18.75 2.25 12 2.25 10.5S4.5 4.5 7.5 4.5c1.406 0 2.63.62 3.75 1.715C13.12 5.12 14.344 4.5 15.75 4.5z" />
                        </svg>
                    </button>
                    <button id="play-btn" class="play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${track.id}" data-control="play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                            <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                        </svg>
                    </button>
                </div>
            </div>`;
    }

    // Fetch and display the queue
    function fetchQueue() {
        $.ajax({
            url: '/queue',
            method: 'GET',
            success: function(response) {
                const queue = response.queue;
                localStorage.setItem('queuedTracks', JSON.stringify(queue));
                displayQueueTracks(queue, response.current_index);
            },
            error: function() {
                console.error('Failed to fetch the queue');
            }
        });
    }

    // Display all tracks in the queue
    function displayQueueTracks(tracks, currentIndex) {
        let htmlContent = `<h2 class="text-xl text-center text-white font-bold font-tbf my-4">Queued Tracks</h2>`;
        tracks.forEach((track, index) => {
            htmlContent += generateQueueHTML(track, index === currentIndex);
        });
        $('#search-results').html(htmlContent).fadeIn();
        $('#welcome-section').fadeOut();
    }

    // Event listener to add a track to the queue
    $('#search-results').on('click', '.add-queue-btn', function() {
        const trackId = $(this).data('id');
        const trackName = $(this).data('name');
        const albumName = $(this).data('album-name');
        const artists = $(this).data('artists');
        const albumArtUrl = $(this).data('album-art-url');
        addToQueue(trackId, trackName, albumName, artists, albumArtUrl);
    });

    // Event listener to remove a track from the queue
    $('#search-results').on('click', '.remove-queue-btn', function() {
        const trackId = $(this).data('id');
        removeFromQueue(trackId);
    });

    // Add a track to the queue
    function addToQueue(trackId, trackName, albumName, artists, albumArtUrl) {
        $.ajax({
            url: `/queue/add`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                track_id: trackId,
                name: trackName,
                albumName: albumName,
                artists: artists,
                albumArtUrl: albumArtUrl
            }),
            success: function() {
                console.log('Track added to the queue!');
                fetchQueue(); // Refresh to show the queue with the added track
            },
            error: function() {
                console.error('Failed to add track to the queue');
            }
        });
    }

    // Remove a track from the queue
    function removeFromQueue(trackId) {
        $.ajax({
            url: `/queue/remove`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ track_id: trackId }),
            success: function() {
                console.log('Track removed from the queue!');
                fetchQueue(); // Refresh to show queue with one less track
            },
            error: function() {
                console.error('Failed to remove the track from queue');
            }
        });
    }

    // Generate HTML for each artist result
    const generateArtistHTML = (artist, index) => {
        const { id, name, images, genres = [] } = artist;
        const artistImage = images.length > 0 ? images[0].url : 'default_image_url';

        return `
            <div id="artist-${index}" class="bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
                <img class="w-16 h-16 rounded-full object-cover" src="${artistImage}" alt="Artist Image">
                <div class="info flex-grow">
                    <p class="artist-name text-lg text-white font-semibold">${name}</p>
                    <p class="genre text-sm text-gray-300">${genres.join(', ')}</p>
                </div>
            </div>`;
    }

    // Generate HTML for each album result
    const generateAlbumHTML = (album, index) => {
        const { id, name, images, artists = [], release_date } = album;
        const albumArtUrl = images.length > 0 ? images[0].url : 'default_image_url';
        const artistNames = artists.map(artist => artist.name).join(', ');

        return `
            <div id="album-${index}" class="bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
                <img class="w-16 h-16 rounded-lg object-cover" src="${albumArtUrl}" alt="Album Cover">
                <div class="info flex-grow">
                    <p class="album-name text-lg text-white font-semibold">${name}</p>
                    <p class="artist-name text-md text-white">${artistNames}</p>
                    <p class="release-date text-sm text-gray-300">${release_date}</p>
                </div>
            </div>`;
    }

    // Update the footer with the current track details
    function updateFooter(track) {
        if (!track) return;
        console.log(`Updating footer with track: ${JSON.stringify(track)}`);

        // Select the elements containing the footer information
        const footerElements = $('#footer-album-art, #footer-track, #footer-artist, #footer-album-name');

        // Fade out current content
        footerElements.fadeOut(500).promise().done(() => {
            // Update the content once faded out
            $('#footer-album-art').attr('src', track.albumArtUrl || '../images/logo.png');
            $('#footer-track').text(track.name || 'No track playing');
            $('#footer-artist').text(track.artist || 'Unknown artist');
            $('#footer-album-name').text(track.albumName || 'Unknown album');

            // After fade out, reset display styles on all footer elements collectively
            footerElements.css('display', '');

            // Ensure all elements in footerElements have completed their fadeOut before starting fadeIn
            footerElements.fadeIn(500);
        });
    }

    // Initialize the footer as hidden and delay the initial slide animation on page load
    $('#footer-container')
        .css('bottom', '-100px')
        .data('visible', false)
        .animate({ bottom: '0px' }, 850, () => {
            $(this).data('visible', true);
    });

    // Toggle footer visibility on click
    $('.footer-toggle').click(function() {
        let isFooterVisible = $('#footer-container').data('visible');
        if (!isFooterVisible) {
            $('#footer-container').animate({ bottom: '-100px' }, 650, function() {
                $(this).data('visible', true);
            });
        } else {
            $('#footer-container').animate({ bottom: '0px' }, 650, function() {
                $(this).data('visible', false);
            });
        }
    });

    // Ensure the body has the 'dark' class on load
    if (!$('body').hasClass('dark')) {
        $('body').addClass('dark');
    }

    // Toggle between light and dark themes
    $('#theme-toggle').change(function() {
        requestAnimationFrame(() => {
            $('body').toggleClass('dark', !$(this).is(':checked'));
            updateThemeStyles();
        });
    });

    // Update styles based on the current theme
    function updateThemeStyles() {
        if ($('body').hasClass('dark')) {
            updateStylesForDarkMode();
        } else {
            updateStylesForLightMode();
        }
    }

    // Update styles for dark mode
    function updateStylesForDarkMode() {
        $('body').css({'background-color': '#111827', 'color': '#f9fafb'});
        $('nav, footer').css({'background-color': '#1a202c', 'color': '#f9fafb'});
        $('#search-query, #search-type').css({'background-color': '#374151', 'color': '#f9fafb'});
        $('#footer-track, #footer-album-name').css({'color': '#f9fafb'});
    }

    // Update styles for light mode
    function updateStylesForLightMode() {
        $('body').css({'background-color': '#f9fafb', 'color': '#111827'});
        $('nav, footer').css({'background-color': '#ffffff', 'color': '#111827'});
        $('#search-query, #search-type').css({'background-color': '#F2F4F5', 'color': '#111827'});
        $('#footer-track, #footer-album-name').css({'color': '#111827'});
    }

    // jQuery fadeIn and fadeOut plugin functions
    $.fn.fadeIn = function(ms) {
        return this.each(function() {
            $(this).css('opacity', 0).removeClass('hidden').animate({'opacity': 1}, ms || 400);
        });
    };

    $.fn.fadeOut = function(ms) {
        return this.each(function() {
            $(this).animate({'opacity': 0}, ms || 400, function() {
                $(this).addClass('hidden');
            });
        });
    };
});
