import { IframeAppWindow } from './IframeAppWindow.js';

const SOLITAIRE_ID = "solitaire";
const SOLITAIRE_URL = "programs/js-solitaire/index.html";

// Solitaire card game window
export class SolitaireApp extends IframeAppWindow {
    constructor(winEl) {
        super({
            id: SOLITAIRE_ID,
            winEl,
            frameId: "solitaire-frame",
            url: SOLITAIRE_URL
        });
    }
}

let solitaireInstance = null;

export function initSolitaire() {
    if (solitaireInstance) return solitaireInstance;
    const winEl = document.getElementById("solitaire-window");
    if (!winEl) return null;
    solitaireInstance = new SolitaireApp(winEl);
    return solitaireInstance;
}

export function openSolitaire() {
    const app = initSolitaire();
    app?.launchGame();
}
