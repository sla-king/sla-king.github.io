import { commands } from './commands.js';
import { currentPath, getPathString, setPath, getNode, resolvePath } from './filesystem.js';

export function initTerminal(onClose) {
    const consoleBody = document.getElementById("console-body");
    const consoleOutput = document.getElementById("console-output");
    const cmdInput = document.getElementById("cmd-input");
    const promptText = document.getElementById("prompt-text");

    const initialText = "Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\n";
    let lastKeyWasTab = false;

    const pathCommands = ['cd', 'chdir', 'dir', 'type'];

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
        setPath(["C:", "Users", "sla-king"]);
        updatePrompt();
        scrollToBottom();
    }

    consoleBody.addEventListener('click', () => {
        cmdInput.focus();
    });

    function getPathMatches(input, basePath) {
        let lastSlashIdx = Math.max(input.lastIndexOf('/'), input.lastIndexOf('\\'));
        let dirPart = "";
        let filePart = "";

        if (lastSlashIdx !== -1) {
            dirPart = input.substring(0, lastSlashIdx + 1);
            filePart = input.substring(lastSlashIdx + 1);
        } else {
            filePart = input;
        }

        const dirPath = resolvePath(dirPart);
        const currentNode = getNode(dirPath);

        if (!currentNode || typeof currentNode !== 'object') return [];

        let matches = [];
        if (filePart === ".") {
            matches = ["."];
        } else if (filePart === "..") {
            matches = [".."];
        } else {
            matches = Object.keys(currentNode).filter(k => k.toLowerCase().startsWith(filePart.toLowerCase()));
        }

        return matches.map(m => {
            const isDir = (m === "." || m === "..") ? true : (typeof currentNode[m] === 'object');
            return {
                name: m,
                isDir: isDir,
                completion: dirPart + m
            };
        });
    }

    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const val = cmdInput.value;
            const cursorPos = cmdInput.selectionStart;
            const textBeforeCursor = val.substring(0, cursorPos);
            const words = textBeforeCursor.split(' ');
            const currentWord = words[words.length - 1];
            const cmd = words[0].toLowerCase();
            let matches = [];

            if (words.length === 1) {
                if (currentWord === "") return;

                matches = Object.keys(commands).filter(c => c.startsWith(currentWord.toLowerCase()));
                
                if (matches.length === 1) {
                    const completion = matches[0];
                    cmdInput.value = completion + val.substring(cursorPos);
                    cmdInput.setSelectionRange(completion.length, completion.length);
                    lastKeyWasTab = false;
                } else if (matches.length > 1) {
                    if (lastKeyWasTab) {
                        print(promptText.textContent + val);
                        print(matches.join("    "));
                        lastKeyWasTab = false;
                    } else {
                        lastKeyWasTab = true;
                    }
                } else {
                    lastKeyWasTab = false;
                }
            } else {
                if (!pathCommands.includes(cmd)) {
                    lastKeyWasTab = false;
                    return;
                }

                const pathMatches = getPathMatches(currentWord, currentPath);
                
                if (pathMatches.length === 1) {
                    const match = pathMatches[0];
                    let completion = match.completion;
                    if (match.isDir) {
                        completion += '/';
                    }
                    
                    const beforeWord = textBeforeCursor.substring(0, textBeforeCursor.length - currentWord.length);
                    const afterCursor = val.substring(cursorPos);
                    cmdInput.value = beforeWord + completion + afterCursor;
                    
                    const newCursorPos = beforeWord.length + completion.length;
                    cmdInput.setSelectionRange(newCursorPos, newCursorPos);
                    lastKeyWasTab = false;
                } else if (pathMatches.length > 1) {
                    if (lastKeyWasTab) {
                        print(promptText.textContent + val);
                        print(pathMatches.map(m => m.name).join("    "));
                        lastKeyWasTab = false;
                    } else {
                        lastKeyWasTab = true;
                    }
                } else {
                    lastKeyWasTab = false;
                }
            }
            return;
        }

        lastKeyWasTab = false;

        if (e.key === 'Enter') {
            const rawInput = cmdInput.value;
            const trimmedInput = rawInput.trim();
            
            print(promptText.textContent + rawInput);

            if (trimmedInput !== "") {
                const parts = trimmedInput.split(' ');
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