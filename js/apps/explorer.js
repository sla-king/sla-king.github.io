import { HOME_PATH, getNode } from '../filesystem.js';
import { registerWindow, openWindow, setWindowTitle } from '../windowManager.js';
import { openNotepad } from './notepad.js';

const explBody = document.getElementById("explorer-body");
let explPath = [...HOME_PATH, "My Documents"];

function createExplorerItem(label, iconChar, onDoubleClick) {
    const item = document.createElement("div");
    item.className = "explorer-item";

    const icon = document.createElement("div");
    icon.className = "explorer-icon";
    icon.textContent = iconChar;

    const text = document.createElement("div");
    text.textContent = label;

    item.append(icon, text);
    item.addEventListener("dblclick", onDoubleClick);
    return item;
}

function renderExplorer(path) {
    const node = getNode(path);
    explBody.innerHTML = "";
    if (!node || typeof node !== "object") return;

    const currentFolder = path[path.length - 1] || "Explorer";
    setWindowTitle("explorer", currentFolder);

    if (path.length > 3) {
        explBody.appendChild(
            createExplorerItem("..", "📁", () => {
                explPath.pop();
                renderExplorer(explPath);
            })
        );
    }

    for (const [key, value] of Object.entries(node)) {
        const isDir = typeof value === "object";
        explBody.appendChild(
            createExplorerItem(key, isDir ? "📁" : "📄", () => {
                if (isDir) {
                    explPath.push(key);
                    renderExplorer(explPath);
                } else {
                    openNotepad(key, value);
                }
            })
        );
    }
}

export function initExplorer() {
    registerWindow({
        id: "explorer",
        winEl: document.getElementById("explorer-window")
    });
}

export function openExplorer() {
    explPath = [...HOME_PATH, "My Documents"];
    renderExplorer(explPath);
    openWindow("explorer");
}