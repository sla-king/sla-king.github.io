import { XPWindow } from '../os/XPWindow.js';
import { Autocomplete } from '../os/Autocomplete.js';
import { HOME_PATH, getPathString, setPath, getNode, isFolderNode, resolvePath } from '../filesystem.js';
import { commands } from '../commands.js';

const INITIAL_TEXT = "Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\n";
const HIDDEN_COMMAND_COMPLETIONS = new Set(["explorer", "notepad"]);
const PATH_COMMANDS = [
    "cat", "cd", "chdir", "dir", "explorer", "explorer.exe", "gc", "gci",
    "get-childitem", "get-content", "ii", "invoke-item", "ls", "notepad",
    "notepad.exe", "saps", "set-location", "sl", "start", "start-process", "type"
];

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

function findCommand(name) {
    const lower = name.toLowerCase();
    if (commands[lower]) return commands[lower];
    const key = Object.keys(commands).find((k) => k.toLowerCase() === lower);
    return key ? commands[key] : null;
}

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
    if (!isFolderNode(currentNode)) return [];

    const cleanFile = filePart.replace(/"/g, "");
    const names = (cleanFile === "." || cleanFile === "..")
        ? [cleanFile]
        : Object.keys(currentNode).filter((k) => k.toLowerCase().startsWith(cleanFile.toLowerCase()));

    return names.map((name) => ({ name, dirPart }));
}

// Command Prompt window
export class TerminalApp extends XPWindow {
    constructor(winEl) {
        super({ id: "terminal", winEl });

        this.consoleBody = document.getElementById("console-body");
        this.consoleOutput = document.getElementById("console-output");
        this.cmdInput = document.getElementById("cmd-input");
        this.promptText = document.getElementById("prompt-text");

        this.autocomplete = new Autocomplete();
        this.printQueue = Promise.resolve();
        this.printSession = 0;
        this.isProcessing = false;
        this.commandHistory = [];
        this.historyIndex = 0;

        this.bindEvents();
        this.reset();
    }

    onClose() {
        this.reset();
    }

    onBlur() {
        this.cmdInput?.blur();
    }

    scrollToBottom() {
        if (this.consoleBody) {
            this.consoleBody.scrollTop = this.consoleBody.scrollHeight;
        }
    }

    updatePrompt() {
        if (this.promptText) {
            this.promptText.textContent = `${getPathString()}>`;
        }
        this.scrollToBottom();
    }

    print(text) {
        const currentSession = this.printSession;
        this.printQueue = this.printQueue.then(async () => {
            if (currentSession !== this.printSession) return;
            for (const line of text.split("\n")) {
                if (currentSession !== this.printSession) return;
                this.consoleOutput.textContent += `${line}\n`;
                this.scrollToBottom();
                await new Promise((r) => setTimeout(r, 10));
            }
        });
        return this.printQueue;
    }

    clearScreen() {
        this.printSession++;
        this.printQueue = Promise.resolve();
        this.consoleOutput.textContent = "";
        this.scrollToBottom();
    }

    reset() {
        this.clearScreen();
        this.consoleOutput.textContent = INITIAL_TEXT;
        this.cmdInput.value = "";
        setPath([...HOME_PATH]);
        this.commandHistory = [];
        this.historyIndex = 0;
        this.autocomplete.reset();
        this.updatePrompt();
    }

    applyCompletion(match) {
        const ctx = this.autocomplete.context;
        if (!ctx) return;

        let completion = ctx.isCommand ? match : `${match.dirPart}${match.name}`;
        if (!ctx.isCommand && completion.includes(" ")) {
            completion = `"${completion.replace(/"/g, "")}"`;
        }
        this.cmdInput.value = ctx.beforeWord + completion + ctx.afterWord;
        const newPos = ctx.beforeWord.length + completion.length;
        this.cmdInput.setSelectionRange(newPos, newPos);
    }

    handleTab(shiftKey) {
        const val = this.cmdInput.value;
        const cursorPos = this.cmdInput.selectionStart;
        const textBeforeCursor = val.substring(0, cursorPos);
        const ctx = this.autocomplete.context;

        if (this.autocomplete.hasMatches() && ctx && val.startsWith(ctx.beforeWord) && val.endsWith(ctx.afterWord)) {
            const middle = val.substring(ctx.beforeWord.length, val.length - ctx.afterWord.length);
            const activeMatch = this.autocomplete.current();
            const isValid = middle !== "" && activeMatch && (
                ctx.isCommand
                    ? activeMatch.toLowerCase().startsWith(middle.toLowerCase())
                    : `${activeMatch.dirPart}${activeMatch.name}`
                        .replace(/"/g, "")
                        .toLowerCase()
                        .startsWith(middle.replace(/"/g, "").toLowerCase())
            );

            if (isValid) {
                const stepped = this.autocomplete.step(shiftKey ? -1 : 1);
                if (stepped) this.applyCompletion(stepped.match);
                return;
            }
        }

        this.autocomplete.reset();

        const { beforeWord, currentWord } = getWordInfo(textBeforeCursor);
        const words = textBeforeCursor.split(" ");
        const cmd = words[0].toLowerCase();

        let matches = [];
        let isCommand = false;
        if (words.length === 1) {
            if (!currentWord) return;
            const lowerWord = currentWord.toLowerCase();
            matches = Object.keys(commands).filter(
                (c) => !HIDDEN_COMMAND_COMPLETIONS.has(c.toLowerCase()) &&
                    c.toLowerCase().startsWith(lowerWord)
            );
            isCommand = true;
        } else if (PATH_COMMANDS.includes(cmd)) {
            matches = getPathMatches(currentWord);
        }

        if (matches.length > 0) {
            this.autocomplete.setMatches(matches, {
                index: 0,
                context: {
                    beforeWord,
                    afterWord: val.substring(cursorPos),
                    isCommand
                }
            });
            this.applyCompletion(matches[0]);
        }
    }

    bindEvents() {
        this.consoleBody?.addEventListener("click", (e) => {
            if (window.getSelection().toString().length > 0) return;
            if (window.matchMedia("(pointer: fine)").matches || e.target.closest(".input-line")) {
                if (!this.winEl.classList.contains("unfocused")) {
                    this.cmdInput.focus({ preventScroll: true });
                }
            }
        });

        this.cmdInput?.addEventListener("keydown", async (e) => {
            if (this.isProcessing) {
                e.preventDefault();
                return;
            }

            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                if (e.key === "ArrowUp" && this.historyIndex > 0) {
                    this.cmdInput.value = this.commandHistory[--this.historyIndex];
                } else if (e.key === "ArrowDown") {
                    if (this.historyIndex < this.commandHistory.length - 1) {
                        this.cmdInput.value = this.commandHistory[++this.historyIndex];
                    } else if (this.historyIndex === this.commandHistory.length - 1) {
                        this.historyIndex++;
                        this.cmdInput.value = "";
                    }
                }
                const len = this.cmdInput.value.length;
                this.cmdInput.setSelectionRange(len, len);
                this.autocomplete.reset();
                return;
            }

            if (e.key === "Tab") {
                e.preventDefault();
                this.handleTab(e.shiftKey);
                return;
            }

            if (e.key === "Enter") {
                this.isProcessing = true;
                const rawInput = this.cmdInput.value;
                const trimmedInput = rawInput.trim();

                if (trimmedInput) {
                    this.commandHistory.push(trimmedInput);
                    if (this.commandHistory.length > 50) this.commandHistory.shift();
                }
                this.historyIndex = this.commandHistory.length;
                this.cmdInput.value = "";
                this.autocomplete.reset();

                this.consoleOutput.textContent += `${this.promptText.textContent}${rawInput}\n`;
                this.scrollToBottom();

                if (trimmedInput) {
                    const [cmdName, ...args] = parseArgs(trimmedInput);
                    const commandFn = findCommand(cmdName);

                    if (commandFn) {
                        commandFn(args, {
                            print: (text) => this.print(text),
                            clearScreen: () => this.clearScreen(),
                            closeWindow: () => this.close()
                        });
                    } else {
                        this.print(`'${cmdName}' is not recognized as an internal or external command,\noperable program or batch file.\n`);
                    }
                    await this.printQueue;
                }

                this.updatePrompt();
                this.isProcessing = false;
                if (!this.winEl.classList.contains("unfocused")) {
                    this.cmdInput.focus({ preventScroll: true });
                }
            }
        });
    }
}

let terminalInstance = null;

export function initTerminal() {
    if (terminalInstance) return terminalInstance;
    const winEl = document.getElementById("command-window");
    if (!winEl) return null;
    terminalInstance = new TerminalApp(winEl);
    return terminalInstance;
}
