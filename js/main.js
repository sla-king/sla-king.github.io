import { initTerminal } from './apps/terminal.js';
import { initExplorer, openExplorer } from './apps/explorer.js';
import { initNotepad } from './apps/notepad.js';
import {
    openWindow,
    blurAllWindows,
    isClickInsideAnyWindow,
    nextZIndex
} from './windowManager.js';

const clock = document.getElementById("clock");
const startButton = document.getElementById("start-button");
const startMenu = document.getElementById("start-menu");

// Initialize Apps
initTerminal();
initExplorer();
initNotepad();

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
    if (!isClickInsideAnyWindow(e.target)) blurAllWindows();
    if (!startMenu.contains(e.target) && !startButton.contains(e.target)) {
        startMenu.classList.remove("show");
    }
});

document.querySelector('.menu-item[data-action="cmd"]').addEventListener("click", () => {
    startMenu.classList.remove("show");
    openWindow("terminal");
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