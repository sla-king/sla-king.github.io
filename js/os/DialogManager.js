import { XPWindow } from './XPWindow.js';
import { registerDismissiblePopup } from './windowManager.js';
import { SOUNDS, playSound } from './AudioMixer.js';

export const EXTERNAL_LINKS = {
    email: {
        name: "sla-king's Email",
        buttonText: "Open Email",
        icon: "assets/app_outlook.png",
        url: "mailto:alex.l.seidinger@gmail.com"
    },
    linkedin: {
        name: "sla-king's LinkedIn",
        buttonText: "Visit LinkedIn",
        icon: "assets/app_linkedin.png",
        url: "https://www.linkedin.com/in/alexanderseidinger"
    },
    github: {
        name: "sla-king's GitHub",
        buttonText: "Visit GitHub",
        icon: "assets/app_github.png",
        url: "https://github.com/sla-king"
    }
};

// Handles the address error popup and external link confirmation popup
export class DialogManager {
    constructor() {
        this.errorWin = null;
        this.linkWin = null;
        this.errorMessage = null;
        this.errorOkBtn = null;
        this.errorCloseHandler = null;

        this.linkIcon = null;
        this.linkMessage = null;
        this.linkVisitBtn = null;
        this.pendingLinkUrl = "";
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.initErrorDialog();
        this.initLinkDialog();
        this.initFrameLinkListener();
    }

    initErrorDialog() {
        const errorWindowEl = document.getElementById("xp-error-window");
        if (!errorWindowEl) return;

        this.errorMessage = document.getElementById("xp-error-message");
        this.errorOkBtn = document.getElementById("xp-error-ok");

        this.errorWin = new XPWindow({
            id: "xp-error",
            winEl: errorWindowEl,
            resizable: false,
            maximizable: false,
            showInTaskbar: false
        });
        this.errorWin.onBlockedFocus = () => this.errorOkBtn?.focus();
        this.errorWin.onClose = (ownerId) => {
            const cb = this.errorCloseHandler;
            this.errorCloseHandler = null;
            cb?.(ownerId);
        };

        this.errorOkBtn?.addEventListener("click", () => this.errorWin.close());
        errorWindowEl.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                this.errorWin.close();
            }
        });
    }

    initLinkDialog() {
        const linkWindowEl = document.getElementById("xp-link-window");
        if (!linkWindowEl) return;

        this.linkIcon = document.getElementById("xp-link-icon");
        this.linkMessage = document.getElementById("xp-link-message");
        this.linkVisitBtn = document.getElementById("xp-link-visit");
        const linkCancelBtn = document.getElementById("xp-link-cancel");

        this.linkWin = new XPWindow({
            id: "xp-link",
            winEl: linkWindowEl,
            resizable: false,
            maximizable: false,
            showInTaskbar: false
        });

        linkCancelBtn?.addEventListener("click", () => this.linkWin.close());
        this.linkVisitBtn?.addEventListener("click", () => {
            const url = this.pendingLinkUrl;
            this.linkWin.close();
            if (!url) return;
            if (url.startsWith("mailto:")) {
                window.location.href = url;
            } else {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        });

        linkWindowEl.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                this.linkWin.close();
            }
        });

        registerDismissiblePopup({
            isOpen: () => this.linkWin.isVisible(),
            containsTarget: (target) => linkWindowEl.contains(target),
            onClose: () => this.linkWin.close(),
            capture: true
        });
    }

    initFrameLinkListener() {
        window.addEventListener("message", (e) => {
            if (e.data?.type !== "xp-open-link") return;
            const isExplorerFrame = Array.from(document.querySelectorAll(".explorer-frame"))
                .some((frame) => frame.contentWindow === e.source);
            if (!isExplorerFrame) return;

            const href = typeof e.data.href === "string" ? e.data.href.trim() : "";
            if (!/^(?:https?:\/\/|mailto:)/i.test(href)) return;

            const text = typeof e.data.text === "string" ? e.data.text.trim() : "";
            this.openLink(this.resolveLinkTarget(href, text));
        });
    }

    resolveLinkTarget(href, label) {
        const lower = href.toLowerCase();
        if (lower.startsWith("mailto:")) {
            return { ...EXTERNAL_LINKS.email, url: href };
        }
        if (lower.includes("linkedin.com")) {
            return { ...EXTERNAL_LINKS.linkedin, url: href };
        }
        if (lower.includes("github.com")) {
            return { ...EXTERNAL_LINKS.github, url: href };
        }
        return {
            name: label || href,
            buttonText: "Visit Link",
            icon: "assets/app_explorer.png",
            url: href
        };
    }

    showAddressError(target, ownerId, onAfterClose = null) {
        this.init();
        if (!this.errorWin || !this.errorMessage) return;

        this.errorCloseHandler = onAfterClose;
        this.errorMessage.textContent =
            `Windows cannot find '${target}'. Check the spelling and try again, or try searching for the item by clicking the Start button and then clicking Search.`;
        this.errorWin.open({ ownerId });
        this.errorWin.center();
        playSound(SOUNDS.CRITICAL_STOP);
        requestAnimationFrame(() => this.errorOkBtn?.focus());
    }

    openLink(targetOrKey) {
        this.init();
        const target = typeof targetOrKey === "string" ? EXTERNAL_LINKS[targetOrKey] : targetOrKey;
        if (!target || !this.linkWin) return;

        this.pendingLinkUrl = target.url;
        if (this.linkIcon) this.linkIcon.src = target.icon;
        if (this.linkMessage) this.linkMessage.textContent = `Are you sure you want to open "${target.url}"?`;
        if (this.linkVisitBtn) this.linkVisitBtn.textContent = target.buttonText;

        this.linkWin.open();
        this.linkWin.center();
        playSound(SOUNDS.EXCLAMATION);
        requestAnimationFrame(() => this.linkVisitBtn?.focus());
    }
}

const dialogManager = new DialogManager();

export function initDialogs() {
    dialogManager.init();
}

export function showAddressError(target, ownerId, onAfterClose) {
    dialogManager.showAddressError(target, ownerId, onAfterClose);
}

export function openLinkDialog(targetOrKey) {
    dialogManager.openLink(targetOrKey);
}
