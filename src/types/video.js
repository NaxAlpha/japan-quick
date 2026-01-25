// Video type definitions
// TTS voices array for runtime
export const TTS_VOICES = [
    'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Enceladus', 'Aoede',
    'Autonoe', 'Laomedeia', 'Iapetus', 'Erinome', 'Alnilam', 'Algieba', 'Despina',
    'Umbriel', 'Callirrhoe', 'Achernar', 'Sulafat', 'Vindemiatrix', 'Achird',
    'Orus', 'Algenib', 'Rasalgethi', 'Gacrux', 'Pulcherrima', 'Zubenelgenubi',
    'Sadachbia', 'Sadaltager'
];
// Helper function to parse video from DB to frontend format
export function parseVideo(video) {
    return {
        ...video,
        notes: video.notes ? video.notes.split('\n') : [],
        articles: video.articles ? JSON.parse(video.articles) : [],
        script: video.script ? JSON.parse(video.script) : null,
        assets: [] // Assets are populated separately in the route handler
    };
}
//# sourceMappingURL=video.js.map