import { loadIcons as iconifyLoadIcons } from "@iconify/react";

/**
 * Ask Iconify to fetch + cache these icons now, so first-render of components
 * that use them doesn't flash a 0×0 placeholder while the API call is in
 * flight (which was the source of chip-row layout shifts on mount).
 *
 * The earlier implementation created `<span class="iconify" data-icon="...">`
 * elements — that only works with the legacy `@iconify/iconify` DOM-scanner
 * package. We only ship `@iconify/react`, so the DOM approach was silently a
 * no-op. `loadIcons` from `@iconify/react` hits the same shared cache that
 * the React <Icon> component reads from.
 */
export function preloadIcons(iconNames: string[]): void {
  if (iconNames.length === 0) return;
  iconifyLoadIcons(iconNames);
}
