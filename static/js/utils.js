/*********************************************************
 * Util Functions:
 ********************************************************/
export function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export function updateTimeDisplays(position, duration) {
    const remaining = duration - position;
    $('#current-time').text(formatTime(position));
    $('#remaining-time').text(`-${formatTime(remaining)}`);
};

// Debounce function to delay execution
export function debounce(func, delay) {
    let debounceTimer;
    return function (...args) {
        const context = this;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    };
};

export function isCurrentTrack(id){
    const currentTrack = localStorage.getItem('currentTrack');
    // console.log(`[DEBUG]: isCurrentTrack(id) - Calling localStorage to retrieve currentTrack Data: ${currentTrack}`)
    return currentTrack.id === id ? true : false;
};


// Display alert messages
export function showAlert(message, isError = false) {
    const alertType = isError ? 'alert-danger' : 'alert-success';
    const alertElement = `<div class="${alertType}">${message}</div>`;
    $('#alert-container').html(alertElement).fadeIn();
    setTimeout(() => $('#alert-container').fadeOut(), 3000);
};

