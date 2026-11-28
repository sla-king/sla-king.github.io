import { XPWindow } from '../os/XPWindow.js';
import { Autocomplete } from '../os/Autocomplete.js';
import { registerDismissiblePopup } from '../os/windowManager.js';
import {
    HOME_PATH,
    MY_DOCUMENTS_TOOLTIP,
    getDriveTooltip,
    getFolderIcon,
    getItemTooltip,
    getNode,
    getPathString,
    isFileNode,
    isFolderNode,
    isHiddenExplorerItem,
    resolvePath,
    truncateTooltipLines
} from '../filesystem.js';
import { getNodeIcon, openFileNode } from '../launcher.js';
import { showAddressError } from '../os/DialogManager.js';
import { SOUNDS, playSound } from '../os/AudioMixer.js';

const HOME_URL = "https://sla-king.github.io/home.html";
const HOME_PAGE_SRC = "home.html";
const WEB_URL_PATTERN = /^(?:https?:\/\/)?sla-king\.github\.io(?:\/home\.html|\/)?$/i;
const BRONNIE_URL = "https://bronnieware.com/blog/regrets-of-the-dying";
const BRONNIE_PAGE_SRC = "pages/regrets-of-the-dying.html";
const BRONNIE_URL_PATTERN = /^(?:https?:\/\/)?(?:www\.)?bronnieware\.com\/blog\/regrets-of-the-dying\/?$/i;

function resolveWebTarget(input) {
    if (WEB_URL_PATTERN.test(input)) {
        return { url: HOME_URL, frameSrc: HOME_PAGE_SRC };
    }
    if (BRONNIE_URL_PATTERN.test(input)) {
        return { url: BRONNIE_URL, frameSrc: BRONNIE_PAGE_SRC };
    }
    return null;
}

export function isWebUrl(input) {
    return Boolean(resolveWebTarget(input));
}

const explorerInstances = new Map();

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

// File Explorer and Internet Explorer window
export class ExplorerWindow extends XPWindow {
    constructor({
        initialMode = "folder",
        initialPath = [...HOME_PATH, "My Documents"],
        maximized = false,
        isWebSize = false
    }) {
        const classNames = [];
        if (isWebSize) classNames.push("explorer-web-size");
        if (maximized) classNames.push("maximized");

        super({
            prefix: "explorer",
            templateId: "explorer-window-template",
            insertBeforeEl: document.getElementById("xp-error-window") || null,
            classNames
        });

        this.toolbarEl = this.winEl.querySelector(".explorer-toolbar");
        this.backBtn = this.winEl.querySelector(".explorer-back-btn");
        this.backMenuBtn = this.winEl.querySelector(".explorer-back-menu-btn");
        this.backMenu = this.winEl.querySelector(".explorer-back-menu");
        this.forwardBtn = this.winEl.querySelector(".explorer-forward-btn");
        this.forwardMenuBtn = this.winEl.querySelector(".explorer-forward-menu-btn");
        this.forwardMenu = this.winEl.querySelector(".explorer-forward-menu");
        this.stopBtn = this.winEl.querySelector(".explorer-stop-btn");
        this.refreshBtn = this.winEl.querySelector(".explorer-refresh-btn");
        this.homeBtn = this.winEl.querySelector(".explorer-home-btn");
        this.upBtn = this.winEl.querySelector(".explorer-up-btn");
        this.explItems = this.winEl.querySelector(".explorer-items");
        this.webErrorEl = this.winEl.querySelector(".explorer-web-error");
        this.explorerFrame = this.winEl.querySelector(".explorer-frame");
        this.addressCombo = this.winEl.querySelector(".explorer-address-combo");
        this.addressIcon = this.winEl.querySelector(".xp-address-icon");
        this.addressInput = this.winEl.querySelector(".explorer-address-field");
        this.addressMenu = this.winEl.querySelector(".explorer-address-menu");
        this.goBtn = this.winEl.querySelector(".explorer-go-btn");

        this.mode = initialMode;
        this.webUrl = HOME_URL;
        this.webFrameSrc = HOME_PAGE_SRC;
        this.isWebError = false;
        this.path = [...initialPath];
        this.history = [];
        this.historyIndex = -1;
        this.justFocused = false;
        this.autocomplete = new Autocomplete();

        this.unregisterPopups = [
            registerDismissiblePopup({
                isOpen: () => Boolean(this.addressMenu && !this.addressMenu.hidden),
                containsTarget: (target) => Boolean(this.addressCombo?.contains(target)),
                onClose: () => this.closeAutoComplete()
            }),
            registerDismissiblePopup({
                isOpen: () => Boolean(
                    (this.backMenu && !this.backMenu.hidden) ||
                    (this.forwardMenu && !this.forwardMenu.hidden)
                ),
                containsTarget: (target) => Boolean(this.toolbarEl?.contains(target)),
                onClose: () => this.closeHistoryMenus()
            })
        ];

        this.bindEvents();

        if (initialMode === "web") {
            this.renderWeb();
        } else if (initialMode === "computer") {
            this.renderComputer();
        } else {
            this.renderFolder([...initialPath]);
        }
    }

    onBlur() {
        this.closeAutoComplete();
        this.closeHistoryMenus();
    }

    onClose() {
        this.closeAutoComplete();
        this.closeHistoryMenus();
        for (const unreg of this.unregisterPopups) {
            unreg();
        }
        explorerInstances.delete(this.id);
    }

    focusAddressInput() {
        this.addressInput?.focus();
    }

    isSameEntry(a, b) {
        if (!a || !b || a.mode !== b.mode) return false;
        if (a.mode === "computer") return true;
        if (a.mode === "web") return a.url === b.url && Boolean(a.isError) === Boolean(b.isError);
        return getPathString(a.path).toLowerCase() === getPathString(b.path).toLowerCase();
    }

    getEntryLabel(entry) {
        if (!entry) return "";
        if (entry.mode === "computer") return "My Computer";
        if (entry.mode === "web") return entry.isError ? "Cannot find server" : entry.url;
        if (entry.path.length === 1) return `Local Disk (${entry.path[0]})`;
        return entry.path[entry.path.length - 1] || "Explorer";
    }

    closeHistoryMenus() {
        if (this.backMenu) this.backMenu.hidden = true;
        if (this.forwardMenu) this.forwardMenu.hidden = true;
        this.backMenuBtn?.setAttribute("aria-expanded", "false");
        this.forwardMenuBtn?.setAttribute("aria-expanded", "false");
    }

    openHistoryMenu(direction) {
        const isBack = direction === "back";
        const menuEl = isBack ? this.backMenu : this.forwardMenu;
        const toggleBtn = isBack ? this.backMenuBtn : this.forwardMenuBtn;
        if (!menuEl || !toggleBtn) return;

        const indices = [];
        if (isBack) {
            for (let i = this.historyIndex - 1; i >= 0; i--) indices.push(i);
        } else {
            for (let i = this.historyIndex + 1; i < this.history.length; i++) indices.push(i);
        }
        if (indices.length === 0) return;

        this.closeAutoComplete();
        this.closeHistoryMenus();
        menuEl.innerHTML = "";

        for (const idx of indices) {
            const entry = this.history[idx];
            const item = document.createElement("div");
            item.className = "explorer-history-item";
            item.textContent = this.getEntryLabel(entry);
            item.title = entry.mode === "computer"
                ? "My Computer"
                : entry.mode === "web" ? entry.url : getPathString(entry.path);
            item.addEventListener("pointerdown", (e) => e.preventDefault());
            item.addEventListener("click", () => {
                this.closeHistoryMenus();
                this.historyIndex = idx;
                this.applyHistoryEntry(this.history[idx]);
            });
            menuEl.appendChild(item);
        }

        menuEl.hidden = false;
        toggleBtn.setAttribute("aria-expanded", "true");
    }

    updateNavButtons() {
        const isWeb = this.mode === "web";
        const canGoBack = this.historyIndex > 0;
        const canGoForward = this.historyIndex < this.history.length - 1;

        if (this.backBtn) {
            this.backBtn.disabled = !canGoBack;
            this.backBtn.title = canGoBack ? `Back to ${this.getEntryLabel(this.history[this.historyIndex - 1])}` : "Back";
        }
        if (this.backMenuBtn) {
            this.backMenuBtn.disabled = !canGoBack;
        }
        if (this.forwardBtn) {
            this.forwardBtn.disabled = !canGoForward;
            this.forwardBtn.title = canGoForward ? `Forward to ${this.getEntryLabel(this.history[this.historyIndex + 1])}` : "Forward";
        }
        if (this.forwardMenuBtn) {
            this.forwardMenuBtn.disabled = !canGoForward;
        }
        if (this.stopBtn) this.stopBtn.hidden = !isWeb;
        if (this.refreshBtn) this.refreshBtn.hidden = !isWeb;
        if (this.homeBtn) this.homeBtn.hidden = !isWeb;
        if (this.upBtn) {
            this.upBtn.hidden = isWeb;
            this.upBtn.disabled = isWeb || this.mode === "computer";
        }
    }

    getCurrentAddressValue() {
        if (this.mode === "web") return this.webUrl;
        if (this.mode === "computer") return "My Computer";
        return getPathString(this.path);
    }

    pushHistory(entry) {
        if (this.isSameEntry(this.history[this.historyIndex], entry)) {
            this.updateNavButtons();
            return;
        }
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(entry);
        this.historyIndex = this.history.length - 1;
        this.updateNavButtons();
    }

    getAutoCompleteMatches(rawInput) {
        if (!rawInput || this.mode !== "folder") return [];

        const lastSlashIdx = Math.max(rawInput.lastIndexOf("/"), rawInput.lastIndexOf("\\"));
        if (lastSlashIdx === -1 && rawInput.toLowerCase() === "c:") {
            return ["C:\\"];
        }

        const dirPart = lastSlashIdx !== -1 ? rawInput.slice(0, lastSlashIdx + 1) : "";
        const prefix = lastSlashIdx !== -1 ? rawInput.slice(lastSlashIdx + 1) : rawInput;
        if (prefix === "." || prefix === "..") return [];

        const targetDirPath = dirPart ? resolvePath(dirPart.replace(/"/g, ""), this.path) : this.path;
        const dirNode = getNode(targetDirPath);
        if (!isFolderNode(dirNode)) return [];

        const lowerPrefix = prefix.replace(/"/g, "").toLowerCase();
        return Object.keys(dirNode)
            .filter((key) => !isHiddenExplorerItem(targetDirPath, key, dirNode[key]) &&
                key.toLowerCase().startsWith(lowerPrefix))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
            .map((key) => `${dirPart}${key}`);
    }

    updateAutoCompleteHighlight() {
        if (!this.addressMenu) return;
        const options = this.addressMenu.querySelectorAll(".explorer-address-option");
        options.forEach((opt, idx) => {
            const isActive = idx === this.autocomplete.index;
            opt.classList.toggle("active", isActive);
            if (isActive) {
                opt.scrollIntoView({ block: "nearest" });
            }
        });
    }

    closeAutoComplete() {
        if (this.addressMenu) {
            this.addressMenu.hidden = true;
        }
        this.autocomplete.reset();
    }

    renderAutoCompleteMenu(matches) {
        if (!this.addressMenu) return;
        if (matches.length === 0) {
            this.closeAutoComplete();
            return;
        }

        this.addressMenu.innerHTML = "";
        for (const match of matches) {
            const option = document.createElement("div");
            option.className = "explorer-address-option";
            option.textContent = match;

            option.addEventListener("pointerdown", (e) => e.preventDefault());
            option.addEventListener("click", () => {
                this.addressInput.value = match;
                this.closeAutoComplete();
                this.navigateFromAddressBar();
            });
            this.addressMenu.appendChild(option);
        }

        this.addressMenu.hidden = false;
    }

    showWebView({ url = HOME_URL, frameSrc = null, isError = false, recordHistory = true } = {}) {
        const target = resolveWebTarget(url);
        const resolvedUrl = target ? target.url : url;
        const resolvedSrc = frameSrc || target?.frameSrc || resolvedUrl;

        this.mode = "web";
        this.webUrl = resolvedUrl;
        this.webFrameSrc = resolvedSrc;
        this.isWebError = isError;
        this.explItems.hidden = true;
        this.explorerFrame.hidden = isError;
        if (this.webErrorEl) this.webErrorEl.hidden = !isError;
        if (!isError && this.explorerFrame.getAttribute("src") !== resolvedSrc) {
            this.explorerFrame.setAttribute("src", resolvedSrc);
        }
        this.addressIcon?.setAttribute("src", "assets/file_internet_doc_16.png");
        this.addressInput.value = resolvedUrl;
        this.closeAutoComplete();
        this.closeHistoryMenus();

        const title = isError
            ? "Cannot find server - Microsoft Internet Explorer"
            : `${resolvedUrl} - Microsoft Internet Explorer`;
        this.setTitle(title, "assets/file_internet_doc_16.png");

        if (recordHistory) {
            this.pushHistory({ mode: "web", url: resolvedUrl, frameSrc: resolvedSrc, isError });
        } else {
            this.updateNavButtons();
        }
        if (isError) {
            playSound(SOUNDS.ERROR);
        }
    }

    reloadWebFrame() {
        try {
            if (this.explorerFrame.contentWindow?.location) {
                this.explorerFrame.contentWindow.location.reload();
                return;
            }
        } catch {
            // Reset the iframe src if reload is blocked
        }
        this.explorerFrame.src = this.webFrameSrc || HOME_PAGE_SRC;
    }

    renderWeb({ recordHistory = true } = {}) {
        this.showWebView({ url: HOME_URL, isError: false, recordHistory });
    }

    renderComputer({ recordHistory = true } = {}) {
        this.mode = "computer";
        this.isWebError = false;
        this.explorerFrame.hidden = true;
        if (this.webErrorEl) this.webErrorEl.hidden = true;
        this.explItems.hidden = false;
        this.explItems.classList.add("explorer-computer-view");
        this.explItems.innerHTML = "";
        this.addressIcon?.setAttribute("src", "assets/app_my_computer_16.png");
        this.addressInput.value = "My Computer";
        this.closeAutoComplete();
        this.closeHistoryMenus();
        this.setTitle("My Computer", "assets/app_my_computer_16.png");

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
            this.explItems.appendChild(section);
        };

        const sharedDocsPath = ["C:", "Documents and Settings", "All Users", "Documents"];
        const userDocsPath = [...HOME_PATH, "My Documents"];
        appendSection("Files Stored on This Computer", [
            {
                label: "Shared Documents",
                icon: "assets/folder_base.png",
                tooltip: "Contains files and folders shared between users of this computer",
                onDoubleClick: () => {
                    playSound(SOUNDS.START_NAVIGATION);
                    this.renderFolder(sharedDocsPath);
                }
            },
            {
                label: "sla-king's Documents",
                icon: "assets/folder_base.png",
                tooltip: MY_DOCUMENTS_TOOLTIP,
                onDoubleClick: () => {
                    playSound(SOUNDS.START_NAVIGATION);
                    this.renderFolder(userDocsPath);
                }
            }
        ]);

        appendSection("Hard Disk Drives", [
            {
                label: "Local Disk (C:)",
                icon: "assets/file_c_drive.png",
                tooltip: getDriveTooltip("C:"),
                onDoubleClick: () => {
                    playSound(SOUNDS.START_NAVIGATION);
                    this.renderFolder(["C:"]);
                }
            }
        ]);

        if (recordHistory) {
            this.pushHistory({ mode: "computer" });
        } else {
            this.updateNavButtons();
        }
    }

    renderFolder(path, { recordHistory = true } = {}) {
        const node = getNode(path);
        if (!isFolderNode(node)) return false;

        this.mode = "folder";
        this.isWebError = false;
        this.path = path;
        this.explorerFrame.hidden = true;
        if (this.webErrorEl) this.webErrorEl.hidden = true;
        this.explItems.hidden = false;
        this.explItems.classList.remove("explorer-computer-view");
        this.explItems.innerHTML = "";

        const smallFolderIcon = getFolderIcon(path, true);
        this.addressIcon?.setAttribute("src", smallFolderIcon);
        this.addressInput.value = getPathString(this.path);
        this.closeAutoComplete();
        this.closeHistoryMenus();

        const currentFolder = path.length === 1
            ? `Local Disk (${path[0]})`
            : (path[path.length - 1] || "Explorer");
        this.setTitle(currentFolder, smallFolderIcon);

        for (const [key, value] of Object.entries(node)) {
            if (isHiddenExplorerItem(path, key, value)) continue;
            const itemPath = [...this.path, key];
            const itemIcon = getNodeIcon(itemPath, key, value);
            const itemTooltip = getItemTooltip(itemPath, key, value);

            this.explItems.appendChild(
                createExplorerItem(key, itemIcon, itemTooltip, () => {
                    if (isFolderNode(value)) {
                        playSound(SOUNDS.START_NAVIGATION);
                        this.renderFolder(itemPath);
                    } else {
                        openFileNode(itemPath, value, { autoplay: true });
                    }
                })
            );
        }

        if (recordHistory) {
            this.pushHistory({ mode: "folder", path: [...path] });
        } else {
            this.updateNavButtons();
        }
        return true;
    }

    applyHistoryEntry(entry) {
        if (!entry) return;
        if (entry.mode === "computer") {
            playSound(SOUNDS.START_NAVIGATION);
            this.renderComputer({ recordHistory: false });
        } else if (entry.mode === "web") {
            if (!entry.isError) {
                playSound(SOUNDS.START_NAVIGATION);
            }
            this.showWebView({
                url: entry.url,
                frameSrc: entry.frameSrc,
                isError: Boolean(entry.isError),
                recordHistory: false
            });
        } else {
            playSound(SOUNDS.START_NAVIGATION);
            this.renderFolder([...entry.path], { recordHistory: false });
        }
    }

    navigateFromAddressBar() {
        this.closeAutoComplete();
        const rawValue = this.addressInput.value.trim();
        if (!rawValue) {
            if (this.mode !== "web") {
                showAddressError("", this.id, () => requestAnimationFrame(() => this.focusAddressInput()));
            }
            return;
        }

        if (rawValue.toLowerCase() === "my computer") {
            playSound(SOUNDS.START_NAVIGATION);
            this.renderComputer();
            return;
        }

        const webTarget = resolveWebTarget(rawValue);
        if (webTarget) {
            playSound(SOUNDS.START_NAVIGATION);
            if (this.mode === "web" && !this.isWebError && this.webUrl === webTarget.url) {
                this.addressInput.value = webTarget.url;
                this.reloadWebFrame();
            } else {
                this.showWebView({ url: webTarget.url, frameSrc: webTarget.frameSrc });
            }
            return;
        }

        const candidatePath = resolvePath(rawValue, this.path);
        const targetNode = getNode(candidatePath);

        if (targetNode === null || targetNode === undefined) {
            if (this.mode === "web" || /^https?:\/\//i.test(rawValue)) {
                this.showWebView({ url: rawValue, isError: true });
            } else {
                showAddressError(rawValue, this.id, () => requestAnimationFrame(() => this.focusAddressInput()));
            }
            return;
        }

        if (isFileNode(targetNode)) {
            openFileNode(candidatePath, targetNode, { autoplay: true });
            this.addressInput.value = this.getCurrentAddressValue();
            return;
        }

        playSound(SOUNDS.START_NAVIGATION);
        this.renderFolder(candidatePath);
    }

    applyCycleValue(val) {
        this.addressInput.value = val;
        this.addressInput.setSelectionRange(val.length, val.length);
        this.updateAutoCompleteHighlight();
    }

    stepCycle(step) {
        if (this.autocomplete.hasMatches() &&
            (this.autocomplete.hasInlineSuggestion ||
                this.autocomplete.index === -1 ||
                this.addressInput.value === this.autocomplete.current())) {
            const stepped = this.autocomplete.step(step);
            if (stepped) {
                this.applyCycleValue(stepped.match);
                return true;
            }
        }

        const matches = this.getAutoCompleteMatches(this.addressInput.value);
        if (matches.length === 0) return false;

        this.renderAutoCompleteMenu(matches);
        this.autocomplete.setMatches(matches, {
            prefix: this.addressInput.value,
            index: step > 0 ? 0 : matches.length - 1
        });
        this.applyCycleValue(this.autocomplete.current());
        return true;
    }

    bindEvents() {
        this.addressInput?.addEventListener("focus", () => {
            this.justFocused = true;
        });

        this.addressInput?.addEventListener("mouseup", () => {
            if (this.justFocused && this.addressInput.selectionStart === this.addressInput.selectionEnd) {
                this.addressInput.select();
            }
            this.justFocused = false;
        });

        this.addressInput?.addEventListener("input", (e) => {
            this.justFocused = false;
            this.closeAutoComplete();

            const rawValue = this.addressInput.value;
            const matches = this.getAutoCompleteMatches(rawValue);
            this.renderAutoCompleteMenu(matches);
            if (matches.length === 0) return;

            const isDelete = e.inputType?.startsWith("delete");
            const isAtEnd = this.addressInput.selectionStart === rawValue.length &&
                this.addressInput.selectionEnd === rawValue.length;
            const endsWithSeparator = rawValue.endsWith("\\") || rawValue.endsWith("/");
            const isDrivePrefix = rawValue.trim().toLowerCase() === "c:";

            let inlineSuggested = false;
            let index = -1;
            if (!isDelete && !e.isComposing && isAtEnd && !endsWithSeparator && !isDrivePrefix) {
                const firstMatch = matches[0];
                if (firstMatch.length > rawValue.length) {
                    this.addressInput.value = rawValue + firstMatch.slice(rawValue.length);
                    this.addressInput.setSelectionRange(rawValue.length, this.addressInput.value.length);
                    inlineSuggested = true;
                    index = 0;
                }
            }

            this.autocomplete.setMatches(matches, {
                prefix: rawValue,
                index,
                inlineSuggested
            });
            if (inlineSuggested) {
                this.updateAutoCompleteHighlight();
            }
        });

        this.addressInput?.addEventListener("keydown", (e) => {
            if (e.key === "Tab" && this.mode === "folder") {
                e.preventDefault();
                this.stepCycle(e.shiftKey ? -1 : 1);
                return;
            }

            if ((e.key === "ArrowDown" || e.key === "ArrowUp") &&
                this.addressMenu &&
                !this.addressMenu.hidden &&
                this.autocomplete.hasMatches()) {
                e.preventDefault();
                if (e.key === "ArrowUp" && this.autocomplete.index === 0 && !this.autocomplete.hasInlineSuggestion) {
                    this.autocomplete.index = -1;
                    this.applyCycleValue(this.autocomplete.prefix);
                } else {
                    this.stepCycle(e.key === "ArrowDown" ? 1 : -1);
                }
                return;
            }

            if (e.key === "Enter") {
                e.preventDefault();
                this.navigateFromAddressBar();
            } else if (e.key === "Escape") {
                if (this.addressMenu && !this.addressMenu.hidden) {
                    e.preventDefault();
                    const prefix = this.autocomplete.prefix;
                    if (prefix && this.addressInput.value !== prefix) {
                        this.addressInput.value = prefix;
                        this.addressInput.setSelectionRange(prefix.length, prefix.length);
                    }
                    this.closeAutoComplete();
                } else {
                    this.closeAutoComplete();
                    this.addressInput.value = this.getCurrentAddressValue();
                    this.addressInput.select();
                }
            }
        });

        this.backBtn?.addEventListener("click", () => {
            if (this.historyIndex > 0) {
                this.applyHistoryEntry(this.history[--this.historyIndex]);
            }
        });

        this.backMenuBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this.backMenu && !this.backMenu.hidden) {
                this.closeHistoryMenus();
            } else {
                this.openHistoryMenu("back");
            }
        });

        this.forwardBtn?.addEventListener("click", () => {
            if (this.historyIndex < this.history.length - 1) {
                this.applyHistoryEntry(this.history[++this.historyIndex]);
            }
        });

        this.forwardMenuBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this.forwardMenu && !this.forwardMenu.hidden) {
                this.closeHistoryMenus();
            } else {
                this.openHistoryMenu("forward");
            }
        });

        this.stopBtn?.addEventListener("click", () => {
            if (this.mode !== "web") return;
            try {
                this.explorerFrame.contentWindow?.stop?.();
            } catch {
                // Ignore errors when stopping external pages
            }
        });

        this.refreshBtn?.addEventListener("click", () => {
            if (this.mode !== "web") return;
            if (this.isWebError) {
                this.showWebView({ url: this.webUrl, isError: true, recordHistory: false });
                return;
            }
            this.reloadWebFrame();
        });

        this.homeBtn?.addEventListener("click", () => {
            playSound(SOUNDS.START_NAVIGATION);
            this.renderWeb();
        });

        this.upBtn?.addEventListener("click", () => {
            if (this.mode !== "folder") return;
            if (this.path.length > 1) {
                playSound(SOUNDS.START_NAVIGATION);
                this.renderFolder(this.path.slice(0, -1));
            } else if (this.path.length === 1) {
                playSound(SOUNDS.START_NAVIGATION);
                this.renderComputer();
            }
        });

        this.goBtn?.addEventListener("click", () => this.navigateFromAddressBar());
    }
}

function findExplorer(predicate) {
    for (const instance of explorerInstances.values()) {
        if (predicate(instance)) return instance;
    }
    return null;
}

function createAndOpenExplorer(options) {
    const cascadeOffset = options.maximized
        ? 0
        : XPWindow.getCascadeOffset(explorerInstances.values());
    const win = new ExplorerWindow(options);
    explorerInstances.set(win.id, win);
    win.open({ cascadeOffset });
    return win.id;
}

export function initExplorer() {
    openWebExplorer({ maximized: true });
}

export function openExplorer(targetPath = [...HOME_PATH, "My Documents"]) {
    const targetStr = getPathString(targetPath).toLowerCase();
    const existing = findExplorer(
        (inst) => inst.mode === "folder" && getPathString(inst.path).toLowerCase() === targetStr
    );
    if (existing) {
        existing.open();
        return;
    }
    createAndOpenExplorer({ initialMode: "folder", initialPath: targetPath });
}

export function openMyComputer() {
    const existing = findExplorer((inst) => inst.mode === "computer");
    if (existing) {
        existing.open();
        return;
    }
    createAndOpenExplorer({ initialMode: "computer" });
}

export function openWebExplorer({ maximized = false, url = HOME_URL } = {}) {
    const target = resolveWebTarget(url);
    const resolvedUrl = target ? target.url : url;
    const resolvedSrc = target ? target.frameSrc : url;
    const isError = !target && !/^https?:\/\//i.test(resolvedUrl);

    const existing = findExplorer(
        (inst) => inst.mode === "web" && inst.webUrl === resolvedUrl && !inst.isWebError
    );
    if (existing) {
        existing.open();
        return;
    }

    const anyWeb = findExplorer((inst) => inst.mode === "web");
    if (anyWeb) {
        anyWeb.open();
        anyWeb.showWebView({ url: resolvedUrl, frameSrc: resolvedSrc, isError });
        return;
    }

    const id = createAndOpenExplorer({ initialMode: "web", maximized, isWebSize: true });
    if (resolvedUrl !== HOME_URL || isError) {
        explorerInstances.get(id)?.showWebView({
            url: resolvedUrl,
            frameSrc: resolvedSrc,
            isError,
            recordHistory: false
        });
    }
}
