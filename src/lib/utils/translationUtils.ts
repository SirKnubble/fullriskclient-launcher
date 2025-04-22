import { writable, type Writable } from "svelte/store";

let translationCache: { [key: string]: any } = {};

export const language = writable("en_US");
export const translations: Writable<{ [key: string]: any } | null> = writable(null);

/**
 * @param {string} lang
 */
export function setLanguage(lang: string) {
    language.set(lang);
    if (translationCache[lang]) {
        translations.set(translationCache[lang]);
    } else {
        import(`../lang/${lang}.json`).then((module) => {
            /** @type {{ [key: string]: any }} */
            const langObject = {};

            Object.keys(module.default).forEach(key => {
                const keys = key.split('.');  // Split the key by the dot (.)
                keys.reduce((acc: { [key: string]: any }, part: string, index) => {
                    if (index === keys.length - 1) {
                        acc[part] = module.default[key];  // Set the value at the final key
                    } else {
                        acc[part] = acc[part] || {};  // Create nested objects if they don't exist
                    }
                    return acc[part];
                }, langObject);
            });

            translationCache[lang] = langObject;
            translations.set(langObject);
        });
    }

    console.info(`Language set to ${lang}.`);
}