import { initTerminal } from './apps/terminal.js';
import { initExplorer, openExplorer } from './apps/explorer.js';
import { initNotepad } from './apps/notepad.js';
import { initIE, openIE } from './apps/ie.js';
import {
    openWindow,
    blurAllWindows,
    isClickInsideAnyWindow,
    nextZIndex
} from './windowManager.js';

const clock = document.getElementById("clock");
const startButton = document.getElementById("start-button");
const startMenu = document.getElementById("start-menu");
const taskbar = document.querySelector(".taskbar");
const selectionBox = document.getElementById("selection-box");

let selectState = null;

// Initialize Apps
initTerminal();
initExplorer();
initNotepad();
initIE();

// Start Menu & Desktop Events
startButton.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    blurAllWindows();
    startMenu.classList.toggle("show");
    if (startMenu.classList.contains("show")) {
        startMenu.style.zIndex = nextZIndex();
    }
});

startMenu.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    startMenu.style.zIndex = nextZIndex();
});

document.addEventListener("pointerdown", (e) => {
    const clickedWindow = isClickInsideAnyWindow(e.target);
    const clickedMenu = startMenu.contains(e.target) || startButton.contains(e.target);
    const clickedTaskbar = taskbar.contains(e.target);

    if (!clickedWindow) blurAllWindows();
    if (!clickedMenu) startMenu.classList.remove("show");

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

document.querySelector('.menu-item[data-action="ie"]').addEventListener("click", () => {
    startMenu.classList.remove("show");
    openIE();
});

document.querySelector('.menu-item[data-action="cmd"]').addEventListener("click", () => {
    startMenu.classList.remove("show");
    openWindow("terminal");
    document.getElementById("cmd-input").focus({ preventScroll: true });
});

document.querySelector('.menu-item[data-action="documents"]').addEventListener("click", () => {
    startMenu.classList.remove("show");
    openExplorer();
});

// System Clock
function updateClock() {
    const now = new Date();
    const hours = now.getHours() % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = now.getHours() >= 12 ? "PM" : "AM";
    clock.textContent = `${hours}:${minutes} ${ampm}`;
}

setInterval(updateClock, 1000);
updateClock();