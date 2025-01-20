/*********************************************************
 * Frontend Queue Management System:
 ********************************************************/

let trackQueue = [];
let currentTrackIndex = -1;

export function setQueue(tracks) {
    trackQueue = tracks;
    currentTrackIndex = 0;
}

export function getQueue() {
    return trackQueue;
}

export function getCurrentTrackIndex() {
    return currentTrackIndex;
}

export function getCurrentTrackUri() {
    if (currentTrackIndex >= 0 && currentTrackIndex < trackQueue.length) {
        return trackQueue[currentTrackIndex];
    }
    return null;
}

export function nextTrack() {
    if (currentTrackIndex < trackQueue.length - 1) {
        currentTrackIndex++;
        return trackQueue[currentTrackIndex];
    } else {
        // Reached the end of the queue
        return null;
    }
}

export function prevTrack() {
    if (currentTrackIndex > 0) {
        currentTrackIndex--;
        return trackQueue[currentTrackIndex];
    } else {
        // At the start of the queue
        return null;
    }
}

export function addTracksToQueue(tracks) {
    trackQueue = trackQueue.concat(tracks);
};

export function setCurrentTrackIndex(index) {
    currentTrackIndex = index;
};

