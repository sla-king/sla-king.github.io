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

export const SHELL_ABOUT_APPS = {
    windows: {
        title: "About Windows",
        product: "Microsoft \u00ae Windows",
        icon: null,
        credits: ""
    },
    notepad: {
        title: "About Notepad",
        product: "Microsoft \u00ae Notepad",
        icon: "assets/app_notepad.png",
        credits: ""
    },
    minesweeper: {
        title: "About Minesweeper",
        product: "Microsoft \u00ae Minesweeper",
        icon: "assets/app_minesweeper.png",
        credits: "by Robert Donner and Curt Johnson"
    },
    solitaire: {
        title: "About Solitaire",
        product: "Microsoft \u00ae Solitaire",
        icon: "assets/app_solitaire.png",
        credits: "Developed for Microsoft by Wes Cherry"
    }
};

// Handles modal dialogs and external link confirmation popups
export class DialogManager {
    constructor() {
        this.errorWin = null;
        this.linkWin = null;
        this.aboutIeWin = null;
        this.aboutWin = null;
        this.errorMessage = null;
        this.errorOkBtn = null;
        this.errorCloseHandler = null;

        this.linkIcon = null;
        this.linkMessage = null;
        this.linkVisitBtn = null;
        this.aboutIeOkBtn = null;
        this.aboutWinTitle = null;
        this.aboutWinIcon = null;
        this.aboutWinProduct = null;
        this.aboutWinCredits = null;
        this.aboutWinOkBtn = null;
        this.pendingLinkUrl = "";
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.initErrorDialog();
        this.initLinkDialog();
        this.initAboutIeDialog();
        this.initShellAboutDialog();
        this.initFrameLinkListener();
    }

    initModalDialog({ winId, windowElId, okBtnId, onClose = null }) {
        const windowEl = document.getElementById(windowElId);
        if (!windowEl) return { win: null, okBtn: null };

        const okBtn = document.getElementById(okBtnId);
        const win = new XPWindow({
            id: winId,
            winEl: windowEl,
            resizable: false,
            maximizable: false,
            showInTaskbar: false
        });
        win.onBlockedFocus = () => okBtn?.focus();
        if (onClose) win.onClose = onClose;

        okBtn?.addEventListener("click", () => win.close());
        windowEl.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                win.close();
            }
        });
        return { win, okBtn };
    }

    initErrorDialog() {
        this.errorMessage = document.getElementById("xp-error-message");
        const { win, okBtn } = this.initModalDialog({
            winId: "xp-error",
            windowElId: "xp-error-window",
            okBtnId: "xp-error-ok",
            onClose: (ownerId) => {
                const cb = this.errorCloseHandler;
                this.errorCloseHandler = null;
                cb?.(ownerId);
            }
        });
        this.errorWin = win;
        this.errorOkBtn = okBtn;
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

    initAboutIeDialog() {
        const { win, okBtn } = this.initModalDialog({
            winId: "xp-about-ie",
            windowElId: "xp-about-ie-window",
            okBtnId: "xp-about-ie-ok"
        });
        this.aboutIeWin = win;
        this.aboutIeOkBtn = okBtn;
    }

    initShellAboutDialog() {
        this.aboutWinTitle = document.getElementById("xp-about-win-title");
        this.aboutWinIcon = document.getElementById("xp-about-win-icon");
        this.aboutWinProduct = document.getElementById("xp-about-win-product");
        this.aboutWinCredits = document.getElementById("xp-about-win-credits");
        const { win, okBtn } = this.initModalDialog({
            winId: "xp-about-win",
            windowElId: "xp-about-win-window",
            okBtnId: "xp-about-win-ok"
        });
        this.aboutWin = win;
        this.aboutWinOkBtn = okBtn;
    }

    initFrameLinkListener() {
        window.addEventListener("message", (e) => {
            if (e.data?.type !== "xp-open-link") return;
            const isAllowedFrame = Array.from(
                document.querySelectorAll(".explorer-frame, .minesweeper-frame, .solitaire-frame")
            ).some((frame) => frame.contentWindow === e.source);
            if (!isAllowedFrame) return;

            openExternalUrl(
                e.data.href,
                typeof e.data.text === "string" ? e.data.text : ""
            );
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

    showAboutIe(ownerId) {
        this.init();
        if (!this.aboutIeWin) return;

        this.aboutIeWin.open({ ownerId });
        this.aboutIeWin.center();
        requestAnimationFrame(() => this.aboutIeOkBtn?.focus());
    }

    showShellAbout(appKey, ownerId) {
        this.init();
        const cfg = SHELL_ABOUT_APPS[appKey];
        if (!cfg || !this.aboutWin) return;

        this.aboutWin.setTitle(cfg.title);
        if (this.aboutWinTitle) this.aboutWinTitle.textContent = cfg.title;
        if (this.aboutWinProduct) this.aboutWinProduct.textContent = cfg.product;
        if (this.aboutWinIcon) {
            this.aboutWinIcon.hidden = !cfg.icon;
            this.aboutWinIcon.src = cfg.icon || "";
        }
        if (this.aboutWinCredits) {
            this.aboutWinCredits.hidden = !cfg.credits;
            this.aboutWinCredits.textContent = cfg.credits;
        }

        this.aboutWin.open({ ownerId });
        this.aboutWin.center();
        requestAnimationFrame(() => this.aboutWinOkBtn?.focus());
    }
}

const dialogManager = new DialogManager();

export function initDialogs() {
    dialogManager.init();
}

export function showAddressError(target, ownerId, onAfterClose) {
    dialogManager.showAddressError(target, ownerId, onAfterClose);
}

export function showAboutInternetExplorer(ownerId) {
    dialogManager.showAboutIe(ownerId);
}

export function showShellAbout(appKey, ownerId) {
    dialogManager.showShellAbout(appKey, ownerId);
}

export function openLinkDialog(targetOrKey) {
    dialogManager.openLink(targetOrKey);
}

export function openExternalUrl(href, label = "") {
    if (typeof href !== "string") return false;
    const cleanHref = href.trim();
    if (!/^(?:https?:\/\/|mailto:)/i.test(cleanHref)) return false;
    dialogManager.openLink(dialogManager.resolveLinkTarget(cleanHref, label.trim()));
    return true;
}
