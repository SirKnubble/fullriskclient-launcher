import type { EventPayload } from "$lib/types/core";
import { writable, type Writable } from "svelte/store";

export const currentEvent: Writable<EventPayload | null> = writable(null);