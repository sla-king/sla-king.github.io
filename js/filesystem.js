export const fs = {
    "C:": {
        "Users": {
            "sla-king": {
                "Desktop": {},
                "Documents": {
                    "welcome.txt": "Hello! This is my website :)"
                },
                "Downloads": {}
            }
        }
    }
};

export let currentPath = ["C:", "Users", "sla-king"];

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
    let parts = input.split(/[/\\]/).filter(p => p !== "");

    if (input === "~") {
        return ["C:", "Users", "sla-king"];
    }
    if (input.startsWith("~/") || input.startsWith("~\\")) {
        newPath = ["C:", "Users", "sla-king"];
        parts.shift(); 
    } 
    else if (parts.length > 0 && parts[0].endsWith(":")) {
        newPath = [parts.shift().toUpperCase()];
    } 
    else {
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
        if (!node || typeof node !== 'object' || !node[part]) return null;
        node = node[part];
    }
    return node;
}