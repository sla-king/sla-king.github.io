import { XPWindow } from '../os/XPWindow.js';
import { openExternalUrl } from '../os/DialogManager.js';

// Shared XP window wrapper for local iframe programs
export class IframeAppWindow extends XPWindow {
    constructor({ id, winEl, frameId, url, resizable = true, maximizable = true }) {
        super({ id, winEl, resizable, maximizable });
        this.frameEl = document.getElementById(frameId);
        this.appUrl = url;
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
        } catch {
            // Ignore cross-origin restrictions
        }
        this.onFrameLoad(cw);
    }

    onFrameLoad() {}

    onClose() {
        this.frameEl?.removeAttribute("src");
    }

    launchGame() {
        if (this.frameEl && this.frameEl.getAttribute("src") !== this.appUrl) {
            this.frameEl.setAttribute("src", this.appUrl);
        }
        this.open();
    }
}
