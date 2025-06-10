document.addEventListener('click', function(event) {
    const link = event.target.closest('a');

    if (!link || !link.href) {
        return;
    }
    
    if (link.href.startsWith(window.location.origin + '/#') || link.protocol === 'javascript:') {
        return;
    }

    if (link.hostname !== 'shanestudios.github.io') {
        event.preventDefault();
        window.open(link.href, '_blank', 'noopener,noreferrer');
    }
});
