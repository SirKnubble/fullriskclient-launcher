export function preloadIcons(iconNames: string[]): void {
  const preloadDiv = document.createElement("div");
  preloadDiv.style.position = "absolute";
  preloadDiv.style.width = "0";
  preloadDiv.style.height = "0";
  preloadDiv.style.overflow = "hidden";
  preloadDiv.style.opacity = "0";
  preloadDiv.style.pointerEvents = "none";
  document.body.appendChild(preloadDiv);

  iconNames.forEach((iconName) => {
    const iconElement = document.createElement("span");
    iconElement.dataset.icon = iconName;
    iconElement.className = "iconify";
    preloadDiv.appendChild(iconElement);
  });

  setTimeout(() => {
    if (document.body.contains(preloadDiv)) {
      document.body.removeChild(preloadDiv);
    }
  }, 1000);
}
