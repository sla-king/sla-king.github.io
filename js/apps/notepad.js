import {
    registerWindow,
    unregisterWindow,
    openWindow,
    setWindowTitle
} from '../windowManager.js';

const notepadTemplate = document.getElementById("notepad-window-template");
const startMenu = document.getElementById("start-menu");

const notepadInstances = new Map();
const blankNotepads = new Map();
const recentDocuments = [];
let notepadCounter = 0;

function createNotepadWindow({ title, content = "", onClose }) {
    if (!notepadTemplate) return;
    const winEl = notepadTemplate.content.firstElementChild.cloneNode(true);
    document.body.insertBefore(winEl, startMenu || null);

    const id = `notepad-${++notepadCounter}`;
    const noteTextarea = winEl.querySelector(".notepad-textarea");

    if (noteTextarea) {
        noteTextarea.value = content;
    }

    registerWindow({
        id,
        winEl,
        onClose: () => {
            onClose?.(id);
            unregisterWindow(id);
        }
    });

    setWindowTitle(id, title);

    const openWindows = [
        ...Array.from(notepadInstances.values(), (inst) => inst.winEl),
        ...Array.from(blankNotepads.values())
    ];
    const nonMaximizedCount = openWindows.filter((el) => !el.classList.contains("maximized")).length;
    const cascadeOffset = (nonMaximizedCount % 5) * 24;

    return { id, winEl, noteTextarea, cascadeOffset };
}

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

export function openBlankNotepad() {
    const created = createNotepadWindow({
        title: "Untitled - Notepad",
        onClose: (id) => blankNotepads.delete(id)
    });
    if (!created) return;

    blankNotepads.set(created.id, created.winEl);
    openWindow(created.id, { cascadeOffset: created.cascadeOffset });
    requestAnimationFrame(() => created.noteTextarea?.focus());
}

export function openNotepad(filename, content, filePath = filename) {
    recordRecentDocument(filename, content, filePath);
    const key = (filePath || filename).toLowerCase();
    const existing = notepadInstances.get(key);
    if (existing) {
        openWindow(existing.id);
        return;
    }

    const displayName = filename.replace(/\.[^/.]+$/, "");
    const created = createNotepadWindow({
        title: `${displayName} - Notepad`,
        content: content || "",
        onClose: () => notepadInstances.delete(key)
    });
    if (!created) return;

    notepadInstances.set(key, { id: created.id, winEl: created.winEl });
    openWindow(created.id, { cascadeOffset: created.cascadeOffset });
}
