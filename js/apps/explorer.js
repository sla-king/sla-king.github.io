import { HOME_PATH, getNode, getPathString, resolvePath } from '../filesystem.js';
import {
    registerWindow,
    openWindow,
    closeWindow,
    centerWindow,
    isWindowBlocked,
    setWindowTitle
} from '../windowManager.js';
import { openNotepad } from './notepad.js';

const explItems = document.getElementById("explorer-items");
const addressCombo = document.querySelector(".explorer-address-combo");
const addressInput = document.getElementById("explorer-address-input");
const addressMenu = document.getElementById("explorer-address-menu");
const goBtn = document.getElementById("explorer-go-btn");

const errorWindow = document.getElementById("xp-error-window");
const errorMessage = document.getElementById("xp-error-message");
const errorOkBtn = document.getElementById("xp-error-ok");

let explPath = [...HOME_PATH, "My Documents"];
let cycleMatches = [];
let cycleIndex = -1;
let cyclePrefix = "";
let hasInlineSuggestion = false;
let justFocused = false;

function getAutoCompleteMatches(rawInput) {
    if (!rawInput) return [];

    const lastSlashIdx = Math.max(rawInput.lastIndexOf("/"), rawInput.lastIndexOf("\\"));
    if (lastSlashIdx === -1 && rawInput.toLowerCase() === "c:") {
        return ["C:\\"];
    }

    const dirPart = lastSlashIdx !== -1 ? rawInput.slice(0, lastSlashIdx + 1) : "";
    const prefix = lastSlashIdx !== -1 ? rawInput.slice(lastSlashIdx + 1) : rawInput;
    if (prefix === "." || prefix === "..") return [];

    const targetDirPath = dirPart ? resolvePath(dirPart.replace(/"/g, ""), explPath) : explPath;
    const dirNode = getNode(targetDirPath);
    if (!dirNode || typeof dirNode !== "object") return [];

    const lowerPrefix = prefix.replace(/"/g, "").toLowerCase();
    return Object.keys(dirNode)
        .filter((key) => key.toLowerCase().startsWith(lowerPrefix))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((key) => `${dirPart}${key}`);
}

function updateAutoCompleteHighlight() {
    if (!addressMenu) return;
    const options = addressMenu.querySelectorAll(".explorer-address-option");
    options.forEach((opt, idx) => {
        const isActive = idx === cycleIndex;
        opt.classList.toggle("active", isActive);
        if (isActive) {
            opt.scrollIntoView({ block: "nearest" });
        }
    });
}

function closeAutoComplete() {
    if (addressMenu) {
        addressMenu.hidden = true;
    }
    cycleMatches = [];
    cycleIndex = -1;
    cyclePrefix = "";
    hasInlineSuggestion = false;
}

function renderAutoCompleteMenu(matches) {
    if (!addressMenu) return;
    if (matches.length === 0) {
        closeAutoComplete();
        return;
    }

    addressMenu.innerHTML = "";
    for (const match of matches) {
        const option = document.createElement("div");
        option.className = "explorer-address-option";
        option.textContent = match;

        option.addEventListener("pointerdown", (e) => e.preventDefault());
        option.addEventListener("click", () => {
            addressInput.value = match;
            closeAutoComplete();
            navigateFromAddressBar();
        });
        addressMenu.appendChild(option);
    }

    addressMenu.hidden = false;
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
    closeAutoComplete();

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
    closeAutoComplete();
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
        onBlur: closeAutoComplete,
        onClose: closeAutoComplete
    });

    registerWindow({
        id: "xp-error",
        winEl: errorWindow,
        ownerId: "explorer",
        resizable: false,
        maximizable: false,
        showInTaskbar: false,
        onBlockedFocus: () => errorOkBtn?.focus(),
        onClose: () => requestAnimationFrame(() => addressInput?.focus())
    });

    addressInput?.addEventListener("focus", () => {
        justFocused = true;
    });

    addressInput?.addEventListener("mouseup", () => {
        if (justFocused && addressInput.selectionStart === addressInput.selectionEnd) {
            addressInput.select();
        }
        justFocused = false;
    });

    addressInput?.addEventListener("input", (e) => {
        justFocused = false;
        closeAutoComplete();

        const rawValue = addressInput.value;
        const matches = getAutoCompleteMatches(rawValue);
        renderAutoCompleteMenu(matches);
        if (matches.length === 0) return;

        cycleMatches = matches;
        cyclePrefix = rawValue;

        const isDelete = e.inputType?.startsWith("delete");
        const isAtEnd = addressInput.selectionStart === rawValue.length &&
            addressInput.selectionEnd === rawValue.length;
        const endsWithSeparator = rawValue.endsWith("\\") || rawValue.endsWith("/");
        const isDrivePrefix = rawValue.trim().toLowerCase() === "c:";

        if (!isDelete && !e.isComposing && isAtEnd && !endsWithSeparator && !isDrivePrefix) {
            const firstMatch = matches[0];
            if (firstMatch.length > rawValue.length) {
                addressInput.value = rawValue + firstMatch.slice(rawValue.length);
                addressInput.setSelectionRange(rawValue.length, addressInput.value.length);
                hasInlineSuggestion = true;
                cycleIndex = 0;
                updateAutoCompleteHighlight();
            }
        }
    });

    function applyCycleValue(val) {
        addressInput.value = val;
        addressInput.setSelectionRange(val.length, val.length);
        updateAutoCompleteHighlight();
    }

    function stepCycle(step) {
        if (hasInlineSuggestion && cycleMatches.length > 0) {
            hasInlineSuggestion = false;
            if (cycleMatches.length > 1) {
                cycleIndex = (cycleIndex + step + cycleMatches.length) % cycleMatches.length;
            }
            applyCycleValue(cycleMatches[cycleIndex]);
            return true;
        }

        if (cycleMatches.length > 0 && (cycleIndex === -1 || addressInput.value === cycleMatches[cycleIndex])) {
            cycleIndex = cycleIndex === -1
                ? (step > 0 ? 0 : cycleMatches.length - 1)
                : (cycleIndex + step + cycleMatches.length) % cycleMatches.length;
            applyCycleValue(cycleMatches[cycleIndex]);
            return true;
        }

        const matches = getAutoCompleteMatches(addressInput.value);
        if (matches.length === 0) return false;

        renderAutoCompleteMenu(matches);
        cyclePrefix = addressInput.value;
        cycleMatches = matches;
        cycleIndex = step > 0 ? 0 : matches.length - 1;
        applyCycleValue(cycleMatches[cycleIndex]);
        return true;
    }

    addressInput?.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            stepCycle(e.shiftKey ? -1 : 1);
            return;
        }

        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && addressMenu && !addressMenu.hidden && cycleMatches.length > 0) {
            e.preventDefault();
            if (e.key === "ArrowUp" && cycleIndex === 0 && !hasInlineSuggestion) {
                cycleIndex = -1;
                applyCycleValue(cyclePrefix);
            } else {
                stepCycle(e.key === "ArrowDown" ? 1 : -1);
            }
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            navigateFromAddressBar();
        } else if (e.key === "Escape") {
            if (addressMenu && !addressMenu.hidden) {
                e.preventDefault();
                if (cyclePrefix && addressInput.value !== cyclePrefix) {
                    addressInput.value = cyclePrefix;
                    addressInput.setSelectionRange(cyclePrefix.length, cyclePrefix.length);
                }
                closeAutoComplete();
            } else {
                closeAutoComplete();
                addressInput.value = getPathString(explPath);
                addressInput.select();
            }
        }
    });

    document.addEventListener("pointerdown", (e) => {
        if (addressMenu && !addressMenu.hidden && !addressCombo?.contains(e.target)) {
            closeAutoComplete();
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
    if (isWindowBlocked("explorer")) {
        openWindow("explorer");
        return;
    }
    renderExplorer([...HOME_PATH, "My Documents"]);
    openWindow("explorer");
}
