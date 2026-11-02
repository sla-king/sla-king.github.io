import { initTerminal } from './terminal.js';

const win = document.getElementById("draggable-window");
const titleBar = document.getElementById("title-bar");
const outline = document.getElementById("drag-outline");
const btnMinimize = document.getElementById("btn-minimize");
const btnClose = document.getElementById("btn-close");
const clock = document.getElementById("clock");
const taskbarApp = document.getElementById("taskbar-app");

let isDragging = false;
let startX, startY;
let winRect;

function hideWindow(reset = false) {
    win.style.display = "none";
    taskbarApp.classList.remove("active");
    if (reset) {
        terminal.reset();
    }
}

function showWindow() {
    win.style.display = "block";
    taskbarApp.classList.add("active");
    bringOnScreen();
    terminal.focus();
}

function bringOnScreen() {
    if (win.style.display === "none") return;
    
    let rect = win.getBoundingClientRect();
    let maxX = window.innerWidth - win.offsetWidth;
    let maxY = window.innerHeight - win.offsetHeight - 30;
    
    let newX = Math.max(0, Math.min(rect.left, maxX));
    let newY = Math.max(0, Math.min(rect.top, maxY));
    
    win.style.left = newX + "px";
    win.style.top = newY + "px";
    win.style.transform = "none";
}

const terminal = initTerminal(() => hideWindow(true));

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

btnMinimize.addEventListener("click", () => hideWindow(false));
btnClose.addEventListener("click", () => hideWindow(true));

taskbarApp.addEventListener("click", () => {
    if (win.style.display === "none") {
        showWindow();
    } else {
        hideWindow(false);
    }
});

titleBar.addEventListener("mousedown", (e) => {
    if (e.target.closest('.title-bar-controls')) return;

    isDragging = true;
    winRect = win.getBoundingClientRect();
    
    startX = e.clientX - winRect.left;
    startY = e.clientY - winRect.top;

    outline.style.width = winRect.width + "px";
    outline.style.height = winRect.height + "px";
    outline.style.left = winRect.left + "px";
    outline.style.top = winRect.top + "px";
    
    outline.style.display = "block";
    
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    let newX = e.clientX - startX;
    let newY = e.clientY - startY;

    outline.style.left = newX + "px";
    outline.style.top = newY + "px";
});

document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;

    outline.style.display = "none";

    let finalX = parseInt(outline.style.left);
    let finalY = parseInt(outline.style.top);

    win.style.left = finalX + "px";
    win.style.top = finalY + "px";
    win.style.transform = "none";
});