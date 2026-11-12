import { aboutMeTxt, contactTxt, experienceTxt, bidoofTxt, regretsOfTheDyingTxt } from './texts.js';

export const HOME_PATH = ["C:", "Documents and Settings", "sla-king"];

export const fs = {
    "C:": {
        "AUTOEXEC.BAT": "",
        "CONFIG.SYS": "",
        "Documents and Settings": {
            "sla-king": {
                "Desktop": {},
                "Favorites": {
                    "bidoof.txt": bidoofTxt,
                    "regrets-of-the-dying.txt": regretsOfTheDyingTxt,
                },
                "My Documents": {
                    "about_me.txt": aboutMeTxt,
                    "contact.txt": contactTxt,
                    "experience.txt": experienceTxt,
                }
            }
        }
    }
};

export const fileDates = {
    "about_me.txt": "11/11/2026  09:33 PM",
    "contact.txt": "11/02/2026  11:43 PM",
    "experience.txt": "11/11/2026  07:28 PM",
    "bidoof.txt": "11/03/2026  01:31 PM",
    "regrets-of-the-dying.txt": "11/03/2026  12:08 AM",
};

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
        if (!node || typeof node !== "object") return null;
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
            const canonicalKey = parentNode && typeof parentNode === "object"
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

    for (const [key, value] of Object.entries(node)) {
        const dateStr = typeof value === "string"
            ? (fileDates[key] || defaultDate)
            : getLatestDateInNode(value, defaultDate);
        const time = new Date(dateStr).getTime();
        if (time > maxTime) {
            maxTime = time;
            maxDateStr = dateStr;
        }
    }
    return maxDateStr;
}