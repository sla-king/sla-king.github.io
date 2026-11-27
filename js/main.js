import { HOME_PATH } from './filesystem.js';
import { initTerminal } from './apps/terminal.js';
import { initExplorer, openExplorer, openWebExplorer, openMyComputer } from './apps/explorer.js';
import { initNotepad, openNotepad, openBlankNotepad, getRecentDocuments } from './apps/notepad.js';
import { initMediaPlayer, openMediaPlayer } from './apps/mediaPlayer.js';
import {
    registerWindow,
    openWindow,
    closeWindow,
    centerWindow,
    blurAllWindows,
    isClickInsideAnyWindow,
    nextZIndex
} from './windowManager.js';

const clock = document.getElementById("clock");
const systemTray = clock.closest(".system-tray") || clock;
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

const POWER_DIALOGS = {
    logoff: {
        title: "Log Off Windows",
        options: [
            { label: "Switch User", icon: "assets/start_switch_user.png" },
            { label: "Log Off", icon: "assets/start_logoff.png" }
        ]
    },
    turnoff: {
        title: "Turn off computer",
        options: [
            { label: "Turn Off", icon: "assets/start_turnoff.png" },
            { label: "Restart", icon: "assets/start_restart.png" }
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

function launchAppAction(action) {
    const launcher = APP_LAUNCHERS[action];
    if (!launcher) return;
    closeStartMenu();
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
            createSubmenuEntry(prog.name, prog.icon, tooltip, () => APP_LAUNCHERS[prog.action]?.())
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

function closePowerDialog() {
    if (!powerBackdrop) return;
    powerBackdrop.classList.remove("desaturated", "show");
    powerBackdrop.hidden = true;
}

function openPowerDialog(mode) {
    const config = POWER_DIALOGS[mode];
    if (!config || !powerBackdrop || !powerTitle || !powerOptions) return;

    closeStartMenu();
    blurAllWindows();
    powerTitle.textContent = config.title;
    powerOptions.innerHTML = "";

    for (const option of config.options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "xp-power-option";
        btn.disabled = true;

        const icon = document.createElement("img");
        icon.className = "xp-power-option-icon";
        icon.src = option.icon;
        icon.alt = "";

        const label = document.createElement("span");
        label.className = "xp-power-option-label";
        label.textContent = option.label;

        btn.append(icon, label);
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

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && powerBackdrop?.classList.contains("show")) {
        e.preventDefault();
        closePowerDialog();
    }
});

// Initialize Apps
initTerminal();
initExplorer();
initNotepad();
initMediaPlayer();

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
}, true);

// Start Menu & Desktop Events
startButton.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    blurAllWindows();
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
    const clickedTaskbar = taskbar.contains(e.target);

    if (!clickedWindow) blurAllWindows();
    if (!clickedMenu) closeStartMenu();

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
    openExplorer();
});

document.querySelector('.menu-item[data-action="pictures"]').addEventListener("click", () => {
    closeStartMenu();
    openExplorer([...HOME_PATH, "My Documents", "My Pictures"]);
});

document.querySelector('.menu-item[data-action="music"]').addEventListener("click", () => {
    closeStartMenu();
    openExplorer([...HOME_PATH, "My Documents", "My Music"]);
});

document.querySelector('.menu-item[data-action="computer"]').addEventListener("click", () => {
    closeStartMenu();
    openMyComputer();
});

document.querySelectorAll('.start-footer-btn[data-power-action]').forEach((btn) => {
    btn.addEventListener("click", () => {
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
    systemTray.title = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

setInterval(updateClock, 1000);
updateClock();
