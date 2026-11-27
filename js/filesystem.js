import { aboutMeTxt, experienceTxt, bidoofTxt, regretsOfTheDyingTxt } from './texts.js';

export const HOME_PATH = ["C:", "Documents and Settings", "sla-king"];
export const DEFAULT_FILE_DATE = "11/01/2026  11:39 PM";

class VfsFile {
    constructor(content, date) {
        if (typeof content !== "string") {
            throw new Error("File content must be a string.");
        }
        if (typeof date !== "string" || !date.trim() || Number.isNaN(Date.parse(date.trim()))) {
            throw new Error(`Every file must have a valid timestamp (received ${JSON.stringify(date)}).`);
        }
        this.content = content;
        this.date = date;
    }
}

export function file(content, date) {
    return new VfsFile(content, date);
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
                    "bidoof.txt": file(bidoofTxt, "11/03/2026  01:31 PM"),
                    "regrets-of-the-dying.txt": file(regretsOfTheDyingTxt, "11/03/2026  12:08 AM"),
                },
                "My Documents": {
                    "My Music": {
                        "After You've Gone - Emmet Choen.mp3": file("https://www.youtube.com/watch?v=984ksjle4YA", "04/21/2021  09:20 AM"),
                        "Backlight - Ado.mp3": file("https://www.youtube.com/watch?v=gt-v_YCkaMY", "07/06/2022  04:00 AM"),
                        "Gira Gira - Ado.mp3": file("https://www.youtube.com/watch?v=sOiMD45QGLs", "02/14/2021  03:00 AM"),
                        "Naked Hero - Vaundy.mp3": file("https://www.youtube.com/watch?v=FT0GKCuSaW0", "01/28/2022  03:00 AM"),
                        "Oddtaxi - Skirt&PUNPEE.mp3": file("https://www.youtube.com/watch?v=_pxsIRHq-M0", "04/06/2021  03:20 AM"),
                        "Odo - Ado.mp3": file("https://www.youtube.com/watch?v=YnSW8ian29w", "04/27/2021  04:00 AM"),
                        "Show - Ado.mp3": file("https://www.youtube.com/watch?v=pgXpM4l_MwI", "09/06/2023  02:00 AM"),
                        "Tank! - Seatbelts.mp3": file("https://www.youtube.com/watch?v=UFFa0QoHWvE", "05/21/1998  12:00 AM"),
                        "The 1 - munque.mp3": file("https://www.youtube.com/watch?v=NefIygtTu-8", "04/27/2025  03:03 AM"),
                        "The World's Continuation - Ado.mp3": file("https://www.youtube.com/watch?v=b3GCfyNKeLs", "08/10/2022  03:30 AM"),
                    },
                    "My Pictures": {
                        "profile_picture.png": file("assets/start_profile_picture.png", "11/27/2026  09:51 AM"),
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