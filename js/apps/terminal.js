import { commands } from './commands.js';
import { HOME_PATH, getPathString, setPath, getNode, resolvePath } from '../filesystem.js';
import { registerWindow, closeWindow } from '../windowManager.js';

function parseArgs(input) {
    const parts = [];
    let current = "";
    let inQuotes = false;

    for (const char of input) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === " " && !inQuotes) {
            if (current) {
                parts.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }
    if (current) parts.push(current);
    return parts;
}

export function initTerminal() {
    const consoleBody = document.getElementById("console-body");
    const consoleOutput = document.getElementById("console-output");
    const cmdInput = document.getElementById("cmd-input");
    const promptText = document.getElementById("prompt-text");

    const initialText = "Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\n";
    const pathCommands = ["cd", "chdir", "dir", "ls", "type", "cat"];

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

    function scrollToBottom() {
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }

    function updatePrompt() {
        promptText.textContent = `${getPathString()}>`;
        scrollToBottom();
    }

    function print(text) {
        const currentSession = printSession;
        printQueue = printQueue.then(async () => {
            if (currentSession !== printSession) return;
            for (const line of text.split("\n")) {
                if (currentSession !== printSession) return;
                consoleOutput.textContent += `${line}\n`;
                scrollToBottom();
                await new Promise(r => setTimeout(r, 10));
            }
        });
        return printQueue;
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
        setPath([...HOME_PATH]);
        commandHistory = [];
        historyIndex = 0;
        updatePrompt();
    }

    registerWindow({
        id: "terminal",
        winEl: document.getElementById("command-window"),
        onClose: reset,
        onBlur: () => cmdInput.blur()
    });

    consoleBody.addEventListener("click", (e) => {
        if (window.getSelection().toString().length > 0) return;
        if (window.matchMedia("(pointer: fine)").matches || e.target.closest(".input-line")) {
            cmdInput.focus({ preventScroll: true });
        }
    });

    function getWordInfo(text) {
        let inQuotes = false;
        let lastSpace = -1;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '"') inQuotes = !inQuotes;
            else if (text[i] === " " && !inQuotes) lastSpace = i;
        }
        return {
            beforeWord: text.substring(0, lastSpace + 1),
            currentWord: text.substring(lastSpace + 1)
        };
    }

    function getPathMatches(input) {
        const lastSlashIdx = Math.max(input.lastIndexOf("/"), input.lastIndexOf("\\"));
        const dirPart = lastSlashIdx !== -1 ? input.substring(0, lastSlashIdx + 1) : "";
        const filePart = lastSlashIdx !== -1 ? input.substring(lastSlashIdx + 1) : input;

        const currentNode = getNode(resolvePath(dirPart.replace(/"/g, "")));
        if (!currentNode || typeof currentNode !== "object") return [];

        const cleanFile = filePart.replace(/"/g, "");
        const names = (cleanFile === "." || cleanFile === "..")
            ? [cleanFile]
            : Object.keys(currentNode).filter(k => k.toLowerCase().startsWith(cleanFile.toLowerCase()));

        return names.map(name => ({ name, dirPart }));
    }

    function applyCompletion(match) {
        let completion = isCyclingCommand ? match : `${match.dirPart}${match.name}`;
        if (!isCyclingCommand && completion.includes(" ")) {
            completion = `"${completion.replace(/"/g, "")}"`;
        }
        cmdInput.value = cycleBeforeWord + completion + cycleAfterWord;
        const newPos = cycleBeforeWord.length + completion.length;
        cmdInput.setSelectionRange(newPos, newPos);
    }

    cmdInput.addEventListener("keydown", async (e) => {
        if (isProcessing) {
            e.preventDefault();
            return;
        }

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            if (e.key === "ArrowUp" && historyIndex > 0) {
                cmdInput.value = commandHistory[--historyIndex];
            } else if (e.key === "ArrowDown") {
                if (historyIndex < commandHistory.length - 1) {
                    cmdInput.value = commandHistory[++historyIndex];
                } else if (historyIndex === commandHistory.length - 1) {
                    historyIndex++;
                    cmdInput.value = "";
                }
            }
            const len = cmdInput.value.length;
            cmdInput.setSelectionRange(len, len);
            cycleMatches = [];
            return;
        }

        if (e.key === "Tab") {
            e.preventDefault();
            const val = cmdInput.value;
            const cursorPos = cmdInput.selectionStart;
            const textBeforeCursor = val.substring(0, cursorPos);

            if (cycleMatches.length > 0 && val.startsWith(cycleBeforeWord) && val.endsWith(cycleAfterWord)) {
                const middle = val.substring(cycleBeforeWord.length, val.length - cycleAfterWord.length);
                const activeMatch = cycleMatches[cycleIndex];
                const isValid = middle !== "" && (
                    isCyclingCommand
                        ? activeMatch.startsWith(middle)
                        : `${activeMatch.dirPart}${activeMatch.name}`.replace(/"/g, "").toLowerCase().startsWith(middle.replace(/"/g, "").toLowerCase())
                );

                if (isValid) {
                    const step = e.shiftKey ? -1 : 1;
                    cycleIndex = (cycleIndex + step + cycleMatches.length) % cycleMatches.length;
                    applyCompletion(cycleMatches[cycleIndex]);
                    return;
                }
            }

            cycleMatches = [];
            cycleIndex = -1;

            const { beforeWord, currentWord } = getWordInfo(textBeforeCursor);
            const words = textBeforeCursor.split(" ");
            const cmd = words[0].toLowerCase();

            if (words.length === 1) {
                if (!currentWord) return;
                cycleMatches = Object.keys(commands).filter(c => c.startsWith(currentWord.toLowerCase()));
                isCyclingCommand = true;
            } else if (pathCommands.includes(cmd)) {
                cycleMatches = getPathMatches(currentWord);
                isCyclingCommand = false;
            }

            if (cycleMatches.length > 0) {
                cycleIndex = 0;
                cycleBeforeWord = beforeWord;
                cycleAfterWord = val.substring(cursorPos);
                applyCompletion(cycleMatches[0]);
            }
            return;
        }

        if (e.key === "Enter") {
            isProcessing = true;
            const rawInput = cmdInput.value;
            const trimmedInput = rawInput.trim();

            if (trimmedInput) {
                commandHistory.push(trimmedInput);
                if (commandHistory.length > 50) commandHistory.shift();
            }
            historyIndex = commandHistory.length;
            cmdInput.value = "";
            cycleMatches = [];

            consoleOutput.textContent += `${promptText.textContent}${rawInput}\n`;
            scrollToBottom();

            if (trimmedInput) {
                const [cmdName, ...args] = parseArgs(trimmedInput);
                const cmd = cmdName.toLowerCase();

                if (commands[cmd]) {
                    commands[cmd](args, {
                        print,
                        clearScreen,
                        closeWindow: () => closeWindow("terminal")
                    });
                } else {
                    print(`'${cmd}' is not recognized as an internal or external command,\noperable program or batch file.\n`);
                }
                await printQueue;
            }

            updatePrompt();
            isProcessing = false;
            cmdInput.focus({ preventScroll: true });
        }
    });

    window.addEventListener("load", reset);
}