import { currentPath, setPath, getPathString, resolvePath, getNode, fileDates, getLatestDateInNode } from './filesystem.js';

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
        const pathString = args.join(' ');
        
        if (pathString.length === 0) {
            context.print(getPathString());
            return;
        }

        const targetPath = resolvePath(pathString);
        const node = getNode(targetPath);

        if (node === null || typeof node === 'string') {
            context.print("The system cannot find the path specified.");
            context.print("");
            return;
        }

        setPath(targetPath);
    },
    cls: (args, context) => {
        context.clearScreen();
    },
    dir: (args, context) => {
        const pathString = args.join(' ');
        const targetPath = pathString.length > 0 ? resolvePath(pathString) : currentPath;
        const node = getNode(targetPath);

        if (node === null || typeof node === 'string') {
            context.print("File Not Found");
            context.print("");
            return;
        }

        context.print(` Volume in drive C has no label.`);
        context.print(` Volume Serial Number is 0CB7-868B`);
        context.print("");
        context.print(` Directory of ${getPathString(targetPath)}\n`);
        
        let fileCount = 0;
        let dirCount = 0;
        let totalBytes = 0;
        
        const defaultTime = "11/01/2026  11:39 PM";

        if (targetPath.length > 1) {
            const dotTime = getLatestDateInNode(node, defaultTime);
            
            const parentPath = targetPath.slice(0, -1);
            const parentNode = getNode(parentPath);
            const dotdotTime = parentNode ? getLatestDateInNode(parentNode, defaultTime) : defaultTime;
            
            context.print(`${dotTime}    <DIR>          .`);
            context.print(`${dotdotTime}    <DIR>          ..`);
            dirCount += 2;
        }

        for (const key in node) {
            if (typeof node[key] === 'object') {
                const folderTime = getLatestDateInNode(node[key], defaultTime);
                context.print(`${folderTime}    <DIR>          ${key}`);
                dirCount++;
            } else {
                const time = fileDates[key] || defaultTime;
                const size = node[key].length;
                totalBytes += size;
                context.print(`${time}    ${size.toString().padStart(14)} ${key}`);
                fileCount++;
            }
        }

        context.print(`               ${fileCount} File(s)   ${totalBytes.toString().padStart(14)} bytes`);
        context.print(`               ${dirCount} Dir(s)   94,983,632 bytes free`);
        context.print("");
    },
    exit: (args, context) => {
        context.closeWindow();
    },
    type: (args, context) => {
        const pathString = args.join(' ');

        if (pathString.length === 0) {
            context.print("The syntax of the command is incorrect.");
            context.print("");
            return;
        }

        const targetPath = resolvePath(pathString);
        const node = getNode(targetPath);

        if (node === null) {
            context.print("The system cannot find the file specified.");
            context.print("");
            return;
        }

        if (typeof node === 'object') {
            context.print("Access is denied.");
            context.print("");
            return;
        }

        context.print(node);
        context.print("");
    },

    cat: (args, context) => {
        commands.type(args, context);
    },
    chdir: (args, context) => {
        commands.cd(args, context);
    },
    clear: (args, context) => {
        commands.cls(args, context);
    },
    ls: (args, context) => {
        commands.dir(args, context);
    }
};