import { SOUNDS, playSound } from './AudioMixer.js';
import { blurAllWindows, closeAllWindows } from './windowManager.js';
import { resetMediaPlayerSession } from '../apps/MediaPlayerApp.js';

const POWER_DIALOGS = {
    logoff: {
        title: "Log Off Windows",
        options: [
            {
                action: "switch-user",
                label: "Switch User",
                icon: "assets/start_switch_user.png",
                disabled: false,
                tooltip: "Lets another user log on while your programs and files remain open."
            },
            {
                action: "logoff",
                label: "Log Off",
                icon: "assets/start_logoff.png",
                disabled: false,
                tooltip: "Closes your programs and ends your Windows session."
            }
        ]
    },
    turnoff: {
        title: "Turn off computer",
        options: [
            {
                action: "turnoff",
                label: "Turn Off",
                icon: "assets/start_turnoff.png",
                disabled: false,
                tooltip: "Shuts down Windows so that you can safely turn off the computer."
            },
            {
                action: "restart",
                label: "Restart",
                icon: "assets/start_restart.png",
                disabled: false,
                tooltip: "Shuts down Windows and then starts Windows again."
            }
        ]
    }
};

// Handles Log Off, Switch User, Shut Down, Restart, and the welcome/boot screens
export class PowerSessionManager {
    constructor({ onDismissOverlays } = {}) {
        this.onDismissOverlays = onDismissOverlays;

        this.powerBackdrop = document.getElementById("xp-power-backdrop");
        this.powerTitle = document.getElementById("xp-power-title");
        this.powerOptions = document.getElementById("xp-power-options");
        this.powerCancelBtn = document.getElementById("xp-power-cancel");
        this.powerBalloon = document.getElementById("xp-power-balloon");
        this.powerBalloonTitle = document.getElementById("xp-power-balloon-title");
        this.powerBalloonBody = document.getElementById("xp-power-balloon-body");

        this.systemScreen = document.getElementById("xp-system-screen");
        this.switchFadeView = document.getElementById("xp-switch-fade-view");
        this.statusView = document.getElementById("xp-status-view");
        this.statusText = document.getElementById("xp-status-text");
        this.logonView = document.getElementById("xp-logon-view");
        this.logonUserBtn = document.getElementById("xp-logon-user");
        this.logonStatusEl = document.getElementById("xp-logon-status");
        this.logonTurnOffBtn = document.getElementById("xp-logon-turnoff");
        this.bootView = document.getElementById("xp-boot-view");
        this.poweroffView = document.getElementById("xp-poweroff-view");
        this.powerOnBtn = document.getElementById("xp-poweron-btn");

        this.systemTimers = [];
        this.powerBalloonTimer = null;
        this.isSwitchedUserSession = false;
        this.isLoggingOn = false;
    }

    init() {
        this.powerBackdrop?.addEventListener("pointerdown", (e) => e.stopPropagation());
        this.powerCancelBtn?.addEventListener("click", () => this.closeDialog());
        this.logonUserBtn?.addEventListener("click", () => this.runLogOn());
        this.logonTurnOffBtn?.addEventListener("click", () => this.openDialog("turnoff"));
        this.powerOnBtn?.addEventListener("click", () => this.runBootSequence());
        this.systemScreen?.addEventListener("pointerdown", (e) => e.stopPropagation());
    }

    isDialogOpen() {
        return Boolean(this.powerBackdrop?.classList.contains("show"));
    }

    clearSystemTimers() {
        for (const timer of this.systemTimers) {
            clearTimeout(timer);
        }
        this.systemTimers = [];
    }

    scheduleStep(delayMs, fn) {
        const timer = setTimeout(fn, delayMs);
        this.systemTimers.push(timer);
    }

    showSystemView(activeView, message = "", { welcomeOnly = false } = {}) {
        if (!this.systemScreen) return;
        for (const view of [this.switchFadeView, this.statusView, this.logonView, this.bootView, this.poweroffView]) {
            if (view) view.hidden = view !== activeView;
        }
        this.systemScreen.classList.toggle("xp-fade-transition", activeView === this.switchFadeView);
        if (this.statusView) {
            this.statusView.classList.toggle("xp-welcome-mode", activeView === this.statusView && welcomeOnly);
        }
        if (this.statusText && activeView === this.statusView) {
            this.statusText.textContent = message;
        }
        this.systemScreen.hidden = false;
    }

    hideSystemScreen() {
        this.clearSystemTimers();
        document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
        if (!this.systemScreen) return;
        this.systemScreen.classList.remove("xp-fade-transition");
        this.systemScreen.hidden = true;
        for (const view of [this.switchFadeView, this.statusView, this.logonView, this.bootView, this.poweroffView]) {
            if (view) view.hidden = true;
        }
    }

    teardownUserSession() {
        document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
        this.closeDialog();
        this.onDismissOverlays?.();
        resetMediaPlayerSession();
        closeAllWindows();
    }

    setLogonStatus(message = "") {
        if (this.logonStatusEl) {
            this.logonStatusEl.textContent = message;
        }
    }

    runBootSequence() {
        this.clearSystemTimers();
        document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
        this.isSwitchedUserSession = false;
        this.isLoggingOn = false;
        this.setLogonStatus("");
        this.showSystemView(this.bootView);
        this.scheduleStep(7000, () => {
            this.showSystemView(this.statusView, "welcome", { welcomeOnly: true });
        });
        this.scheduleStep(9000, () => {
            this.hideSystemScreen();
            playSound(SOUNDS.STARTUP);
        });
    }

    runSwitchUser() {
        this.clearSystemTimers();
        this.closeDialog();
        this.onDismissOverlays?.();
        blurAllWindows();
        this.isSwitchedUserSession = true;
        this.isLoggingOn = false;
        this.setLogonStatus("Logged on");
        document.body.classList.add("xp-session-closing", "xp-wallpaper-only");
        this.scheduleStep(200, () => {
            playSound(SOUNDS.LOGOFF);
            this.showSystemView(this.switchFadeView);
        });
        this.scheduleStep(650, () => {
            document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
            this.showSystemView(this.logonView);
        });
    }

    runLogOff() {
        this.clearSystemTimers();
        this.teardownUserSession();
        this.isSwitchedUserSession = false;
        this.isLoggingOn = false;
        this.setLogonStatus("");
        document.body.classList.add("xp-session-closing");

        this.scheduleStep(1000, () => {
            document.body.classList.add("xp-wallpaper-only");
        });
        this.scheduleStep(2000, () => {
            document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
            playSound(SOUNDS.SHUTDOWN);
            this.showSystemView(this.statusView, "Logging off...");
        });
        this.scheduleStep(7000, () => {
            this.showSystemView(this.statusView, "Saving your settings...");
        });
        this.scheduleStep(7100, () => {
            this.showSystemView(this.logonView);
        });
    }

    runLogOn() {
        if (this.isLoggingOn) return;
        this.clearSystemTimers();

        if (this.isSwitchedUserSession) {
            this.isSwitchedUserSession = false;
            this.isLoggingOn = false;
            this.setLogonStatus("");
            this.hideSystemScreen();
            this.scheduleStep(500, () => {
                playSound(SOUNDS.LOGON);
            });
            return;
        }

        this.isLoggingOn = true;
        this.setLogonStatus("Loading your personal settings...");
        this.scheduleStep(800, () => {
            this.isLoggingOn = false;
            this.setLogonStatus("");
            this.hideSystemScreen();
            playSound(SOUNDS.STARTUP);
        });
    }

    runShutdownFlow({ restart = false } = {}) {
        const fromLogonScreen = Boolean(
            this.systemScreen && !this.systemScreen.hidden && this.logonView && !this.logonView.hidden
        );
        const needsLogoffSteps = !fromLogonScreen || this.isSwitchedUserSession;

        this.clearSystemTimers();
        this.teardownUserSession();
        this.isSwitchedUserSession = false;
        this.isLoggingOn = false;
        this.setLogonStatus("");

        let offset = 0;
        if (!needsLogoffSteps) {
            playSound(SOUNDS.SHUTDOWN);
            this.showSystemView(this.statusView, "Windows is shutting down...");
        } else {
            if (!fromLogonScreen) {
                this.hideSystemScreen();
                document.body.classList.add("xp-session-closing");
                this.scheduleStep(1000, () => {
                    document.body.classList.add("xp-wallpaper-only");
                });
                offset = 2000;
            }
            this.scheduleStep(offset, () => {
                document.body.classList.remove("xp-session-closing", "xp-wallpaper-only");
                playSound(SOUNDS.SHUTDOWN);
                this.showSystemView(this.statusView, "Logging off...");
            });
            offset += 4000;
            this.scheduleStep(offset, () => {
                this.showSystemView(this.statusView, "Saving your settings...");
            });
            offset += 100;
            this.scheduleStep(offset, () => {
                this.showSystemView(this.statusView, "Windows is shutting down...");
            });
        }

        this.scheduleStep(offset + 7000, () => {
            this.showSystemView(null);
        });
        this.scheduleStep(offset + 11000, () => {
            if (restart) {
                this.runBootSequence();
            } else {
                this.showSystemView(this.poweroffView);
            }
        });
    }

    executeAction(action) {
        if (action === "logoff") {
            this.runLogOff();
        } else if (action === "switch-user") {
            this.runSwitchUser();
        } else if (action === "turnoff") {
            this.runShutdownFlow({ restart: false });
        } else if (action === "restart") {
            this.runShutdownFlow({ restart: true });
        }
    }

    hideBalloon() {
        clearTimeout(this.powerBalloonTimer);
        this.powerBalloonTimer = null;
        if (this.powerBalloon) {
            this.powerBalloon.hidden = true;
        }
    }

    showBalloon(btn, option) {
        if (!this.powerBalloon || !this.powerBalloonTitle || !this.powerBalloonBody || !option.tooltip) return;
        this.powerBalloonTitle.textContent = option.label;
        this.powerBalloonBody.textContent = option.tooltip;
        this.powerBalloon.hidden = false;

        const iconEl = btn.querySelector(".xp-power-option-icon") || btn;
        const anchorRect = iconEl.getBoundingClientRect();
        const balloonWidth = this.powerBalloon.offsetWidth || 240;
        const left = Math.max(
            6,
            Math.min(anchorRect.left + anchorRect.width / 2 - 16, window.innerWidth - balloonWidth - 6)
        );
        const top = Math.min(anchorRect.bottom + 14, window.innerHeight - this.powerBalloon.offsetHeight - 6);
        this.powerBalloon.style.left = `${Math.round(left)}px`;
        this.powerBalloon.style.top = `${Math.round(top)}px`;
    }

    closeDialog() {
        this.hideBalloon();
        if (!this.powerBackdrop) return;
        this.powerBackdrop.classList.remove("desaturated", "show");
        this.powerBackdrop.hidden = true;
    }

    openDialog(mode) {
        const config = POWER_DIALOGS[mode];
        if (!config || !this.powerBackdrop || !this.powerTitle || !this.powerOptions) return;

        this.hideBalloon();
        this.onDismissOverlays?.();
        blurAllWindows();
        this.powerTitle.textContent = config.title;
        this.powerOptions.innerHTML = "";

        for (const option of config.options) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "xp-reset-btn xp-power-option";
            btn.disabled = Boolean(option.disabled);

            const icon = document.createElement("img");
            icon.className = "xp-power-option-icon";
            icon.src = option.icon;
            icon.alt = "";

            const label = document.createElement("span");
            label.className = "xp-power-option-label";
            label.textContent = option.label;

            btn.append(icon, label);
            if (!option.disabled) {
                btn.addEventListener("click", () => {
                    this.hideBalloon();
                    this.executeAction(option.action);
                });
                btn.addEventListener("pointerenter", () => {
                    clearTimeout(this.powerBalloonTimer);
                    this.powerBalloonTimer = setTimeout(() => {
                        this.showBalloon(btn, option);
                    }, 280);
                });
                btn.addEventListener("pointerleave", () => this.hideBalloon());
            }
            this.powerOptions.appendChild(btn);
        }

        this.powerBackdrop.classList.remove("desaturated");
        this.powerBackdrop.hidden = false;
        this.powerBackdrop.classList.add("show");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.powerBackdrop.classList.contains("show")) {
                    this.powerBackdrop.classList.add("desaturated");
                }
            });
        });
        this.powerCancelBtn?.focus();
    }
}
