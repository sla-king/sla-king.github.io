import { initTerminal } from './terminal.js';
import { fs, getNode } from './filesystem.js';

const outline = document.getElementById("drag-outline");
const clock = document.getElementById("clock");
const startButton = document.getElementById("start-button");
const startMenu = document.getElementById("start-menu");
const cmdInput = document.getElementById("cmd-input");

const termWin = document.getElementById("draggable-window");
const termTitleBar = document.getElementById("title-bar");
const btnMinimize = document.getElementById("btn-minimize");
const btnClose = document.getElementById("btn-close");
const taskbarTerm = document.getElementById("taskbar-app");

const explWin = document.getElementById("explorer-window");
const explTitleBar = document.getElementById("explorer-title-bar");
const explBtnMinimize = document.getElementById("explorer-btn-minimize");
const explBtnClose = document.getElementById("explorer-btn-close");
const taskbarExpl = document.getElementById("taskbar-explorer");
const explBody = document.getElementById("explorer-body");

const noteWin = document.getElementById("notepad-window");
const noteTitleBar = document.getElementById("notepad-title-bar");
const noteBtnMinimize = document.getElementById("notepad-btn-minimize");
const noteBtnClose = document.getElementById("notepad-btn-close");
const taskbarNote = document.getElementById("taskbar-notepad");
const noteTitleText = document.getElementById("notepad-title-text");
const noteTextarea = document.getElementById("notepad-textarea");

const taskbarApps = document.getElementById("taskbar-apps");

let zIndexCounter = 10;
let explPath = ["C:", "Documents and Settings", "sla-king", "My Documents"];

let isDragging = false;
let dragTarget = null;
let startX, startY, initialX, initialY;

function bringToFront(winElement, taskbarElement) {
    winElement.style.zIndex = ++zIndexCounter;
    winElement.classList.remove("unfocused");
    taskbarElement.classList.add("active");
    
    if (winElement !== termWin) { termWin.classList.add("unfocused"); taskbarTerm.classList.remove("active"); }
    if (winElement !== explWin) { explWin.classList.add("unfocused"); taskbarExpl.classList.remove("active"); }
    if (winElement !== noteWin) { noteWin.classList.add("unfocused"); taskbarNote.classList.remove("active"); }
}

function blurAllWindows() {
    termWin.classList.add("unfocused"); taskbarTerm.classList.remove("active");
    explWin.classList.add("unfocused"); taskbarExpl.classList.remove("active");
    noteWin.classList.add("unfocused"); taskbarNote.classList.remove("active");
    cmdInput.blur();
}

function startDrag(e, winElement, taskbarElement) {
    if (e.target.closest('.title-bar-controls')) return;
    bringToFront(winElement, taskbarElement);
    
    isDragging = true;
    dragTarget = winElement;
    
    const rect = winElement.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    initialX = rect.left;
    initialY = rect.top;
    
    outline.style.width = rect.width + "px";
    outline.style.height = rect.height + "px";
    outline.style.left = initialX + "px";
    outline.style.top = initialY + "px";
    outline.style.display = "block";
    
    e.preventDefault();
}

document.addEventListener("pointermove", (e) => {
    if (!isDragging || !dragTarget) return;
    
    let newX = initialX + (e.clientX - startX);
    let newY = initialY + (e.clientY - startY);
    
    outline.style.left = newX + "px";
    outline.style.top = newY + "px";
});

function endDrag() {
    if (!isDragging || !dragTarget) return;
    isDragging = false;
    
    outline.style.display = "none";
    
    const finalX = parseInt(outline.style.left);
    const finalY = parseInt(outline.style.top);
    
    dragTarget.style.left = finalX + "px";
    dragTarget.style.top = finalY + "px";
    dragTarget.style.transform = "none";
    
    dragTarget = null;
}

document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

termTitleBar.addEventListener("pointerdown", (e) => startDrag(e, termWin, taskbarTerm));
explTitleBar.addEventListener("pointerdown", (e) => startDrag(e, explWin, taskbarExpl));
noteTitleBar.addEventListener("pointerdown", (e) => startDrag(e, noteWin, taskbarNote));

function minimizeToTaskbar(winElement, taskbarElement) {
    const currentRect = winElement.getBoundingClientRect();
    const taskRect = taskbarElement.getBoundingClientRect();
    const scale = taskRect.width / currentRect.width;
    const winCenterX = currentRect.left + currentRect.width / 2;
    const winCenterY = currentRect.top + currentRect.height / 2;
    const taskCenterX = taskRect.left + taskRect.width / 2;
    const taskCenterY = taskRect.top + taskRect.height / 2;
    const deltaX = taskCenterX - winCenterX;
    const deltaY = taskCenterY - winCenterY;
    
    winElement.style.transformOrigin = 'center center';
    winElement.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
    winElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
    winElement.style.opacity = '0';
    
    setTimeout(() => {
        winElement.style.display = "none";
        winElement.style.transform = "none";
        winElement.style.opacity = "1";
        winElement.style.transition = "none";
        taskbarElement.classList.remove("active");
    }, 250);
}

function openInstantly(winElement, taskbarElement) {
    winElement.style.transition = "none";
    winElement.style.transform = "none";
    winElement.style.opacity = "1";
    winElement.style.display = "block";
    
    const rect = winElement.getBoundingClientRect();
    let maxX = window.innerWidth - winElement.offsetWidth;
    let maxY = window.innerHeight - winElement.offsetHeight - 30;
    
    let newLeft = Math.max(0, Math.min(rect.left, maxX));
    let newTop = Math.max(0, Math.min(rect.top, maxY));
    
    if (maxX < 0) newLeft = 0;
    if (maxY < 0) newTop = 0;

    winElement.style.left = newLeft + "px";
    winElement.style.top = newTop + "px";
    
    void winElement.offsetWidth; 

    if (taskbarElement.style.display === "none") {
        taskbarApps.appendChild(taskbarElement);
        taskbarElement.style.display = "flex";
        
        taskbarElement.classList.remove("slide-in");
        void taskbarElement.offsetWidth; 
        taskbarElement.classList.add("slide-in");
    }
}

function restoreFromTaskbar(winElement, taskbarElement) {
    winElement.style.display = "block";
    winElement.style.transform = "none";
    winElement.style.opacity = "1";
    winElement.style.transition = "none";

    const rect = winElement.getBoundingClientRect();
    let maxX = window.innerWidth - winElement.offsetWidth;
    let maxY = window.innerHeight - winElement.offsetHeight - 30;
    
    let newLeft = Math.max(0, Math.min(rect.left, maxX));
    let newTop = Math.max(0, Math.min(rect.top, maxY));
    
    if (maxX < 0) newLeft = 0;
    if (maxY < 0) newTop = 0;

    winElement.style.left = newLeft + "px";
    winElement.style.top = newTop + "px";

    const taskRect = taskbarElement.getBoundingClientRect();
    const targetRect = winElement.getBoundingClientRect();
    
    winElement.style.opacity = "0";
    winElement.style.transformOrigin = 'center center';
    const scale = taskRect.width / targetRect.width;
    const winCenterX = targetRect.left + targetRect.width / 2;
    const winCenterY = targetRect.top + targetRect.height / 2;
    const taskCenterX = taskRect.left + taskRect.width / 2;
    const taskCenterY = taskRect.top + taskRect.height / 2;
    const deltaX = taskCenterX - winCenterX;
    const deltaY = taskCenterY - winCenterY;
    
    winElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
    void winElement.offsetHeight; 
    
    winElement.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
    winElement.style.transform = "translate(0, 0) scale(1)";
    winElement.style.opacity = "1";
    
    setTimeout(() => {
        winElement.style.transition = "none";
        winElement.style.transform = "none";
    }, 250);
}

function closeTerminal() {
    termWin.style.display = "none";
    taskbarTerm.style.display = "none";
    taskbarTerm.classList.remove("active");
    terminal.reset();
}

const terminal = initTerminal(closeTerminal);

btnMinimize.addEventListener("click", () => minimizeToTaskbar(termWin, taskbarTerm));
btnClose.addEventListener("click", closeTerminal);

taskbarTerm.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    startMenu.classList.remove("show");
    if (termWin.style.display === "none") {
        restoreFromTaskbar(termWin, taskbarTerm);
        bringToFront(termWin, taskbarTerm);
    } else if (!taskbarTerm.classList.contains("active")) {
        bringToFront(termWin, taskbarTerm);
    } else {
        minimizeToTaskbar(termWin, taskbarTerm);
    }
});

function renderExplorer(path) {
    const node = getNode(path);
    explBody.innerHTML = "";
    if (!node || typeof node !== 'object') return;

    for (const key in node) {
        const isDir = typeof node[key] === 'object';
        const item = document.createElement("div");
        item.className = "explorer-item";
        
        const icon = document.createElement("div");
        icon.className = "explorer-icon";
        icon.textContent = isDir ? "📁" : "📄";
        
        const label = document.createElement("div");
        label.textContent = key;
        
        item.appendChild(icon);
        item.appendChild(label);
        
        if (isDir) {
            item.addEventListener("dblclick", () => {
                explPath.push(key);
                renderExplorer(explPath);
            });
        } else {
            item.addEventListener("dblclick", () => {
                openNotepad(key, node[key]);
            });
        }
        explBody.appendChild(item);
    }

    if (path.length > 3) {
        const upItem = document.createElement("div");
        upItem.className = "explorer-item";
        upItem.innerHTML = `<div class="explorer-icon">📁</div><div>..</div>`;
        upItem.addEventListener("dblclick", () => {
            explPath.pop();
            renderExplorer(explPath);
        });
        explBody.prepend(upItem);
    }
}

function openExplorer() {
    explPath = ["C:", "Documents and Settings", "sla-king", "My Documents"];
    renderExplorer(explPath);
    openInstantly(explWin, taskbarExpl);
    bringToFront(explWin, taskbarExpl);
}

function closeExplorer() {
    explWin.style.display = "none";
    taskbarExpl.style.display = "none";
    taskbarExpl.classList.remove("active");
}

explBtnMinimize.addEventListener("click", () => minimizeToTaskbar(explWin, taskbarExpl));
explBtnClose.addEventListener("click", closeExplorer);

taskbarExpl.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    startMenu.classList.remove("show");
    if (explWin.style.display === "none") {
        restoreFromTaskbar(explWin, taskbarExpl);
        bringToFront(explWin, taskbarExpl);
    } else if (!taskbarExpl.classList.contains("active")) {
        bringToFront(explWin, taskbarExpl);
    } else {
        minimizeToTaskbar(explWin, taskbarExpl);
    }
});

function openNotepad(filename, content) {
    const displayName = filename.replace(/\.[^/.]+$/, "");
    noteTitleText.textContent = displayName + " - Notepad";
    noteTextarea.value = content || "";
    
    openInstantly(noteWin, taskbarNote);
    bringToFront(noteWin, taskbarNote);
}

function closeNotepad() {
    noteWin.style.display = "none";
    taskbarNote.style.display = "none";
    taskbarNote.classList.remove("active");
}

noteBtnMinimize.addEventListener("click", () => minimizeToTaskbar(noteWin, taskbarNote));
noteBtnClose.addEventListener("click", closeNotepad);

taskbarNote.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    startMenu.classList.remove("show");
    if (noteWin.style.display === "none") {
        restoreFromTaskbar(noteWin, taskbarNote);
        bringToFront(noteWin, taskbarNote);
    } else if (!taskbarNote.classList.contains("active")) {
        bringToFront(noteWin, taskbarNote);
    } else {
        minimizeToTaskbar(noteWin, taskbarNote);
    }
});

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    clock.textContent = hours + ':' + minutes + ' ' + ampm;
}

setInterval(updateClock, 1000);
updateClock();

startButton.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    blurAllWindows();
    startMenu.classList.toggle("show");
    if (startMenu.classList.contains("show")) {
        startMenu.style.zIndex = ++zIndexCounter; 
    }
});

startMenu.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    startMenu.style.zIndex = ++zIndexCounter;
});

document.addEventListener("pointerdown", (e) => {
    if (!termWin.contains(e.target) && !explWin.contains(e.target) && !noteWin.contains(e.target)) blurAllWindows();
    if (!startMenu.contains(e.target) && !startButton.contains(e.target)) startMenu.classList.remove("show");
});

termWin.addEventListener("pointerdown", () => bringToFront(termWin, taskbarTerm));
explWin.addEventListener("pointerdown", () => bringToFront(explWin, taskbarExpl));
noteWin.addEventListener("pointerdown", () => bringToFront(noteWin, taskbarNote));

document.querySelector('.menu-item[data-action="cmd"]').addEventListener("click", () => {
    startMenu.classList.remove("show");
    openInstantly(termWin, taskbarTerm);
    bringToFront(termWin, taskbarTerm);
});

document.querySelector('.menu-item[data-action="documents"]').addEventListener("click", () => {
    startMenu.classList.remove("show");
    openExplorer();
});