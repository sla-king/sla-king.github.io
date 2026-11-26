import { HOME_PATH, getNode, getPathString, resolvePath } from '../filesystem.js';
import {
    registerWindow,
    unregisterWindow,
    openWindow,
    closeWindow,
    centerWindow,
    setWindowTitle
} from '../windowManager.js';
import { openNotepad } from './notepad.js';

const HOME_URL = "https://sla-king.github.io/home.html";
const HOME_PAGE_SRC = "home.html";
const WEB_URL_PATTERN = /^(?:https?:\/\/)?sla-king\.github\.io(?:\/home\.html|\/)?$/i;

const explorerTemplate = document.getElementById("explorer-window-template");
const errorWindow = document.getElementById("xp-error-window");
const errorMessage = document.getElementById("xp-error-message");
const errorOkBtn = document.getElementById("xp-error-ok");

const explorerInstances = new Map();
let errorDialogInitialized = false;
let explorerCounter = 0;

function initErrorDialog() {
    if (errorDialogInitialized) return;
    errorDialogInitialized = true;

    registerWindow({
        id: "xp-error",
        winEl: errorWindow,
        resizable: false,
        maximizable: false,
        showInTaskbar: false,
        onBlockedFocus: () => errorOkBtn?.focus(),
        onClose: (ownerId) => {
            requestAnimationFrame(() => explorerInstances.get(ownerId)?.focusAddressInput());
        }
    });

    errorOkBtn?.addEventListener("click", () => closeWindow("xp-error"));
    errorWindow?.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            closeWindow("xp-error");
        }
    });
}

function showAddressError(target, ownerId) {
    if (!errorWindow || !errorMessage) return;
    errorMessage.textContent = `Windows cannot find '${target}'. Check the spelling and try again, or try searching for the item by clicking the Start button and then clicking Search.`;
    openWindow("xp-error", { ownerId });
    centerWindow("xp-error");
    requestAnimationFrame(() => errorOkBtn?.focus());
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

function findExplorer(predicate) {
    for (const instance of explorerInstances.values()) {
        if (predicate(instance)) {
            return instance;
        }
    }
    return null;
}

function createExplorerWindow({
    initialMode = "folder",
    initialPath = [...HOME_PATH, "My Documents"],
    maximized = false,
    isWebSize = false
}) {
    if (!explorerTemplate) return null;
    initErrorDialog();

    const winEl = explorerTemplate.content.firstElementChild.cloneNode(true);
    if (isWebSize) winEl.classList.add("explorer-web-size");
    if (maximized) winEl.classList.add("maximized");
    document.body.insertBefore(winEl, errorWindow || null);

    const id = `explorer-${++explorerCounter}`;
    const explItems = winEl.querySelector(".explorer-items");
    const explorerFrame = winEl.querySelector(".explorer-frame");
    const addressCombo = winEl.querySelector(".explorer-address-combo");
    const addressIcon = winEl.querySelector(".xp-address-icon");
    const addressInput = winEl.querySelector(".explorer-address-field");
    const addressMenu = winEl.querySelector(".explorer-address-menu");
    const goBtn = winEl.querySelector(".explorer-go-btn");

    let currentMode = initialMode;
    let explPath = [...initialPath];
    let cycleMatches = [];
    let cycleIndex = -1;
    let cyclePrefix = "";
    let hasInlineSuggestion = false;
    let justFocused = false;

    function getAutoCompleteMatches(rawInput) {
        if (!rawInput) return [];

        const lastSlashIdx = Math.max(rawInput.lastIndexOf("/"), rawInput.lastIndexOf("\\"));
        if (currentMode !== "folder" && lastSlashIdx === -1 && !/^(?:[a-zA-Z]:|~)/i.test(rawInput)) {
            return [];
        }

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

    function renderWeb() {
        currentMode = "web";
        explItems.hidden = true;
        explorerFrame.hidden = false;
        if (explorerFrame.getAttribute("src") !== HOME_PAGE_SRC) {
            explorerFrame.setAttribute("src", HOME_PAGE_SRC);
        }
        if (addressIcon) addressIcon.textContent = "🌐";
        addressInput.value = HOME_URL;
        closeAutoComplete();
        setWindowTitle(id, "Microsoft Internet Explorer", "🌐");
    }

    function renderFolder(path) {
        const node = getNode(path);
        if (!node || typeof node !== "object") {
            return false;
        }

        currentMode = "folder";
        explPath = path;
        explorerFrame.hidden = true;
        explItems.hidden = false;
        explItems.innerHTML = "";
        if (addressIcon) addressIcon.textContent = "📁";
        addressInput.value = getPathString(explPath);
        closeAutoComplete();

        const currentFolder = path[path.length - 1] || "Explorer";
        setWindowTitle(id, currentFolder, "📁");

        for (const [key, value] of Object.entries(node)) {
            const isDir = typeof value === "object";
            explItems.appendChild(
                createExplorerItem(key, isDir ? "📁" : "📄", () => {
                    if (isDir) {
                        renderFolder([...explPath, key]);
                    } else {
                        openNotepad(key, value, getPathString([...explPath, key]));
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
            showAddressError("", id);
            return;
        }

        if (WEB_URL_PATTERN.test(rawValue)) {
            renderWeb();
            return;
        }

        const candidatePath = resolvePath(rawValue, explPath);
        const targetNode = getNode(candidatePath);

        if (targetNode === null || targetNode === undefined) {
            showAddressError(rawValue, id);
            return;
        }

        if (typeof targetNode === "string") {
            const fileName = candidatePath[candidatePath.length - 1];
            openNotepad(fileName, targetNode, getPathString(candidatePath));
            addressInput.value = currentMode === "folder" ? getPathString(explPath) : HOME_URL;
            return;
        }

        renderFolder(candidatePath);
    }

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

    const handleDocPointerDown = (e) => {
        if (addressMenu && !addressMenu.hidden && !addressCombo?.contains(e.target)) {
            closeAutoComplete();
        }
    };
    document.addEventListener("pointerdown", handleDocPointerDown);

    registerWindow({
        id,
        winEl,
        onBlur: closeAutoComplete,
        onClose: () => {
            closeAutoComplete();
            document.removeEventListener("pointerdown", handleDocPointerDown);
            explorerInstances.delete(id);
            unregisterWindow(id);
        }
    });

    if (initialMode === "web") {
        renderWeb();
    } else {
        renderFolder([...initialPath]);
    }

    const nonMaximizedCount = Array.from(explorerInstances.values())
        .filter((inst) => !inst.isMaximized()).length;
    const cascadeOffset = maximized ? 0 : (nonMaximizedCount % 5) * 24;

    explorerInstances.set(id, {
        id,
        getMode: () => currentMode,
        getPath: () => explPath,
        getUrl: () => HOME_URL,
        isMaximized: () => winEl.classList.contains("maximized"),
        focusAddressInput: () => addressInput?.focus()
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
                addressInput.value = currentMode === "folder" ? getPathString(explPath) : HOME_URL;
                addressInput.select();
            }
        }
    });

    goBtn?.addEventListener("click", navigateFromAddressBar);
    openWindow(id, { cascadeOffset });
    return id;
}

export function initExplorer() {
    initErrorDialog();
    openWebExplorer({ maximized: true });
}

export function openExplorer(targetPath = [...HOME_PATH, "My Documents"]) {
    const targetStr = getPathString(targetPath).toLowerCase();
    const existing = findExplorer(
        (inst) => inst.getMode() === "folder" && getPathString(inst.getPath()).toLowerCase() === targetStr
    );
    if (existing) {
        openWindow(existing.id);
        return;
    }
    createExplorerWindow({
        initialMode: "folder",
        initialPath: targetPath
    });
}

export function openWebExplorer({ maximized = false } = {}) {
    const existing = findExplorer(
        (inst) => inst.getMode() === "web" && inst.getUrl() === HOME_URL
    );
    if (existing) {
        openWindow(existing.id);
        return;
    }
    createExplorerWindow({
        initialMode: "web",
        maximized,
        isWebSize: true
    });
}
