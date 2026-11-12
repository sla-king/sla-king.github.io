import { registerWindow, openWindow } from '../windowManager.js';

const noteTitleText = document.getElementById("notepad-title-text");
const noteTextarea = document.getElementById("notepad-textarea");

export function initNotepad() {
    registerWindow({
        id: "notepad",
        winEl: document.getElementById("notepad-window")
    });
}

export function openNotepad(filename, content) {
    const displayName = filename.replace(/\.[^/.]+$/, "");
    noteTitleText.textContent = `${displayName} - Notepad`;
    noteTextarea.value = content || "";
    openWindow("notepad");
}