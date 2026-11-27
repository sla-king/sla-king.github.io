import { XPWindow } from '../os/XPWindow.js';
import { registerDismissiblePopup } from '../os/windowManager.js';
import { audioMixer } from '../os/AudioMixer.js';
import {
    HOME_PATH,
    getNode,
    getPathString,
    isAudioFile,
    isFileNode,
    listFilesInFolder,
    resolvePath
} from '../filesystem.js';

const MUSIC_FOLDER_PATH = [...HOME_PATH, "My Documents", "My Music"];

const PLAY_ICON_SRC = "assets/wmp_play.png";
const PAUSE_ICON_SRC = "assets/wmp_pause.png";
const SOUND_ICON_SRC = "assets/wmp_sound.png";
const MUTE_ICON_SRC = "assets/wmp_mute.png";

function extractYouTubeId(urlString) {
    if (typeof urlString !== "string") return "";
    let parsed;
    try {
        parsed = new URL(urlString.trim());
    } catch {
        return "";
    }
    if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.slice(1).split("/")[0];
    }
    if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname.startsWith("/embed/")) {
            return parsed.pathname.slice("/embed/".length).split("/")[0];
        }
        return parsed.searchParams.get("v") || "";
    }
    return "";
}

function formatTime(totalSeconds) {
    const secs = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${String(rem).padStart(2, "0")}`;
}

// Windows Media Player window (plays YouTube tracks from My Music)
export class MediaPlayerApp extends XPWindow {
    constructor(winEl) {
        super({
            id: "media-player",
            winEl,
            resizable: true,
            maximizable: true
        });

        this.screenEl = winEl.querySelector(".wmp-screen");
        this.hostEl = document.getElementById("wmp-yt-host");
        this.stoppedTitleEl = winEl.querySelector(".wmp-stopped-title");
        this.playlistColEl = winEl.querySelector(".wmp-playlist-col");
        this.playlistEl = winEl.querySelector(".wmp-playlist");
        this.statusGlyphEl = winEl.querySelector(".wmp-status-glyph");
        this.statusTextEl = winEl.querySelector(".wmp-status-text");
        this.trackTimeEl = winEl.querySelector(".wmp-tracktime");
        this.playBtnEl = winEl.querySelector(".wmp-play-btn");
        this.muteBtnEl = winEl.querySelector(".wmp-mute-btn");
        this.seekEl = winEl.querySelector(".wmp-seek");
        this.volumeEl = winEl.querySelector(".wmp-volume");

        this.currentTrack = null;
        this.playlistTracks = [];
        this.ytPlayer = null;
        this.ytReady = false;
        this.ytApiPromise = null;
        this.progressTimer = null;
        this.isStopped = false;
        this.isPlaying = false;
        this.isMuted = false;
        this.isSeeking = false;
        this.currentVolume = this.volumeEl
            ? Math.round(Number(this.volumeEl.value || 0.7) * 100)
            : 70;
        this.masterVolume = 0.7;
        this.masterMuted = false;
        this.pendingLoad = null;

        audioMixer.subscribe((audioState) => this.setMasterAudio(audioState));
        this.bindControls();
    }

    onClose() {
        this.currentTrack = null;
        this.destroyPlayer();
        this.setStoppedScreen(true);
    }

    bindControls() {
        this.playBtnEl?.addEventListener("click", () => {
            if (!this.currentTrack) {
                if (this.playlistTracks.length > 0) {
                    this.openTrack({ trackPath: this.playlistTracks[0].pathString, autoplay: true });
                }
                return;
            }
            if (this.isStopped || !this.ytPlayer) {
                this.playVideoWithPlayer(this.currentTrack.videoId, true);
                return;
            }
            if (this.ytReady && typeof this.ytPlayer.getPlayerState === "function") {
                if (this.isPlaying) {
                    this.ytPlayer.pauseVideo();
                } else {
                    this.ytPlayer.playVideo();
                }
            }
        });

        this.winEl.querySelector(".wmp-stop-btn")?.addEventListener("click", () => {
            this.stopProgressPolling();
            if (this.ytPlayer && this.ytReady && typeof this.ytPlayer.stopVideo === "function") {
                this.ytPlayer.stopVideo();
            } else {
                this.destroyPlayer();
            }
            this.setStoppedScreen(true);
        });

        this.winEl.querySelector(".wmp-prev-btn")?.addEventListener("click", () => this.stepTrack(-1));
        this.winEl.querySelector(".wmp-next-btn")?.addEventListener("click", () => this.stepTrack(1));

        this.winEl.querySelector(".wmp-rew-btn")?.addEventListener("click", () => {
            if (this.ytPlayer && this.ytReady && !this.isStopped && typeof this.ytPlayer.getCurrentTime === "function") {
                this.ytPlayer.seekTo(Math.max(0, (this.ytPlayer.getCurrentTime() || 0) - 10), true);
                this.syncProgress();
            } else {
                this.stepTrack(-1);
            }
        });

        this.winEl.querySelector(".wmp-ff-btn")?.addEventListener("click", () => {
            if (this.ytPlayer && this.ytReady && !this.isStopped && typeof this.ytPlayer.getCurrentTime === "function") {
                const duration = this.ytPlayer.getDuration() || 0;
                const nextTime = Math.min(duration || Infinity, (this.ytPlayer.getCurrentTime() || 0) + 10);
                this.ytPlayer.seekTo(nextTime, true);
                this.syncProgress();
            } else {
                this.stepTrack(1);
            }
        });

        this.seekEl?.addEventListener("pointerdown", () => {
            this.isSeeking = true;
        });

        this.seekEl?.addEventListener("input", () => {
            if (this.trackTimeEl) {
                this.trackTimeEl.textContent = formatTime(Number(this.seekEl.value));
            }
        });

        const commitSeek = () => {
            if (this.ytPlayer && this.ytReady && !this.isStopped && typeof this.ytPlayer.seekTo === "function") {
                this.ytPlayer.seekTo(Number(this.seekEl.value), true);
            }
            this.isSeeking = false;
        };

        this.seekEl?.addEventListener("change", commitSeek);
        this.seekEl?.addEventListener("pointerup", commitSeek);
        this.seekEl?.addEventListener("pointercancel", () => {
            this.isSeeking = false;
        });

        this.muteBtnEl?.addEventListener("click", () => {
            this.updateMuteButtonUI(!this.isMuted);
            this.applyAudioSettings();
        });

        this.volumeEl?.addEventListener("input", () => {
            this.currentVolume = Math.round(Number(this.volumeEl.value) * 100);
            if (this.currentVolume > 0 && this.isMuted) {
                this.updateMuteButtonUI(false);
            }
            this.applyAudioSettings();
        });

        this.bindModeDropdown();
    }

    bindModeDropdown() {
        const modeDropdown = this.winEl.querySelector(".wmp-mode-dropdown");
        const modeBtn = this.winEl.querySelector(".wmp-mode-select");
        const modeIcon = this.winEl.querySelector(".wmp-mode-icon");
        const modeLabel = this.winEl.querySelector(".wmp-mode-label");
        const modeMenu = this.winEl.querySelector(".wmp-mode-menu");
        const modeOptions = this.winEl.querySelectorAll(".wmp-mode-option");

        const closeModeMenu = () => {
            if (!modeMenu || !modeBtn) return;
            modeMenu.hidden = true;
            modeBtn.setAttribute("aria-expanded", "false");
        };

        modeDropdown?.addEventListener("pointerdown", (e) => e.stopPropagation());

        modeBtn?.addEventListener("click", () => {
            if (!modeMenu) return;
            const willOpen = modeMenu.hidden;
            modeMenu.hidden = !willOpen;
            modeBtn.setAttribute("aria-expanded", String(willOpen));
        });

        modeOptions.forEach((opt) => {
            opt.addEventListener("click", () => {
                const showPlaylist = opt.dataset.wmpView === "playlist";
                if (this.playlistColEl) {
                    this.playlistColEl.hidden = !showPlaylist;
                }
                if (modeIcon && opt.dataset.icon) {
                    modeIcon.src = opt.dataset.icon;
                }
                if (modeLabel) {
                    const labelSpan = opt.querySelector("span");
                    modeLabel.textContent = labelSpan ? labelSpan.textContent : opt.textContent.trim();
                }
                modeOptions.forEach((item) => item.classList.toggle("active", item === opt));
                closeModeMenu();
            });
        });

        registerDismissiblePopup({
            isOpen: () => Boolean(modeMenu && !modeMenu.hidden),
            containsTarget: (target) => Boolean(modeDropdown?.contains(target)),
            onClose: closeModeMenu
        });
    }

    collectTracksFromMusicFolder() {
        return listFilesInFolder(MUSIC_FOLDER_PATH, (name, value) => (
            isAudioFile(name) && Boolean(extractYouTubeId(value.content))
        )).map((item) => ({
            name: item.name,
            url: item.node.content,
            videoId: extractYouTubeId(item.node.content),
            pathString: item.pathString
        }));
    }

    renderPlaylist() {
        if (!this.playlistEl) return;
        this.playlistEl.textContent = "";
        for (const track of this.playlistTracks) {
            const item = document.createElement("div");
            item.className = "wmp-playlist-item";
            if (this.currentTrack && track.pathString.toLowerCase() === this.currentTrack.pathString.toLowerCase()) {
                item.classList.add("active");
            }
            item.textContent = track.name;
            item.title = track.name;
            item.addEventListener("click", () => {
                this.openTrack({ trackPath: track.pathString, autoplay: true });
            });
            this.playlistEl.appendChild(item);
        }
    }

    updatePlayButtonUI(playing) {
        this.isPlaying = playing;
        if (!this.playBtnEl) return;
        const icon = this.playBtnEl.querySelector("img");
        if (icon) {
            icon.src = playing ? PAUSE_ICON_SRC : PLAY_ICON_SRC;
        }
        this.playBtnEl.title = playing ? "Pause" : "Play";
        this.playBtnEl.setAttribute("aria-label", playing ? "Pause" : "Play");
    }

    updateMuteButtonUI(muted) {
        this.isMuted = muted;
        if (!this.muteBtnEl) return;
        const icon = this.muteBtnEl.querySelector("img");
        if (icon) {
            icon.src = muted ? MUTE_ICON_SRC : SOUND_ICON_SRC;
        }
        this.muteBtnEl.classList.toggle("active", muted);
        this.muteBtnEl.setAttribute("aria-pressed", String(muted));
        this.muteBtnEl.title = muted ? "Unmute" : "Mute";
        this.muteBtnEl.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    }

    updateStatusUI(stateLabel, glyphHtml) {
        if (this.statusGlyphEl) {
            this.statusGlyphEl.innerHTML = glyphHtml;
        }
        if (this.statusTextEl) {
            this.statusTextEl.textContent = stateLabel;
        }
    }

    setStoppedScreen(stopped) {
        this.isStopped = stopped;
        if (this.hostEl) {
            this.hostEl.hidden = stopped;
        }
        if (this.stoppedTitleEl) {
            this.stoppedTitleEl.hidden = !stopped;
            this.stoppedTitleEl.textContent = this.currentTrack ? this.currentTrack.name : "";
        }
        if (stopped) {
            this.updatePlayButtonUI(false);
            this.updateStatusUI("Stopped", "&#9632;");
            if (this.seekEl) this.seekEl.value = "0";
            if (this.trackTimeEl) this.trackTimeEl.textContent = "0:00";
        }
    }

    stopProgressPolling() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    syncProgress() {
        if (!this.ytPlayer || !this.ytReady || this.isSeeking || this.isStopped) return;
        if (typeof this.ytPlayer.getCurrentTime !== "function") return;
        const current = this.ytPlayer.getCurrentTime() || 0;
        const duration = this.ytPlayer.getDuration() || 0;
        if (this.seekEl && duration > 0) {
            this.seekEl.max = String(Math.floor(duration));
            this.seekEl.value = String(Math.min(duration, Math.floor(current)));
        }
        if (this.trackTimeEl) {
            this.trackTimeEl.textContent = formatTime(current);
        }
    }

    startProgressPolling() {
        this.stopProgressPolling();
        this.syncProgress();
        this.progressTimer = setInterval(() => this.syncProgress(), 250);
    }

    loadYouTubeApi() {
        if (window.YT?.Player) {
            return Promise.resolve(window.YT);
        }
        if (this.ytApiPromise) {
            return this.ytApiPromise;
        }
        this.ytApiPromise = new Promise((resolve, reject) => {
            const previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof previous === "function") {
                    previous();
                }
                resolve(window.YT);
            };
            const script = document.createElement("script");
            script.src = "https://www.youtube.com/iframe_api";
            script.onerror = () => reject(new Error("Failed to load YouTube IFrame API"));
            document.head.appendChild(script);
        });
        return this.ytApiPromise;
    }

    destroyPlayer() {
        this.stopProgressPolling();
        this.ytReady = false;
        this.pendingLoad = null;
        if (this.ytPlayer && typeof this.ytPlayer.destroy === "function") {
            try {
                this.ytPlayer.destroy();
            } catch {
                // Ignore errors if the YouTube player is already gone
            }
        }
        this.ytPlayer = null;
        if (this.screenEl && !document.getElementById("wmp-yt-host")) {
            const freshHost = document.createElement("div");
            freshHost.id = "wmp-yt-host";
            freshHost.className = "wmp-frame-host";
            this.screenEl.appendChild(freshHost);
            this.hostEl = freshHost;
        } else if (this.hostEl) {
            this.hostEl.textContent = "";
        }
    }

    resetSession() {
        this.destroyPlayer();
        this.currentTrack = null;
        this.setStoppedScreen(true);
        this.updatePlayButtonUI(false);
        this.updateStatusUI("Ready", "&#9632;");
        if (this.trackTimeEl) {
            this.trackTimeEl.textContent = "0:00";
        }
        if (this.seekEl) {
            this.seekEl.max = "100";
            this.seekEl.value = "0";
        }
    }

    loadFallbackIframe(videoId, autoplay) {
        if (!this.hostEl) return;
        this.hostEl.textContent = "";
        const iframe = document.createElement("iframe");
        const params = new URLSearchParams({ rel: "0" });
        if (autoplay) params.set("autoplay", "1");
        iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
        iframe.title = "Windows Media Player";
        iframe.allow = "autoplay; encrypted-media; picture-in-picture";
        iframe.allowFullscreen = true;
        this.hostEl.appendChild(iframe);
    }

    setMasterAudio({ volume, muted } = {}) {
        if (typeof volume === "number" && !Number.isNaN(volume)) {
            this.masterVolume = Math.max(0, Math.min(1, volume));
        }
        if (typeof muted === "boolean") {
            this.masterMuted = muted;
        }
        this.applyAudioSettings();
    }

    applyAudioSettings() {
        if (!this.ytPlayer || !this.ytReady) return;
        if (typeof this.ytPlayer.setVolume === "function") {
            this.ytPlayer.setVolume(Math.round(this.currentVolume * this.masterVolume));
        }
        if (this.isMuted || this.masterMuted) {
            this.ytPlayer.mute?.();
        } else {
            this.ytPlayer.unMute?.();
        }
    }

    playVideoWithPlayer(videoId, autoplay) {
        if (!this.hostEl) return;
        this.setStoppedScreen(false);
        const trackLabel = this.currentTrack ? this.currentTrack.name.replace(/\.[^.]+$/, "") : "Ready";
        this.updateStatusUI(trackLabel, "&#9654;");

        if (this.ytPlayer && this.ytReady) {
            if (autoplay) {
                this.ytPlayer.loadVideoById(videoId);
            } else {
                this.ytPlayer.cueVideoById(videoId);
            }
            return;
        }

        this.pendingLoad = { videoId, autoplay };
        if (this.ytPlayer) {
            return;
        }

        this.loadYouTubeApi().then((YT) => {
            if (this.isStopped || !this.pendingLoad) return;
            const targetLoad = this.pendingLoad;
            this.pendingLoad = null;

            const playerVars = {
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
                autoplay: targetLoad.autoplay ? 1 : 0
            };
            if (window.location.protocol.startsWith("http")) {
                playerVars.origin = window.location.origin;
            }

            this.ytPlayer = new YT.Player(this.hostEl.id, {
                width: "100%",
                height: "100%",
                videoId: targetLoad.videoId,
                playerVars,
                events: {
                    onReady: () => {
                        this.ytReady = true;
                        this.hostEl = document.getElementById("wmp-yt-host") || this.screenEl?.querySelector("iframe");
                        this.applyAudioSettings();
                        if (this.pendingLoad) {
                            const next = this.pendingLoad;
                            this.pendingLoad = null;
                            if (next.autoplay) {
                                this.ytPlayer.loadVideoById(next.videoId);
                            } else {
                                this.ytPlayer.cueVideoById(next.videoId);
                            }
                        } else if (targetLoad.autoplay) {
                            this.ytPlayer.playVideo?.();
                        }
                        this.syncProgress();
                    },
                    onStateChange: (event) => {
                        const label = this.currentTrack ? this.currentTrack.name.replace(/\.[^.]+$/, "") : "Ready";
                        if (event.data === YT.PlayerState.PLAYING) {
                            this.updatePlayButtonUI(true);
                            this.updateStatusUI(label, "&#9654;");
                            this.startProgressPolling();
                        } else if (event.data === YT.PlayerState.PAUSED) {
                            this.updatePlayButtonUI(false);
                            this.updateStatusUI(`Paused: ${label}`, "&#10074;&#10074;");
                            this.stopProgressPolling();
                            this.syncProgress();
                        } else if (event.data === YT.PlayerState.BUFFERING) {
                            this.updateStatusUI(`Buffering: ${label}`, "&#9654;");
                        } else if (event.data === YT.PlayerState.ENDED) {
                            this.updatePlayButtonUI(false);
                            this.stopProgressPolling();
                            this.stepTrack(1);
                        }
                    }
                }
            });
        }).catch(() => {
            if (!this.isStopped && this.currentTrack) {
                this.loadFallbackIframe(this.currentTrack.videoId, autoplay);
            }
        });
    }

    stepTrack(delta) {
        if (!this.playlistTracks.length || !this.currentTrack) return;
        const idx = this.playlistTracks.findIndex(
            (t) => t.pathString.toLowerCase() === this.currentTrack.pathString.toLowerCase()
        );
        const nextIdx = idx === -1 ? 0 : (idx + delta + this.playlistTracks.length) % this.playlistTracks.length;
        this.openTrack({ trackPath: this.playlistTracks[nextIdx].pathString, autoplay: true });
    }

    openTrack({ trackPath = null, autoplay = Boolean(trackPath) } = {}) {
        this.playlistTracks = this.collectTracksFromMusicFolder();

        if (!trackPath) {
            this.renderPlaylist();
            this.setTitle("Windows Media Player");
            if (!this.currentTrack) {
                this.setStoppedScreen(true);
                this.updateStatusUI("Ready", "&#9632;");
            }
            this.open();
            return;
        }

        const parts = Array.isArray(trackPath) ? trackPath : resolvePath(trackPath);
        const node = parts ? getNode(parts) : null;
        const videoId = isFileNode(node) ? extractYouTubeId(node.content) : "";
        if (!videoId) return;

        const filename = parts[parts.length - 1];
        const pathString = getPathString(parts);
        this.currentTrack = { name: filename, url: node.content, videoId, pathString };

        if (!this.playlistTracks.some((t) => t.pathString.toLowerCase() === pathString.toLowerCase())) {
            this.playlistTracks.unshift(this.currentTrack);
        }

        this.renderPlaylist();
        this.setTitle("Windows Media Player");
        this.open();
        this.playVideoWithPlayer(videoId, autoplay);
    }
}

let mediaPlayerInstance = null;

export function initMediaPlayer() {
    if (mediaPlayerInstance) return mediaPlayerInstance;
    const winEl = document.getElementById("media-player-window");
    if (!winEl) return null;
    mediaPlayerInstance = new MediaPlayerApp(winEl);
    return mediaPlayerInstance;
}

export function resetMediaPlayerSession() {
    mediaPlayerInstance?.resetSession();
}

export function setMasterAudio(audioState) {
    mediaPlayerInstance?.setMasterAudio(audioState);
}

// Opens Media Player and loads the requested track
export function openMediaPlayer(options = {}) {
    const app = initMediaPlayer();
    app?.openTrack(options);
}
