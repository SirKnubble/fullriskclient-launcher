'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '../../lib/utils';

interface VanillaCapeImageProps {
  imageUrl: string | undefined;
  width?: number;
  className?: string;
}

const CAPE_PART_SRC_WIDTH = 10; 
const CAPE_PART_SRC_HEIGHT = 16; 
const FRONT_X = 1;  
const FRONT_Y = 1;  

export const VanillaCapeImage = React.memo(function VanillaCapeImage({
  imageUrl,
  width = 140, 
  className,
}: VanillaCapeImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const height = useMemo(() => Math.round(width * (CAPE_PART_SRC_HEIGHT / CAPE_PART_SRC_WIDTH)), [width]);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsLoading(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (!imageUrl) {
      setIsLoading(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous'; 
    img.src = imageUrl;

    const onLoad = () => {
      if (!canvasRef.current) {
        setErrorMessage("Canvas lost before drawing.");
        setIsLoading(false);
        return;
      }
      const currentCtx = canvasRef.current.getContext('2d');
      if (!currentCtx) {
        setErrorMessage("Failed to get canvas context for drawing.");
        setIsLoading(false);
        return;
      }

      try {
        const textureWidth = img.naturalWidth;
        const textureHeight = img.naturalHeight;
        
        const scaleX = textureWidth / 64;
        const scaleY = textureHeight / 32;
        
        const sx = FRONT_X * scaleX;
        const sy = FRONT_Y * scaleY;
        const sWidth = CAPE_PART_SRC_WIDTH * scaleX;
        const sHeight = CAPE_PART_SRC_HEIGHT * scaleY;
        
        currentCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        currentCtx.imageSmoothingEnabled = false; 

        currentCtx.drawImage(
          img,
          sx, sy, sWidth, sHeight,
          0, 0, canvasRef.current.width, canvasRef.current.height  
        );
        
        setErrorMessage(null);
      } catch (drawError) {
        console.error("[VanillaCapeImage] Error drawing cape:", drawError);
        setErrorMessage("Error rendering cape.");
      } finally {
        setIsLoading(false);
      }
    };

    const onError = (error: string | Event) => {
      console.error("[VanillaCapeImage] Failed to load cape image:", imageUrl, error);
      setErrorMessage("Failed to load cape image.");
      setIsLoading(false);
    };
    
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    return () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
  }, [imageUrl, width, height]);

  return (
    <div 
      className={cn("cape-image-container relative inline-block align-middle overflow-hidden", className)} 
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {errorMessage ? (
        <div 
          className="error-message w-full h-full flex justify-center items-center text-center text-xs text-red-600 bg-red-100 border border-red-600 p-1 box-border"
          title={errorMessage}
        >
          ⚠️ Error
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={cn(
            "cape-canvas block w-full h-full transition-opacity duration-300 ease-in-out",
            "image-rendering-pixelated",
            isLoading && !errorMessage ? "opacity-0" : "opacity-100"
          )}
          title="Vanilla Cape"
          style={{ 
            backgroundColor: 'transparent',
            imageRendering: 'pixelated',
          }}
        />
      )}
    </div>
  );
});