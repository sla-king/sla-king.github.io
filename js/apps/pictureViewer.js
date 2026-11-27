import { registerWindow, openWindow, setWindowTitle } from "../windowManager.js";
import { getNode, getPathString, isFileNode, isFolderNode, isImageFile, resolvePath } from "../filesystem.js";

const VIEWER_ID = "picture-viewer";
const VIEWER_ICON = "assets/app_.picture_viewer_16png.png";
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

let winEl = null;
let imgEl = null;
let prevBtn = null;
let nextBtn = null;
let fitBtn = null;
let actualBtn = null;
let zoomInBtn = null;
let zoomOutBtn = null;

let folderImages = [];
let currentIndex = -1;
let zoom = 1;
let actualSize = false;

function updateImageTransform() {
    if (!imgEl) return;
    imgEl.classList.toggle("actual-size", actualSize);
    imgEl.style.transform = `scale(${zoom})`;
    fitBtn?.classList.toggle("active", !actualSize && zoom === 1);
    actualBtn?.classList.toggle("active", actualSize);
    if (zoomInBtn) zoomInBtn.disabled = zoom >= MAX_ZOOM;
    if (zoomOutBtn) zoomOutBtn.disabled = zoom <= MIN_ZOOM;
}

function collectSiblingImages(fileParts) {
    const parentParts = fileParts.slice(0, -1);
    const parentNode = getNode(parentParts);
    if (!isFolderNode(parentNode)) return [];

    const images = [];
    for (const [name, value] of Object.entries(parentNode)) {
        if (isFileNode(value) && isImageFile(name)) {
            images.push({
                name,
                src: value.content,
                pathString: getPathString([...parentParts, name])
            });
        }
    }
    return images;
}

function showCurrentImage() {
    const entry = folderImages[currentIndex];
    if (!entry || !imgEl) return;

    zoom = 1;
    actualSize = false;
    imgEl.src = entry.src;
    imgEl.alt = entry.name;
    updateImageTransform();

    const displayName = entry.name.replace(/\.[^/.]+$/, "");
    setWindowTitle(VIEWER_ID, `${displayName} - Windows Picture and Fax Viewer`, VIEWER_ICON);

    const hasMultiple = folderImages.length > 1;
    if (prevBtn) prevBtn.disabled = !hasMultiple;
    if (nextBtn) nextBtn.disabled = !hasMultiple;
}

function stepImage(delta) {
    if (folderImages.length <= 1) return;
    currentIndex = (currentIndex + delta + folderImages.length) % folderImages.length;
    showCurrentImage();
}

export function initPictureViewer() {
    winEl = document.getElementById("picture-viewer-window");
    if (!winEl) return;

    imgEl = document.getElementById("picviewer-img");
    prevBtn = document.getElementById("picviewer-prev");
    nextBtn = document.getElementById("picviewer-next");
    fitBtn = document.getElementById("picviewer-best-fit");
    actualBtn = document.getElementById("picviewer-actual");
    zoomInBtn = document.getElementById("picviewer-zoom-in");
    zoomOutBtn = document.getElementById("picviewer-zoom-out");

    registerWindow({
        id: VIEWER_ID,
        winEl,
        onClose: () => {
            zoom = 1;
            actualSize = false;
            if (imgEl) {
                imgEl.removeAttribute("src");
                imgEl.style.transform = "";
            }
        }
    });

    prevBtn?.addEventListener("click", () => stepImage(-1));
    nextBtn?.addEventListener("click", () => stepImage(1));

    fitBtn?.addEventListener("click", () => {
        zoom = 1;
        actualSize = false;
        updateImageTransform();
    });

    actualBtn?.addEventListener("click", () => {
        zoom = 1;
        actualSize = true;
        updateImageTransform();
    });

    zoomInBtn?.addEventListener("click", () => {
        zoom = Math.min(MAX_ZOOM, Number((zoom + ZOOM_STEP).toFixed(2)));
        updateImageTransform();
    });

    zoomOutBtn?.addEventListener("click", () => {
        zoom = Math.max(MIN_ZOOM, Number((zoom - ZOOM_STEP).toFixed(2)));
        updateImageTransform();
    });

    winEl.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            stepImage(-1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            stepImage(1);
        } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoomInBtn?.click();
        } else if (e.key === "-") {
            e.preventDefault();
            zoomOutBtn?.click();
        }
    });
}

export function openPictureViewer({ imagePath } = {}) {
    if (!winEl) initPictureViewer();
    if (!winEl || !imagePath) return;

    const parts = Array.isArray(imagePath) ? imagePath : resolvePath(imagePath);
    const node = parts ? getNode(parts) : null;
    const fileName = parts?.[parts.length - 1] || "";
    if (!isFileNode(node) || !isImageFile(fileName)) return;

    folderImages = collectSiblingImages(parts);
    const targetPath = getPathString(parts).toLowerCase();
    currentIndex = folderImages.findIndex((item) => item.pathString.toLowerCase() === targetPath);
    if (currentIndex === -1) {
        folderImages = [{ name: fileName, src: node.content, pathString: getPathString(parts) }];
        currentIndex = 0;
    }

    showCurrentImage();
    openWindow(VIEWER_ID);
}
