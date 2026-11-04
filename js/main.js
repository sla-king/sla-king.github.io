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
let isMinimized = false;

function hideWindow(reset = false, animate = false) {
    if (animate) {
        isMinimized = true;
        const currentRect = win.getBoundingClientRect();
        const taskRect = taskbarApp.getBoundingClientRect();
        
        const scale = taskRect.width / currentRect.width;
        const winCenterX = currentRect.left + currentRect.width / 2;
        const winCenterY = currentRect.top + currentRect.height / 2;
        const taskCenterX = taskRect.left + taskRect.width / 2;
        const taskCenterY = taskRect.top + taskRect.height / 2;
        
        const deltaX = taskCenterX - winCenterX;
        const deltaY = taskCenterY - winCenterY;
        
        win.style.transformOrigin = 'center center';
        win.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
        win.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
        win.style.opacity = '0';
        
        setTimeout(() => {
            win.style.display = "none";
            win.style.transform = "none";
            win.style.opacity = "1";
            win.style.transition = "none";
            taskbarApp.classList.remove("active");
            if (reset) {
                terminal.reset();
                taskbarApp.style.display = "none";
            }
        }, 250);
    } else {
        isMinimized = false;
        win.style.display = "none";
        taskbarApp.classList.remove("active");
        if (reset) {
            terminal.reset();
            taskbarApp.style.display = "none";
        }
    }
}

function showWindow() {
    if (win.style.display === "none") {
        win.style.display = "block";
        taskbarApp.style.display = "flex";
        
        win.style.transform = "none";
        win.style.opacity = "1";
        win.style.transition = "none";

        bringOnScreen();

        if (isMinimized) {
            isMinimized = false;
            
            const taskRect = taskbarApp.getBoundingClientRect();
            const targetRect = win.getBoundingClientRect();
            
            win.style.opacity = "0";
            win.style.transformOrigin = 'center center';
            
            const scale = taskRect.width / targetRect.width;
            const winCenterX = targetRect.left + targetRect.width / 2;
            const winCenterY = targetRect.top + targetRect.height / 2;
            const taskCenterX = taskRect.left + taskRect.width / 2;
            const taskCenterY = taskRect.top + taskRect.height / 2;
            
            const deltaX = taskCenterX - winCenterX;
            const deltaY = taskCenterY - winCenterY;
            
            win.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
            
            void win.offsetHeight; 
            
            win.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
            win.style.transform = "translate(0, 0) scale(1)";
            win.style.opacity = "1";
            
            setTimeout(() => {
                win.style.transition = "none";
                win.style.transform = "none";
            }, 250);
        }
        
        taskbarApp.classList.add("active");
        terminal.focus();
    }
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

const terminal = initTerminal(() => hideWindow(true, false));

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

btnMinimize.addEventListener("click", () => hideWindow(false, true));
btnClose.addEventListener("click", () => hideWindow(true, false));

taskbarApp.addEventListener("click", () => {
    if (win.style.display === "none") {
        showWindow();
    } else {
        hideWindow(false, true);
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

const startButton = document.getElementById("start-button");
const startMenu = document.getElementById("start-menu");

startButton.addEventListener("click", (e) => {
    e.stopPropagation();
    startMenu.classList.toggle("show");
});

document.addEventListener("click", (e) => {
    if (!startMenu.contains(e.target) && !startButton.contains(e.target)) {
        startMenu.classList.remove("show");
    }
});

const cmdMenuItem = document.querySelector('.menu-item[data-action="cmd"]');
if (cmdMenuItem) {
    cmdMenuItem.addEventListener("click", () => {
        startMenu.classList.remove("show");
        if (win.style.display === "none") {
            showWindow();
        } else {
            terminal.focus();
        }
    });
}