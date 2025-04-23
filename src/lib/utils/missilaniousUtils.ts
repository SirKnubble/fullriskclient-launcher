import { writable } from "svelte/store";

const launcherStartCompleted = writable(false);

export { launcherStartCompleted };