import { currentPath, setPath, getPathString, resolvePath, getNode, fileDates, getLatestDateInNode } from '../filesystem.js';

export const commands = {
    help: (args, context) => {
        context.print("CD        Displays the name of or changes the current directory.");
        context.print("CLS       Clears the screen.");
        context.print("DIR       Displays a list of files and subdirectories in a directory.");
        context.print("EXIT      Quits the CMD.EXE program (command interpreter).");
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

        if (node === null || typeof node === "string") {
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

        if (node === null || typeof node === "string") {
            context.print("File Not Found\n");
            return;
        }

        context.print(" Volume in drive C has no label.");
        context.print(" Volume Serial Number is 0CB7-868B\n");
        context.print(` Directory of ${getPathString(targetPath)}\n`);

        let fileCount = 0;
        let dirCount = 0;
        let currentDirBytes = 0;
        const defaultTime = "11/01/2026  11:39 PM";

        if (targetPath.length > 1) {
            const dotTime = getLatestDateInNode(node, defaultTime);
            const parentNode = getNode(targetPath.slice(0, -1));
            const dotdotTime = parentNode ? getLatestDateInNode(parentNode, defaultTime) : defaultTime;

            context.print(`${dotTime}    <DIR>          .`);
            context.print(`${dotdotTime}    <DIR>          ..`);
            dirCount += 2;
        }

        for (const [key, value] of Object.entries(node)) {
            if (typeof value === "object") {
                const folderTime = getLatestDateInNode(value, defaultTime);
                context.print(`${folderTime}    <DIR>          ${key}`);
                dirCount++;
            } else {
                const time = fileDates[key] || defaultTime;
                const size = value.length;
                currentDirBytes += size;
                context.print(`${time}    ${size.toString().padStart(14)} ${key}`);
                fileCount++;
            }
        }

        const freeBytes = 9498362732;
        context.print(`               ${fileCount} File(s) ${currentDirBytes.toString().padStart(14)} bytes`);
        context.print(`               ${dirCount} Dir(s)  ${freeBytes.toLocaleString("en-US").padStart(14)} bytes free\n`);
    },

    exit: (args, context) => {
        context.closeWindow();
    },

    type: (args, context) => {
        const pathString = args.join(" ");
        if (!pathString) {
            context.print("The syntax of the command is incorrect.\n");
            return;
        }

        const targetPath = resolvePath(pathString);
        const node = getNode(targetPath);

        if (node === null) {
            context.print("The system cannot find the file specified.\n");
            return;
        }
        if (typeof node === "object") {
            context.print("Access is denied.\n");
            return;
        }

        context.print(node ? `${node}\n` : "");
    }
};

commands.cat = commands.type;
commands.chdir = commands.cd;
commands.clear = commands.cls;
commands.ls = commands.dir;