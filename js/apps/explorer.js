import { HOME_PATH, DEFAULT_FILE_DATE, getNode, getPathString, resolvePath, isAudioFile, isFileNode, isFolderNode } from '../filesystem.js';
import {
    registerWindow,
    unregisterWindow,
    openWindow,
    closeWindow,
    centerWindow,
    setWindowTitle
} from '../windowManager.js';
import { openNotepad } from './notepad.js';
import { openMediaPlayer } from './mediaPlayer.js';

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

const MY_DOCUMENTS_TOOLTIP = "Contains letters, reports, and other documents and files.";
const MAX_TOOLTIP_LINE_LENGTH = 64;

const SPECIAL_FOLDERS = {
    "my documents": {
        large: "assets/folder_documents.png",
        small: "assets/folder_documents_16.png"
    },
    "my music": {
        large: "assets/folder_music.png",
        small: "assets/folder_music_16.png",
        tooltip: "Contains music and other audio files"
    },
    "my pictures": {
        large: "assets/folder_pictures.png",
        small: "assets/folder_pictures_16.png",
        tooltip: "Contains digital photos, images, and graphic files."
    },
    "favorites": {
        large: "assets/folder_favorites.png",
        small: "assets/folder_favorites_16.png"
    }
};

function getSpecialFolder(path) {
    const folderName = path[path.length - 1]?.toLowerCase();
    const hasHomePrefix = HOME_PATH.every((part, i) => path[i]?.toLowerCase() === part.toLowerCase());
    if (!hasHomePrefix || !folderName) {
        return null;
    }

    const isHomeChild = path.length === HOME_PATH.length + 1;
    const isMyDocsChild =
        path.length === HOME_PATH.length + 2 &&
        path[HOME_PATH.length]?.toLowerCase() === "my documents";

    if (isHomeChild || (isMyDocsChild && (folderName === "my music" || folderName === "my pictures"))) {
        return SPECIAL_FOLDERS[folderName] || null;
    }
    return null;
}

function getFolderIcon(path, small = false) {
    if (path.length === 1 && path[0].toUpperCase() === "C:") {
        return small ? "assets/file_c_drive_16.png" : "assets/file_c_drive.png";
    }
    const match = getSpecialFolder(path);
    if (match) return small ? match.small : match.large;
    return small ? "assets/folder_base_16.png" : "assets/folder_base.png";
}

function formatTooltipSize(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    const kb = bytes / 1024;
    return `${kb >= 100 ? Math.round(kb) : Number(kb.toFixed(2))} KB`;
}

function formatTooltipDate(dateStr) {
    return dateStr
        .replace(/\s+/g, " ")
        .replace(/^0/, "")
        .replace(/\/0/g, "/")
        .replace(/ 0(\d:)/, " $1");
}

function getFileTypeLabel(filename) {
    const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
    if (ext === "txt") return "Text Document";
    if (ext === "bat") return "MS-DOS Batch File";
    if (ext === "sys") return "System File";
    if (ext === "mp3") return "MP3 Format Sound";
    if (ext === "wma") return "Windows Media Audio file";
    if (ext === "wav") return "Wave Sound";
    if (ext === "ogg") return "Ogg Vorbis Audio";
    if (isAudioFile(filename)) return "Audio File";
    return "File";
}

function getNodeSize(node) {
    if (isFileNode(node)) return node.content.length;
    let total = 0;
    for (const value of Object.values(node)) {
        total += getNodeSize(value);
    }
    return total;
}

const HIDDEN_ROOT_FILES = new Set(["autoexec.bat", "config.sys"]);

function isHiddenExplorerItem(parentPath, name, value) {
    return parentPath.length === 1 &&
        parentPath[0].toUpperCase() === "C:" &&
        isFileNode(value) &&
        HIDDEN_ROOT_FILES.has(name.toLowerCase());
}

function getItemTooltip(path, name, value) {
    if (isFileNode(value)) {
        const type = getFileTypeLabel(name);
        const dateModified = formatTooltipDate(value.date);
        const size = formatTooltipSize(value.content.length);
        return `Type: ${type}\nDate Modified: ${dateModified}\nSize: ${size}`;
    }

    const lines = [];
    const special = getSpecialFolder(path);
    if (special?.tooltip) {
        lines.push(special.tooltip);
    }

    const entries = Object.entries(value).filter(([k, v]) => !isHiddenExplorerItem(path, k, v));
    const childFolders = entries.filter(([, v]) => isFolderNode(v)).map(([k]) => k);
    const childFiles = entries.filter(([, v]) => isFileNode(v)).map(([k]) => k);
    if (childFolders.length === 0 && childFiles.length === 0) {
        lines.push("Folder is empty");
        return lines.join("\n");
    }

    lines.push(`Size: ${formatTooltipSize(getNodeSize(value))}`);
    if (childFolders.length > 0) {
        lines.push(`Folders: ${childFolders.join(", ")}`);
    }
    if (childFiles.length > 0) {
        lines.push(`Files: ${childFiles.join(", ")}`);
    }
    return lines.join("\n");
}

function truncateTooltipLines(tooltip, maxLength = MAX_TOOLTIP_LINE_LENGTH) {
    return tooltip
        .split("\n")
        .map((line) => (
            line.length > maxLength
                ? `${line.slice(0, maxLength - 3).trimEnd()}...`
                : line
        ))
        .join("\n");
}

function createExplorerItem(label, iconSrc, tooltip, onDoubleClick) {
    const item = document.createElement("div");
    item.className = "explorer-item";
    item.title = truncateTooltipLines(tooltip);

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
    const webErrorEl = winEl.querySelector(".explorer-web-error");
    const explorerFrame = winEl.querySelector(".explorer-frame");
    const addressCombo = winEl.querySelector(".explorer-address-combo");
    const addressIcon = winEl.querySelector(".xp-address-icon");
    const addressInput = winEl.querySelector(".explorer-address-field");
    const addressMenu = winEl.querySelector(".explorer-address-menu");
    const goBtn = winEl.querySelector(".explorer-go-btn");

    let currentMode = initialMode;
    let currentWebUrl = HOME_URL;
    let isWebError = false;
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
        if (a.mode === "computer") return true;
        if (a.mode === "web") return a.url === b.url && Boolean(a.isError) === Boolean(b.isError);
        return getPathString(a.path).toLowerCase() === getPathString(b.path).toLowerCase();
    }

    function getEntryLabel(entry) {
        if (!entry) return "";
        if (entry.mode === "computer") return "My Computer";
        if (entry.mode === "web") return entry.isError ? "Cannot find server" : entry.url;
        if (entry.path.length === 1) return `Local Disk (${entry.path[0]})`;
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
            item.title = entry.mode === "computer"
                ? "My Computer"
                : entry.mode === "web" ? entry.url : getPathString(entry.path);
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
            upBtn.disabled = isWeb || currentMode === "computer";
        }
    }

    function getCurrentAddressValue() {
        if (currentMode === "web") return currentWebUrl;
        if (currentMode === "computer") return "My Computer";
        return getPathString(explPath);
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
        if (!rawInput || currentMode !== "folder") return [];

        const lastSlashIdx = Math.max(rawInput.lastIndexOf("/"), rawInput.lastIndexOf("\\"));

        if (lastSlashIdx === -1 && rawInput.toLowerCase() === "c:") {
            return ["C:\\"];
        }

        const dirPart = lastSlashIdx !== -1 ? rawInput.slice(0, lastSlashIdx + 1) : "";
        const prefix = lastSlashIdx !== -1 ? rawInput.slice(lastSlashIdx + 1) : rawInput;
        if (prefix === "." || prefix === "..") return [];

        const targetDirPath = dirPart ? resolvePath(dirPart.replace(/"/g, ""), explPath) : explPath;
        const dirNode = getNode(targetDirPath);
        if (!isFolderNode(dirNode)) return [];

        const lowerPrefix = prefix.replace(/"/g, "").toLowerCase();
        return Object.keys(dirNode)
            .filter((key) => !isHiddenExplorerItem(targetDirPath, key, dirNode[key]) &&
                key.toLowerCase().startsWith(lowerPrefix))
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

    function showWebView({ url = HOME_URL, isError = false, recordHistory = true } = {}) {
        currentMode = "web";
        currentWebUrl = url;
        isWebError = isError;
        explItems.hidden = true;
        explorerFrame.hidden = isError;
        if (webErrorEl) webErrorEl.hidden = !isError;
        if (!isError && explorerFrame.getAttribute("src") !== HOME_PAGE_SRC) {
            explorerFrame.setAttribute("src", HOME_PAGE_SRC);
        }
        if (addressIcon) addressIcon.setAttribute("src", "assets/app_explorer_16.png");
        addressInput.value = url;
        closeAutoComplete();
        closeHistoryMenus();
        const title = isError
            ? "Cannot find server - Microsoft Internet Explorer"
            : `${HOME_URL} - Microsoft Internet Explorer`;
        setWindowTitle(id, title, "assets/app_explorer_16.png");
        if (recordHistory) {
            pushHistory({ mode: "web", url, isError });
        } else {
            updateNavButtons();
        }
    }

    function reloadWebFrame() {
        try {
            if (explorerFrame.contentWindow?.location) {
                explorerFrame.contentWindow.location.reload();
                return;
            }
        } catch {
            // Fall back to resetting src
        }
        explorerFrame.src = HOME_PAGE_SRC;
    }

    function renderWeb({ recordHistory = true } = {}) {
        showWebView({ url: HOME_URL, isError: false, recordHistory });
    }

    function renderComputer({ recordHistory = true } = {}) {
        currentMode = "computer";
        isWebError = false;
        explorerFrame.hidden = true;
        if (webErrorEl) webErrorEl.hidden = true;
        explItems.hidden = false;
        explItems.classList.add("explorer-computer-view");
        explItems.innerHTML = "";
        if (addressIcon) addressIcon.setAttribute("src", "assets/app_my_computer_16.png");
        addressInput.value = "My Computer";
        closeAutoComplete();
        closeHistoryMenus();
        setWindowTitle(id, "My Computer", "assets/app_my_computer_16.png");

        const appendSection = (heading, items) => {
            const section = document.createElement("div");
            section.className = "explorer-section";

            const header = document.createElement("div");
            header.className = "explorer-section-header";
            header.textContent = heading;

            const grid = document.createElement("div");
            grid.className = "explorer-section-items";
            for (const item of items) {
                grid.appendChild(
                    createExplorerItem(item.label, item.icon, item.tooltip, item.onDoubleClick)
                );
            }

            section.append(header, grid);
            explItems.appendChild(section);
        };

        const sharedDocsPath = ["C:", "Documents and Settings", "All Users", "Documents"];
        const userDocsPath = [...HOME_PATH, "My Documents"];
        appendSection("Files Stored on This Computer", [
            {
                label: "Shared Documents",
                icon: "assets/folder_base.png",
                tooltip: "Contains files and folders shared between users of this computer",
                onDoubleClick: () => renderFolder(sharedDocsPath)
            },
            {
                label: "sla-king's Documents",
                icon: "assets/folder_base.png",
                tooltip: MY_DOCUMENTS_TOOLTIP,
                onDoubleClick: () => renderFolder(userDocsPath)
            }
        ]);

        appendSection("Hard Disk Drives", [
            {
                label: "Local Disk (C:)",
                icon: "assets/file_c_drive.png",
                tooltip: "Free Space: 8.84 GB\nTotal Size: 9.31 GB",
                onDoubleClick: () => renderFolder(["C:"])
            }
        ]);

        if (recordHistory) {
            pushHistory({ mode: "computer" });
        } else {
            updateNavButtons();
        }
    }

    function renderFolder(path, { recordHistory = true } = {}) {
        const node = getNode(path);
        if (!isFolderNode(node)) {
            return false;
        }

        currentMode = "folder";
        isWebError = false;
        explPath = path;
        explorerFrame.hidden = true;
        if (webErrorEl) webErrorEl.hidden = true;
        explItems.hidden = false;
        explItems.classList.remove("explorer-computer-view");
        explItems.innerHTML = "";
        const smallFolderIcon = getFolderIcon(path, true);
        if (addressIcon) addressIcon.setAttribute("src", smallFolderIcon);
        addressInput.value = getPathString(explPath);
        closeAutoComplete();
        closeHistoryMenus();

        const currentFolder = path.length === 1
            ? `Local Disk (${path[0]})`
            : (path[path.length - 1] || "Explorer");
        setWindowTitle(id, currentFolder, smallFolderIcon);

        for (const [key, value] of Object.entries(node)) {
            if (isHiddenExplorerItem(path, key, value)) continue;
            const isDir = isFolderNode(value);
            const itemPath = [...explPath, key];
            const itemIcon = isDir
                ? getFolderIcon(itemPath)
                : (isAudioFile(key) ? "assets/file_sound.png" : "assets/file_text_doc.png");
            const itemTooltip = getItemTooltip(itemPath, key, value);
            explItems.appendChild(
                createExplorerItem(key, itemIcon, itemTooltip, () => {
                    if (isDir) {
                        renderFolder(itemPath);
                    } else if (isAudioFile(key)) {
                        openMediaPlayer({ trackPath: getPathString(itemPath), autoplay: true });
                    } else {
                        openNotepad(key, value.content, getPathString(itemPath));
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
        if (entry.mode === "computer") {
            renderComputer({ recordHistory: false });
        } else if (entry.mode === "web") {
            showWebView({ url: entry.url, isError: Boolean(entry.isError), recordHistory: false });
        } else {
            renderFolder([...entry.path], { recordHistory: false });
        }
    }

    function navigateFromAddressBar() {
        closeAutoComplete();
        const rawValue = addressInput.value.trim();
        if (!rawValue) {
            if (currentMode !== "web") {
                showAddressError("", id);
            }
            return;
        }

        if (rawValue.toLowerCase() === "my computer") {
            renderComputer();
            return;
        }

        if (isWebUrl(rawValue)) {
            if (currentMode === "web" && !isWebError) {
                addressInput.value = HOME_URL;
                reloadWebFrame();
            } else {
                renderWeb();
            }
            return;
        }

        const candidatePath = resolvePath(rawValue, explPath);
        const targetNode = getNode(candidatePath);

        if (targetNode === null || targetNode === undefined) {
            if (currentMode === "web" || /^https?:\/\//i.test(rawValue)) {
                showWebView({ url: rawValue, isError: true });
            } else {
                showAddressError(rawValue, id);
            }
            return;
        }

        if (isFileNode(targetNode)) {
            const fileName = candidatePath[candidatePath.length - 1];
            const fullPath = getPathString(candidatePath);
            if (isAudioFile(fileName)) {
                openMediaPlayer({ trackPath: fullPath, autoplay: true });
            } else {
                openNotepad(fileName, targetNode.content, fullPath);
            }
            addressInput.value = getCurrentAddressValue();
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
    } else if (initialMode === "computer") {
        renderComputer();
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
        getUrl: () => currentWebUrl,
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
        if (e.key === "Tab" && currentMode === "folder") {
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
                addressInput.value = getCurrentAddressValue();
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
        if (isWebError) {
            showWebView({ url: currentWebUrl, isError: true, recordHistory: false });
            return;
        }
        reloadWebFrame();
    });

    homeBtn?.addEventListener("click", () => {
        renderWeb();
    });

    upBtn?.addEventListener("click", () => {
        if (currentMode !== "folder") return;
        if (explPath.length > 1) {
            renderFolder(explPath.slice(0, -1));
        } else if (explPath.length === 1) {
            renderComputer();
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

export function openMyComputer() {
    const existing = findExplorer((inst) => inst.getMode() === "computer");
    if (existing) {
        openWindow(existing.id);
        return;
    }
    createExplorerWindow({
        initialMode: "computer"
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
