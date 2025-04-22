import { get, writable, type Writable } from "svelte/store";

const activeTab = writable('play');
const closeTabDirection: Writable<"right" | "left" | null> = writable(null);

function selectTab(tabs: Record<string, any>[], tab: string) {
    const active = tabs.find(t => t.name === get(activeTab))!;
    const newTab = tabs.find(t => t.name === tab)!;
    if (active === newTab) return;
    
    closeTabDirection.set(tabs.indexOf(active) > tabs.indexOf(newTab) ? 'right' : 'left');
    setTimeout(() => {
        activeTab.set(tab);
    }, 100);
}

function resetCloseTabDirection() {
    closeTabDirection.set(null);
}

export { activeTab, closeTabDirection, selectTab, resetCloseTabDirection };