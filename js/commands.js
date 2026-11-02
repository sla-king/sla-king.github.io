export const commands = {
    clear: (args, context) => {
        context.clearScreen();
    },
    cls: (args, context) => {
        context.clearScreen();
    },
    exit: (args, context) => {
        context.closeWindow();
    }
};