import { HOME_PATH } from './filesystem.js';
import { initTerminal } from './apps/terminal.js';
import { initExplorer, openExplorer, openWebExplorer, openMyComputer } from './apps/explorer.js';
import { initNotepad, openNotepad, openBlankNotepad, getRecentDocuments } from './apps/notepad.js';
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
const linkWindow = document.getElementById("xp-link-window");
const linkIcon = document.getElementById("xp-link-icon");
const linkMessage = document.getElementById("xp-link-message");
const linkCancelBtn = document.getElementById("xp-link-cancel");
const linkVisitBtn = document.getElementById("xp-link-visit");

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
let recentHoverTimer = null;
const RECENT_MENU_DELAY_MS = 350;

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
        const item = document.createElement("div");
        item.className = "start-submenu-item";
        item.title = doc.filePath;

        const icon = document.createElement("img");
        icon.src = "assets/file_text_doc_16.png";
        icon.className = "start-submenu-icon";
        icon.alt = "";

        const label = document.createElement("span");
        label.textContent = doc.displayName;

        item.append(icon, label);
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            closeStartMenu();
            openNotepad(doc.filename, doc.content, doc.filePath);
        });
        recentDocumentsMenu.appendChild(item);
    }
}

function closeStartMenu() {
    clearTimeout(recentHoverTimer);
    recentHoverTimer = null;
    startMenu.classList.remove("show");
    recentMenuItem?.classList.remove("submenu-open");
}

// Initialize Apps
initTerminal();
initExplorer();
initNotepad();

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
    if (item && item !== recentMenuItem) {
        clearTimeout(recentHoverTimer);
        recentMenuItem?.classList.remove("submenu-open");
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

document.querySelector('.menu-item[data-action="explorer-web"]').addEventListener("click", () => {
    closeStartMenu();
    openWebExplorer();
});

document.querySelector('.menu-item[data-action="email"]').addEventListener("click", () => {
    closeStartMenu();
    openLinkDialog("email");
});

document.querySelector('.menu-item[data-action="cmd"]').addEventListener("click", () => {
    closeStartMenu();
    openWindow("terminal");
    document.getElementById("cmd-input").focus({ preventScroll: true });
});

document.querySelector('.menu-item[data-action="notepad"]').addEventListener("click", () => {
    closeStartMenu();
    openBlankNotepad();
});

document.querySelector('.menu-item[data-action="documents"]').addEventListener("click", () => {
    closeStartMenu();
    openExplorer();
});

recentMenuItem?.addEventListener("pointerenter", (e) => {
    clearTimeout(recentHoverTimer);
    if (e.pointerType !== "touch" && !recentMenuItem.classList.contains("submenu-open")) {
        recentHoverTimer = setTimeout(() => {
            recentMenuItem.classList.add("submenu-open");
        }, RECENT_MENU_DELAY_MS);
    }
});

recentMenuItem?.addEventListener("pointerleave", () => {
    clearTimeout(recentHoverTimer);
    recentHoverTimer = setTimeout(() => {
        recentMenuItem.classList.remove("submenu-open");
    }, 250);
});

recentMenuItem?.addEventListener("click", (e) => {
    if (recentDocumentsMenu?.contains(e.target)) return;
    clearTimeout(recentHoverTimer);
    recentMenuItem.classList.toggle("submenu-open");
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

document.querySelector('.menu-item[data-action="linkedin"]').addEventListener("click", () => {
    closeStartMenu();
    openLinkDialog("linkedin");
});

document.querySelector('.menu-item[data-action="github"]').addEventListener("click", () => {
    closeStartMenu();
    openLinkDialog("github");
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
