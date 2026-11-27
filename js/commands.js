import {
    DEFAULT_FILE_DATE,
    currentPath,
    setPath,
    getPathString,
    resolvePath,
    getNode,
    isFileNode,
    isFolderNode,
    getDriveFreeBytes,
    getLatestDateInNode
} from './filesystem.js';
import { openFileNode } from './launcher.js';
import { openExplorer, openWebExplorer, isWebUrl } from './apps/ExplorerWindow.js';
import { openNotepad } from './apps/NotepadWindow.js';

function resolveFileTarget(args, context) {
    const pathString = args.join(" ");
    if (!pathString) {
        context.print("The syntax of the command is incorrect.\n");
        return null;
    }

    const targetPath = resolvePath(pathString);
    const node = getNode(targetPath);

    if (node === null) {
        context.print("The system cannot find the file specified.\n");
        return null;
    }
    if (isFolderNode(node)) {
        context.print("Access is denied.\n");
        return null;
    }

    return { targetPath, node };
}

function openTarget(pathString, context, notFoundMessage) {
    if (isWebUrl(pathString)) {
        openWebExplorer();
        return;
    }

    const targetPath = resolvePath(pathString);
    const node = getNode(targetPath);

    if (node === null) {
        context.print(notFoundMessage);
        return;
    }

    if (isFolderNode(node)) {
        openExplorer(targetPath);
        return;
    }

    openFileNode(targetPath, node, { autoplay: true });
}

export const commands = {
    help: (args, context) => {
        context.print("CD        Displays the name of or changes the current directory.");
        context.print("CLS       Clears the screen.");
        context.print("DIR       Displays a list of files and subdirectories in a directory.");
        context.print("EXIT      Quits the CMD.EXE program (command interpreter).");
        context.print("START     Starts a separate window to run a specified program or command.")
        context.print("TYPE      Displays the contents of a text file.");
        context.print("");
    },

    cd: (args, context) => {
        const pathString = args.join(" ");
        if (!pathString) {
            context.print(getPathString());
            return;
        }

        const targetPath = resolvePath(pathString);
        const node = getNode(targetPath);

        if (node === null || isFileNode(node)) {
            context.print("The system cannot find the path specified.\n");
            return;
        }

        setPath(targetPath);
    },

    cls: (args, context) => {
        context.clearScreen();
    },

    dir: (args, context) => {
        const pathString = args.join(" ");
        const targetPath = pathString ? resolvePath(pathString) : currentPath;
        const node = getNode(targetPath);

        if (node === null || isFileNode(node)) {
            context.print("File Not Found\n");
            return;
        }

        context.print(" Volume in drive C has no label.");
        context.print(" Volume Serial Number is 0CB7-868B\n");
        context.print(` Directory of ${getPathString(targetPath)}\n`);

        let fileCount = 0;
        let dirCount = 0;
        let currentDirBytes = 0;
        const defaultTime = DEFAULT_FILE_DATE;

        if (targetPath.length > 1) {
            const dotTime = getLatestDateInNode(node, defaultTime);
            const parentNode = getNode(targetPath.slice(0, -1));
            const dotdotTime = parentNode ? getLatestDateInNode(parentNode, defaultTime) : defaultTime;

            context.print(`${dotTime}    <DIR>          .`);
            context.print(`${dotdotTime}    <DIR>          ..`);
            dirCount += 2;
        }

        for (const [key, value] of Object.entries(node)) {
            if (isFolderNode(value)) {
                const folderTime = getLatestDateInNode(value, defaultTime);
                context.print(`${folderTime}    <DIR>          ${key}`);
                dirCount++;
            } else {
                const time = value.date;
                const size = value.size;
                currentDirBytes += size;
                context.print(`${time}    ${size.toLocaleString("en-US").padStart(14)} ${key}`);
                fileCount++;
            }
        }

        const freeBytes = getDriveFreeBytes(targetPath[0]);
        const fileSummaryCount = fileCount.toString().padStart(16);
        const dirSummaryCount = dirCount.toString().padStart(16);
        const fileSummaryBytes = currentDirBytes.toLocaleString("en-US").padStart(15);
        const freeSummaryBytes = freeBytes.toLocaleString("en-US").padStart(15);
        context.print(`${fileSummaryCount} File(s)${fileSummaryBytes} bytes`);
        context.print(`${dirSummaryCount} Dir(s) ${freeSummaryBytes} bytes free\n`);
    },

    exit: (args, context) => {
        context.closeWindow();
    },

    explorer: (args, context) => {
        const pathString = args.join(" ").trim();
        if (!pathString) {
            openExplorer();
            return;
        }

        openTarget(pathString, context, "The system cannot find the path specified.\n");
    },

    notepad: (args, context) => {
        const target = resolveFileTarget(args, context);
        if (!target) return;

        const fileName = target.targetPath[target.targetPath.length - 1];
        openNotepad(fileName, target.node.content, getPathString(target.targetPath));
    },

    start: (args, context) => {
        if (args.length === 0) {
            context.print("The syntax of the command is incorrect.\n");
            return;
        }

        const first = args[0].toLowerCase();
        if (first === "explorer" || first === "explorer.exe") {
            commands.explorer(args.slice(1), context);
            return;
        }
        if (first === "notepad" || first === "notepad.exe") {
            commands.notepad(args.slice(1), context);
            return;
        }
        if ((first === "iexplore" || first === "iexplore.exe") && args.length === 1) {
            openWebExplorer();
            return;
        }

        openTarget(args.join(" ").trim(), context, "The system cannot find the file specified.\n");
    },

    type: (args, context) => {
        const target = resolveFileTarget(args, context);
        if (!target) return;

        context.print(target.node.content ? `${target.node.content}\n` : "");
    }
};

commands.cat = commands.type;
commands.chdir = commands.cd;
commands.clear = commands.cls;
commands["Clear-Host"] = commands.cls;
commands["explorer.exe"] = commands.explorer;
commands.gc = commands.type;
commands.gci = commands.dir;
commands["Get-ChildItem"] = commands.dir;
commands["Get-Content"] = commands.type;
commands["Get-Help"] = commands.help;
commands.ii = commands.start;
commands["Invoke-Item"] = commands.start;
commands.ls = commands.dir;
commands.man = commands.help;
commands["notepad.exe"] = commands.notepad;
commands.saps = commands.start;
commands["Set-Location"] = commands.cd;
commands.sl = commands.cd;
commands["Start-Process"] = commands.start;
