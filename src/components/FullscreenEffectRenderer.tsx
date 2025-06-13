import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from './ui/buttons/Button';
import { BACKGROUND_EFFECTS, useBackgroundEffectStore } from '../store/background-effect-store';
import { useQualitySettingsStore } from '../store/quality-settings-store';
import { useThemeStore } from '../store/useThemeStore';

// Import actual effect components (adjust paths if necessary)
import { MatrixRainEffect } from './effects/MatrixRainEffect';
import { EnchantmentParticlesEffect } from './effects/EnchantmentParticlesEffect';
import { NebulaWaves } from './effects/NebulaWaves';
import { NebulaParticles } from './effects/NebulaParticles';
import { NebulaGrid } from './effects/NebulaGrid';
import { NebulaVoxels } from './effects/NebulaVoxels';
import { NebulaLightning } from './effects/NebulaLightning';
import { NebulaLiquidChrome } from './effects/NebulaLiquidChrome';
import { RetroGridEffect } from './effects/RetroGridEffect';
import PlainBackground from './effects/PlainBackground';

interface FullscreenEffectRendererProps {
  effectId: string;
  onClose: () => void;
}

export function FullscreenEffectRenderer({ effectId, onClose }: FullscreenEffectRendererProps) {
  const { qualityLevel } = useQualitySettingsStore();
  const { accentColor: themeAccentColor } = useThemeStore();
  // isBackgroundAnimationEnabled is not directly used here as we are forcing preview

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const getQualityParams = () => {
    switch (qualityLevel) {
      case "low":
        return { particleCount: 30, opacity: 0.2, speed: 0.5 };
      case "high":
        return { particleCount: 200, opacity: 0.4, speed: 1.5 };
      default: // medium
        return { particleCount: 50, opacity: 0.3, speed: 1 };
    }
  };

  const qualityParams = getQualityParams();

  const renderEffect = () => {
    switch (effectId) {
      case BACKGROUND_EFFECTS.MATRIX_RAIN:
        return (
          <MatrixRainEffect
            speed={qualityParams.speed}
            opacity={qualityParams.opacity}
            forceEnable={true} // Force enable for preview
          />
        );
      case BACKGROUND_EFFECTS.ENCHANTMENT_PARTICLES:
        return (
          <EnchantmentParticlesEffect
            opacity={qualityParams.opacity}
            particleCount={qualityParams.particleCount}
            speed={qualityParams.speed}
            forceEnable={true} // Force enable for preview
          />
        );
      case BACKGROUND_EFFECTS.NEBULA_WAVES:
        return (
          <NebulaWaves
            opacity={qualityParams.opacity}
            speed={qualityParams.speed}
          />
        );
      case BACKGROUND_EFFECTS.NEBULA_PARTICLES:
        return (
          <NebulaParticles
            opacity={qualityParams.opacity}
            particleCount={qualityParams.particleCount}
            speed={qualityParams.speed}
          />
        );
      case BACKGROUND_EFFECTS.NEBULA_GRID:
        return (
          <NebulaGrid
            opacity={qualityParams.opacity}
            speed={qualityParams.speed}
            gridSize={30} // Default from AppLayout
          />
        );
      case BACKGROUND_EFFECTS.NEBULA_VOXELS:
        return (
          <NebulaVoxels
            opacity={qualityParams.opacity}
            cubeCount={qualityParams.particleCount}
            speed={qualityParams.speed}
          />
        );
      case BACKGROUND_EFFECTS.NEBULA_LIGHTNING:
        return (
          <NebulaLightning
            opacity={qualityParams.opacity * 2} // As in AppLayout
            speed={qualityParams.speed}
            intensity={qualityParams.speed * 1.2} // As in AppLayout
            size={1.5} // As in AppLayout
          />
        );
      case BACKGROUND_EFFECTS.NEBULA_LIQUID_CHROME:
        return (
          <NebulaLiquidChrome
            opacity={qualityParams.opacity * 2} // As in AppLayout
            speed={qualityParams.speed * 0.2} // As in AppLayout
            amplitude={0.5} // As in AppLayout
            frequencyX={3} // As in AppLayout
            frequencyY={2} // As in AppLayout
          />
        );
      case BACKGROUND_EFFECTS.RETRO_GRID:
        return (
          <RetroGridEffect 
            isAnimationEnabled={true} // Ensure animation is on for preview
            // The component will use theme and quality from stores internally
          />
        );
      case BACKGROUND_EFFECTS.PLAIN_BACKGROUND:
        return <PlainBackground accentColorValue={themeAccentColor.value} />;
      default:
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', color: 'white' }}>
            Unknown Effect ID: {effectId}
          </div>
        );
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10000,
        backgroundColor: '#000', 
      }}
      onClick={(e) => {
        // Check if the click target is the close button or inside it
        const closeButton = (e.target as HTMLElement).closest('[data-is-close-button="true"]');
        if (!closeButton) {
          onClose();
        }
      }}
    >
      {renderEffect()}
      <Button
        onClick={(e) => {
            e.stopPropagation(); // Prevent click from bubbling to the parent div
            onClose();
        }}
        variant="destructive"
        size="lg"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10001,
          padding: '10px 15px',
          fontSize: '1rem',
        }}
        icon={<Icon icon="solar:close-circle-bold" className="w-6 h-6" />}
        // Add a data attribute to identify the close button
        data-is-close-button="true"
      >
        Close
      </Button>
    </div>
  );
} 