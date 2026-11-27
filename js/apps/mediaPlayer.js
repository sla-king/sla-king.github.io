import { registerWindow, openWindow, setWindowTitle } from "../windowManager.js";
import { HOME_PATH, getNode, getPathString, isAudioFile, isFileNode, isFolderNode, resolvePath } from "../filesystem.js";

const MUSIC_FOLDER_PATH = [...HOME_PATH, "My Documents", "My Music"];

const PLAY_ICON_SRC = "assets/wmp_play.png";
const PAUSE_ICON_SRC = "assets/wmp_pause.png";
const SOUND_ICON_SRC = "assets/wmp_sound.png";
const MUTE_ICON_SRC = "assets/wmp_mute.png";

let winEl = null;
let screenEl = null;
let hostEl = null;
let stoppedTitleEl = null;
let playlistColEl = null;
let playlistEl = null;
let statusGlyphEl = null;
let statusTextEl = null;
let trackTimeEl = null;
let playBtnEl = null;
let muteBtnEl = null;
let seekEl = null;
let volumeEl = null;

let currentTrack = null;
let playlistTracks = [];
let ytPlayer = null;
let ytReady = false;
let ytApiPromise = null;
let progressTimer = null;
let isStopped = false;
let isPlaying = false;
let isMuted = false;
let isSeeking = false;
let currentVolume = 70;
let masterVolume = 0.7;
let masterMuted = false;
let pendingLoad = null;

function extractYouTubeId(urlString) {
    if (typeof urlString !== "string") {
        return "";
    }
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

function collectTracksFromMusicFolder() {
    const musicNode = getNode(MUSIC_FOLDER_PATH);
    if (!isFolderNode(musicNode)) {
        return [];
    }
    const tracks = [];
    for (const [name, value] of Object.entries(musicNode)) {
        if (isFileNode(value) && isAudioFile(name) && extractYouTubeId(value.content)) {
            tracks.push({
                name,
                url: value.content,
                videoId: extractYouTubeId(value.content),
                pathString: getPathString([...MUSIC_FOLDER_PATH, name])
            });
        }
    }
    return tracks;
}

function renderPlaylist() {
    if (!playlistEl) return;
    playlistEl.textContent = "";
    for (const track of playlistTracks) {
        const item = document.createElement("div");
        item.className = "wmp-playlist-item";
        if (currentTrack && track.pathString.toLowerCase() === currentTrack.pathString.toLowerCase()) {
            item.classList.add("active");
        }
        item.textContent = track.name;
        item.title = track.name;
        item.addEventListener("click", () => {
            openMediaPlayer({ trackPath: track.pathString, autoplay: true });
        });
        playlistEl.appendChild(item);
    }
}

function updatePlayButtonUI(playing) {
    isPlaying = playing;
    if (!playBtnEl) return;
    const icon = playBtnEl.querySelector("img");
    if (icon) {
        icon.src = playing ? PAUSE_ICON_SRC : PLAY_ICON_SRC;
    }
    playBtnEl.title = playing ? "Pause" : "Play";
    playBtnEl.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function updateMuteButtonUI(muted) {
    isMuted = muted;
    if (!muteBtnEl) return;
    const icon = muteBtnEl.querySelector("img");
    if (icon) {
        icon.src = muted ? MUTE_ICON_SRC : SOUND_ICON_SRC;
    }
    muteBtnEl.classList.toggle("active", muted);
    muteBtnEl.setAttribute("aria-pressed", String(muted));
    muteBtnEl.title = muted ? "Unmute" : "Mute";
    muteBtnEl.setAttribute("aria-label", muted ? "Unmute" : "Mute");
}

function updateStatusUI(stateLabel, glyphHtml) {
    if (statusGlyphEl) {
        statusGlyphEl.innerHTML = glyphHtml;
    }
    if (statusTextEl) {
        statusTextEl.textContent = stateLabel;
    }
}

function setStoppedScreen(stopped) {
    isStopped = stopped;
    if (hostEl) {
        hostEl.hidden = stopped;
    }
    if (stoppedTitleEl) {
        stoppedTitleEl.hidden = !stopped;
        stoppedTitleEl.textContent = currentTrack ? currentTrack.name : "";
    }
    if (stopped) {
        updatePlayButtonUI(false);
        updateStatusUI("Stopped", "&#9632;");
        if (seekEl) seekEl.value = "0";
        if (trackTimeEl) trackTimeEl.textContent = "0:00";
    }
}

function stopProgressPolling() {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
}

function syncProgress() {
    if (!ytPlayer || !ytReady || isSeeking || isStopped) return;
    if (typeof ytPlayer.getCurrentTime !== "function") return;
    const current = ytPlayer.getCurrentTime() || 0;
    const duration = ytPlayer.getDuration() || 0;
    if (seekEl && duration > 0) {
        seekEl.max = String(Math.floor(duration));
        seekEl.value = String(Math.min(duration, Math.floor(current)));
    }
    if (trackTimeEl) {
        trackTimeEl.textContent = formatTime(current);
    }
}

function startProgressPolling() {
    stopProgressPolling();
    syncProgress();
    progressTimer = setInterval(syncProgress, 250);
}

function loadYouTubeApi() {
    if (window.YT?.Player) {
        return Promise.resolve(window.YT);
    }
    if (ytApiPromise) {
        return ytApiPromise;
    }
    ytApiPromise = new Promise((resolve, reject) => {
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
    return ytApiPromise;
}

function destroyPlayer() {
    stopProgressPolling();
    ytReady = false;
    pendingLoad = null;
    if (ytPlayer && typeof ytPlayer.destroy === "function") {
        try {
            ytPlayer.destroy();
        } catch {
            // Ignore teardown errors
        }
    }
    ytPlayer = null;
    if (screenEl && !document.getElementById("wmp-yt-host")) {
        const freshHost = document.createElement("div");
        freshHost.id = "wmp-yt-host";
        freshHost.className = "wmp-frame-host";
        screenEl.appendChild(freshHost);
        hostEl = freshHost;
    } else if (hostEl) {
        hostEl.textContent = "";
    }
}

function loadFallbackIframe(videoId, autoplay) {
    if (!hostEl) return;
    hostEl.textContent = "";
    const iframe = document.createElement("iframe");
    const params = new URLSearchParams({ rel: "0" });
    if (autoplay) params.set("autoplay", "1");
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
    iframe.title = "Windows Media Player";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    hostEl.appendChild(iframe);
}

export function setMasterAudio({ volume, muted } = {}) {
    if (typeof volume === "number" && !Number.isNaN(volume)) {
        masterVolume = Math.max(0, Math.min(1, volume));
    }
    if (typeof muted === "boolean") {
        masterMuted = muted;
    }
    applyAudioSettings();
}

function applyAudioSettings() {
    if (!ytPlayer || !ytReady) return;
    if (typeof ytPlayer.setVolume === "function") {
        ytPlayer.setVolume(Math.round(currentVolume * masterVolume));
    }
    if (isMuted || masterMuted) {
        ytPlayer.mute?.();
    } else {
        ytPlayer.unMute?.();
    }
}

function playVideoWithPlayer(videoId, autoplay) {
    if (!hostEl) return;
    setStoppedScreen(false);
    const trackLabel = currentTrack ? currentTrack.name.replace(/\.[^.]+$/, "") : "Ready";
    updateStatusUI(trackLabel, "&#9654;");

    if (ytPlayer && ytReady) {
        if (autoplay) {
            ytPlayer.loadVideoById(videoId);
        } else {
            ytPlayer.cueVideoById(videoId);
        }
        return;
    }

    pendingLoad = { videoId, autoplay };
    if (ytPlayer) {
        return;
    }

    loadYouTubeApi().then((YT) => {
        if (isStopped || !pendingLoad) return;
        const targetLoad = pendingLoad;
        pendingLoad = null;

        const playerVars = {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            autoplay: targetLoad.autoplay ? 1 : 0
        };
        if (window.location.protocol.startsWith("http")) {
            playerVars.origin = window.location.origin;
        }

        ytPlayer = new YT.Player(hostEl.id, {
            width: "100%",
            height: "100%",
            videoId: targetLoad.videoId,
            playerVars,
            events: {
                onReady: () => {
                    ytReady = true;
                    hostEl = document.getElementById("wmp-yt-host") || screenEl?.querySelector("iframe");
                    applyAudioSettings();
                    if (pendingLoad) {
                        const next = pendingLoad;
                        pendingLoad = null;
                        if (next.autoplay) {
                            ytPlayer.loadVideoById(next.videoId);
                        } else {
                            ytPlayer.cueVideoById(next.videoId);
                        }
                    } else if (targetLoad.autoplay) {
                        ytPlayer.playVideo?.();
                    }
                    syncProgress();
                },
                onStateChange: (event) => {
                    const label = currentTrack ? currentTrack.name.replace(/\.[^.]+$/, "") : "Ready";
                    if (event.data === YT.PlayerState.PLAYING) {
                        updatePlayButtonUI(true);
                        updateStatusUI(label, "&#9654;");
                        startProgressPolling();
                    } else if (event.data === YT.PlayerState.PAUSED) {
                        updatePlayButtonUI(false);
                        updateStatusUI(`Paused: ${label}`, "&#10074;&#10074;");
                        stopProgressPolling();
                        syncProgress();
                    } else if (event.data === YT.PlayerState.BUFFERING) {
                        updateStatusUI(`Buffering: ${label}`, "&#9654;");
                    } else if (event.data === YT.PlayerState.ENDED) {
                        updatePlayButtonUI(false);
                        stopProgressPolling();
                        stepTrack(1);
                    }
                }
            }
        });
    }).catch(() => {
        if (!isStopped && currentTrack) {
            loadFallbackIframe(currentTrack.videoId, autoplay);
        }
    });
}

function stepTrack(delta) {
    if (!playlistTracks.length || !currentTrack) return;
    const idx = playlistTracks.findIndex(t => t.pathString.toLowerCase() === currentTrack.pathString.toLowerCase());
    const nextIdx = idx === -1 ? 0 : (idx + delta + playlistTracks.length) % playlistTracks.length;
    openMediaPlayer({ trackPath: playlistTracks[nextIdx].pathString, autoplay: true });
}

export function initMediaPlayer() {
    winEl = document.getElementById("media-player-window");
    if (!winEl) {
        return;
    }

    screenEl = winEl.querySelector(".wmp-screen");
    hostEl = document.getElementById("wmp-yt-host");
    stoppedTitleEl = winEl.querySelector(".wmp-stopped-title");
    playlistColEl = winEl.querySelector(".wmp-playlist-col");
    playlistEl = winEl.querySelector(".wmp-playlist");
    statusGlyphEl = winEl.querySelector(".wmp-status-glyph");
    statusTextEl = winEl.querySelector(".wmp-status-text");
    trackTimeEl = winEl.querySelector(".wmp-tracktime");
    playBtnEl = winEl.querySelector(".wmp-play-btn");
    muteBtnEl = winEl.querySelector(".wmp-mute-btn");
    seekEl = winEl.querySelector(".wmp-seek");
    volumeEl = winEl.querySelector(".wmp-volume");

    if (volumeEl) {
        currentVolume = Math.round(Number(volumeEl.value || 0.7) * 100);
    }

    registerWindow({
        id: "media-player",
        winEl,
        resizable: true,
        maximizable: true,
        onClose() {
            currentTrack = null;
            destroyPlayer();
            setStoppedScreen(true);
        }
    });

    playBtnEl?.addEventListener("click", () => {
        if (!currentTrack) {
            if (playlistTracks.length > 0) {
                openMediaPlayer({ trackPath: playlistTracks[0].pathString, autoplay: true });
            }
            return;
        }
        if (isStopped || !ytPlayer) {
            playVideoWithPlayer(currentTrack.videoId, true);
            return;
        }
        if (ytReady && typeof ytPlayer.getPlayerState === "function") {
            if (isPlaying) {
                ytPlayer.pauseVideo();
            } else {
                ytPlayer.playVideo();
            }
        }
    });

    winEl.querySelector(".wmp-stop-btn")?.addEventListener("click", () => {
        stopProgressPolling();
        if (ytPlayer && ytReady && typeof ytPlayer.stopVideo === "function") {
            ytPlayer.stopVideo();
        } else {
            destroyPlayer();
        }
        setStoppedScreen(true);
    });

    winEl.querySelector(".wmp-prev-btn")?.addEventListener("click", () => stepTrack(-1));
    winEl.querySelector(".wmp-next-btn")?.addEventListener("click", () => stepTrack(1));

    winEl.querySelector(".wmp-rew-btn")?.addEventListener("click", () => {
        if (ytPlayer && ytReady && !isStopped && typeof ytPlayer.getCurrentTime === "function") {
            ytPlayer.seekTo(Math.max(0, (ytPlayer.getCurrentTime() || 0) - 10), true);
            syncProgress();
        } else {
            stepTrack(-1);
        }
    });

    winEl.querySelector(".wmp-ff-btn")?.addEventListener("click", () => {
        if (ytPlayer && ytReady && !isStopped && typeof ytPlayer.getCurrentTime === "function") {
            const duration = ytPlayer.getDuration() || 0;
            const nextTime = Math.min(duration || Infinity, (ytPlayer.getCurrentTime() || 0) + 10);
            ytPlayer.seekTo(nextTime, true);
            syncProgress();
        } else {
            stepTrack(1);
        }
    });

    seekEl?.addEventListener("pointerdown", () => {
        isSeeking = true;
    });

    seekEl?.addEventListener("input", () => {
        if (trackTimeEl) {
            trackTimeEl.textContent = formatTime(Number(seekEl.value));
        }
    });

    const commitSeek = () => {
        if (ytPlayer && ytReady && !isStopped && typeof ytPlayer.seekTo === "function") {
            ytPlayer.seekTo(Number(seekEl.value), true);
        }
        isSeeking = false;
    };

    seekEl?.addEventListener("change", commitSeek);
    seekEl?.addEventListener("pointerup", commitSeek);
    seekEl?.addEventListener("pointercancel", () => {
        isSeeking = false;
    });

    muteBtnEl?.addEventListener("click", () => {
        updateMuteButtonUI(!isMuted);
        applyAudioSettings();
    });

    volumeEl?.addEventListener("input", () => {
        currentVolume = Math.round(Number(volumeEl.value) * 100);
        if (currentVolume > 0 && isMuted) {
            updateMuteButtonUI(false);
        }
        applyAudioSettings();
    });

    const modeDropdown = winEl.querySelector(".wmp-mode-dropdown");
    const modeBtn = winEl.querySelector(".wmp-mode-select");
    const modeIcon = winEl.querySelector(".wmp-mode-icon");
    const modeLabel = winEl.querySelector(".wmp-mode-label");
    const modeMenu = winEl.querySelector(".wmp-mode-menu");
    const modeOptions = winEl.querySelectorAll(".wmp-mode-option");

    const closeModeMenu = () => {
        if (!modeMenu || !modeBtn) return;
        modeMenu.hidden = true;
        modeBtn.setAttribute("aria-expanded", "false");
    };

    modeDropdown?.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
    });

    modeBtn?.addEventListener("click", () => {
        if (!modeMenu) return;
        const willOpen = modeMenu.hidden;
        modeMenu.hidden = !willOpen;
        modeBtn.setAttribute("aria-expanded", String(willOpen));
    });

    modeOptions.forEach((opt) => {
        opt.addEventListener("click", () => {
            const view = opt.dataset.wmpView;
            const showPlaylist = view === "playlist";
            if (playlistColEl) {
                playlistColEl.hidden = !showPlaylist;
            }
            if (modeIcon && opt.dataset.icon) {
                modeIcon.src = opt.dataset.icon;
            }
            if (modeLabel) {
                const labelSpan = opt.querySelector("span");
                modeLabel.textContent = labelSpan ? labelSpan.textContent : opt.textContent.trim();
            }
            modeOptions.forEach(item => item.classList.toggle("active", item === opt));
            closeModeMenu();
        });
    });

    document.addEventListener("pointerdown", (e) => {
        if (!modeDropdown?.contains(e.target)) {
            closeModeMenu();
        }
    });
}

/**
 * Opens Windows Media Player and loads the YouTube player for the requested track.
 */
export function openMediaPlayer({ trackPath = null, autoplay = Boolean(trackPath) } = {}) {
    if (!winEl) {
        initMediaPlayer();
    }

    playlistTracks = collectTracksFromMusicFolder();

    if (!trackPath) {
        renderPlaylist();
        setWindowTitle("media-player", "Windows Media Player");
        if (!currentTrack) {
            setStoppedScreen(true);
            updateStatusUI("Ready", "&#9632;");
        }
        openWindow("media-player");
        return;
    }

    const parts = Array.isArray(trackPath) ? trackPath : resolvePath(trackPath);
    const node = parts ? getNode(parts) : null;
    const videoId = isFileNode(node) ? extractYouTubeId(node.content) : "";
    if (!videoId) {
        return;
    }

    const filename = parts[parts.length - 1];
    const pathString = getPathString(parts);
    currentTrack = { name: filename, url: node.content, videoId, pathString };

    if (!playlistTracks.some(t => t.pathString.toLowerCase() === pathString.toLowerCase())) {
        playlistTracks.unshift(currentTrack);
    }

    renderPlaylist();
    setWindowTitle("media-player", "Windows Media Player");
    openWindow("media-player");
    playVideoWithPlayer(videoId, autoplay);
}
