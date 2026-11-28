import {
    HOME_PATH,
    getFolderIcon,
    getNode,
    getPathString,
    isAudioFile,
    isFileNode,
    isFolderNode,
    isImageFile,
    isUrlFile,
    parseUrlFileContent
} from './filesystem.js';
import { SOUNDS, playSound } from './os/AudioMixer.js';
import { openWindow } from './os/windowManager.js';
import { openExplorer, openMyComputer, openWebExplorer } from './apps/ExplorerWindow.js';
import { openBlankNotepad, openNotepad } from './apps/NotepadWindow.js';
import { openMediaPlayer } from './apps/MediaPlayerApp.js';
import { openPictureViewer } from './apps/PictureViewerApp.js';
import { openLinkDialog } from './os/DialogManager.js';

// Apps and folders shown in the Start Menu and All Programs
export const APP_ACTIONS = {
    "explorer-web": {
        name: "Internet Explorer",
        icon: "assets/app_explorer_16.png",
        tooltip: "Opens your Internet browser.",
        launch: () => openWebExplorer()
    },
    email: {
        name: "E-mail",
        icon: "assets/app_outlook.png",
        tooltip: "Opens your e-mail program so you can send or read a message.",
        isLinkDialog: true,
        launch: () => openLinkDialog("email")
    },
    cmd: {
        name: "Command Prompt",
        icon: "assets/app_command_prompt_16.png",
        tooltip: "Performs text-based (command-line) functions.",
        launch: () => {
            openWindow("terminal");
            document.getElementById("cmd-input")?.focus({ preventScroll: true });
        }
    },
    notepad: {
        name: "Notepad",
        icon: "assets/app_notepad_16.png",
        tooltip: "Creates and edits text files using basic text formatting.",
        launch: () => openBlankNotepad()
    },
    "media-player": {
        name: "Windows Media Player",
        icon: "assets/app_media_player_16.png",
        tooltip: "Plays your digital media including music, videos, CDs, DVDs, and Internet Radio.",
        launch: () => openMediaPlayer()
    },
    linkedin: {
        name: "LinkedIn",
        icon: "assets/app_linkedin.png",
        tooltip: "Visit sla-king's LinkedIn profile.",
        isLinkDialog: true,
        launch: () => openLinkDialog("linkedin")
    },
    github: {
        name: "GitHub",
        icon: "assets/app_github.png",
        tooltip: "Visit sla-king's GitHub profile.",
        isLinkDialog: true,
        launch: () => openLinkDialog("github")
    },
    documents: {
        name: "My Documents",
        launch: () => openExplorer()
    },
    pictures: {
        name: "My Pictures",
        launch: () => openExplorer([...HOME_PATH, "My Documents", "My Pictures"])
    },
    music: {
        name: "My Music",
        launch: () => openExplorer([...HOME_PATH, "My Documents", "My Music"])
    },
    computer: {
        name: "My Computer",
        launch: () => openMyComputer()
    }
};

export const ALL_PROGRAMS_SECTIONS = [
    ["cmd", "explorer-web", "notepad", "media-player"],
    ["email", "linkedin", "github"],
    [] // Programs not already on the Start menu
];

export function launchAppAction(action) {
    const entry = APP_ACTIONS[action];
    if (!entry) return;
    if (!entry.isLinkDialog) {
        playSound(SOUNDS.MENU_COMMAND);
    }
    entry.launch();
}

// Picks the right icon for a file or folder
export function getNodeIcon(itemPath, name, value) {
    if (isFolderNode(value)) return getFolderIcon(itemPath);
    if (isAudioFile(name)) return "assets/file_sound.png";
    if (isImageFile(name)) return "assets/file_image.png";
    if (isUrlFile(name)) return "assets/file_internet_doc.png";
    return "assets/file_text_doc.png";
}

// Opens a file in Media Player, Picture Viewer, Internet Explorer, or Notepad based on its extension
export function openFileNode(targetPath, node = getNode(targetPath), { autoplay = true } = {}) {
    if (!isFileNode(node)) return false;

    const fileName = targetPath[targetPath.length - 1];
    const fullPath = getPathString(targetPath);

    if (isAudioFile(fileName)) {
        openMediaPlayer({ trackPath: fullPath, autoplay });
    } else if (isImageFile(fileName)) {
        openPictureViewer({ imagePath: fullPath });
    } else if (isUrlFile(fileName)) {
        const url = parseUrlFileContent(node.content);
        if (url) openWebExplorer({ url });
    } else {
        openNotepad(fileName, node.content, fullPath);
    }
    return true;
}
