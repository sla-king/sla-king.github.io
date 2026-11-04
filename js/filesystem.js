import { aboutMeTxt, contactTxt, experienceTxt, bidoofTxt, regretsOfTheDyingTxt } from './texts.js';

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
        },
    }
};

export const fileDates = {
    "about_me.txt": "11/03/2026  01:24 PM",
    "contact.txt": "11/02/2026  11:43 PM",
    "experience.txt": "11/04/2026  11:05 AM",
    "bidoof.txt": "11/03/2026  01:31 PM",
    "regrets-of-the-dying.txt": "11/03/2026  12:08 AM",
};

export let currentPath = ["C:", "Documents and Settings", "sla-king"];

export function setPath(newPath) {
    currentPath = newPath;
}

export function getPathString(pathArray = currentPath) {
    if (pathArray.length === 1) return pathArray[0] + "\\";
    return pathArray.join("\\");
}

export function resolvePath(input) {
    if (!input) return [...currentPath];

    let newPath = [];
    let cleanInput = input.replace(/"/g, ''); 
    
    if (cleanInput.startsWith('/') || cleanInput.startsWith('\\')) {
        newPath = [currentPath[0]];
        cleanInput = cleanInput.substring(1);
    }

    let parts = cleanInput.split(/[/\\]/).filter(p => p !== "");
    
    if (cleanInput === "~") {
        return ["C:", "Documents and Settings", "sla-king"];
    }
    if (cleanInput.startsWith("~/") || cleanInput.startsWith("~\\")) {
        newPath = ["C:", "Documents and Settings", "sla-king"];
        parts.shift(); 
    } 
    else if (parts.length > 0 && parts[0].endsWith(":")) {
        newPath = [parts.shift().toUpperCase()];
    } 
    else if (newPath.length === 0) {
        newPath = [...currentPath];
    }

    for (let part of parts) {
        if (part === ".") continue;
        if (part === "..") {
            if (newPath.length > 1) newPath.pop();
            continue;
        }
        newPath.push(part);
    }
    return newPath;
}

export function getNode(path) {
    let node = fs;
    for (let part of path) {
        if (!node || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, part)) return null;
        node = node[part];
    }
    return node;
}

export function getLatestDateInNode(node, defaultDate) {
    let maxTime = 0;
    let maxDateStr = defaultDate;
    let foundFile = false;

    for (const key in node) {
        if (typeof node[key] === 'string') {
            const dateStr = fileDates[key] || defaultDate;
            const time = new Date(dateStr).getTime();
            if (time > maxTime || !foundFile) {
                maxTime = time;
                maxDateStr = dateStr;
                foundFile = true;
            }
        } else if (typeof node[key] === 'object') {
            const childDate = getLatestDateInNode(node[key], defaultDate);
            const time = new Date(childDate).getTime();
            if (time > maxTime || !foundFile) {
                maxTime = time;
                maxDateStr = childDate;
                foundFile = true;
            }
        }
    }
    return foundFile ? maxDateStr : defaultDate;
}