import { SOUNDS, audioMixer, playSound } from './AudioMixer.js';
import { blurAllWindows, registerDismissiblePopup } from './windowManager.js';

// Handles the taskbar volume icon and popup slider
export class TrayVolume {
    constructor({ onBeforeOpen } = {}) {
        this.onBeforeOpen = onBeforeOpen;
        this.trayBtn = document.getElementById("tray-volume-btn");
        this.trayIcon = this.trayBtn?.querySelector(".tray-icon");
        this.popup = document.getElementById("xp-volume-popup");
        this.slider = document.getElementById("xp-volume-slider");
        this.muteCheckbox = document.getElementById("xp-volume-mute");
    }

    init() {
        audioMixer.subscribe((state) => this.syncUI(state));

        this.trayBtn?.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            blurAllWindows();
            if (this.popup?.hidden) {
                this.open();
            } else {
                this.close();
            }
        });

        this.popup?.addEventListener("pointerdown", (e) => e.stopPropagation());

        this.slider?.addEventListener("input", () => {
            const volume = Math.max(0, Math.min(1, Number(this.slider.value) || 0));
            audioMixer.setState({ volume });
        });

        this.slider?.addEventListener("change", () => {
            playSound(SOUNDS.DING);
        });

        this.muteCheckbox?.addEventListener("change", () => {
            audioMixer.setState({ muted: Boolean(this.muteCheckbox.checked) });
        });

        registerDismissiblePopup({
            isOpen: () => Boolean(this.popup && !this.popup.hidden),
            containsTarget: (target) => this.containsTarget(target),
            onClose: () => this.close(),
            capture: true
        });
    }

    isOpen() {
        return Boolean(this.popup && !this.popup.hidden);
    }

    containsTarget(target) {
        return Boolean(this.popup?.contains(target) || this.trayBtn?.contains(target));
    }

    syncUI({ volume, muted, effectivelyMuted }) {
        if (this.slider) {
            this.slider.value = String(volume);
        }
        if (this.muteCheckbox) {
            this.muteCheckbox.checked = muted;
        }
        if (this.trayIcon) {
            this.trayIcon.src = effectivelyMuted
                ? "assets/start_volume_muted.png"
                : "assets/start_volume.png";
        }
        if (this.trayBtn) {
            this.trayBtn.title = effectivelyMuted ? "Volume (Muted)" : "Volume";
        }
    }

    open() {
        if (!this.popup || !this.trayBtn) return;
        this.onBeforeOpen?.();
        this.syncUI(audioMixer.getState());
        this.popup.hidden = false;
        this.trayBtn.classList.add("active");
        this.trayBtn.setAttribute("aria-expanded", "true");

        const btnRect = this.trayBtn.getBoundingClientRect();
        const popupWidth = this.popup.offsetWidth || 92;
        const left = Math.max(
            4,
            Math.min(btnRect.left + (btnRect.width - popupWidth) / 2, window.innerWidth - popupWidth - 4)
        );
        this.popup.style.left = `${Math.round(left)}px`;
        this.popup.style.right = "auto";
        this.slider?.focus({ preventScroll: true });
    }

    close() {
        if (!this.popup) return;
        this.popup.hidden = true;
        this.trayBtn?.classList.remove("active");
        this.trayBtn?.setAttribute("aria-expanded", "false");
    }
}
