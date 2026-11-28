import { XPWindow } from '../os/XPWindow.js';
import { getNode, getPathString, isFileNode, isImageFile, listFilesInFolder, resolvePath } from '../filesystem.js';

const VIEWER_ID = "picture-viewer";
const VIEWER_ICON = "assets/app_picture_viewer_16.png";
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

// Windows Picture and Fax Viewer window
export class PictureViewerApp extends XPWindow {
    constructor(winEl) {
        super({ id: VIEWER_ID, winEl });

        this.imgEl = document.getElementById("picviewer-img");
        this.prevBtn = document.getElementById("picviewer-prev");
        this.nextBtn = document.getElementById("picviewer-next");
        this.fitBtn = document.getElementById("picviewer-best-fit");
        this.actualBtn = document.getElementById("picviewer-actual");
        this.zoomInBtn = document.getElementById("picviewer-zoom-in");
        this.zoomOutBtn = document.getElementById("picviewer-zoom-out");

        this.folderImages = [];
        this.currentIndex = -1;
        this.zoom = 1;
        this.actualSize = false;

        this.bindEvents();
    }

    onClose() {
        this.zoom = 1;
        this.actualSize = false;
        if (this.imgEl) {
            this.imgEl.removeAttribute("src");
            this.imgEl.style.transform = "";
        }
    }

    bindEvents() {
        this.prevBtn?.addEventListener("click", () => this.stepImage(-1));
        this.nextBtn?.addEventListener("click", () => this.stepImage(1));

        this.fitBtn?.addEventListener("click", () => {
            this.zoom = 1;
            this.actualSize = false;
            this.updateImageTransform();
        });

        this.actualBtn?.addEventListener("click", () => {
            this.zoom = 1;
            this.actualSize = true;
            this.updateImageTransform();
        });

        this.zoomInBtn?.addEventListener("click", () => {
            this.zoom = Math.min(MAX_ZOOM, Number((this.zoom + ZOOM_STEP).toFixed(2)));
            this.updateImageTransform();
        });

        this.zoomOutBtn?.addEventListener("click", () => {
            this.zoom = Math.max(MIN_ZOOM, Number((this.zoom - ZOOM_STEP).toFixed(2)));
            this.updateImageTransform();
        });

        this.winEl.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                this.stepImage(-1);
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                this.stepImage(1);
            } else if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                this.zoomInBtn?.click();
            } else if (e.key === "-") {
                e.preventDefault();
                this.zoomOutBtn?.click();
            }
        });
    }

    updateImageTransform() {
        if (!this.imgEl) return;
        this.imgEl.classList.toggle("actual-size", this.actualSize);
        this.imgEl.style.transform = `scale(${this.zoom})`;
        this.fitBtn?.classList.toggle("active", !this.actualSize && this.zoom === 1);
        this.actualBtn?.classList.toggle("active", this.actualSize);
        if (this.zoomInBtn) this.zoomInBtn.disabled = this.zoom >= MAX_ZOOM;
        if (this.zoomOutBtn) this.zoomOutBtn.disabled = this.zoom <= MIN_ZOOM;
    }

    showCurrentImage() {
        const entry = this.folderImages[this.currentIndex];
        if (!entry || !this.imgEl) return;

        this.zoom = 1;
        this.actualSize = false;
        this.imgEl.src = entry.src;
        this.imgEl.alt = entry.name;
        this.updateImageTransform();

        const displayName = entry.name.replace(/\.[^/.]+$/, "");
        this.setTitle(`${displayName} - Windows Picture and Fax Viewer`, VIEWER_ICON);

        const hasMultiple = this.folderImages.length > 1;
        if (this.prevBtn) this.prevBtn.disabled = !hasMultiple;
        if (this.nextBtn) this.nextBtn.disabled = !hasMultiple;
    }

    stepImage(delta) {
        if (this.folderImages.length <= 1) return;
        this.currentIndex = (this.currentIndex + delta + this.folderImages.length) % this.folderImages.length;
        this.showCurrentImage();
    }

    openImage(imagePath) {
        if (!imagePath) return;

        const parts = Array.isArray(imagePath) ? imagePath : resolvePath(imagePath);
        const node = parts ? getNode(parts) : null;
        const fileName = parts?.[parts.length - 1] || "";
        if (!isFileNode(node) || !isImageFile(fileName)) return;

        const siblingEntries = listFilesInFolder(parts.slice(0, -1), (name) => isImageFile(name));
        this.folderImages = siblingEntries.map((item) => ({
            name: item.name,
            src: item.node.content,
            pathString: item.pathString
        }));

        const targetPath = getPathString(parts).toLowerCase();
        this.currentIndex = this.folderImages.findIndex(
            (item) => item.pathString.toLowerCase() === targetPath
        );
        if (this.currentIndex === -1) {
            this.folderImages = [{ name: fileName, src: node.content, pathString: getPathString(parts) }];
            this.currentIndex = 0;
        }

        this.showCurrentImage();
        this.open();
    }
}

let viewerInstance = null;

export function initPictureViewer() {
    if (viewerInstance) return viewerInstance;
    const winEl = document.getElementById("picture-viewer-window");
    if (!winEl) return null;
    viewerInstance = new PictureViewerApp(winEl);
    return viewerInstance;
}

export function openPictureViewer({ imagePath } = {}) {
    const app = initPictureViewer();
    app?.openImage(imagePath);
}
