/** @type {OSGUITopLevelMenus} */
var menus = {
	"&Game": [
		{
			label: "&Deal",
			shortcutLabel: "F2",
			ariaKeyShortcuts: "F2",
			action: ()=> { resetGame(); },
			description: "Deal a new game",
		},
		MENU_DIVIDER,
		{
			label: "&Undo",
			shortcutLabel: "",
			ariaKeyShortcuts: "",
			enabled: false,
			action: ()=> {},
			description: "Undo last action",
		},
		{
			label: "De&ck...",
			shortcutLabel: "",
			ariaKeyShortcuts: "",
			enabled: false,
			action: ()=> {},
			description: "Choose new deck back",
		},
		{
			label: "&Options...",
			shortcutLabel: "",
			ariaKeyShortcuts: "",
			enabled: false,
			action: ()=> {},
			description: "Change Solitaire options",
		},
		MENU_DIVIDER,
		{
			label: "E&xit",
			shortcutLabel: "",
			ariaKeyShortcuts: "",
			action: ()=> {
				close();
			},
			description: "Exit Solitaire",
		}
	],
	"&Help": [
		{
			label: "&Contents",
			shortcutLabel: "F1",
			enabled: false,
			action: ()=> {},
			description: "Index of Solitaire help topics"
		},
		{
			label: "&Search for Help on...",
			enabled: false,
			action: ()=> {},
			description: "Search the Help Engine for a specific topic"
		},
		{
			label: "&How to Use Help",
			enabled: false,
			action: ()=> {},
			description: "Help using help"
		},
		MENU_DIVIDER,
		{
			label: "&About Solitaire",
			action: ()=> {
				window.open("https://github.com/1j01/98/tree/master/programs/js-solitaire");
			},
			description: "About Solitaire"
		},
	],
};

var go_outside_frame = false;
if(frameElement){
	try{
		if(parent.MenuBar){
			MenuBar = parent.MenuBar;
			go_outside_frame = true;
		}
	}catch(e){}
}
var menu_bar = new MenuBar(menus);
if (go_outside_frame) {
	frameElement.parentElement.insertBefore(menu_bar.element, frameElement);
} else {
	document.body.prepend(menu_bar.element);
}
