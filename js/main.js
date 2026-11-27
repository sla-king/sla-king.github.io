import { HOME_PATH } from './filesystem.js';
import { SOUNDS, playSound, setSiteAudioState } from './sound.js';
import { initTerminal } from './apps/terminal.js';
import { initExplorer, openExplorer, openWebExplorer, openMyComputer } from './apps/explorer.js';
import { initNotepad, openNotepad, openBlankNotepad, getRecentDocuments } from './apps/notepad.js';
import { initMediaPlayer, openMediaPlayer, setMasterAudio, resetMediaPlayerSession } from './apps/mediaPlayer.js';
import { initPictureViewer } from './apps/pictureViewer.js';
import {
    registerWindow,
    openWindow,
    closeWindow,
    closeAllWindows,
    centerWindow,
    blurAllWindows,
    isClickInsideAnyWindow,
    nextZIndex
} from './windowManager.js';

const clock = document.getElementById("clock");
const trayVolumeBtn = document.getElementById("tray-volume-btn");
const trayVolumeIcon = trayVolumeBtn?.querySelector(".tray-icon");
const volumePopup = document.getElementById("xp-volume-popup");
const volumeSlider = document.getElementById("xp-volume-slider");
const volumeMuteCheckbox = document.getElementById("xp-volume-mute");
const startButton = document.getElementById("start-button");
const startMenu = document.getElementById("start-menu");
const taskbar = document.querySelector(".taskbar");
const selectionBox = document.getElementById("selection-box");
const recentMenuItem = document.querySelector('.menu-item[data-action="recent-documents"]');
const recentDocumentsMenu = document.getElementById("recent-documents-menu");
const allProgramsMenuItem = document.querySelector('.menu-item[data-action="all-programs"]');
const allProgramsMenu = document.getElementById("all-programs-menu");
const linkWindow = document.getElementById("xp-link-window");
const linkIcon = document.getElementById("xp-link-icon");
const linkMessage = document.getElementById("xp-link-message");
const linkCancelBtn = document.getElementById("xp-link-cancel");
const linkVisitBtn = document.getElementById("xp-link-visit");
const powerBackdrop = document.getElementById("xp-power-backdrop");
const powerTitle = document.getElementById("xp-power-title");
const powerOptions = document.getElementById("xp-power-options");
const powerCancelBtn = document.getElementById("xp-power-cancel");
const powerBalloon = document.getElementById("xp-power-balloon");
const powerBalloonTitle = document.getElementById("xp-power-balloon-title");
const powerBalloonBody = document.getElementById("xp-power-balloon-body");
const systemScreen = document.getElementById("xp-system-screen");
const statusView = document.getElementById("xp-status-view");
const statusText = document.getElementById("xp-status-text");
const logonView = document.getElementById("xp-logon-view");
const logonUserBtn = document.getElementById("xp-logon-user");
const logonStatusEl = document.getElementById("xp-logon-status");
const logonTurnOffBtn = document.getElementById("xp-logon-turnoff");
const bootView = document.getElementById("xp-boot-view");
const poweroffView = document.getElementById("xp-poweroff-view");
const powerOnBtn = document.getElementById("xp-poweron-btn");

const POWER_DIALOGS = {
    logoff: {
        title: "Log Off Windows",
        options: [
            {
                action: "switch-user",
                label: "Switch User",
                icon: "assets/start_switch_user.png",
                disabled: false,
                tooltip: "Lets another user log on while your programs and files remain open."
            },
            {
                action: "logoff",
                label: "Log Off",
                icon: "assets/start_logoff.png",
                disabled: false,
                tooltip: "Closes your programs and ends your Windows session."
            }
        ]
    },
    turnoff: {
        title: "Turn off computer",
        options: [
            {
                action: "turnoff",
                label: "Turn Off",
                icon: "assets/start_turnoff.png",
                disabled: false,
                tooltip: "Shuts down Windows so that you can safely turn off the computer."
            },
            {
                action: "restart",
                label: "Restart",
                icon: "assets/start_restart.png",
                disabled: false,
                tooltip: "Shuts down Windows and then starts Windows again."
            }
        ]
    }
};

const EXTERNAL_LINKS = {
    email: {
        name: "sla-king's Email",
        buttonText: "Open Email",
        icon: "assets/app_outlook.png",
        url: "mailto:alex.l.seidinger@gmail.com"
    },
    linkedin: {
        name: "sla-king's LinkedIn",
        buttonText: "Visit LinkedIn",
        icon: "assets/app_linkedin.png",
        url: "https://www.linkedin.com/in/alexanderseidinger"
    },
    github: {
        name: "sla-king's GitHub",
        buttonText: "Visit GitHub",
        icon: "assets/app_github.png",
        url: "https://github.com/sla-king"
    }
};

let pendingLinkUrl = "";
let selectState = null;
const submenuTimers = new Map();
const SUBMENU_DELAY_MS = 350;

const APP_LAUNCHERS = {
    "explorer-web": () => openWebExplorer(),
    "email": () => openLinkDialog("email"),
    "cmd": () => {
        openWindow("terminal");
        document.getElementById("cmd-input").focus({ preventScroll: true });
    },
    "notepad": () => openBlankNotepad(),
    "media-player": () => openMediaPlayer(),
    "linkedin": () => openLinkDialog("linkedin"),
    "github": () => openLinkDialog("github")
};

const ALL_PROGRAMS_ITEMS = [
    { name: "Command Prompt", icon: "assets/app_command_prompt_16.png", action: "cmd" },
    { name: "GitHub", icon: "assets/app_github.png", action: "github" },
    { name: "Internet Explorer", icon: "assets/app_explorer_16.png", action: "explorer-web" },
    { name: "LinkedIn", icon: "assets/app_linkedin.png", action: "linkedin" },
    { name: "Notepad", icon: "assets/app_notepad_16.png", action: "notepad" },
    { name: "Outlook Express", icon: "assets/app_outlook.png", action: "email" },
    { name: "Windows Media Player", icon: "assets/app_media_player_16.png", action: "media-player" }
];

const LINK_DIALOG_ACTIONS = new Set(["email", "linkedin", "github"]);

function launchAppAction(action) {
    const launcher = APP_LAUNCHERS[action];
    if (!launcher) return;
    closeStartMenu();
    if (!LINK_DIALOG_ACTIONS.has(action)) {
        playSound(SOUNDS.MENU_COMMAND);
    }
    launcher();
}

function createSubmenuEntry(labelText, iconSrc, tooltip, onClick) {
    const item = document.createElement("div");
    item.className = "start-submenu-item";
    if (tooltip) item.title = tooltip;

    const icon = document.createElement("img");
    icon.src = iconSrc;
    icon.className = "start-submenu-icon";
    icon.alt = "";

    const label = document.createElement("span");
    label.textContent = labelText;

    item.append(icon, label);
    item.addEventListener("click", (e) => {
        e.stopPropagation();
        closeStartMenu();
        onClick();
    });
    return item;
}

function renderAllProgramsMenu() {
    if (!allProgramsMenu) return;
    allProgramsMenu.innerHTML = "";
    for (const prog of ALL_PROGRAMS_ITEMS) {
        const tooltip = startMenu.querySelector(`.menu-item[data-action="${prog.action}"]`)?.title || "";
        allProgramsMenu.appendChild(
            createSubmenuEntry(prog.name, prog.icon, tooltip, () => {
                if (!LINK_DIALOG_ACTIONS.has(prog.action)) {
                    playSound(SOUNDS.MENU_COMMAND);
                }
                APP_LAUNCHERS[prog.action]?.();
            })
        );
    }
}

function renderRecentDocumentsMenu() {
    if (!recentDocumentsMenu) return;
    recentDocumentsMenu.innerHTML = "";
    const docs = getRecentDocuments();

    if (docs.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "start-submenu-empty";
        emptyItem.textContent = "(Empty)";
        emptyItem.title = "";
        recentDocumentsMenu.appendChild(emptyItem);
        return;
    }

    for (const doc of docs) {
        recentDocumentsMenu.appendChild(
            createSubmenuEntry(doc.displayName, "assets/file_text_doc_16.png", doc.filePath, () => {
                playSound(SOUNDS.MENU_COMMAND);
                openNotepad(doc.filename, doc.content, doc.filePath);
            })
        );
    }
}

function closeOtherSubmenus(exceptEl = null) {
    for (const [el, timer] of submenuTimers.entries()) {
        if (el !== exceptEl) {
            clearTimeout(timer);
            submenuTimers.delete(el);
            el.classList.remove("submenu-open");
        }
    }
}

function closeStartMenu() {
    closeOtherSubmenus(null);
    startMenu.classList.remove("show");
}

function setupSubmenu(menuItemEl, submenuEl) {
    if (!menuItemEl) return;

    menuItemEl.addEventListener("pointerenter", (e) => {
        clearTimeout(submenuTimers.get(menuItemEl));
        closeOtherSubmenus(menuItemEl);
        if (e.pointerType !== "touch" && !menuItemEl.classList.contains("submenu-open")) {
            const timer = setTimeout(() => {
                menuItemEl.classList.add("submenu-open");
            }, SUBMENU_DELAY_MS);
            submenuTimers.set(menuItemEl, timer);
        }
    });

    menuItemEl.addEventListener("pointerleave", () => {
        clearTimeout(submenuTimers.get(menuItemEl));
        const timer = setTimeout(() => {
            menuItemEl.classList.remove("submenu-open");
        }, 250);
        submenuTimers.set(menuItemEl, timer);
    });

    menuItemEl.addEventListener("click", (e) => {
        if (submenuEl?.contains(e.target)) return;
        clearTimeout(submenuTimers.get(menuItemEl));
        closeOtherSubmenus(menuItemEl);
        menuItemEl.classList.toggle("submenu-open");
    });
}

let systemTimers = [];

function clearSystemTimers() {
    for (const timer of systemTimers) {
        clearTimeout(timer);
    }
    systemTimers = [];
}

function scheduleSystemStep(delayMs, fn) {
    const timer = setTimeout(fn, delayMs);
    systemTimers.push(timer);
}

function showSystemView(activeView, message = "", { welcomeOnly = false } = {}) {
    if (!systemScreen) return;
    for (const view of [statusView, logonView, bootView, poweroffView]) {
        if (view) view.hidden = view !== activeView;
    }
    if (statusView) {
        statusView.classList.toggle("xp-welcome-mode", activeView === statusView && welcomeOnly);
    }
    if (statusText && activeView === statusView) {
        statusText.textContent = message;
    }
    systemScreen.hidden = false;
}

function hideSystemScreen() {
    clearSystemTimers();
    document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
    if (!systemScreen) return;
    systemScreen.hidden = true;
    for (const view of [statusView, logonView, bootView, poweroffView]) {
        if (view) view.hidden = true;
    }
}

function teardownUserSession() {
    document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
    closePowerDialog();
    closeStartMenu();
    closeVolumePopup();
    resetMediaPlayerSession();
    closeAllWindows();
}

let isSwitchedUserSession = false;
let isLoggingOn = false;

function setLogonStatus(message = "") {
    if (logonStatusEl) {
        logonStatusEl.textContent = message;
    }
}

function runBootSequence() {
    clearSystemTimers();
    document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
    isSwitchedUserSession = false;
    isLoggingOn = false;
    setLogonStatus("");
    showSystemView(bootView);
    scheduleSystemStep(7000, () => {
        showSystemView(statusView, "welcome", { welcomeOnly: true });
    });
    scheduleSystemStep(9000, () => {
        hideSystemScreen();
        playSound(SOUNDS.STARTUP);
    });
}

function runSwitchUser() {
    clearSystemTimers();
    closePowerDialog();
    closeStartMenu();
    closeVolumePopup();
    blurAllWindows();
    isSwitchedUserSession = true;
    isLoggingOn = false;
    setLogonStatus("Logged on");
    document.body.classList.add("xp-session-closing");
    scheduleSystemStep(500, () => {
        document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
        playSound(SOUNDS.LOGOFF);
        showSystemView(logonView);
    });
}

function runLogOff() {
    clearSystemTimers();
    teardownUserSession();
    isSwitchedUserSession = false;
    isLoggingOn = false;
    setLogonStatus("");
    document.body.classList.add("xp-session-closing");

    scheduleSystemStep(1000, () => {
        document.body.classList.add("xp-wallpaper-only");
    });
    scheduleSystemStep(2000, () => {
        document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
        playSound(SOUNDS.SHUTDOWN);
        showSystemView(statusView, "Logging off...");
    });
    scheduleSystemStep(7000, () => {
        showSystemView(statusView, "Saving your settings...");
    });
    scheduleSystemStep(7100, () => {
        showSystemView(logonView);
    });
}

function runLogOn() {
    if (isLoggingOn) return;
    clearSystemTimers();

    if (isSwitchedUserSession) {
        isSwitchedUserSession = false;
        isLoggingOn = false;
        setLogonStatus("");
        hideSystemScreen();
        scheduleSystemStep(500, () => {
            playSound(SOUNDS.LOGON);
        });
        return;
    }

    isLoggingOn = true;
    setLogonStatus("Loading your personal settings...");
    scheduleSystemStep(800, () => {
        isLoggingOn = false;
        setLogonStatus("");
        hideSystemScreen();
        playSound(SOUNDS.STARTUP);
    });
}

function runShutdownFlow({ restart = false } = {}) {
    const fromLogonScreen = Boolean(systemScreen && !systemScreen.hidden && logonView && !logonView.hidden);
    const needsLogoffSteps = !fromLogonScreen || isSwitchedUserSession;

    clearSystemTimers();
    teardownUserSession();
    isSwitchedUserSession = false;
    isLoggingOn = false;
    setLogonStatus("");

    let offset = 0;
    if (!needsLogoffSteps) {
        playSound(SOUNDS.SHUTDOWN);
        showSystemView(statusView, "Windows is shutting down...");
    } else {
        if (!fromLogonScreen) {
            hideSystemScreen();
            document.body.classList.add("xp-session-closing");
            scheduleSystemStep(1000, () => {
                document.body.classList.add("xp-wallpaper-only");
            });
            offset = 2000;
        }
        scheduleSystemStep(offset, () => {
            document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
            playSound(SOUNDS.SHUTDOWN);
            showSystemView(statusView, "Logging off...");
        });
        offset += 4000;
        scheduleSystemStep(offset, () => {
            showSystemView(statusView, "Saving your settings...");
        });
        offset += 100;
        scheduleSystemStep(offset, () => {
            showSystemView(statusView, "Windows is shutting down...");
        });
    }

    scheduleSystemStep(offset + 7000, () => {
        showSystemView(null);
    });
    scheduleSystemStep(offset + 11000, () => {
        if (restart) {
            runBootSequence();
        } else {
            showSystemView(poweroffView);
        }
    });
}

function executePowerAction(action) {
    if (action === "logoff") {
        runLogOff();
    } else if (action === "switch-user") {
        runSwitchUser();
    } else if (action === "turnoff") {
        runShutdownFlow({ restart: false });
    } else if (action === "restart") {
        runShutdownFlow({ restart: true });
    }
}

let powerBalloonTimer = null;

function hidePowerBalloon() {
    clearTimeout(powerBalloonTimer);
    powerBalloonTimer = null;
    if (powerBalloon) {
        powerBalloon.hidden = true;
    }
}

function showPowerBalloon(btn, option) {
    if (!powerBalloon || !powerBalloonTitle || !powerBalloonBody || !option.tooltip) return;
    powerBalloonTitle.textContent = option.label;
    powerBalloonBody.textContent = option.tooltip;
    powerBalloon.hidden = false;

    const iconEl = btn.querySelector(".xp-power-option-icon") || btn;
    const anchorRect = iconEl.getBoundingClientRect();
    const balloonWidth = powerBalloon.offsetWidth || 240;
    const left = Math.max(
        6,
        Math.min(anchorRect.left + anchorRect.width / 2 - 16, window.innerWidth - balloonWidth - 6)
    );
    const top = Math.min(anchorRect.bottom + 14, window.innerHeight - powerBalloon.offsetHeight - 6);
    powerBalloon.style.left = `${Math.round(left)}px`;
    powerBalloon.style.top = `${Math.round(top)}px`;
}

function closePowerDialog() {
    hidePowerBalloon();
    if (!powerBackdrop) return;
    powerBackdrop.classList.remove("desaturated", "show");
    powerBackdrop.hidden = true;
}

function openPowerDialog(mode) {
    const config = POWER_DIALOGS[mode];
    if (!config || !powerBackdrop || !powerTitle || !powerOptions) return;

    hidePowerBalloon();
    closeStartMenu();
    blurAllWindows();
    powerTitle.textContent = config.title;
    powerOptions.innerHTML = "";

    for (const option of config.options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "xp-power-option";
        btn.disabled = Boolean(option.disabled);

        const icon = document.createElement("img");
        icon.className = "xp-power-option-icon";
        icon.src = option.icon;
        icon.alt = "";

        const label = document.createElement("span");
        label.className = "xp-power-option-label";
        label.textContent = option.label;

        btn.append(icon, label);
        if (!option.disabled) {
            btn.addEventListener("click", () => {
                hidePowerBalloon();
                executePowerAction(option.action);
            });
            btn.addEventListener("pointerenter", () => {
                clearTimeout(powerBalloonTimer);
                powerBalloonTimer = setTimeout(() => {
                    showPowerBalloon(btn, option);
                }, 280);
            });
            btn.addEventListener("pointerleave", hidePowerBalloon);
        }
        powerOptions.appendChild(btn);
    }

    powerBackdrop.classList.remove("desaturated");
    powerBackdrop.hidden = false;
    powerBackdrop.classList.add("show");
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (powerBackdrop.classList.contains("show")) {
                powerBackdrop.classList.add("desaturated");
            }
        });
    });
    powerCancelBtn?.focus();
}

powerBackdrop?.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
});

powerCancelBtn?.addEventListener("click", closePowerDialog);
logonUserBtn?.addEventListener("click", runLogOn);
logonTurnOffBtn?.addEventListener("click", () => openPowerDialog("turnoff"));
powerOnBtn?.addEventListener("click", runBootSequence);
systemScreen?.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
});

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (powerBackdrop?.classList.contains("show")) {
        e.preventDefault();
        closePowerDialog();
    } else if (volumePopup && !volumePopup.hidden) {
        e.preventDefault();
        closeVolumePopup();
    }
});

// Initialize Apps
initTerminal();
initExplorer();
initNotepad();
initMediaPlayer();
initPictureViewer();

if (linkWindow) {
    registerWindow({
        id: "xp-link",
        winEl: linkWindow,
        resizable: false,
        maximizable: false,
        showInTaskbar: false
    });

    linkCancelBtn?.addEventListener("click", () => closeWindow("xp-link"));
    linkVisitBtn?.addEventListener("click", () => {
        const url = pendingLinkUrl;
        closeWindow("xp-link");
        if (!url) return;
        if (url.startsWith("mailto:")) {
            window.location.href = url;
        } else {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    });
    linkWindow.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeWindow("xp-link");
        }
    });
}

function openLinkDialog(targetOrKey) {
    const target = typeof targetOrKey === "string" ? EXTERNAL_LINKS[targetOrKey] : targetOrKey;
    if (!target || !linkWindow) return;

    pendingLinkUrl = target.url;
    if (linkIcon) linkIcon.src = target.icon;
    if (linkMessage) linkMessage.textContent = `Are you sure you want to open "${target.url}"?`;
    if (linkVisitBtn) linkVisitBtn.textContent = target.buttonText;

    openWindow("xp-link");
    centerWindow("xp-link");
    playSound(SOUNDS.EXCLAMATION);
    requestAnimationFrame(() => linkVisitBtn?.focus());
}

function resolveLinkTarget(href, label) {
    const lower = href.toLowerCase();
    if (lower.startsWith("mailto:")) {
        return { ...EXTERNAL_LINKS.email, url: href };
    }
    if (lower.includes("linkedin.com")) {
        return { ...EXTERNAL_LINKS.linkedin, url: href };
    }
    if (lower.includes("github.com")) {
        return { ...EXTERNAL_LINKS.github, url: href };
    }
    return {
        name: label || href,
        buttonText: "Visit Link",
        icon: "assets/app_explorer.png",
        url: href
    };
}

window.addEventListener("message", (e) => {
    if (e.data?.type !== "xp-open-link") return;
    const isExplorerFrame = Array.from(document.querySelectorAll(".explorer-frame"))
        .some((frame) => frame.contentWindow === e.source);
    if (!isExplorerFrame) return;

    const href = typeof e.data.href === "string" ? e.data.href.trim() : "";
    if (!/^(?:https?:\/\/|mailto:)/i.test(href)) return;

    openLinkDialog(resolveLinkTarget(href, typeof e.data.text === "string" ? e.data.text.trim() : ""));
});

document.addEventListener("pointerdown", (e) => {
    if (linkWindow && linkWindow.style.display !== "none" && !linkWindow.contains(e.target)) {
        closeWindow("xp-link");
    }
    if (volumePopup && !volumePopup.hidden && !volumePopup.contains(e.target) && !trayVolumeBtn?.contains(e.target)) {
        closeVolumePopup();
    }
}, true);

let siteVolume = 0.7;
let siteMuted = false;

function closeVolumePopup() {
    if (!volumePopup) return;
    volumePopup.hidden = true;
    trayVolumeBtn?.classList.remove("active");
    trayVolumeBtn?.setAttribute("aria-expanded", "false");
}

function syncVolumePopupUI() {
    const effectivelyMuted = siteMuted || siteVolume === 0;
    if (volumeSlider) {
        volumeSlider.value = String(siteVolume);
    }
    if (volumeMuteCheckbox) {
        volumeMuteCheckbox.checked = siteMuted;
    }
    if (trayVolumeIcon) {
        trayVolumeIcon.src = effectivelyMuted
            ? "assets/start_volume_muted.png"
            : "assets/start_volume.png";
    }
    if (trayVolumeBtn) {
        trayVolumeBtn.title = effectivelyMuted ? "Volume (Muted)" : "Volume";
    }
    setSiteAudioState({ volume: siteVolume, muted: siteMuted });
    setMasterAudio({ volume: siteVolume, muted: siteMuted });
}

function openVolumePopup() {
    if (!volumePopup || !trayVolumeBtn) return;
    closeStartMenu();
    syncVolumePopupUI();
    volumePopup.hidden = false;
    trayVolumeBtn.classList.add("active");
    trayVolumeBtn.setAttribute("aria-expanded", "true");

    const btnRect = trayVolumeBtn.getBoundingClientRect();
    const popupWidth = volumePopup.offsetWidth || 92;
    const left = Math.max(
        4,
        Math.min(btnRect.left + (btnRect.width - popupWidth) / 2, window.innerWidth - popupWidth - 4)
    );
    volumePopup.style.left = `${Math.round(left)}px`;
    volumePopup.style.right = "auto";
    volumeSlider?.focus({ preventScroll: true });
}

trayVolumeBtn?.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    blurAllWindows();
    if (volumePopup?.hidden) {
        openVolumePopup();
    } else {
        closeVolumePopup();
    }
});

volumePopup?.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
});

volumeSlider?.addEventListener("input", () => {
    siteVolume = Math.max(0, Math.min(1, Number(volumeSlider.value) || 0));
    syncVolumePopupUI();
});

volumeSlider?.addEventListener("change", () => {
    playSound(SOUNDS.DING);
});

volumeMuteCheckbox?.addEventListener("change", () => {
    siteMuted = Boolean(volumeMuteCheckbox.checked);
    syncVolumePopupUI();
});

syncVolumePopupUI();

// Start Menu & Desktop Events
startButton.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    blurAllWindows();
    closeVolumePopup();
    const willShow = !startMenu.classList.contains("show");
    if (willShow) {
        renderRecentDocumentsMenu();
        startMenu.classList.add("show");
        startMenu.style.zIndex = nextZIndex();
    } else {
        closeStartMenu();
    }
});

startMenu.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    startMenu.style.zIndex = nextZIndex();
});

startMenu.addEventListener("pointerover", (e) => {
    const item = e.target.closest(".menu-item");
    if (item) {
        closeOtherSubmenus(item);
    }
});

document.addEventListener("pointerdown", (e) => {
    const clickedWindow = isClickInsideAnyWindow(e.target);
    const clickedMenu = startMenu.contains(e.target) || startButton.contains(e.target);
    const clickedVolume = volumePopup?.contains(e.target) || trayVolumeBtn?.contains(e.target);
    const clickedTaskbar = taskbar.contains(e.target);

    if (!clickedWindow) blurAllWindows();
    if (!clickedMenu) closeStartMenu();
    if (!clickedVolume) closeVolumePopup();

    // Start desktop selection box if clicking empty desktop with primary button
    if (e.button === 0 && !clickedWindow && !clickedMenu && !clickedTaskbar) {
        selectState = { startX: e.clientX, startY: e.clientY };
        Object.assign(selectionBox.style, {
            left: `${e.clientX}px`,
            top: `${e.clientY}px`,
            width: "0px",
            height: "0px",
            display: "block"
        });
    }
});

document.addEventListener("pointermove", (e) => {
    if (!selectState) return;

    const currentX = Math.max(0, Math.min(e.clientX, window.innerWidth));
    const currentY = Math.max(0, Math.min(e.clientY, window.innerHeight - 30));

    const left = Math.min(selectState.startX, currentX);
    const top = Math.min(selectState.startY, currentY);
    const width = Math.abs(currentX - selectState.startX);
    const height = Math.abs(currentY - selectState.startY);

    Object.assign(selectionBox.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
    });
});

function endSelection() {
    if (!selectState) return;
    selectionBox.style.display = "none";
    selectState = null;
}

document.addEventListener("pointerup", endSelection);
document.addEventListener("pointercancel", endSelection);

Object.keys(APP_LAUNCHERS).forEach((action) => {
    document.querySelector(`.menu-item[data-action="${action}"]`)?.addEventListener("click", () => {
        launchAppAction(action);
    });
});

renderAllProgramsMenu();
setupSubmenu(recentMenuItem, recentDocumentsMenu);
setupSubmenu(allProgramsMenuItem, allProgramsMenu);

document.querySelector('.menu-item[data-action="documents"]').addEventListener("click", () => {
    closeStartMenu();
    playSound(SOUNDS.MENU_COMMAND);
    openExplorer();
});

document.querySelector('.menu-item[data-action="pictures"]').addEventListener("click", () => {
    closeStartMenu();
    playSound(SOUNDS.MENU_COMMAND);
    openExplorer([...HOME_PATH, "My Documents", "My Pictures"]);
});

document.querySelector('.menu-item[data-action="music"]').addEventListener("click", () => {
    closeStartMenu();
    playSound(SOUNDS.MENU_COMMAND);
    openExplorer([...HOME_PATH, "My Documents", "My Music"]);
});

document.querySelector('.menu-item[data-action="computer"]').addEventListener("click", () => {
    closeStartMenu();
    playSound(SOUNDS.MENU_COMMAND);
    openMyComputer();
});

document.querySelectorAll('.start-footer-btn[data-power-action]').forEach((btn) => {
    btn.addEventListener("click", () => {
        playSound(SOUNDS.MENU_COMMAND);
        openPowerDialog(btn.dataset.powerAction);
    });
});

// System Clock
function updateClock() {
    const now = new Date();
    const hours = now.getHours() % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = now.getHours() >= 12 ? "PM" : "AM";
    clock.textContent = `${hours}:${minutes} ${ampm}`;
    clock.title = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

setInterval(updateClock, 1000);
updateClock();
