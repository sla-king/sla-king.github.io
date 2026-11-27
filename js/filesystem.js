import { aboutMeTxt, experienceTxt } from './texts.js';

export const HOME_PATH = ["C:", "Documents and Settings", "sla-king"];
export const DEFAULT_FILE_DATE = "11/01/2026  11:39 PM";
export const MY_DOCUMENTS_TOOLTIP = "Contains letters, reports, and other documents and files.";

const MAX_TOOLTIP_LINE_LENGTH = 64;

const SIZE_UNITS = {
    b: 1,
    byte: 1,
    bytes: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
};

export const DRIVE_TOTAL_BYTES = Math.round(28.9 * SIZE_UNITS.gb);

function parseFileSize(size, fallbackBytes) {
    if (size === undefined) return fallbackBytes;
    if (typeof size === "number") {
        if (!Number.isFinite(size) || size < 0) {
            throw new Error(`File size must be a non-negative number (received ${JSON.stringify(size)}).`);
        }
        return Math.round(size);
    }
    if (typeof size === "string") {
        const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*(b|bytes?|kb|mb|gb)?$/i);
        if (match) {
            const amount = Number(match[1]);
            const unit = (match[2] || "b").toLowerCase();
            return Math.round(amount * SIZE_UNITS[unit]);
        }
    }
    throw new Error(`Invalid file size (received ${JSON.stringify(size)}).`);
}

class VfsFile {
    constructor(content, date, size) {
        if (typeof content !== "string") {
            throw new Error("File content must be a string.");
        }
        if (typeof date !== "string" || !date.trim() || Number.isNaN(Date.parse(date.trim()))) {
            throw new Error(`Every file must have a valid timestamp (received ${JSON.stringify(date)}).`);
        }
        this.content = content;
        this.date = date;
        this.size = parseFileSize(size, content.length);
    }
}

export function file(content, date, size) {
    return new VfsFile(content, date, size);
}

export function isFileNode(node) {
    return node instanceof VfsFile;
}

export function isFolderNode(node) {
    return Boolean(node) && typeof node === "object" && !Array.isArray(node) && !(node instanceof VfsFile);
}

export function isAudioFile(filename) {
    return /\.(mp3|wav|ogg|wma|m4a|flac)$/i.test(filename);
}

export function isImageFile(filename) {
    return /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(filename);
}

export function isUrlFile(filename) {
    return /\.url$/i.test(filename);
}

export function parseUrlFileContent(content) {
    const raw = String(content || "").trim();
    const iniMatch = raw.match(/^URL=(.+)$/im);
    return (iniMatch ? iniMatch[1] : raw).trim();
}

export const fs = {
    "C:": {
        "AUTOEXEC.BAT": file("", "11/01/2026  11:39 PM"),
        "CONFIG.SYS": file("", "11/01/2026  11:39 PM"),
        "Documents and Settings": {
            "All Users": {
                "Documents": {}
            },
            "sla-king": {
                "Desktop": {},
                "Favorites": {
                    "Regrets of the Dying - Bronnie Ware.url": file("https://bronnieware.com/blog/regrets-of-the-dying", "11/27/2026  01:49 PM"),
                    "sla-king's homepage.url": file("https://sla-king.github.io/home.html", "11/27/2026  01:49 PM"),
                },
                "My Documents": {
                    "My Music": {
                        "After You've Gone - Emmet Choen.mp3": file("https://www.youtube.com/watch?v=984ksjle4YA", "04/21/2021  09:20 AM", 20373766),
                        "Backlight - Ado.mp3": file("https://www.youtube.com/watch?v=gt-v_YCkaMY", "07/06/2022  04:00 AM", 5999941),
                        "Gira Gira - Ado.mp3": file("https://www.youtube.com/watch?v=sOiMD45QGLs", "02/14/2021  03:00 AM", 6641926),
                        "Naked Hero - Vaundy.mp3": file("https://www.youtube.com/watch?v=FT0GKCuSaW0", "01/28/2022  03:00 AM", 3209854),
                        "Oddtaxi - Skirt&PUNPEE.mp3": file("https://www.youtube.com/watch?v=_pxsIRHq-M0", "04/06/2021  03:20 AM", 4882736),
                        "Odo - Ado.mp3": file("https://www.youtube.com/watch?v=YnSW8ian29w", "04/27/2021  04:00 AM", 3529803),
                        "Show - Ado.mp3": file("https://www.youtube.com/watch?v=pgXpM4l_MwI", "09/06/2023  02:00 AM", 4547950),
                        "Tank! - Seatbelts.mp3": file("https://www.youtube.com/watch?v=UFFa0QoHWvE", "05/21/1998  12:00 AM", 5049261),
                        "The 1 - munque.mp3": file("https://www.youtube.com/watch?v=NefIygtTu-8", "04/27/2025  03:03 AM", 3274749),
                        "The World's Continuation - Ado.mp3": file("https://www.youtube.com/watch?v=b3GCfyNKeLs", "08/10/2022  03:30 AM", 7083291),
                    },
                    "My Pictures": {
                        "profile_picture.png": file("assets/start_profile_picture.png", "11/27/2026  09:51 AM", 7975),
                    },
                    "about_me.txt": file(aboutMeTxt, "11/26/2026  07:24 PM"),
                    "experience.txt": file(experienceTxt, "11/15/2026  04:22 PM"),
                }
            }
        }
    }
};

function validateFsTree(node, trail = []) {
    if (!isFolderNode(node)) {
        throw new Error(`Invalid filesystem node at "${trail.join("\\")}": files must use file(content, timestamp).`);
    }
    for (const [key, value] of Object.entries(node)) {
        if (!isFileNode(value)) {
            validateFsTree(value, [...trail, key]);
        }
    }
}

validateFsTree(fs);

export let currentPath = [...HOME_PATH];

export function setPath(newPath) {
    currentPath = newPath;
}

export function getPathString(pathArray = currentPath) {
    return pathArray.length === 1 ? `${pathArray[0]}\\` : pathArray.join("\\");
}

export function getNode(path) {
    let node = fs;
    for (const part of path) {
        if (!isFolderNode(node)) return null;
        const key = Object.keys(node).find(k => k.toLowerCase() === part.toLowerCase());
        if (!key) return null;
        node = node[key];
    }
    return node;
}

export function resolvePath(input, basePath = currentPath) {
    if (!input) return [...basePath];

    let cleanInput = input.replace(/"/g, "");
    if (cleanInput === "~") return [...HOME_PATH];

    let newPath = [];
    const parts = cleanInput.split(/[/\\]/).filter(Boolean);

    if (cleanInput.startsWith("/") || cleanInput.startsWith("\\")) {
        newPath = [basePath[0]];
    } else if (cleanInput.startsWith("~/") || cleanInput.startsWith("~\\")) {
        newPath = [...HOME_PATH];
        parts.shift();
    } else if (parts.length > 0 && parts[0].endsWith(":")) {
        newPath = [parts.shift().toUpperCase()];
    } else {
        newPath = [...basePath];
    }

    for (const part of parts) {
        if (part === ".") continue;
        if (part === "..") {
            if (newPath.length > 1) newPath.pop();
        } else {
            const parentNode = getNode(newPath);
            const canonicalKey = isFolderNode(parentNode)
                ? Object.keys(parentNode).find(k => k.toLowerCase() === part.toLowerCase())
                : null;
            newPath.push(canonicalKey || part);
        }
    }
    return newPath;
}

export function getLatestDateInNode(node, defaultDate) {
    let maxTime = -1;
    let maxDateStr = defaultDate;

    for (const value of Object.values(node)) {
        const dateStr = isFileNode(value)
            ? value.date
            : getLatestDateInNode(value, defaultDate);
        const time = new Date(dateStr).getTime();
        if (time > maxTime) {
            maxTime = time;
            maxDateStr = dateStr;
        }
    }
    return maxDateStr;
}

// Returns matching files inside a folder along with their paths
export function listFilesInFolder(folderPath, predicate = () => true) {
    const folderNode = getNode(folderPath);
    if (!isFolderNode(folderNode)) return [];

    const results = [];
    for (const [name, value] of Object.entries(folderNode)) {
        if (!isFileNode(value) || !predicate(name, value)) continue;
        const path = [...folderPath, name];
        results.push({
            name,
            node: value,
            path,
            pathString: getPathString(path)
        });
    }
    return results;
}

// Folder icons, file type labels, and hover tooltips

const SPECIAL_FOLDERS = {
    "my documents": {
        large: "assets/folder_documents.png",
        small: "assets/folder_documents_16.png"
    },
    "my music": {
        large: "assets/folder_music.png",
        small: "assets/folder_music_16.png",
        tooltip: "Contains music and other audio files"
    },
    "my pictures": {
        large: "assets/folder_pictures.png",
        small: "assets/folder_pictures_16.png",
        tooltip: "Contains digital photos, images, and graphic files."
    },
    "favorites": {
        large: "assets/folder_favorites.png",
        small: "assets/folder_favorites_16.png"
    }
};

const FILE_TYPE_LABELS = {
    txt: "Text Document",
    bat: "MS-DOS Batch File",
    sys: "System File",
    mp3: "MP3 Format Sound",
    wma: "Windows Media Audio file",
    wav: "Wave Sound",
    ogg: "Ogg Vorbis Audio",
    png: "PNG Image",
    jpg: "JPEG Image",
    jpeg: "JPEG Image",
    gif: "GIF Image",
    bmp: "Bitmap Image",
    url: "Internet Shortcut"
};

const HIDDEN_ROOT_FILES = new Set(["autoexec.bat", "config.sys"]);

export function getSpecialFolder(path) {
    const folderName = path[path.length - 1]?.toLowerCase();
    const hasHomePrefix = HOME_PATH.every((part, i) => path[i]?.toLowerCase() === part.toLowerCase());
    if (!hasHomePrefix || !folderName) {
        return null;
    }

    const isHomeChild = path.length === HOME_PATH.length + 1;
    const isMyDocsChild =
        path.length === HOME_PATH.length + 2 &&
        path[HOME_PATH.length]?.toLowerCase() === "my documents";

    if (isHomeChild || (isMyDocsChild && (folderName === "my music" || folderName === "my pictures"))) {
        return SPECIAL_FOLDERS[folderName] || null;
    }
    return null;
}

export function getFolderIcon(path, small = false) {
    if (path.length === 1 && path[0].toUpperCase() === "C:") {
        return small ? "assets/file_c_drive_16.png" : "assets/file_c_drive.png";
    }
    const match = getSpecialFolder(path);
    if (match) return small ? match.small : match.large;
    return small ? "assets/folder_base_16.png" : "assets/folder_base.png";
}

export function isHiddenExplorerItem(parentPath, name, value) {
    return parentPath.length === 1 &&
        parentPath[0].toUpperCase() === "C:" &&
        isFileNode(value) &&
        HIDDEN_ROOT_FILES.has(name.toLowerCase());
}

export function formatTooltipSize(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unitIdx = 0;
    while (value >= 1024 && unitIdx < units.length - 1) {
        value /= 1024;
        unitIdx++;
    }
    return `${value >= 100 ? Math.round(value) : Number(value.toFixed(2))} ${units[unitIdx]}`;
}

export function formatTooltipDate(dateStr) {
    return dateStr
        .replace(/\s+/g, " ")
        .replace(/^0/, "")
        .replace(/\/0/g, "/")
        .replace(/ 0(\d:)/, " $1");
}

export function getFileTypeLabel(filename) {
    const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
    if (FILE_TYPE_LABELS[ext]) return FILE_TYPE_LABELS[ext];
    if (isAudioFile(filename)) return "Audio File";
    if (isImageFile(filename)) return "Image File";
    return "File";
}

export function getNodeSize(node) {
    if (isFileNode(node)) return node.size;
    let total = 0;
    for (const value of Object.values(node)) {
        total += getNodeSize(value);
    }
    return total;
}

export function getDriveFreeBytes(drive = "C:") {
    const driveNode = fs[drive];
    const usedBytes = isFolderNode(driveNode) ? getNodeSize(driveNode) : 0;
    return Math.max(0, DRIVE_TOTAL_BYTES - usedBytes);
}

export function getDriveTooltip(drive = "C:") {
    return `Free Space: ${formatTooltipSize(getDriveFreeBytes(drive))}\nTotal Size: ${formatTooltipSize(DRIVE_TOTAL_BYTES)}`;
}

export function getItemTooltip(path, name, value) {
    if (isFileNode(value)) {
        const type = getFileTypeLabel(name);
        const dateModified = formatTooltipDate(value.date);
        const size = formatTooltipSize(value.size);
        return `Type: ${type}\nDate Modified: ${dateModified}\nSize: ${size}`;
    }

    const lines = [];
    const special = getSpecialFolder(path);
    if (special?.tooltip) {
        lines.push(special.tooltip);
    }

    const entries = Object.entries(value).filter(([k, v]) => !isHiddenExplorerItem(path, k, v));
    const childFolders = entries.filter(([, v]) => isFolderNode(v)).map(([k]) => k);
    const childFiles = entries.filter(([, v]) => isFileNode(v)).map(([k]) => k);
    if (childFolders.length === 0 && childFiles.length === 0) {
        lines.push("Folder is empty");
        return lines.join("\n");
    }

    lines.push(`Size: ${formatTooltipSize(getNodeSize(value))}`);
    if (childFolders.length > 0) {
        lines.push(`Folders: ${childFolders.join(", ")}`);
    }
    if (childFiles.length > 0) {
        lines.push(`Files: ${childFiles.join(", ")}`);
    }
    return lines.join("\n");
}

export function truncateTooltipLines(tooltip, maxLength = MAX_TOOLTIP_LINE_LENGTH) {
    return tooltip
        .split("\n")
        .map((line) => (
            line.length > maxLength
                ? `${line.slice(0, maxLength - 3).trimEnd()}...`
                : line
        ))
        .join("\n");
}
