import { get, writable, type Writable } from "svelte/store";

const TABS = [
    {
        name: 'settings',
        onClick: () => selectTab('settings')
    },
    {
        name: 'skins',
        onClick: () => selectTab('skins')
    },
    {
        name: 'capes',
        onClick: () => selectTab('capes')
    },
    {
        name: 'play',
        onClick: () => selectTab('play')
    },
    {
        name: 'profiles',
        onClick: () => selectTab('profiles')
    },
    {
        name: 'addons',
        onClick: () => selectTab('addons')
    },
    {
        name: 'quit',
        onClick: () => {}
    }
];

const activeTab = writable('play');
const closeTabDirection: Writable<"right" | "left" | null> = writable(null);

function selectTab(tab: string) {
    const active = TABS.find(t => t.name === get(activeTab))!;
    const newTab = TABS.find(t => t.name === tab)!;
    if (active === newTab) return;
    
    closeTabDirection.set(TABS.indexOf(active) > TABS.indexOf(newTab) ? 'right' : 'left');
    setTimeout(() => {
        activeTab.set(tab);
    }, 100);
}

function resetCloseTabDirection() {
    closeTabDirection.set(null);
}

export { TABS, activeTab, closeTabDirection, selectTab, resetCloseTabDirection };