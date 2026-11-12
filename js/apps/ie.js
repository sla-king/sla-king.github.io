import { registerWindow, openWindow } from '../windowManager.js';

export function initIE() {
    registerWindow({
        id: "ie",
        winEl: document.getElementById("ie-window")
    });
}

export function openIE() {
    openWindow("ie");
}