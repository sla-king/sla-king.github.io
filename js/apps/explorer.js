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

export function isWebUrl(input) {
    return WEB_URL_PATTERN.test(input);
}

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

const SPECIAL_FOLDER_ICONS = {
    "my documents": { large: "assets/folder_documents.png", small: "assets/folder_documents_16.png" },
    "my music": { large: "assets/folder_music.png", small: "assets/folder_music_16.png" },
    "my pictures": { large: "assets/folder_pictures.png", small: "assets/folder_pictures_16.png" }
};

function getFolderIcon(path, small = false) {
    const defaultIcon = small ? "assets/folder_base_16.png" : "assets/folder_base.png";
    const folderName = path[path.length - 1]?.toLowerCase();
    const hasHomePrefix = HOME_PATH.every((part, i) => path[i]?.toLowerCase() === part.toLowerCase());
    if (!hasHomePrefix || !folderName) {
        return defaultIcon;
    }

    const isHomeChild = path.length === HOME_PATH.length + 1;
    const isMyDocsChild =
        path.length === HOME_PATH.length + 2 &&
        path[HOME_PATH.length]?.toLowerCase() === "my documents";

    const match = (isHomeChild || (isMyDocsChild && (folderName === "my music" || folderName === "my pictures")))
        ? SPECIAL_FOLDER_ICONS[folderName]
        : null;
    return match ? (small ? match.small : match.large) : defaultIcon;
}

function createExplorerItem(label, iconSrc, onDoubleClick) {
    const item = document.createElement("div");
    item.className = "explorer-item";

    const icon = document.createElement("img");
    icon.className = "explorer-icon";
    icon.src = iconSrc;
    icon.alt = "";
    icon.draggable = false;

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
    const toolbarEl = winEl.querySelector(".explorer-toolbar");
    const backBtn = winEl.querySelector(".explorer-back-btn");
    const backMenuBtn = winEl.querySelector(".explorer-back-menu-btn");
    const backMenu = winEl.querySelector(".explorer-back-menu");
    const forwardBtn = winEl.querySelector(".explorer-forward-btn");
    const forwardMenuBtn = winEl.querySelector(".explorer-forward-menu-btn");
    const forwardMenu = winEl.querySelector(".explorer-forward-menu");
    const stopBtn = winEl.querySelector(".explorer-stop-btn");
    const refreshBtn = winEl.querySelector(".explorer-refresh-btn");
    const homeBtn = winEl.querySelector(".explorer-home-btn");
    const upBtn = winEl.querySelector(".explorer-up-btn");
    const explItems = winEl.querySelector(".explorer-items");
    const explorerFrame = winEl.querySelector(".explorer-frame");
    const addressCombo = winEl.querySelector(".explorer-address-combo");
    const addressIcon = winEl.querySelector(".xp-address-icon");
    const addressInput = winEl.querySelector(".explorer-address-field");
    const addressMenu = winEl.querySelector(".explorer-address-menu");
    const goBtn = winEl.querySelector(".explorer-go-btn");

    let currentMode = initialMode;
    let explPath = [...initialPath];
    let history = [];
    let historyIndex = -1;
    let cycleMatches = [];
    let cycleIndex = -1;
    let cyclePrefix = "";
    let hasInlineSuggestion = false;
    let justFocused = false;

    function isSameEntry(a, b) {
        if (!a || !b || a.mode !== b.mode) return false;
        if (a.mode === "web") return a.url === b.url;
        return getPathString(a.path).toLowerCase() === getPathString(b.path).toLowerCase();
    }

    function getEntryLabel(entry) {
        if (!entry) return "";
        if (entry.mode === "web") return "Microsoft Internet Explorer";
        return entry.path[entry.path.length - 1] || "Explorer";
    }

    function closeHistoryMenus() {
        if (backMenu) backMenu.hidden = true;
        if (forwardMenu) forwardMenu.hidden = true;
        backMenuBtn?.setAttribute("aria-expanded", "false");
        forwardMenuBtn?.setAttribute("aria-expanded", "false");
    }

    function openHistoryMenu(direction) {
        const isBack = direction === "back";
        const menuEl = isBack ? backMenu : forwardMenu;
        const toggleBtn = isBack ? backMenuBtn : forwardMenuBtn;
        if (!menuEl || !toggleBtn) return;

        const indices = [];
        if (isBack) {
            for (let i = historyIndex - 1; i >= 0; i--) indices.push(i);
        } else {
            for (let i = historyIndex + 1; i < history.length; i++) indices.push(i);
        }
        if (indices.length === 0) return;

        closeAutoComplete();
        closeHistoryMenus();
        menuEl.innerHTML = "";

        for (const idx of indices) {
            const entry = history[idx];
            const item = document.createElement("div");
            item.className = "explorer-history-item";
            item.textContent = getEntryLabel(entry);
            item.title = entry.mode === "web" ? entry.url : getPathString(entry.path);
            item.addEventListener("pointerdown", (e) => e.preventDefault());
            item.addEventListener("click", () => {
                closeHistoryMenus();
                historyIndex = idx;
                applyHistoryEntry(history[idx]);
            });
            menuEl.appendChild(item);
        }

        menuEl.hidden = false;
        toggleBtn.setAttribute("aria-expanded", "true");
    }

    function updateNavButtons() {
        const isWeb = currentMode === "web";
        const canGoBack = historyIndex > 0;
        const canGoForward = historyIndex < history.length - 1;

        if (backBtn) {
            backBtn.disabled = !canGoBack;
            backBtn.title = canGoBack ? `Back to ${getEntryLabel(history[historyIndex - 1])}` : "Back";
        }
        if (backMenuBtn) {
            backMenuBtn.disabled = !canGoBack;
        }
        if (forwardBtn) {
            forwardBtn.disabled = !canGoForward;
            forwardBtn.title = canGoForward ? `Forward to ${getEntryLabel(history[historyIndex + 1])}` : "Forward";
        }
        if (forwardMenuBtn) {
            forwardMenuBtn.disabled = !canGoForward;
        }
        if (stopBtn) stopBtn.hidden = !isWeb;
        if (refreshBtn) refreshBtn.hidden = !isWeb;
        if (homeBtn) homeBtn.hidden = !isWeb;
        if (upBtn) {
            upBtn.hidden = isWeb;
            upBtn.disabled = isWeb || explPath.length <= 1;
        }
    }

    function pushHistory(entry) {
        if (isSameEntry(history[historyIndex], entry)) {
            updateNavButtons();
            return;
        }
        history = history.slice(0, historyIndex + 1);
        history.push(entry);
        historyIndex = history.length - 1;
        updateNavButtons();
    }

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

    function renderWeb({ recordHistory = true } = {}) {
        currentMode = "web";
        explItems.hidden = true;
        explorerFrame.hidden = false;
        if (explorerFrame.getAttribute("src") !== HOME_PAGE_SRC) {
            explorerFrame.setAttribute("src", HOME_PAGE_SRC);
        }
        if (addressIcon) addressIcon.setAttribute("src", "assets/app_explorer_16.png");
        addressInput.value = HOME_URL;
        closeAutoComplete();
        closeHistoryMenus();
        setWindowTitle(id, `${HOME_URL} - Microsoft Internet Explorer`, "assets/app_explorer_16.png");
        if (recordHistory) {
            pushHistory({ mode: "web", url: HOME_URL });
        } else {
            updateNavButtons();
        }
    }

    function renderFolder(path, { recordHistory = true } = {}) {
        const node = getNode(path);
        if (!node || typeof node !== "object") {
            return false;
        }

        currentMode = "folder";
        explPath = path;
        explorerFrame.hidden = true;
        explItems.hidden = false;
        explItems.innerHTML = "";
        const smallFolderIcon = getFolderIcon(path, true);
        if (addressIcon) addressIcon.setAttribute("src", smallFolderIcon);
        addressInput.value = getPathString(explPath);
        closeAutoComplete();
        closeHistoryMenus();

        const currentFolder = path[path.length - 1] || "Explorer";
        setWindowTitle(id, currentFolder, smallFolderIcon);

        for (const [key, value] of Object.entries(node)) {
            const isDir = typeof value === "object";
            const itemIcon = isDir ? getFolderIcon([...explPath, key]) : "assets/file_text_doc.png";
            explItems.appendChild(
                createExplorerItem(key, itemIcon, () => {
                    if (isDir) {
                        renderFolder([...explPath, key]);
                    } else {
                        openNotepad(key, value, getPathString([...explPath, key]));
                    }
                })
            );
        }
        if (recordHistory) {
            pushHistory({ mode: "folder", path: [...path] });
        } else {
            updateNavButtons();
        }
        return true;
    }

    function applyHistoryEntry(entry) {
        if (!entry) return;
        if (entry.mode === "web") {
            renderWeb({ recordHistory: false });
        } else {
            renderFolder([...entry.path], { recordHistory: false });
        }
    }

    function navigateFromAddressBar() {
        closeAutoComplete();
        const rawValue = addressInput.value.trim();
        if (!rawValue) {
            showAddressError("", id);
            return;
        }

        if (isWebUrl(rawValue)) {
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
        if (((backMenu && !backMenu.hidden) || (forwardMenu && !forwardMenu.hidden)) &&
            !toolbarEl?.contains(e.target)) {
            closeHistoryMenus();
        }
    };
    document.addEventListener("pointerdown", handleDocPointerDown);

    registerWindow({
        id,
        winEl,
        onBlur: () => {
            closeAutoComplete();
            closeHistoryMenus();
        },
        onClose: () => {
            closeAutoComplete();
            closeHistoryMenus();
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

    backBtn?.addEventListener("click", () => {
        if (historyIndex > 0) {
            applyHistoryEntry(history[--historyIndex]);
        }
    });

    backMenuBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (backMenu && !backMenu.hidden) {
            closeHistoryMenus();
        } else {
            openHistoryMenu("back");
        }
    });

    forwardBtn?.addEventListener("click", () => {
        if (historyIndex < history.length - 1) {
            applyHistoryEntry(history[++historyIndex]);
        }
    });

    forwardMenuBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (forwardMenu && !forwardMenu.hidden) {
            closeHistoryMenus();
        } else {
            openHistoryMenu("forward");
        }
    });

    stopBtn?.addEventListener("click", () => {
        if (currentMode !== "web") return;
        try {
            explorerFrame.contentWindow?.stop?.();
        } catch {
            // Ignore cross-origin stop restrictions
        }
    });

    refreshBtn?.addEventListener("click", () => {
        if (currentMode !== "web") return;
        try {
            if (explorerFrame.contentWindow?.location) {
                explorerFrame.contentWindow.location.reload();
                return;
            }
        } catch {
            // Fall back to resetting src
        }
        explorerFrame.setAttribute("src", HOME_PAGE_SRC);
    });

    homeBtn?.addEventListener("click", () => {
        renderWeb();
    });

    upBtn?.addEventListener("click", () => {
        if (currentMode === "folder" && explPath.length > 1) {
            renderFolder(explPath.slice(0, -1));
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
