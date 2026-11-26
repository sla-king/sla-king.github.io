import {
    registerWindow,
    unregisterWindow,
    openWindow,
    setWindowTitle
} from '../windowManager.js';

const notepadTemplate = document.getElementById("notepad-window-template");
const startMenu = document.getElementById("start-menu");

const notepadInstances = new Map();
let notepadCounter = 0;

export function initNotepad() {
    // Notepad windows are created dynamically per opened file.
}

export function openNotepad(filename, content, filePath = filename) {
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
