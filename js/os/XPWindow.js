import {
    registerWindow,
    unregisterWindow,
    openWindow,
    closeWindow,
    centerWindow,
    setWindowTitle
} from './windowManager.js';

const instanceCounters = new Map();

// Base class for XP windows (handles opening, closing, titles, and templates)
export class XPWindow {
    constructor({
        id,
        prefix = "win",
        templateId = null,
        winEl = null,
        insertBeforeEl = null,
        classNames = [],
        resizable = true,
        maximizable = true,
        showInTaskbar = true,
        ownerId = null
    } = {}) {
        let element = winEl;
        let isTemplated = false;

        if (!element && templateId) {
            const template = document.getElementById(templateId);
            if (!template) {
                throw new Error(`Window template "${templateId}" was not found.`);
            }
            element = template.content.firstElementChild.cloneNode(true);
            for (const cls of classNames) {
                if (cls) element.classList.add(cls);
            }
            const anchor = insertBeforeEl || document.getElementById("start-menu") || null;
            document.body.insertBefore(element, anchor);
            isTemplated = true;
        }

        if (!element) {
            throw new Error(`XPWindow requires an element or templateId (id=${id || prefix}).`);
        }

        if (id) {
            this.id = id;
        } else {
            const count = (instanceCounters.get(prefix) || 0) + 1;
            instanceCounters.set(prefix, count);
            this.id = `${prefix}-${count}`;
        }

        this.winEl = element;
        this.isTemplated = isTemplated;

        registerWindow({
            id: this.id,
            winEl: this.winEl,
            ownerId,
            resizable,
            maximizable,
            showInTaskbar,
            onClose: (closedOwnerId) => this.handleClose(closedOwnerId),
            onBlur: () => this.onBlur(),
            onBlockedFocus: () => this.onBlockedFocus()
        });
    }

    onClose() {}

    onBlur() {}

    onBlockedFocus() {}

    handleClose(ownerId) {
        this.onClose(ownerId);
        if (this.isTemplated) {
            unregisterWindow(this.id);
        }
    }

    open(options = {}) {
        openWindow(this.id, options);
    }

    close() {
        closeWindow(this.id);
    }

    center() {
        centerWindow(this.id);
    }

    setTitle(title, icon) {
        setWindowTitle(this.id, title, icon);
    }

    isMaximized() {
        return this.winEl.classList.contains("maximized");
    }

    isVisible() {
        return this.winEl.style.display !== "none";
    }

    static getCascadeOffset(instances) {
        let nonMaximized = 0;
        for (const inst of instances) {
            if (!inst.isMaximized()) {
                nonMaximized++;
            }
        }
        return (nonMaximized % 5) * 24;
    }
}
