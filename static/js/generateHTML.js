import { isCurrentTrack } from './utils.js';

/*********************************************************
 * Data Templating & HTML Injection of Spotify Info:
 ********************************************************/

/**
 * Generates HTML for a track entry.
 * @param {Object} track - The track object containing details.
 * @param {number} index - The track's index in the list.
 * @returns {string} The HTML string for the track.
 */
export const generateTrackHTML = (track, index) => {
    // Validation: Ensure the track object is valid
    if (!track || typeof track.id === 'undefined') {
        console.error('generateTrackHTML called with invalid track:', track);
        return ''; // Return an empty string or a placeholder if preferred
    }

    const { id, uri, name, album, artists } = track;

    // Extracting necessary information
    const albumName = album.name;
    const albumArtUrl = album.images[0] ? album.images[0].url : `/static/images/logo.png`;
    const artistNames = artists.map(artist => artist.name).join(', ');
    const isCurrent = isCurrentTrack(id);

    // Prepare the track data as a JSON string for queue attribution:
    const trackData = encodeURIComponent(
        JSON.stringify({
            id,
            uri,
            name,
            albumName,
            albumArtUrl,
            artistNames,
        })
    );

    // Prepares the track data as JSON string for like attributions:
    const likeTrackData = JSON.stringify({
        id,
        uri,
        name,
        albumName,
        artistNames,
        albumArtUrl,
    });

    return `
        <div id="track-${index}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} track-entry font-tbf bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
            <p class="track-id text-sm text-gray-300 font-bold">${index + 1}</p>
            <img class="w-16 h-16 rounded-lg object-cover" src="${albumArtUrl}" alt="Album Art for ${albumName}">
            <div class="info flex-grow">
                <p class="track-name text-lg text-white font-semibold">${name}</p>
                <p class="artist-name text-sm text-gray-300">${artistNames}</p>
                <p class="album-name text-sm text-gray-300">${albumName}</p>
            </div>
            <div class="controls flex space-x-2">
                <button class="add-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in" data-track='${trackData}'>
                    <!-- Add to Queue Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </button>
                <!-- Like Icon -->
                <button class="like-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" data-track='${likeTrackData}'${name} data-control="like">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5c2.75 0 5.25 2.25 5.25 6s-3 8.25-8.25 11.25C5.25 18.75 2.25 12 2.25 10.5S4.5 4.5 7.5 4.5c1.406 0 2.63.62 3.75 1.715C13.12 5.12 14.344 4.5 15.75 4.5z" />
                    </svg>
                </button>
                <button class="search-play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${id}" data-track-uri="${uri}" data-control="play">
                    <!-- Play Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                        <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                    </svg>
                </button>
            </div>
        </div>`;
};


/**
 * Generates HTML for an artist entry.
 * @param {Object} artist - The artist object containing details.
 * @param {number} index - The artist's index in the list.
 * @returns {string} The HTML string for the artist.
 */
export const generateArtistHTML = (artist, index) => {
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
};

/**
 * Generates HTML for an album entry.
 * @param {Object} album - The album object containing details.
 * @param {number} index - The album's index in the list.
 * @returns {string} The HTML string for the album.
 */
export const generateAlbumHTML = (album, index) => {
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
};

/**
 * Generates HTML for a recently played track.
 * @param {Object} track - The recently played track object containing details.
 * @param {number} index - The track's index in the list.
 * @returns {string} The HTML string for the recent track.
 */
export const generateRecentHTML = (track, index) => {
    const { id, name, album, artist, albumArt, uri } = track;
    const isCurrent = isCurrentTrack(id);


    // Packages the track data through URI encapsulation of JSON data as string for queue attributions:
    const trackData = encodeURIComponent(
        JSON.stringify({
            id,
            uri,
            name,
            album,
            albumArt,
            artist
        })
    );

    // Prepares the track data as JSON string for like attributions:
    const likeTrackData = JSON.stringify({
        id,
        uri,
        name,
        album,
        albumArt,
        artist
    });

    return `
        <div id="track-${index}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} font-tbf bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
            <p class="track-id text-sm text-gray-300 font-bold">${index + 1}</p>
            <img class="w-16 h-16 rounded-lg object-cover" src="${albumArt}" alt="Album Art">
            <div class="info flex-grow">
                <p class="track-name text-lg text-white font-semibold">${name}</p>
                <p class="artist-name text-sm text-gray-300">${artist}</p>
                <p class="album-name text-sm text-gray-300">${album}</p>
            </div>
            <div class="controls flex space-x-2">
                <button class="add-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in" data-track='${trackData}'>
                    <!-- Add to Queue Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </button>
                <button class="like-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" data-track='${likeTrackData}'${name} data-control="like">
                    <!-- Like Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5c2.75 0 5.25 2.25 5.25 6s-3 8.25-8.25 11.25C5.25 18.75 2.25 12 2.25 10.5S4.5 4.5 7.5 4.5c1.406 0 2.63.62 3.75 1.715C13.12 5.12 14.344 4.5 15.75 4.5z" />
                    </svg>
                </button>
                <button class="recents-play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${id}" data-track-uri="${uri}"data-control="play">
                    <!-- Play Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                        <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                    </svg>
                </button>
            </div>
        </div>`;
};

/**
 * Generates HTML for a track in the queue.
 * @param {Object} track - The track object containing details.
 * @param {number} index - The track's index in the queue.
 * @returns {string} The HTML string for the queued track.
 */
export const generateQueueHTML = (track, index) => {
    const { id, name, artist, album, albumArt, uri } = track;
    const isCurrent = isCurrentTrack(id);


    // Packages the track data through URI encapsulation of JSON data as string for queue attributions:
    const trackData = encodeURIComponent(
        JSON.stringify({
            id,
            uri,
            name,
            album,
            albumArt,
            artist
        })
    );

    // Prepares the track data as JSON string for like attributions:
    const likeTrackData = JSON.stringify({
        id,
        uri,
        name,
        album,
        albumArt,
        artist
    });

    return `
        <div id="track-${index}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} font-tbf hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
            <img class="w-16 h-16 rounded-lg object-cover" src="${albumArt || 'default_album_art.jpg'}" alt="Album Art">
            <div class="info flex-grow">
                <p class="track-name text-lg text-white font-semibold">${name}</p>
                <p class="artist-name text-sm text-gray-300">${artist}</p>
            </div>
            <div class="controls flex space-x-2">
                <button class="remove-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in" data-id="${id}">
                    <!-- Remove from Queue Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <button class="like-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" data-track='${likeTrackData}'${name} data-control="like">
                    <!-- Like Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 4.5c2.75 0 5.25 2.25 5.25 6s-3 8.25-8.25 11.25C5.25 18.75 2.25 12 2.25 10.5S4.5 4.5 7.5 4.5c1.406 0 2.63.62 3.75 1.715C13.12 5.12 14.344 4.5 15.75 4.5z" />
                    </svg>
                </button>
                <button class="queue-play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${id}" data-track-uri="${uri}" data-control="play">
                    <!-- Play Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                        <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                    </svg>
                </button>
            </div>
        </div>`;
};

/**
 * Generates HTML for a liked track.
 * @param {Object} track - The liked track object containing details.
 * @param {number} index - The track's index in the liked list.
 * @returns {string} The HTML string for the liked track.
 */
export const generateLikedTracksHTML = (track, index) => {
    const { id, name, artist, album, albumArt, uri } = track;
    const isCurrent = isCurrentTrack(id);

     // Packages the track data through URI encapsulation of JSON data as string for data attributions:
    const trackData = encodeURIComponent(
        JSON.stringify({
            id,
            uri,
            name,
            album,
            albumArt,
            artist
        })
    );

    // Prepares the track data as JSON string for like attributions:
    const likeTrackData = JSON.stringify({
        id,
        uri,
        name,
        album,
        albumArt,
        artist
    });


    return `
        <div id="track-${index}" class="${isCurrent ? 'bg-purple-600' : 'bg-gray-800'} font-tbf bg-gray-800 hover:bg-gray-700 transition-all duration-300 ease-in-out transform hover:scale-105 opacity-1 rounded-lg shadow-md flex items-center space-x-4 py-4 px-6 my-3 mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-2/3">
            <p class="track-id text-sm text-gray-300 font-bold">${index + 1}</p>
            <img class="w-16 h-16 rounded-lg object-cover" src="${albumArt || 'default_album_art.jpg'}" alt="Album Art">
            <div class="info flex-grow">
                <p class="track-name text-lg text-white font-semibold">${name}</p>
                <p class="artist-name text-sm text-gray-300">${artist}</p>
                <p class="album-name text-sm text-gray-300">${album}</p>
            </div>
            <div class="controls flex space-x-2">
                <button class="add-queue-btn button-effect text-white hover:text-purple-600 transition duration-150 ease-in" data-track='${trackData}'>
                    <!-- Add to Queue Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </button>
                <button class="remove-like-btn button-effect text-white hover:text-red-500 transition duration-150 ease-in" data-track='${likeTrackData}'${name} data-control="unlike">
                    <!-- Remove Like Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="21" height="21" viewBox="0 0 26 26" fill="currentColor">
                        <path d="M 13 0.1875 C 5.925781 0.1875 0.1875 5.925781 0.1875 13 C 0.1875 20.074219 5.925781 25.8125 13 25.8125 C 20.074219 25.8125 25.8125 20.074219 25.8125 13 C 25.8125 5.925781 20.074219 0.1875 13 0.1875 Z M 18.78125 17.394531 L 17.390625 18.78125 C 17.136719 19.035156 16.722656 19.035156 16.46875 18.78125 L 13 15.3125 L 9.53125 18.78125 C 9.277344 19.035156 8.863281 19.035156 8.609375 18.777344 L 7.21875 17.394531 C 6.96875 17.136719 6.96875 16.726563 7.21875 16.46875 L 10.6875 13 L 7.222656 9.535156 C 6.96875 9.277344 6.96875 8.863281 7.222656 8.609375 L 8.609375 7.222656 C 8.863281 6.964844 9.28125 6.964844 9.535156 7.222656 L 13 10.6875 L 16.46875 7.222656 C 16.722656 6.964844 17.140625 6.964844 17.390625 7.222656 L 18.78125 8.605469 C 19.035156 8.863281 19.035156 9.277344 18.78125 9.535156 L 15.3125 13 L 18.78125 16.46875 C 19.03125 16.726563 19.03125 17.136719 18.78125 17.394531 Z"></path>
                    </svg>
                </button>
                <button class="likes-play-btn button-effect text-white hover:text-green-500 transition duration-150 ease-in" data-track-id="${id}" data-track-uri="${uri}" data-control="play">
                    <!-- Play Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                        <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z"></path>
                    </svg>
                </button>
            </div>
        </div>`;
};
