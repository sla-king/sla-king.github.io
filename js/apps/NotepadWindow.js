import { XPWindow } from '../os/XPWindow.js';
import { HOME_PATH, getNode, getPathString, isFileNode } from '../filesystem.js';

const DEFAULT_RECENT_DOCUMENTS = ["experience.txt", "about_me.txt"];

const notepadInstances = new Map();
const blankNotepads = new Map();
const recentDocuments = [];

// Notepad window for viewing and editing text files
export class NotepadWindow extends XPWindow {
    constructor({ title, content = "", onDispose }) {
        super({
            prefix: "notepad",
            templateId: "notepad-window-template"
        });
        this.onDispose = onDispose;
        this.textarea = this.winEl.querySelector(".notepad-textarea");
        if (this.textarea) {
            this.textarea.value = content;
        }
        this.setTitle(title);
    }

    onClose() {
        this.onDispose?.(this.id);
    }

    focusEditor() {
        requestAnimationFrame(() => this.textarea?.focus());
    }
}

function getAllOpenNotepads() {
    return [
        ...notepadInstances.values(),
        ...blankNotepads.values()
    ];
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
    for (const filename of DEFAULT_RECENT_DOCUMENTS) {
        const pathParts = [...HOME_PATH, "My Documents", filename];
        const node = getNode(pathParts);
        if (isFileNode(node)) {
            recordRecentDocument(filename, node.content, getPathString(pathParts));
        }
    }
}

export function openBlankNotepad() {
    const cascadeOffset = XPWindow.getCascadeOffset(getAllOpenNotepads());
    const win = new NotepadWindow({
        title: "Untitled - Notepad",
        onDispose: (id) => blankNotepads.delete(id)
    });
    blankNotepads.set(win.id, win);
    win.open({ cascadeOffset });
    win.focusEditor();
}

export function openNotepad(filename, content, filePath = filename) {
    recordRecentDocument(filename, content, filePath);
    const key = (filePath || filename).toLowerCase();
    const existing = notepadInstances.get(key);
    if (existing) {
        existing.open();
        return;
    }

    const cascadeOffset = XPWindow.getCascadeOffset(getAllOpenNotepads());
    const displayName = filename.replace(/\.[^/.]+$/, "");
    const win = new NotepadWindow({
        title: `${displayName} - Notepad`,
        content: content || "",
        onDispose: () => notepadInstances.delete(key)
    });
    notepadInstances.set(key, win);
    win.open({ cascadeOffset });
}
