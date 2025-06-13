'use client';

import React, { useEffect, useRef } from 'react';
import * as skinview3d from 'skinview3d';
import { cn } from '../../lib/utils';

interface SkinView3DWrapperProps {
  skinUrl?: string | null;
  capeUrl?: string | null;
  className?: string;
  width?: number;
  height?: number;
  enableAutoRotate?: boolean;
  zoom?: number;
  displayAsElytra?: boolean;
}

// A known public URL for a "Steve" skin, can be used as a default
const DEFAULT_STEVE_SKIN_URL = 'https://api.mineatar.com/skin/Steve'; // A common Steve skin URL

export const SkinView3DWrapper: React.FC<SkinView3DWrapperProps> = ({
  skinUrl,
  capeUrl,
  className,
  width: propWidth,
  height: propHeight,
  enableAutoRotate = false,
  zoom = 1.0, // Default zoom
  displayAsElytra = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skinViewerRef = useRef<skinview3d.SkinViewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return () => {};

    const determineWidth = propWidth || containerRef.current.offsetWidth || 300;
    const determineHeight = propHeight || containerRef.current.offsetHeight || 400;

    const viewer = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width: determineWidth,
      height: determineHeight,
      skin: skinUrl === null ? undefined : (skinUrl || DEFAULT_STEVE_SKIN_URL),
    });
    skinViewerRef.current = viewer;

    if (capeUrl) {
      viewer.loadCape(capeUrl, displayAsElytra ? { backEquipment: "elytra" } : undefined);
    }
    viewer.autoRotate = enableAutoRotate;
    viewer.zoom = zoom;
    // Rotate the player slightly for a better initial view if not auto-rotating
    if (!enableAutoRotate && viewer.playerObject) {
        viewer.playerObject.rotation.y = Math.PI; // CHANGED to show back
    }


    const resizeObserver = new ResizeObserver(entries => {
      if (!skinViewerRef.current) return;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!propWidth) skinViewerRef.current.width = width;
        if (!propHeight) skinViewerRef.current.height = height;
      }
    });

    if (!propWidth || !propHeight) {
       resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (skinViewerRef.current) {
        // skinview3d documentation doesn't explicitly show a general dispose method
        // on the SkinViewer instance. It's assumed that when the canvas is removed
        // and references are dropped, resources are garbage collected.
        // If there were specific methods like skinViewer.destroy() or .dispose(),
        // they would be called here.
        skinViewerRef.current = null;
      }
    };
  // skinUrl dependency is removed from here, handled by its own useEffect
  // capeUrl dependency is removed from here, handled by its own useEffect
  // displayAsElytra dependency is removed from here, handled by its own useEffect
  }, [propWidth, propHeight, enableAutoRotate, zoom]); // REVERTED: displayAsElytra removed from this dependency array

  // Effect for skinUrl changes
  useEffect(() => {
    if (skinViewerRef.current) {
      if (skinUrl === null) {
        // Load a default or transparent skin if null is meant to hide the current one
        // For now, we load the default Steve skin if skinUrl becomes null explicitly.
        // Or, if `loadSkin(null)` is supported to clear, that would be used.
        // The constructor handles undefined/default, this is for dynamic changes.
        skinViewerRef.current.loadSkin(DEFAULT_STEVE_SKIN_URL);
      } else if (skinUrl) {
        skinViewerRef.current.loadSkin(skinUrl);
      }
      // If skinUrl is undefined, it means use the initial/default, so no change here.
    }
  }, [skinUrl]);

  // Effect for capeUrl changes
  useEffect(() => {
    if (skinViewerRef.current) {
      if (capeUrl === null) {
        skinViewerRef.current.loadCape(null); // Unload cape
      } else if (capeUrl) {
        skinViewerRef.current.loadCape(capeUrl, displayAsElytra ? { backEquipment: "elytra" } : undefined);
      }
      // If capeUrl is undefined, do nothing (keep existing cape or no cape)
    }
  }, [capeUrl, displayAsElytra]); // ADDED displayAsElytra dependency

  // Effect for autoRotate changes
  useEffect(() => {
    if (skinViewerRef.current) {
      skinViewerRef.current.autoRotate = enableAutoRotate;
    }
  }, [enableAutoRotate]);

  // Effect for zoom changes
  useEffect(() => {
    if (skinViewerRef.current) {
      skinViewerRef.current.zoom = zoom;
    }
  }, [zoom]);

  return (
    <div ref={containerRef} className={cn("w-full h-full", className)}>
      <canvas ref={canvasRef} style={{ display: 'block' }} /> {/* Ensure canvas is block to fill div */}
    </div>
  );
}; 