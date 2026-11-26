import { fs, HOME_PATH, getNode, getPathString, resolvePath } from '../filesystem.js';
import {
    registerWindow,
    openWindow,
    closeWindow,
    centerWindow,
    setWindowTitle
} from '../windowManager.js';
import { openNotepad } from './notepad.js';

const explItems = document.getElementById("explorer-items");
const addressCombo = document.querySelector(".explorer-address-combo");
const addressInput = document.getElementById("explorer-address-input");
const dropdownBtn = document.getElementById("explorer-address-dropdown-btn");
const addressMenu = document.getElementById("explorer-address-menu");
const goBtn = document.getElementById("explorer-go-btn");
const folderIconTemplate = addressCombo?.querySelector(".xp-folder-icon");

const errorWindow = document.getElementById("xp-error-window");
const errorMessage = document.getElementById("xp-error-message");
const errorOkBtn = document.getElementById("xp-error-ok");

let explPath = [...HOME_PATH, "My Documents"];

function collectDirectoryPaths(node = fs, prefix = []) {
    const paths = [];
    for (const [key, value] of Object.entries(node)) {
        if (value && typeof value === "object") {
            const nextPath = [...prefix, key];
            paths.push(nextPath);
            paths.push(...collectDirectoryPaths(value, nextPath));
        }
    }
    return paths;
}

function closeAddressMenu() {
    if (!addressMenu || !dropdownBtn) return;
    addressMenu.hidden = true;
    dropdownBtn.setAttribute("aria-expanded", "false");
}

function openAddressMenu() {
    if (!addressMenu || !dropdownBtn) return;
    const currentPathStr = getPathString(explPath).toLowerCase();
    addressMenu.innerHTML = "";

    for (const path of collectDirectoryPaths()) {
        const pathStr = getPathString(path);
        const option = document.createElement("div");
        option.className = "explorer-address-option";
        if (pathStr.toLowerCase() === currentPathStr) {
            option.classList.add("active");
        }

        const label = document.createElement("span");
        label.textContent = pathStr;

        if (folderIconTemplate) {
            option.append(folderIconTemplate.cloneNode(true));
        }
        option.append(label);
        option.addEventListener("click", () => {
            closeAddressMenu();
            renderExplorer(path);
        });
        addressMenu.appendChild(option);
    }

    addressMenu.hidden = false;
    dropdownBtn.setAttribute("aria-expanded", "true");
}

function showAddressError(target) {
    if (!errorWindow || !errorMessage) return;
    errorMessage.textContent = `Windows cannot find '${target}'. Check the spelling and try again, or try searching for the item by clicking the Start button and then clicking Search.`;
    openWindow("xp-error");
    centerWindow("xp-error");
    requestAnimationFrame(() => errorOkBtn?.focus());
}

function closeAddressError() {
    closeWindow("xp-error");
}

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
    if (!node || typeof node !== "object") {
        return false;
    }

    explPath = path;
    explItems.innerHTML = "";
    addressInput.value = getPathString(explPath);

    const currentFolder = path[path.length - 1] || "Explorer";
    setWindowTitle("explorer", currentFolder);

    for (const [key, value] of Object.entries(node)) {
        const isDir = typeof value === "object";
        explItems.appendChild(
            createExplorerItem(key, isDir ? "📁" : "📄", () => {
                if (isDir) {
                    renderExplorer([...explPath, key]);
                } else {
                    openNotepad(key, value);
                }
            })
        );
    }
    return true;
}

function navigateFromAddressBar() {
    closeAddressMenu();
    const rawValue = addressInput.value.trim();
    if (!rawValue) {
        showAddressError("");
        return;
    }

    const candidatePath = resolvePath(rawValue, explPath);
    const targetNode = getNode(candidatePath);

    if (targetNode === null || targetNode === undefined) {
        showAddressError(rawValue);
        return;
    }

    if (typeof targetNode === "string") {
        const fileName = candidatePath[candidatePath.length - 1];
        openNotepad(fileName, targetNode);
        addressInput.value = getPathString(explPath);
        return;
    }

    renderExplorer(candidatePath);
}

export function initExplorer() {
    registerWindow({
        id: "explorer",
        winEl: document.getElementById("explorer-window"),
        onBlur: closeAddressMenu,
        onClose: closeAddressMenu
    });

    registerWindow({
        id: "xp-error",
        winEl: errorWindow,
        resizable: false,
        maximizable: false,
        showInTaskbar: false
    });

    addressInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            navigateFromAddressBar();
        } else if (e.key === "Escape") {
            if (addressMenu && !addressMenu.hidden) {
                closeAddressMenu();
            } else {
                addressInput.value = getPathString(explPath);
            }
        }
    });

    dropdownBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (addressMenu?.hidden) {
            openAddressMenu();
        } else {
            closeAddressMenu();
        }
    });

    document.addEventListener("pointerdown", (e) => {
        if (addressMenu && !addressMenu.hidden && !addressCombo?.contains(e.target)) {
            closeAddressMenu();
        }
    });

    goBtn?.addEventListener("click", navigateFromAddressBar);
    errorOkBtn?.addEventListener("click", closeAddressError);
    errorWindow?.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            closeAddressError();
        }
    });
}

export function openExplorer() {
    closeAddressMenu();
    renderExplorer([...HOME_PATH, "My Documents"]);
    openWindow("explorer");
}
