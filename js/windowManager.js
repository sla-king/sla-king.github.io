const outline = document.getElementById("drag-outline");
const taskbarApps = document.getElementById("taskbar-apps");
const startMenu = document.getElementById("start-menu");

const windows = new Map();
let zIndexCounter = 10;
let dragState = null;
let resizeState = null;

const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;
const RESIZE_DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function clampToScreen(winEl) {
    const rect = winEl.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - winEl.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - winEl.offsetHeight - 30);
    winEl.style.left = `${Math.max(0, Math.min(rect.left, maxX))}px`;
    winEl.style.top = `${Math.max(0, Math.min(rect.top, maxY))}px`;
}

function getTaskbarTransform(winEl, taskEl) {
    const winRect = winEl.getBoundingClientRect();
    const taskRect = taskEl.getBoundingClientRect();
    const scale = taskRect.width / winRect.width;
    const deltaX = (taskRect.left + taskRect.width / 2) - (winRect.left + winRect.width / 2);
    const deltaY = (taskRect.top + taskRect.height / 2) - (winRect.top + winRect.height / 2);
    return `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
}

function getDefaultRestoreRect(winEl) {
    const styles = getComputedStyle(winEl);
    const cssW = parseInt(styles.getPropertyValue("--win-w")) || 680;
    const cssH = parseInt(styles.getPropertyValue("--win-h")) || 390;
    const width = Math.min(cssW, window.innerWidth * 0.95);
    const height = Math.min(cssH, window.innerHeight - 60);
    return {
        width,
        height,
        left: Math.max(0, (window.innerWidth - width) / 2),
        top: Math.max(0, (window.innerHeight - 30 - height) / 2)
    };
}

function createTaskbarItem(winEl) {
    const titleBarText = winEl.querySelector(".title-bar-text");
    const iconEl = titleBarText.querySelector(".window-icon");

    const taskEl = document.createElement("div");
    taskEl.className = "taskbar-item";

    if (iconEl) {
        const taskIcon = iconEl.cloneNode(true);
        taskIcon.classList.replace("window-icon", "taskbar-icon");
        taskEl.appendChild(taskIcon);
    }

    const titleClone = titleBarText.cloneNode(true);
    titleClone.querySelector(".window-icon")?.remove();

    const taskLabel = document.createElement("span");
    taskLabel.textContent = titleClone.textContent.trim();
    taskEl.appendChild(taskLabel);

    if (winEl.style.display === "none") {
        taskEl.style.display = "none";
    } else {
        taskEl.classList.add("active");
    }

    taskbarApps.appendChild(taskEl);
    return { taskEl, taskLabel };
}

export function setWindowTitle(id, title) {
    const app = windows.get(id);
    if (!app) return;

    const titleBarText = app.winEl.querySelector(".title-bar-text");
    const iconEl = titleBarText.querySelector(".window-icon");

    titleBarText.textContent = "";
    if (iconEl) titleBarText.appendChild(iconEl);
    titleBarText.append(title);

    app.taskLabel.textContent = title;
}

export function nextZIndex() {
    return ++zIndexCounter;
}

export function bringToFront(id) {
    windows.forEach((app, appId) => {
        const isTarget = appId === id;
        app.winEl.classList.toggle("unfocused", !isTarget);
        app.taskEl.classList.toggle("active", isTarget);
        if (isTarget) {
            app.winEl.style.zIndex = ++zIndexCounter;
        } else {
            app.onBlur?.();
        }
    });
}

export function blurAllWindows() {
    windows.forEach((app) => {
        app.winEl.classList.add("unfocused");
        app.taskEl.classList.remove("active");
        app.onBlur?.();
    });
}

export function isClickInsideAnyWindow(target) {
    for (const { winEl } of windows.values()) {
        if (winEl.contains(target)) return true;
    }
    return false;
}

export function toggleMaximize(id) {
    const app = windows.get(id);
    if (!app) return;

    const { winEl, btnMax } = app;
    clearTimeout(app.animTimer);

    const currentRect = winEl.getBoundingClientRect();
    Object.assign(winEl.style, {
        transition: "none",
        left: `${currentRect.left}px`,
        top: `${currentRect.top}px`,
        width: `${currentRect.width}px`,
        height: `${currentRect.height}px`
    });
    void winEl.offsetHeight;

    const isMaximizing = !winEl.classList.contains("maximized");
    winEl.classList.toggle("maximized", isMaximizing);
    btnMax?.setAttribute("aria-label", isMaximizing ? "Restore" : "Maximize");

    winEl.style.transition = "left 0.2s ease-out, top 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out";

    if (isMaximizing) {
        app.savedRect = {
            left: currentRect.left,
            top: currentRect.top,
            width: currentRect.width,
            height: currentRect.height
        };
        Object.assign(winEl.style, {
            left: "0px",
            top: "0px",
            width: "100vw",
            height: "calc(100dvh - 30px)"
        });
    } else {
        const target = app.savedRect || getDefaultRestoreRect(winEl);
        Object.assign(winEl.style, {
            left: `${target.left}px`,
            top: `${target.top}px`,
            width: `${target.width}px`,
            height: `${target.height}px`
        });
    }

    app.animTimer = setTimeout(() => {
        winEl.style.transition = "none";
    }, 200);

    bringToFront(id);
}

export function minimizeWindow(id) {
    const app = windows.get(id);
    const { winEl, taskEl } = app;
    clearTimeout(app.animTimer);

    winEl.style.transformOrigin = "center center";
    winEl.style.transition = "transform 0.25s ease-in, opacity 0.25s ease-in";
    winEl.style.transform = getTaskbarTransform(winEl, taskEl);
    winEl.style.opacity = "0";

    app.animTimer = setTimeout(() => {
        winEl.style.display = "none";
        winEl.style.transform = "none";
        winEl.style.opacity = "1";
        winEl.style.transition = "none";
        taskEl.classList.remove("active");
    }, 250);
}

export function restoreWindow(id) {
    const app = windows.get(id);
    const { winEl, taskEl } = app;
    clearTimeout(app.animTimer);

    winEl.style.display = "block";
    winEl.style.transform = "none";
    winEl.style.opacity = "1";
    winEl.style.transition = "none";
    clampToScreen(winEl);

    winEl.style.opacity = "0";
    winEl.style.transformOrigin = "center center";
    winEl.style.transform = getTaskbarTransform(winEl, taskEl);
    void winEl.offsetHeight;

    winEl.style.transition = "transform 0.25s ease-out, opacity 0.25s ease-out";
    winEl.style.transform = "translate(0, 0) scale(1)";
    winEl.style.opacity = "1";

    app.animTimer = setTimeout(() => {
        winEl.style.transition = "none";
        winEl.style.transform = "none";
    }, 250);
}

export function openWindow(id) {
    const app = windows.get(id);
    const { winEl, taskEl } = app;
    clearTimeout(app.animTimer);

    winEl.style.transition = "none";
    winEl.style.transform = "none";
    winEl.style.opacity = "1";
    winEl.style.display = "block";
    clampToScreen(winEl);

    if (taskEl.style.display === "none") {
        taskbarApps.appendChild(taskEl);
        taskEl.style.display = "flex";
        taskEl.classList.remove("slide-in");
        void taskEl.offsetWidth;
        taskEl.classList.add("slide-in");
    }
    bringToFront(id);
}

export function closeWindow(id) {
    const app = windows.get(id);
    clearTimeout(app.animTimer);
    app.winEl.style.display = "none";
    app.taskEl.style.display = "none";
    app.taskEl.classList.remove("active");
    app.onClose?.();
}

export function registerWindow({ id, winEl, onClose, onBlur }) {
    const { taskEl, taskLabel } = createTaskbarItem(winEl);
    const titleBar = winEl.querySelector(".title-bar");
    const btnMin = winEl.querySelector('[aria-label="Minimize"]');
    const btnMax = winEl.querySelector('[aria-label="Maximize"], [aria-label="Restore"]');
    const btnClose = winEl.querySelector('[aria-label="Close"]');

    if (btnMax) {
        btnMax.setAttribute("aria-label", winEl.classList.contains("maximized") ? "Restore" : "Maximize");
    }

    windows.set(id, {
        winEl,
        taskEl,
        taskLabel,
        btnMax,
        onClose,
        onBlur,
        animTimer: null,
        savedRect: null
    });

    winEl.addEventListener("pointerdown", () => bringToFront(id));
    btnMin?.addEventListener("click", () => minimizeWindow(id));
    btnMax?.addEventListener("click", () => toggleMaximize(id));
    btnClose?.addEventListener("click", () => closeWindow(id));

    titleBar.addEventListener("dblclick", (e) => {
        if (e.target.closest(".title-bar-controls")) return;
        toggleMaximize(id);
    });

    titleBar.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".title-bar-controls")) return;
        bringToFront(id);
        titleBar.setPointerCapture(e.pointerId);

        const rect = winEl.getBoundingClientRect();
        dragState = {
            id,
            winEl,
            startX: e.clientX,
            startY: e.clientY,
            initialX: rect.left,
            initialY: rect.top
        };

        Object.assign(outline.style, {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            display: "block"
        });
        e.preventDefault();
    });

    // Inject 8-directional resize handles
    for (const dir of RESIZE_DIRS) {
        const handle = document.createElement("div");
        handle.className = `resize-handle resize-${dir}`;
        handle.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            bringToFront(id);
            handle.setPointerCapture(e.pointerId);

            const rect = winEl.getBoundingClientRect();
            resizeState = {
                id,
                winEl,
                dir,
                startX: e.clientX,
                startY: e.clientY,
                startRect: rect
            };

            Object.assign(outline.style, {
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                display: "block"
            });
        });
        winEl.appendChild(handle);
    }

    taskEl.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        startMenu.classList.remove("show");
        if (winEl.style.display === "none") {
            restoreWindow(id);
            bringToFront(id);
        } else if (!taskEl.classList.contains("active")) {
            bringToFront(id);
        } else {
            minimizeWindow(id);
        }
    });
}

document.addEventListener("pointermove", (e) => {
    if (dragState) {
        outline.style.left = `${dragState.initialX + (e.clientX - dragState.startX)}px`;
        outline.style.top = `${dragState.initialY + (e.clientY - dragState.startY)}px`;
        return;
    }

    if (resizeState) {
        const { dir, startX, startY, startRect } = resizeState;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const maxBottom = window.innerHeight - 30;

        let left = startRect.left;
        let top = startRect.top;
        let width = startRect.width;
        let height = startRect.height;

        if (dir.includes("e")) {
            width = Math.max(MIN_WIDTH, Math.min(startRect.width + dx, window.innerWidth - left));
        }
        if (dir.includes("s")) {
            height = Math.max(MIN_HEIGHT, Math.min(startRect.height + dy, maxBottom - top));
        }
        if (dir.includes("w")) {
            left = Math.max(0, Math.min(startRect.left + dx, startRect.right - MIN_WIDTH));
            width = startRect.right - left;
        }
        if (dir.includes("n")) {
            top = Math.max(0, Math.min(startRect.top + dy, startRect.bottom - MIN_HEIGHT));
            height = startRect.bottom - top;
        }

        Object.assign(outline.style, {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`
        });
    }
});

function endPointerInteraction() {
    if (dragState) {
        outline.style.display = "none";
        dragState.winEl.style.transition = "none";
        dragState.winEl.style.left = outline.style.left;
        dragState.winEl.style.top = outline.style.top;
        dragState.winEl.style.transform = "none";
        dragState = null;
    }

    if (resizeState) {
        const app = windows.get(resizeState.id);
        outline.style.display = "none";
        resizeState.winEl.classList.remove("maximized");
        app?.btnMax?.setAttribute("aria-label", "Maximize");

        Object.assign(resizeState.winEl.style, {
            transition: "none",
            left: outline.style.left,
            top: outline.style.top,
            width: outline.style.width,
            height: outline.style.height,
            transform: "none"
        });
        resizeState = null;
    }
}

document.addEventListener("pointerup", endPointerInteraction);
document.addEventListener("pointercancel", endPointerInteraction);