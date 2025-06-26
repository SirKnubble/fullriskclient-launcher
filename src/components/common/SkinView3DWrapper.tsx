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
  onPaintPixel?: (x: any, y: any) => void;
  autoRotateSpeed?: number;
  startFromBack?: boolean;
}


const DEFAULT_STEVE_SKIN_URL = 'https://api.mineatar.com/skin/Steve'; 

export const SkinView3DWrapper: React.FC<SkinView3DWrapperProps> = ({
  skinUrl,
  capeUrl,
  className,
  width: propWidth,
  height: propHeight,
  enableAutoRotate = false,
  zoom = 1.0,
  displayAsElytra = false,
  autoRotateSpeed = 1.0,
  startFromBack = false,
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
    if (enableAutoRotate && autoRotateSpeed !== 1.0) {
      viewer.autoRotateSpeed = autoRotateSpeed;
    }
    viewer.zoom = zoom;
   
    if (startFromBack && viewer.playerObject) {
        viewer.playerObject.rotation.y = Math.PI; 
    } else if (!enableAutoRotate && viewer.playerObject) {
        viewer.playerObject.rotation.y = Math.PI; 
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
      
        skinViewerRef.current = null;
      }
    };

  }, [propWidth, propHeight, enableAutoRotate, zoom]);

 
  useEffect(() => {
    if (skinViewerRef.current) {
      if (skinUrl === null) {
        
        skinViewerRef.current.loadSkin(DEFAULT_STEVE_SKIN_URL);
      } else if (skinUrl) {
        skinViewerRef.current.loadSkin(skinUrl);
      }
    }
  }, [skinUrl]);

  useEffect(() => {
    if (skinViewerRef.current) {
      if (capeUrl === null) {
        skinViewerRef.current.loadCape(null);
      } else if (capeUrl) {
        skinViewerRef.current.loadCape(capeUrl, displayAsElytra ? { backEquipment: "elytra" } : undefined);
      }
    }
  }, [capeUrl, displayAsElytra]);

  useEffect(() => {
    if (skinViewerRef.current) {
      skinViewerRef.current.autoRotate = enableAutoRotate;
    }
  }, [enableAutoRotate]);

  useEffect(() => {
    if (skinViewerRef.current) {
      skinViewerRef.current.zoom = zoom;
    }
  }, [zoom]);

  return (
    <div ref={containerRef} className={cn("w-full h-full", className)}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}; 
