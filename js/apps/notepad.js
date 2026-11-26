import {
    registerWindow,
    unregisterWindow,
    openWindow,
    setWindowTitle
} from '../windowManager.js';

const notepadTemplate = document.getElementById("notepad-window-template");
const startMenu = document.getElementById("start-menu");

const notepadInstances = new Map();
const recentDocuments = [];
let notepadCounter = 0;

function recordRecentDocument(filename, content, filePath) {
    const key = (filePath || filename).toLowerCase();
    const existingIdx = recentDocuments.findIndex((doc) => doc.key === key);
    if (existingIdx !== -1) {
        recentDocuments.splice(existingIdx, 1);
    }
    recentDocuments.unshift({
        key,
        filename,
        displayName: filename.replace(/\.[^/.]+$/, ""),
        content: content || "",
        filePath: filePath || filename
    });
    if (recentDocuments.length > 15) {
        recentDocuments.length = 15;
    }
}

export function getRecentDocuments() {
    return [...recentDocuments];
}

export function initNotepad() {
    // Notepad windows are created dynamically per opened file.
}

export function openNotepad(filename, content, filePath = filename) {
    recordRecentDocument(filename, content, filePath);
    const key = (filePath || filename).toLowerCase();
    const existing = notepadInstances.get(key);
    if (existing) {
        openWindow(existing.id);
        return;
    }

    if (!notepadTemplate) return;
    const winEl = notepadTemplate.content.firstElementChild.cloneNode(true);
    document.body.insertBefore(winEl, startMenu || null);

    const id = `notepad-${++notepadCounter}`;
    const noteTextarea = winEl.querySelector(".notepad-textarea");
    const displayName = filename.replace(/\.[^/.]+$/, "");

    if (noteTextarea) {
        noteTextarea.value = content || "";
    }

    registerWindow({
        id,
        winEl,
        onClose: () => {
            notepadInstances.delete(key);
            unregisterWindow(id);
        }
    });

    setWindowTitle(id, `${displayName} - Notepad`);

    const nonMaximizedCount = Array.from(notepadInstances.values())
        .filter((inst) => !inst.winEl.classList.contains("maximized")).length;
    const cascadeOffset = (nonMaximizedCount % 5) * 24;

    notepadInstances.set(key, { id, winEl });
    openWindow(id, { cascadeOffset });
}
