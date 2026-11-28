import { registerDismissiblePopup } from './windowManager.js';

function stripMnemonic(label) {
    return String(label ?? "").replace(/&(.)/g, "$1");
}

function normalizeLegacyItems(rawItems = []) {
    return rawItems.map((item) => {
        if (typeof item === "string" || item?.type === "divider") {
            return { type: "divider" };
        }
        const disabled = typeof item.enabled === "function"
            ? () => !item.enabled()
            : item.enabled === false;

        const normalized = {
            label: stripMnemonic(item.label),
            shortcut: item.shortcutLabel || item.shortcut || "",
            disabled
        };

        if (Array.isArray(item.submenu)) {
            normalized.submenu = normalizeLegacyItems(item.submenu);
        } else if (item.checkbox) {
            normalized.checked = () => Boolean(item.checkbox.check?.());
            normalized.onClick = () => item.checkbox.toggle?.();
        } else if (typeof item.action === "function") {
            normalized.onClick = () => item.action();
        }
        return normalized;
    });
}

function normalizeMenuOptions(options) {
    if (!options || typeof options !== "object") {
        return { containerEl: null, menus: [], insertBeforeEl: undefined, brandLogo: null };
    }
    if (Array.isArray(options.menus) || "containerEl" in options) {
        return options;
    }
    const menus = Object.entries(options).map(([label, items]) => ({
        label: stripMnemonic(label),
        items: Array.isArray(items) ? normalizeLegacyItems(items) : items
    }));
    return { containerEl: null, menus, insertBeforeEl: undefined, brandLogo: null };
}

// Shared Windows XP classic top menu bar for app windows
export class MenuBar {
    constructor(options = {}) {
        const {
            containerEl,
            menus = [],
            insertBeforeEl,
            brandLogo = null
        } = normalizeMenuOptions(options);

        this.openIndex = -1;
        this.menuRecords = [];

        this.el = document.createElement("div");
        this.el.className = "xp-menubar";
        this.el.setAttribute("role", "menubar");
        this.el._xpMenuBar = this;
        this.element = this.el;

        menus.forEach((menuSpec, index) => {
            const wrapEl = document.createElement("div");
            wrapEl.className = "xp-menubar-item-wrap";

            const btnEl = document.createElement("button");
            btnEl.type = "button";
            btnEl.className = "xp-reset-btn xp-menubar-btn";
            btnEl.textContent = menuSpec.label;
            btnEl.setAttribute("aria-haspopup", "true");
            btnEl.setAttribute("aria-expanded", "false");

            const menuEl = document.createElement("div");
            menuEl.className = "xp-menubar-menu";
            menuEl.setAttribute("role", "menu");
            menuEl.hidden = true;

            const isDynamic = typeof menuSpec.items === "function";
            const itemRecords = isDynamic
                ? []
                : this.buildMenuItems(menuEl, menuSpec.items || []);

            btnEl.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.openIndex === index) {
                    this.close();
                } else {
                    this.open(index);
                }
            });

            btnEl.addEventListener("pointerenter", () => {
                if (this.openIndex !== -1 && this.openIndex !== index) {
                    this.open(index);
                }
            });

            wrapEl.append(btnEl, menuEl);
            this.el.appendChild(wrapEl);
            this.menuRecords.push({
                btnEl,
                menuEl,
                itemRecords,
                getItems: isDynamic ? menuSpec.items : null
            });
        });

        if (brandLogo) {
            const brandEl = document.createElement("div");
            brandEl.className = "xp-menubar-brand";
            brandEl.setAttribute("aria-hidden", "true");

            const logoEl = document.createElement("img");
            logoEl.className = "xp-menubar-brand-logo";
            logoEl.src = brandLogo;
            logoEl.alt = "";
            logoEl.draggable = false;

            brandEl.appendChild(logoEl);
            this.el.appendChild(brandEl);
        }

        if (containerEl) {
            const anchor = insertBeforeEl !== undefined
                ? insertBeforeEl
                : (containerEl.firstElementChild || null);
            containerEl.insertBefore(this.el, anchor);
        }

        this.unregisterDismiss = registerDismissiblePopup({
            isOpen: () => this.openIndex !== -1,
            containsTarget: (target) => Boolean(this.el.contains(target)),
            onClose: () => this.close(),
            capture: true
        });

        this.onWindowBlur = () => this.close();
        window.addEventListener?.("blur", this.onWindowBlur);
    }

    buildMenuItems(menuEl, items) {
        const records = [];
        const submenuEntries = [];

        for (const itemSpec of items) {
            if (itemSpec.type === "divider") {
                const dividerEl = document.createElement("div");
                dividerEl.className = "xp-menubar-divider";
                dividerEl.setAttribute("role", "separator");
                menuEl.appendChild(dividerEl);
                records.push({ itemSpec, itemEl: null });
                continue;
            }

            const hasSubmenu = Array.isArray(itemSpec.submenu) || Boolean(itemSpec.hasSubmenu);
            const itemEl = document.createElement("button");
            itemEl.type = "button";
            itemEl.className = itemSpec.icon
                ? "xp-reset-btn xp-menubar-item has-icon"
                : "xp-reset-btn xp-menubar-item";
            itemEl.setAttribute("role", "menuitem");
            if (typeof itemSpec.disabled === "boolean") {
                itemEl.disabled = itemSpec.disabled;
            }

            if (itemSpec.checked !== undefined) {
                const checkEl = document.createElement("span");
                checkEl.className = "xp-menubar-item-check";
                checkEl.setAttribute("aria-hidden", "true");
                checkEl.textContent = "\u2713";
                itemEl.appendChild(checkEl);
            }

            if (itemSpec.icon) {
                const iconEl = document.createElement("img");
                iconEl.className = "xp-menubar-item-icon";
                iconEl.src = itemSpec.icon;
                iconEl.alt = "";
                iconEl.draggable = false;
                itemEl.appendChild(iconEl);
            }

            const labelEl = document.createElement("span");
            labelEl.className = "xp-menubar-item-label";
            labelEl.textContent = itemSpec.label;
            itemEl.appendChild(labelEl);

            if (hasSubmenu) {
                const arrowEl = document.createElement("span");
                arrowEl.className = "xp-menubar-item-arrow";
                arrowEl.setAttribute("aria-hidden", "true");
                itemEl.appendChild(arrowEl);
            } else if (itemSpec.shortcut) {
                const shortcutEl = document.createElement("span");
                shortcutEl.className = "xp-menubar-item-shortcut";
                shortcutEl.textContent = itemSpec.shortcut;
                itemEl.appendChild(shortcutEl);
            }

            if (Array.isArray(itemSpec.submenu)) {
                const subWrapEl = document.createElement("div");
                subWrapEl.className = "xp-menubar-subwrap";

                const subMenuEl = document.createElement("div");
                subMenuEl.className = "xp-menubar-menu xp-menubar-submenu";
                subMenuEl.setAttribute("role", "menu");
                subMenuEl.hidden = true;

                const subRecords = this.buildMenuItems(subMenuEl, itemSpec.submenu);
                const subEntry = { itemEl, subMenuEl, subRecords };
                submenuEntries.push(subEntry);

                itemEl.setAttribute("aria-haspopup", "true");
                itemEl.setAttribute("aria-expanded", "false");

                const openSubmenu = () => {
                    this.closeSubmenus(submenuEntries);
                    if (itemEl.disabled) return;
                    this.syncItems(subRecords);
                    subMenuEl.hidden = false;
                    itemEl.setAttribute("aria-expanded", "true");
                };

                itemEl.addEventListener("pointerenter", openSubmenu);
                itemEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openSubmenu();
                });

                subWrapEl.append(itemEl, subMenuEl);
                menuEl.appendChild(subWrapEl);
                records.push({ itemSpec, itemEl, subRecords });
            } else {
                itemEl.addEventListener("pointerenter", () => {
                    this.closeSubmenus(submenuEntries);
                });
                itemEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (itemEl.disabled) return;
                    this.close();
                    itemSpec.onClick?.();
                });

                menuEl.appendChild(itemEl);
                records.push({ itemSpec, itemEl });
            }
        }

        return records;
    }

    isItemDisabled(itemSpec) {
        return typeof itemSpec.disabled === "function"
            ? Boolean(itemSpec.disabled())
            : Boolean(itemSpec.disabled);
    }

    isItemChecked(itemSpec) {
        return typeof itemSpec.checked === "function"
            ? Boolean(itemSpec.checked())
            : Boolean(itemSpec.checked);
    }

    closeSubmenus(entries) {
        for (const entry of entries) {
            entry.subMenuEl.hidden = true;
            entry.itemEl.setAttribute("aria-expanded", "false");
        }
    }

    syncItems(itemRecords) {
        for (const { itemSpec, itemEl, subRecords } of itemRecords) {
            if (!itemEl) continue;
            itemEl.disabled = this.isItemDisabled(itemSpec);
            if (itemSpec.checked !== undefined) {
                itemEl.classList.toggle("is-checked", this.isItemChecked(itemSpec));
            }
            if (subRecords) {
                this.syncItems(subRecords);
            }
        }
    }

    open(index) {
        if (index < 0 || index >= this.menuRecords.length) return;
        this.close();
        const record = this.menuRecords[index];
        if (record.getItems) {
            record.menuEl.innerHTML = "";
            record.itemRecords = this.buildMenuItems(record.menuEl, record.getItems() || []);
        }
        this.syncItems(record.itemRecords);
        record.menuEl.hidden = false;
        record.btnEl.setAttribute("aria-expanded", "true");
        this.openIndex = index;
    }

    close() {
        if (this.openIndex === -1) return;
        for (const { btnEl, menuEl } of this.menuRecords) {
            menuEl.hidden = true;
            btnEl.setAttribute("aria-expanded", "false");
            for (const subMenuEl of menuEl.querySelectorAll(".xp-menubar-submenu")) {
                subMenuEl.hidden = true;
            }
            for (const subTrigger of menuEl.querySelectorAll(".xp-menubar-item[aria-expanded]")) {
                subTrigger.setAttribute("aria-expanded", "false");
            }
        }
        this.openIndex = -1;
    }

    destroy() {
        this.close();
        this.unregisterDismiss?.();
        this.unregisterDismiss = null;
        if (this.onWindowBlur) {
            window.removeEventListener?.("blur", this.onWindowBlur);
            this.onWindowBlur = null;
        }
        if (this.el._xpMenuBar === this) {
            this.el._xpMenuBar = null;
        }
    }
}
