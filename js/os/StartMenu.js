import { SOUNDS, playSound } from './AudioMixer.js';
import { blurAllWindows, nextZIndex } from './windowManager.js';
import { ALL_PROGRAMS_ORDER, APP_ACTIONS, launchAppAction } from '../launcher.js';
import { getRecentDocuments, openNotepad } from '../apps/NotepadWindow.js';

const SUBMENU_DELAY_MS = 350;

// Handles the Start button, Start Menu, All Programs, and Recent Documents
export class StartMenu {
    constructor({ onBeforeOpen, onPowerAction } = {}) {
        this.onBeforeOpen = onBeforeOpen;
        this.onPowerAction = onPowerAction;

        this.startButton = document.getElementById("start-button");
        this.startMenu = document.getElementById("start-menu");
        this.recentMenuItem = document.querySelector('.menu-item[data-action="recent-documents"]');
        this.recentDocumentsMenu = document.getElementById("recent-documents-menu");
        this.allProgramsMenuItem = document.querySelector('.menu-item[data-action="all-programs"]');
        this.allProgramsMenu = document.getElementById("all-programs-menu");
        this.submenuTimers = new Map();
    }

    init() {
        if (!this.startButton || !this.startMenu) return;

        this.startButton.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            blurAllWindows();
            this.onBeforeOpen?.();
            const willShow = !this.startMenu.classList.contains("show");
            if (willShow) {
                this.renderRecentDocumentsMenu();
                this.startMenu.classList.add("show");
                this.startMenu.style.zIndex = nextZIndex();
            } else {
                this.close();
            }
        });

        this.startMenu.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            this.startMenu.style.zIndex = nextZIndex();
        });

        this.startMenu.addEventListener("pointerover", (e) => {
            const item = e.target.closest(".menu-item");
            if (item) {
                this.closeOtherSubmenus(item);
            }
        });

        this.renderAllProgramsMenu();
        this.setupSubmenu(this.recentMenuItem, this.recentDocumentsMenu);
        this.setupSubmenu(this.allProgramsMenuItem, this.allProgramsMenu);

        for (const action of Object.keys(APP_ACTIONS)) {
            this.startMenu
                .querySelector(`.menu-item[data-action="${action}"]`)
                ?.addEventListener("click", () => {
                    this.close();
                    launchAppAction(action);
                });
        }

        this.startMenu.querySelectorAll('.start-footer-btn[data-power-action]').forEach((btn) => {
            btn.addEventListener("click", () => {
                playSound(SOUNDS.MENU_COMMAND);
                this.onPowerAction?.(btn.dataset.powerAction);
            });
        });
    }

    containsTarget(target) {
        return Boolean(this.startMenu?.contains(target) || this.startButton?.contains(target));
    }

    closeOtherSubmenus(exceptEl = null) {
        for (const [el, timer] of this.submenuTimers.entries()) {
            if (el !== exceptEl) {
                clearTimeout(timer);
                this.submenuTimers.delete(el);
                el.classList.remove("submenu-open");
            }
        }
    }

    close() {
        this.closeOtherSubmenus(null);
        this.startMenu?.classList.remove("show");
    }

    createSubmenuEntry(labelText, iconSrc, tooltip, onClick) {
        const item = document.createElement("div");
        item.className = "start-submenu-item";
        if (tooltip) item.title = tooltip;

        const icon = document.createElement("img");
        icon.src = iconSrc;
        icon.className = "start-submenu-icon";
        icon.alt = "";

        const label = document.createElement("span");
        label.textContent = labelText;

        item.append(icon, label);
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            this.close();
            onClick();
        });
        return item;
    }

    renderAllProgramsMenu() {
        if (!this.allProgramsMenu) return;
        this.allProgramsMenu.innerHTML = "";
        for (const action of ALL_PROGRAMS_ORDER) {
            const app = APP_ACTIONS[action];
            if (!app) continue;
            const tooltip = this.startMenu
                ?.querySelector(`.menu-item[data-action="${action}"]`)
                ?.title || app.tooltip || "";
            this.allProgramsMenu.appendChild(
                this.createSubmenuEntry(app.name, app.icon, tooltip, () => launchAppAction(action))
            );
        }
    }

    renderRecentDocumentsMenu() {
        if (!this.recentDocumentsMenu) return;
        this.recentDocumentsMenu.innerHTML = "";
        const docs = getRecentDocuments();

        if (docs.length === 0) {
            const emptyItem = document.createElement("div");
            emptyItem.className = "start-submenu-empty";
            emptyItem.textContent = "(Empty)";
            emptyItem.title = "";
            this.recentDocumentsMenu.appendChild(emptyItem);
            return;
        }

        for (const doc of docs) {
            this.recentDocumentsMenu.appendChild(
                this.createSubmenuEntry(doc.displayName, "assets/file_text_doc_16.png", doc.filePath, () => {
                    playSound(SOUNDS.MENU_COMMAND);
                    openNotepad(doc.filename, doc.content, doc.filePath);
                })
            );
        }
    }

    setupSubmenu(menuItemEl, submenuEl) {
        if (!menuItemEl) return;

        menuItemEl.addEventListener("pointerenter", (e) => {
            clearTimeout(this.submenuTimers.get(menuItemEl));
            this.closeOtherSubmenus(menuItemEl);
            if (e.pointerType !== "touch" && !menuItemEl.classList.contains("submenu-open")) {
                const timer = setTimeout(() => {
                    menuItemEl.classList.add("submenu-open");
                }, SUBMENU_DELAY_MS);
                this.submenuTimers.set(menuItemEl, timer);
            }
        });

        menuItemEl.addEventListener("pointerleave", () => {
            clearTimeout(this.submenuTimers.get(menuItemEl));
            const timer = setTimeout(() => {
                menuItemEl.classList.remove("submenu-open");
            }, 250);
            this.submenuTimers.set(menuItemEl, timer);
        });

        menuItemEl.addEventListener("click", (e) => {
            if (submenuEl?.contains(e.target)) return;
            clearTimeout(this.submenuTimers.get(menuItemEl));
            this.closeOtherSubmenus(menuItemEl);
            menuItemEl.classList.toggle("submenu-open");
        });
    }
}
