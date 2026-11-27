export const SOUNDS = {
    CRITICAL_STOP: "assets/audio/Windows XP Critical Stop.mp3",
    DING: "assets/audio/Windows XP Ding.mp3",
    ERROR: "assets/audio/Windows XP Error.mp3",
    EXCLAMATION: "assets/audio/Windows XP Exclamation.mp3",
    LOGOFF: "assets/audio/Windows XP Logoff Sound.mp3",
    LOGON: "assets/audio/Windows XP Logon Sound.mp3",
    MENU_COMMAND: "assets/audio/Windows XP Menu Command.mp3",
    MINIMIZE: "assets/audio/Windows XP Minimize.mp3",
    RESTORE: "assets/audio/Windows XP Restore.mp3",
    SHUTDOWN: "assets/audio/Windows XP Shutdown.mp3",
    START_NAVIGATION: "assets/audio/Windows XP Start.mp3",
    STARTUP: "assets/audio/Windows XP Startup.mp3"
};

// Manages site volume, mute, and XP sound effects
export class AudioMixer {
    constructor(initialVolume = 0.7, initialMuted = false) {
        this.volume = initialVolume;
        this.muted = initialMuted;
        this.activeSounds = new Set();
        this.activeSources = new Set();
        this.listeners = new Set();

        this.audioCtx = null;
        this.gainNode = null;
        this.decodedBuffers = new Map();
        this.preloadedElements = new Map();
        this.preloadStarted = false;
    }

    ensureWebAudio() {
        if (this.audioCtx) return this.audioCtx;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;

        try {
            this.audioCtx = new AudioCtx();
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = this.muted ? 0 : this.volume;
            this.gainNode.connect(this.audioCtx.destination);
        } catch {
            this.audioCtx = null;
            this.gainNode = null;
        }
        return this.audioCtx;
    }

    preloadAll(sources = Object.values(SOUNDS)) {
        if (this.preloadStarted) return;
        this.preloadStarted = true;

        const canFetch = typeof fetch === "function" && window.location?.protocol?.startsWith("http");
        const ctx = canFetch ? this.ensureWebAudio() : null;

        for (const src of sources) {
            if (!src) continue;

            if (typeof Audio === "function") {
                try {
                    const el = new Audio();
                    el.preload = "auto";
                    el.src = src;
                    el.load?.();
                    this.preloadedElements.set(src, el);
                } catch {
                    // Skip if Audio isn't available
                }
            }

            if (ctx && canFetch) {
                fetch(src)
                    .then((res) => (res.ok ? res.arrayBuffer() : null))
                    .then((buf) => (buf ? ctx.decodeAudioData(buf) : null))
                    .then((decoded) => {
                        if (decoded) {
                            this.decodedBuffers.set(src, decoded);
                        }
                    })
                    .catch(() => {
                        // If preloading fails, play() falls back to a regular Audio element
                    });
            }
        }
    }

    getState() {
        return {
            volume: this.volume,
            muted: this.muted,
            effectivelyMuted: this.muted || this.volume === 0
        };
    }

    setState({ volume, muted } = {}) {
        if (typeof volume === "number" && !Number.isNaN(volume)) {
            this.volume = Math.max(0, Math.min(1, volume));
        }
        if (typeof muted === "boolean") {
            this.muted = muted;
        }
        if (this.gainNode) {
            this.gainNode.gain.value = this.muted ? 0 : this.volume;
        }
        for (const audio of this.activeSounds) {
            audio.volume = this.volume;
            audio.muted = this.muted;
        }
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }

    subscribe(listener, { immediate = true } = {}) {
        if (typeof listener !== "function") return () => {};
        this.listeners.add(listener);
        if (immediate) {
            listener(this.getState());
        }
        return () => this.listeners.delete(listener);
    }

    play(src) {
        if (!src || this.muted || this.volume <= 0) return;

        const buffer = this.decodedBuffers.get(src);
        const ctx = this.audioCtx;
        if (buffer && ctx && this.gainNode) {
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.gainNode);
            this.activeSources.add(source);
            source.addEventListener?.("ended", () => this.activeSources.delete(source), { once: true });
            source.start(0);
            return;
        }

        const template = this.preloadedElements.get(src);
        const audio = typeof template?.cloneNode === "function"
            ? template.cloneNode(true)
            : new Audio(src);
        audio.volume = this.volume;
        audio.muted = this.muted;
        this.activeSounds.add(audio);

        const cleanup = () => this.activeSounds.delete(audio);
        audio.addEventListener("ended", cleanup, { once: true });
        audio.addEventListener("error", cleanup, { once: true });

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(cleanup);
        }
    }
}

export const audioMixer = new AudioMixer();
audioMixer.preloadAll();

export function setSiteAudioState(state) {
    audioMixer.setState(state);
}

export function playSound(src) {
    audioMixer.play(src);
}
