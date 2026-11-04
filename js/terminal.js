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
    
    let printQueue = Promise.resolve();
    let printSession = 0;
    let isProcessing = false;

    let commandHistory = [];
    let historyIndex = 0;

    function updatePrompt() {
        promptText.textContent = getPathString() + ">";
        scrollToBottom();
    }

    function print(text) {
        const currentSession = printSession;
        printQueue = printQueue.then(async () => {
            if (currentSession !== printSession) return;
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (currentSession !== printSession) return;
                consoleOutput.textContent += lines[i] + "\n";
                scrollToBottom();
                await new Promise(r => setTimeout(r, 10));
            }
        });
        return printQueue;
    }

    function scrollToBottom() {
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }

    function clearScreen() {
        printSession++;
        printQueue = Promise.resolve();
        consoleOutput.textContent = "";
        scrollToBottom();
    }

    function reset() {
        clearScreen();
        consoleOutput.textContent = initialText;
        cmdInput.value = "";
        setPath(["C:", "Documents and Settings", "sla-king"]);
        commandHistory = [];
        historyIndex = 0;
        updatePrompt();
        scrollToBottom();
    }

    consoleBody.addEventListener('click', () => {
        if (window.getSelection().toString().length > 0) return;
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

    function getPathMatches(input) {
        let lastSlashIdx = Math.max(input.lastIndexOf('/'), input.lastIndexOf('\\'));
        let dirPart = "";
        let filePart = "";

        if (lastSlashIdx !== -1) {
            dirPart = input.substring(0, lastSlashIdx + 1);
            filePart = input.substring(lastSlashIdx + 1);
        } else {
            filePart = input;
        }

        let cleanDir = dirPart.replace(/"/g, '');
        const dirPath = resolvePath(cleanDir);
        const currentNode = getNode(dirPath);

        if (!currentNode || typeof currentNode !== 'object') return [];

        let matches = [];
        let cleanFile = filePart.replace(/"/g, '');

        if (cleanFile === ".") {
            matches = ["."];
        } else if (cleanFile === "..") {
            matches = [".."];
        } else {
            matches = Object.keys(currentNode).filter(k => k.toLowerCase().startsWith(cleanFile.toLowerCase()));
        }

        return matches.map(m => {
            const isDir = (m === "." || m === "..") ? true : (typeof currentNode[m] === 'object');
            return {
                name: m,
                isDir: isDir,
                dirPart: dirPart 
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

    cmdInput.addEventListener('keydown', async (e) => {
        if (isProcessing) {
            e.preventDefault();
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                cmdInput.value = commandHistory[historyIndex];
                const len = cmdInput.value.length;
                cmdInput.setSelectionRange(len, len);
                cycleMatches = [];
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                cmdInput.value = commandHistory[historyIndex];
            } else if (historyIndex === commandHistory.length - 1) {
                historyIndex++;
                cmdInput.value = "";
            }
            const len = cmdInput.value.length;
            cmdInput.setSelectionRange(len, len);
            cycleMatches = [];
            return;
        }

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
            isProcessing = true;
            
            const rawInput = cmdInput.value;
            const trimmedInput = rawInput.trim();

            if (trimmedInput !== "") {
                commandHistory.push(trimmedInput);
                if (commandHistory.length > 50) {
                    commandHistory.shift();
                }
            }
            historyIndex = commandHistory.length;
            
            cmdInput.value = "";
            cycleMatches = [];

            consoleOutput.textContent += promptText.textContent + rawInput + "\n";
            scrollToBottom();

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
                    
                    await printQueue;
                } else {
                    print(`'${cmd}' is not recognized as an internal or external command,`);
                    print("operable program or batch file.");
                    print("");
                    await printQueue;
                }
            }

            updatePrompt();
            isProcessing = false;
            cmdInput.focus();
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