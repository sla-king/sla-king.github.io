import { currentPath, setPath, getPathString, resolvePath, getNode } from './filesystem.js';

export const commands = {
    help: (args, context) => {
        context.print("For more information on a specific command, type HELP command-name");
        context.print("CD        Displays the name of or changes the current directory.");
        context.print("DIR       Displays a list of files and subdirectories in a directory.");
        context.print("TYPE      Displays the contents of a text file.");
        context.print("ECHO      Displays messages.");
        context.print("CLS       Clears the screen.");
        context.print("EXIT      Quits the CMD.EXE program (or closes the window).");
        context.print("");
    },
    
    ls: (args, context) => {
        commands.dir(args, context);
    },
    cat: (args, context) => {
        commands.type(args, context);
    },
    clear: (args, context) => {
        commands.cls(args, context);
    },
    chdir: (args, context) => {
        commands.cd(args, context);
    },

    cls: (args, context) => {
        context.clearScreen();
    },
    exit: (args, context) => {
        context.closeWindow();
    },
    echo: (args, context) => {
        context.print(args.join(' '));
    },
    dir: (args, context) => {
        const targetPath = args.length > 0 ? resolvePath(args[0]) : currentPath;
        const node = getNode(targetPath);

        if (node === null || typeof node === 'string') {
            context.print("File Not Found");
            context.print("");
            return;
        }

        context.print("");
        context.print(` Volume in drive C has no label.`);
        context.print(` Directory of ${getPathString(targetPath)}\n`);
        
        let fileCount = 0;
        let dirCount = 0;
        let totalBytes = 0;
        
        const time = "11/01/2026  11:39 PM";

        if (targetPath.length > 1) {
            context.print(`${time}    <DIR>          .`);
            context.print(`${time}    <DIR>          ..`);
            dirCount += 2;
        }

        for (const key in node) {
            if (typeof node[key] === 'object') {
                context.print(`${time}    <DIR>          ${key}`);
                dirCount++;
            } else {
                const size = node[key].length;
                totalBytes += size;
                context.print(`${time}    ${size.toString().padStart(14)} ${key}`);
                fileCount++;
            }
        }

        context.print(`               ${fileCount} File(s)   ${totalBytes.toString().padStart(14)} bytes`);
        context.print(`               ${dirCount} Dir(s)   1,234,567,890 bytes free`);
        context.print("");
    },
    cd: (args, context) => {
        if (args.length === 0) {
            return;
        }

        const targetPath = resolvePath(args[0]);
        const node = getNode(targetPath);

        if (node === null || typeof node === 'string') {
            context.print("The system cannot find the path specified.");
            context.print("");
            return;
        }

        setPath(targetPath);
    },
    type: (args, context) => {
        if (args.length === 0) {
            context.print("The syntax of the command is incorrect.");
            context.print("");
            return;
        }

        const targetPath = resolvePath(args[0]);
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
    }
};