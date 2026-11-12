import { registerWindow, openWindow, setWindowTitle } from '../windowManager.js';

const noteTextarea = document.getElementById("notepad-textarea");

export function initNotepad() {
    registerWindow({
        id: "notepad",
        winEl: document.getElementById("notepad-window")
    });
}

export function openNotepad(filename, content) {
    const displayName = filename.replace(/\.[^/.]+$/, "");
    setWindowTitle("notepad", `${displayName} - Notepad`);
    noteTextarea.value = content || "";
    openWindow("notepad");
}