import { blurAllWindows, isClickInsideAnyWindow, setWindowInteractionHandler } from './os/windowManager.js';
import { initDialogs } from './os/DialogManager.js';
import { PowerSessionManager } from './os/PowerSessionManager.js';
import { StartMenu } from './os/StartMenu.js';
import { TrayVolume } from './os/TrayVolume.js';
import { initTerminal } from './apps/TerminalApp.js';
import { initExplorer } from './apps/ExplorerWindow.js';
import { initNotepad } from './apps/NotepadWindow.js';
import { initMediaPlayer } from './apps/MediaPlayerApp.js';
import { initPictureViewer } from './apps/PictureViewerApp.js';

initDialogs();

initTerminal();
initExplorer();
initNotepad();
initMediaPlayer();
initPictureViewer();

let startMenu = null;
let trayVolume = null;
let powerSession = null;

const dismissShellOverlays = () => {
    startMenu?.close();
    trayVolume?.close();
};

trayVolume = new TrayVolume({
    onBeforeOpen: () => startMenu?.close()
});

powerSession = new PowerSessionManager({
    onDismissOverlays: dismissShellOverlays
});

startMenu = new StartMenu({
    onBeforeOpen: () => trayVolume.close(),
    onPowerAction: (mode) => powerSession.openDialog(mode)
});

setWindowInteractionHandler(dismissShellOverlays);

trayVolume.init();
startMenu.init();
powerSession.init();

// Drag-select box on the desktop, Escape key shortcuts, and taskbar clock
const taskbar = document.querySelector(".taskbar");
const selectionBox = document.getElementById("selection-box");
const clock = document.getElementById("clock");

let selectState = null;

document.addEventListener("pointerdown", (e) => {
    const clickedWindow = isClickInsideAnyWindow(e.target);
    const clickedMenu = startMenu.containsTarget(e.target);
    const clickedVolume = trayVolume.containsTarget(e.target);
    const clickedTaskbar = Boolean(taskbar?.contains(e.target));

    if (!clickedWindow) blurAllWindows();
    if (!clickedMenu) startMenu.close();
    if (!clickedVolume) trayVolume.close();

    if (e.button === 0 && !clickedWindow && !clickedMenu && !clickedTaskbar && selectionBox) {
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
    if (!selectState || !selectionBox) return;

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
    if (!selectState || !selectionBox) return;
    selectionBox.style.display = "none";
    selectState = null;
}

document.addEventListener("pointerup", endSelection);
document.addEventListener("pointercancel", endSelection);

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (powerSession.isDialogOpen()) {
        e.preventDefault();
        powerSession.closeDialog();
    } else if (trayVolume.isOpen()) {
        e.preventDefault();
        trayVolume.close();
    }
});

function updateClock() {
    if (!clock) return;
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
