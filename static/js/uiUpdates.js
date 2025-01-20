import { generateTrackHTML, generateRecentHTML, generateLikedTracksHTML, generateQueueHTML } from './generateHTML.js';

/*********************************************************
 * Frontend Middleware to handle UI rendering and Data Exchange:
 ********************************************************/
export function displayQueuedTracks(tracks) {
    let htmlContent = `<h2 class="text-xl text-center text-white font-bold my-4">Queued Tracks</h2>`;
    tracks.forEach(track => {
        htmlContent += generateQueueHTML(track);
    });
    $('#search-results').html(htmlContent).fadeIn();
};

export function displayLikedTracks(tracks) {
    let htmlContent = `<h2 class="text-xl text-center text-white font-bold my-4">Liked Tracks</h2>`;
    tracks.forEach((track, index) => {
        htmlContent += generateLikedTracksHTML(track, index);
    });
    $('#search-results').html(htmlContent).fadeIn();
};

export function displayRecentTracks(tracks) {
    let htmlContent = `<h2 class="text-xl text-center text-white font-bold my-4">Recent Tracks</h2>`;
    tracks.forEach((track, index) => {
        console.log(`displayRecentTrack: ${track}}`)
        htmlContent += generateRecentHTML(track, index);
    });
    $('#search-results').html(htmlContent).fadeIn();
};

// Display search results
export function displaySearchResults(data, type) {
    const resultsContainer = $('#search-results');
    resultsContainer.empty();

    let headerText = type === 'track' ? 'Tracks' : type === 'artist' ? 'Artists' : 'Albums';
    let htmlContent = `<h2 class="text-xl text-center text-white font-bold my-4">${headerText}</h2>`;

    if (type === 'track' && data.tracks?.items.length) {
        data.tracks.items.forEach((track, index) => {
            htmlContent += generateTrackHTML(track, index);
        });
    // } else if (type === 'artist' && data.artists?.items.length) {
    //     data.artists.items.forEach((artist, index) => {
    //         htmlContent += generateQueueHTML(artist, index);
    //     });
    // } else if (type === 'album' && data.albums?.items.length) {
    //     data.albums.items.forEach((album, index) => {
    //         htmlContent += generateQueueHTML(album, index);
    //     });
    } else {
        htmlContent += `<div class="text-yellow-500 text-center p-4">No results found. Try a different query.</div>`;
    }

    resultsContainer.html(htmlContent).fadeIn();
};

