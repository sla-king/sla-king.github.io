import { IframeAppWindow } from './IframeAppWindow.js';

const MINESWEEPER_ID = "minesweeper";
const MINESWEEPER_URL = "programs/minesweeper/index.html";

// Fixed-size Minesweeper window that auto-resizes to match selected difficulty
export class MinesweeperApp extends IframeAppWindow {
    constructor(winEl) {
        super({
            id: MINESWEEPER_ID,
            winEl,
            frameId: "minesweeper-frame",
            url: MINESWEEPER_URL,
            resizable: false,
            maximizable: false
        });

        if (this.frameEl) {
            // Upstream menus.js calls frameElement.$window.setDimensions on difficulty change
            this.frameEl.$window = {
                setDimensions: ({ innerWidth, innerHeight }) => {
                    this.resizeToContent(innerWidth, innerHeight);
                }
            };
        }
    }

    onFrameLoad(cw) {
        try {
            if (cw.document?.body) {
                cw.document.body.style.overflow = "hidden";
            }
            const game = cw.minesweeper_;
            if (game?.width && game?.height) {
                this.resizeToContent(24 + 16 * game.width, 64 + 16 * game.height);
            }
        } catch {
            // Ignore if unavailable
        }
    }

    onClose() {
        super.onClose();
        this.winEl.style.width = "";
        this.winEl.style.height = "";
    }

    resizeToContent(contentWidth, contentHeight) {
        if (!this.frameEl || !Number.isFinite(contentWidth) || !Number.isFinite(contentHeight)) {
            return;
        }
        let menuHeight = 0;
        try {
            const innerMenuEl = this.frameEl.contentDocument?.querySelector(".menus");
            if (innerMenuEl?.offsetHeight) {
                menuHeight = innerMenuEl.offsetHeight;
            } else if (!this.winEl.querySelector(".xp-menubar")) {
                menuHeight = 20;
            }
        } catch {
            if (!this.winEl.querySelector(".xp-menubar")) {
                menuHeight = 20;
            }
        }

        const chromeW = Math.max(6, this.winEl.offsetWidth - this.frameEl.clientWidth);
        const chromeH = Math.max(26, this.winEl.offsetHeight - this.frameEl.clientHeight);
        const nextW = Math.min(Math.round(contentWidth + 12 + chromeW), Math.max(180, window.innerWidth - 8));
        const nextH = Math.min(Math.round(contentHeight + menuHeight + 10 + chromeH), Math.max(180, window.innerHeight - 38));

        this.winEl.style.width = `${nextW}px`;
        this.winEl.style.height = `${nextH}px`;

        const rect = this.winEl.getBoundingClientRect();
        if (rect.left + nextW > window.innerWidth) {
            this.winEl.style.left = `${Math.max(0, window.innerWidth - nextW)}px`;
            this.winEl.style.transform = "none";
        }
        if (rect.top + nextH > window.innerHeight - 30) {
            this.winEl.style.top = `${Math.max(0, window.innerHeight - 30 - nextH)}px`;
            this.winEl.style.transform = "none";
        }
    }
}

let minesweeperInstance = null;

export function initMinesweeper() {
    if (minesweeperInstance) return minesweeperInstance;
    const winEl = document.getElementById("minesweeper-window");
    if (!winEl) return null;
    minesweeperInstance = new MinesweeperApp(winEl);
    return minesweeperInstance;
}

export function openMinesweeper() {
    const app = initMinesweeper();
    app?.launchGame();
}
