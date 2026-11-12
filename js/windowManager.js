const outline = document.getElementById("drag-outline");
const taskbarApps = document.getElementById("taskbar-apps");
const startMenu = document.getElementById("start-menu");

const windows = new Map();
let zIndexCounter = 10;
let dragState = null;

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

    const label = document.createElement("span");
    label.textContent = titleClone.textContent.trim();
    taskEl.appendChild(label);

    if (winEl.style.display === "none") {
        taskEl.style.display = "none";
    } else {
        taskEl.classList.add("active");
    }

    taskbarApps.appendChild(taskEl);
    return taskEl;
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

export function minimizeWindow(id) {
    const { winEl, taskEl } = windows.get(id);
    winEl.style.transformOrigin = "center center";
    winEl.style.transition = "transform 0.25s ease-in, opacity 0.25s ease-in";
    winEl.style.transform = getTaskbarTransform(winEl, taskEl);
    winEl.style.opacity = "0";

    setTimeout(() => {
        winEl.style.display = "none";
        winEl.style.transform = "none";
        winEl.style.opacity = "1";
        winEl.style.transition = "none";
        taskEl.classList.remove("active");
    }, 250);
}

export function restoreWindow(id) {
    const { winEl, taskEl } = windows.get(id);
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

    setTimeout(() => {
        winEl.style.transition = "none";
        winEl.style.transform = "none";
    }, 250);
}

export function openWindow(id) {
    const { winEl, taskEl } = windows.get(id);
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
    app.winEl.style.display = "none";
    app.taskEl.style.display = "none";
    app.taskEl.classList.remove("active");
    app.onClose?.();
}

export function registerWindow({ id, winEl, onClose, onBlur }) {
    const taskEl = createTaskbarItem(winEl);
    windows.set(id, { winEl, taskEl, onClose, onBlur });

    const titleBar = winEl.querySelector(".title-bar");
    const btnMin = winEl.querySelector('[aria-label="Minimize"]');
    const btnClose = winEl.querySelector('[aria-label="Close"]');

    winEl.addEventListener("pointerdown", () => bringToFront(id));
    btnMin?.addEventListener("click", () => minimizeWindow(id));
    btnClose?.addEventListener("click", () => closeWindow(id));

    titleBar.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".title-bar-controls")) return;
        bringToFront(id);

        const rect = winEl.getBoundingClientRect();
        dragState = {
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
    if (!dragState) return;
    outline.style.left = `${dragState.initialX + (e.clientX - dragState.startX)}px`;
    outline.style.top = `${dragState.initialY + (e.clientY - dragState.startY)}px`;
});

function endDrag() {
    if (!dragState) return;
    outline.style.display = "none";
    dragState.winEl.style.left = outline.style.left;
    dragState.winEl.style.top = outline.style.top;
    dragState.winEl.style.transform = "none";
    dragState = null;
}

document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);