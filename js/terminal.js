import { commands } from './commands.js';
import { currentPath, getPathString, setPath, getNode, resolvePath } from './filesystem.js';

export function initTerminal(onClose) {
    const consoleBody = document.getElementById("console-body");
    const consoleOutput = document.getElementById("console-output");
    const cmdInput = document.getElementById("cmd-input");
    const promptText = document.getElementById("prompt-text");

    const initialText = "Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\n";
    const pathCommands = ['cd', 'chdir', 'dir', 'ls', 'type', 'cat'];

    let cycleMatches = [];
    let cycleIndex = -1;
    let cycleBeforeWord = "";
    let cycleAfterWord = "";
    let isCyclingCommand = false;

    function updatePrompt() {
        promptText.textContent = getPathString() + ">";
    }

    function print(text) {
        consoleOutput.textContent += text + "\n";
        scrollToBottom();
    }

    function scrollToBottom() {
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }

    function clearScreen() {
        consoleOutput.textContent = "";
    }

    function reset() {
        consoleOutput.textContent = initialText;
        cmdInput.value = "";
        setPath(["C:", "Documents and Settings", "sla-king"]);
        updatePrompt();
        scrollToBottom();
    }

    consoleBody.addEventListener('click', () => {
        cmdInput.focus();
    });

    function getWordInfo(text) {
        let inQuotes = false;
        let lastSpace = -1;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '"') inQuotes = !inQuotes;
            else if (text[i] === ' ' && !inQuotes) lastSpace = i;
        }
        return {
            beforeWord: text.substring(0, lastSpace + 1),
            currentWord: text.substring(lastSpace + 1)
        };
    }

    function getRelativePath(targetParts, baseParts) {
        if (targetParts.length > 0 && baseParts.length > 0 && targetParts[0] !== baseParts[0]) {
            return targetParts.join('\\') + '\\';
        }

        let common = 0;
        while (common < targetParts.length && common < baseParts.length && targetParts[common] === baseParts[common]) {
            common++;
        }
        
        let up = [];
        for (let i = common; i < baseParts.length; i++) {
            up.push("..");
        }
        
        let down = targetParts.slice(common);
        
        let parts = up.concat(down);
        if (parts.length === 0) return "";
        return parts.join('\\') + '\\';
    }

    function getPathMatches(input) {
        let cleanInput = input.replace(/"/g, '');
        let parts = cleanInput.split(/[/\\]/);
        let filePart = parts.pop() || "";
        let dirParts = parts;

        let currentNode = getNode(currentPath);
        let currentPathParts = [...currentPath];

        for (let part of dirParts) {
            if (!currentNode || typeof currentNode !== 'object') return [];
            
            if (part.endsWith(":")) {
                currentPathParts = [part.toUpperCase()];
                currentNode = getNode(currentPathParts);
                if (!currentNode) return [];
                continue;
            }

            if (part === ".") continue;
            if (part === "..") {
                if (currentPathParts.length > 1) {
                    currentPathParts.pop();
                    currentNode = getNode(currentPathParts);
                }
                continue;
            }

            let keys = Object.keys(currentNode);
            let match = keys.find(k => k.toLowerCase() === part.toLowerCase());
            if (!match) {
                let partials = keys.filter(k => k.toLowerCase().startsWith(part.toLowerCase()));
                if (partials.length === 1) {
                    match = partials[0];
                } else {
                    return []; 
                }
            }
            currentNode = currentNode[match];
            currentPathParts.push(match);
        }

        if (!currentNode || typeof currentNode !== 'object') return [];

        let matches = [];
        if (filePart === ".") {
            matches = ["."];
        } else if (filePart === "..") {
            matches = [".."];
        } else {
            matches = Object.keys(currentNode).filter(k => k.toLowerCase().startsWith(filePart.toLowerCase()));
        }

        let dirString = getRelativePath(currentPathParts, currentPath);

        return matches.map(m => {
            const isDir = (m === "." || m === "..") ? true : (typeof currentNode[m] === 'object');
            return {
                name: m,
                isDir: isDir,
                dirPart: dirString
            };
        });
    }

    function formatCompletion(match, isCommand) {
        if (isCommand) return match;
        
        let combined = match.dirPart + match.name;
        
        if (combined.includes(' ')) {
            combined = combined.replace(/"/g, ''); 
            combined = '"' + combined + '"';
        }
        
        return combined;
    }

    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();

            const val = cmdInput.value;
            const cursorPos = cmdInput.selectionStart;
            const textBeforeCursor = val.substring(0, cursorPos);

            if (cycleMatches.length > 0) {
                let isValid = false;
                
                if (val.startsWith(cycleBeforeWord) && val.endsWith(cycleAfterWord)) {
                    const middle = val.substring(cycleBeforeWord.length, val.length - cycleAfterWord.length);
                    
                    if (middle !== "") {
                        const activeMatch = cycleMatches[cycleIndex];
                        if (isCyclingCommand) {
                            if (activeMatch.startsWith(middle)) isValid = true;
                        } else {
                            let cleanMiddle = middle.replace(/"/g, '');
                            let matchString = (activeMatch.dirPart + activeMatch.name).replace(/"/g, '');
                            
                            if (matchString.toLowerCase().startsWith(cleanMiddle.toLowerCase())) {
                                isValid = true;
                            }
                        }
                    }
                }

                if (isValid) {
                    if (e.shiftKey) {
                        cycleIndex = (cycleIndex - 1 + cycleMatches.length) % cycleMatches.length;
                    } else {
                        cycleIndex = (cycleIndex + 1) % cycleMatches.length;
                    }
                    
                    const match = cycleMatches[cycleIndex];
                    const completion = formatCompletion(match, isCyclingCommand);
                    
                    cmdInput.value = cycleBeforeWord + completion + cycleAfterWord;
                    const newCursorPos = cycleBeforeWord.length + completion.length;
                    cmdInput.setSelectionRange(newCursorPos, newCursorPos);
                    return;
                }
            }

            cycleMatches = [];
            cycleIndex = -1;

            const { beforeWord, currentWord } = getWordInfo(textBeforeCursor);
            const words = textBeforeCursor.split(' ');
            const cmd = words[0].toLowerCase();
            
            let matches = [];

            if (words.length === 1) {
                if (currentWord === "") return;
                matches = Object.keys(commands).filter(c => c.startsWith(currentWord.toLowerCase()));
                isCyclingCommand = true;
            } else {
                if (!pathCommands.includes(cmd)) return;
                matches = getPathMatches(currentWord);
                isCyclingCommand = false;
            }

            if (matches.length > 0) {
                cycleMatches = matches;
                cycleIndex = 0;
                cycleBeforeWord = beforeWord;
                cycleAfterWord = val.substring(cursorPos);

                const match = cycleMatches[0];
                const completion = formatCompletion(match, isCyclingCommand);
                
                cmdInput.value = cycleBeforeWord + completion + cycleAfterWord;
                const newCursorPos = cycleBeforeWord.length + completion.length;
                cmdInput.setSelectionRange(newCursorPos, newCursorPos);
            }
            return;
        }

        if (e.key === 'Enter') {
            const rawInput = cmdInput.value;
            const trimmedInput = rawInput.trim();
            
            print(promptText.textContent + rawInput);

            if (trimmedInput !== "") {
                const parts = [];
                let currentPart = '';
                let inQuotes = false;
                
                for (let i = 0; i < trimmedInput.length; i++) {
                    const char = trimmedInput[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ' ' && !inQuotes) {
                        if (currentPart.length > 0) {
                            parts.push(currentPart);
                            currentPart = '';
                        }
                    } else {
                        currentPart += char;
                    }
                }
                if (currentPart.length > 0) {
                    parts.push(currentPart);
                }

                const cmd = parts[0].toLowerCase();
                const args = parts.slice(1);

                if (commands[cmd]) {
                    commands[cmd](args, {
                        print: print,
                        clearScreen: clearScreen,
                        closeWindow: onClose
                    });
                    updatePrompt();
                } else {
                    print(`'${cmd}' is not recognized as an internal or external command,`);
                    print("operable program or batch file.");
                    print("");
                }
            }

            cmdInput.value = "";
            cycleMatches = [];
            scrollToBottom();
        }
    });

    window.addEventListener('load', () => {
        reset();
    });

    return {
        focus: () => cmdInput.focus(),
        reset: reset
    };
}