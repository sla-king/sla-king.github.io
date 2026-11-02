import { commands } from './commands.js';

export function initTerminal(onClose) {
    const consoleBody = document.getElementById("console-body");
    const consoleOutput = document.getElementById("console-output");
    const cmdInput = document.getElementById("cmd-input");
    const promptText = document.getElementById("prompt-text");

    const initialText = "Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\n";

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
        scrollToBottom();
    }

    consoleBody.addEventListener('click', () => {
        cmdInput.focus();
    });

    cmdInput.addEventListener('keydown', (e) => {
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