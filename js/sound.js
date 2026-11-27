export const SOUNDS = {
    CRITICAL_STOP: "assets/audio/Windows XP Critical Stop.mp3",
    DING: "assets/audio/Windows XP Ding.mp3",
    ERROR: "assets/audio/Windows XP Error.mp3",
    EXCLAMATION: "assets/audio/Windows XP Exclamation.mp3",
    MENU_COMMAND: "assets/audio/Windows XP Menu Command.mp3",
    MINIMIZE: "assets/audio/Windows XP Minimize.mp3",
    RESTORE: "assets/audio/Windows XP Restore.mp3",
    START_NAVIGATION: "assets/audio/Windows XP Start.mp3"
};

let siteVolume = 0.7;
let siteMuted = false;
const activeSounds = new Set();

export function setSiteAudioState({ volume, muted } = {}) {
    if (typeof volume === "number" && !Number.isNaN(volume)) {
        siteVolume = Math.max(0, Math.min(1, volume));
    }
    if (typeof muted === "boolean") {
        siteMuted = muted;
    }
    for (const audio of activeSounds) {
        audio.volume = siteVolume;
        audio.muted = siteMuted;
    }
}

export function playSound(src) {
    if (!src || siteMuted || siteVolume <= 0) return;

    const audio = new Audio(src);
    audio.volume = siteVolume;
    audio.muted = siteMuted;
    activeSounds.add(audio);

    const cleanup = () => activeSounds.delete(audio);
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", cleanup, { once: true });

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(cleanup);
    }
}
