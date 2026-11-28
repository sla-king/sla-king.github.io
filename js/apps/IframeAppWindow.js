import { XPWindow } from '../os/XPWindow.js';
import { openExternalUrl, showShellAbout } from '../os/DialogManager.js';

// Shared XP window wrapper for local iframe programs
export class IframeAppWindow extends XPWindow {
    constructor({ id, winEl, frameId, url, aboutKey = null, resizable = true, maximizable = true }) {
        super({ id, winEl, resizable, maximizable });
        this.frameEl = document.getElementById(frameId);
        this.appUrl = url;
        this.aboutKey = aboutKey;
        this.frameEl?.addEventListener("load", () => this.handleFrameLoad());
    }

    handleFrameLoad() {
        const cw = this.frameEl?.contentWindow;
        if (!cw || !this.frameEl?.getAttribute("src")) return;
        try {
            cw.close = () => this.close();
            cw.open = (href) => {
                openExternalUrl(href);
                return null;
            };
            if (this.aboutKey) {
                cw.showAboutDialog = () => showShellAbout(this.aboutKey, this.id);
            }
        } catch {
            // Ignore cross-origin restrictions
        }
        this.onFrameLoad(cw);
    }

    onFrameLoad() {}

    clearMenuBar() {
        for (const menuBarEl of this.winEl.querySelectorAll(".xp-menubar")) {
            menuBarEl._xpMenuBar?.destroy();
            menuBarEl.remove();
        }
    }

    onBlur() {
        this.winEl.querySelector(".xp-menubar")?._xpMenuBar?.close();
    }

    onClose() {
        this.clearMenuBar();
        this.frameEl?.removeAttribute("src");
    }

    launchGame() {
        if (this.frameEl && this.frameEl.getAttribute("src") !== this.appUrl) {
            this.clearMenuBar();
            this.frameEl.setAttribute("src", this.appUrl);
        }
        this.open();
    }
}
