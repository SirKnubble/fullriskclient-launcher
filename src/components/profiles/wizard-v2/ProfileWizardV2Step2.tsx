"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import type { ModLoader } from "../../../types/profile";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/buttons/Button";
import { StatusMessage } from "../../ui/StatusMessage";
import { useThemeStore } from "../../../store/useThemeStore";
import { Select } from "../../ui/Select";

interface LoaderVersionInfo {
  loader: {
    version: string;
    stable?: boolean;
  };
}

interface ProfileWizardV2Step2Props {
  onClose: () => void;
  onNext: (selectedLoader: ModLoader, selectedLoaderVersion: string | null) => void;
  onBack: () => void;
  selectedMinecraftVersion: string;
}

export function ProfileWizardV2Step2({ 
  onClose, 
  onNext, 
  onBack,
  selectedMinecraftVersion 
}: ProfileWizardV2Step2Props) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoader, setSelectedLoader] = useState<ModLoader>("fabric");
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string | null>(null);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const [showNoVersionsFound, setShowNoVersionsFound] = useState(false);

  const modLoaders: { key: ModLoader; label: string; icon: string; backgroundImage: string }[] = [
    { key: "vanilla", label: "Vanilla", icon: "solar:gamepad-bold", backgroundImage: "/icons/minecraft.png" },
    { key: "fabric", label: "Fabric", icon: "solar:box-bold", backgroundImage: "/icons/fabric.png" },
    { key: "forge", label: "Forge", icon: "solar:hammer-bold", backgroundImage: "/icons/forge.png" },
    { key: "neoforge", label: "NeoForge", icon: "solar:shield-bold", backgroundImage: "/icons/neoforge.png" },
    { key: "quilt", label: "Quilt", icon: "solar:widget-bold", backgroundImage: "/icons/quilt.png" },
  ];

  // Fetch versions when loader changes
  useEffect(() => {
    const fetchVersions = async () => {
      if (selectedLoader === "vanilla") {
        setLoaderVersions([]);
        setSelectedLoaderVersion(null);
        setShowLoadingIndicator(false);
        setShowNoVersionsFound(false);
        return;
      }

      setLoadingVersions(true);
      setShowLoadingIndicator(false);
      setShowNoVersionsFound(false);
      setError(null);

      // Show loading indicator only after 800ms delay
      const loadingTimeout = setTimeout(() => {
        if (loadingVersions) {
          setShowLoadingIndicator(true);
        }
      }, 800);

      // Show "no versions found" only after 800ms delay
      const noVersionsTimeout = setTimeout(() => {
        if (!loadingVersions && loaderVersions.length === 0 && !error) {
          setShowNoVersionsFound(true);
        }
      }, 800);

      try {
        let versions: string[] = [];

        switch (selectedLoader) {
          case "fabric":
            const fabricVersions = await invoke<LoaderVersionInfo[]>(
              "get_fabric_loader_versions",
              { minecraftVersion: selectedMinecraftVersion }
            );
            versions = fabricVersions.map(v => 
              `${v.loader.version}${v.loader.stable ? " (stable)" : ""}`
            );
            break;

          case "forge":
            versions = await invoke<string[]>("get_forge_versions", {
              minecraftVersion: selectedMinecraftVersion,
            });
            break;

          case "neoforge":
            versions = await invoke<string[]>("get_neoforge_versions", {
              minecraftVersion: selectedMinecraftVersion,
            });
            break;

          case "quilt":
            const quiltVersions = await invoke<LoaderVersionInfo[]>(
              "get_quilt_loader_versions",
              { minecraftVersion: selectedMinecraftVersion }
            );
            versions = quiltVersions.map(v => 
              `${v.loader.version}${v.loader.stable ? " (stable)" : ""}`
            );
            break;
        }

        setLoaderVersions(versions);
        // Auto-select latest (first) version
        if (versions.length > 0) {
          setSelectedLoaderVersion(versions[0]);
          setShowNoVersionsFound(false);
        } else {
          setSelectedLoaderVersion(null);
          // Delay showing "no versions found" message
          setTimeout(() => {
            setShowNoVersionsFound(true);
          }, 100);
        }
      } catch (err) {
        console.error(`Failed to fetch ${selectedLoader} versions:`, err);
        setError(`Failed to load ${selectedLoader} versions. Please try again.`);
        setLoaderVersions([]);
        setSelectedLoaderVersion(null);
        setShowNoVersionsFound(false);
      } finally {
        clearTimeout(loadingTimeout);
        clearTimeout(noVersionsTimeout);
        setLoadingVersions(false);
        setShowLoadingIndicator(false);
      }
    };

    fetchVersions();
  }, [selectedLoader, selectedMinecraftVersion]);

  const handleNext = () => {
    onNext(selectedLoader, selectedLoaderVersion);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <Icon icon="solar:refresh-bold" className="w-12 h-12 text-white animate-spin mb-4" />
          <p className="text-xl font-minecraft text-white lowercase">loading...</p>
        </div>
      );
    }

    if (error) {
      return <StatusMessage type="error" message={error} />;
    }

    return (
      <div className="h-[380px] flex flex-col space-y-6">
        {/* Mod Loader Selection */}
        <div className="grid grid-cols-2 gap-3 flex-shrink-0">
          {modLoaders.map(loader => (
            <div
              key={loader.key}
              className={`relative p-4 h-28 cursor-pointer transition-all duration-200 border-2 rounded-lg overflow-hidden ${
                selectedLoader === loader.key
                  ? "border-current hover:bg-current/15"
                  : "border-transparent hover:bg-black/30"
              }`}
              style={{
                backgroundImage: `url('${loader.backgroundImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                ...(selectedLoader === loader.key ? {
                  borderColor: accentColor.value,
                  color: accentColor.value
                } : {})
              }}
              onClick={() => setSelectedLoader(loader.key)}
            >
              {/* Dark overlay for better text readability */}
              <div className={`absolute inset-0 transition-all duration-200 ${
                selectedLoader === loader.key
                  ? "bg-black/40"
                  : "bg-black/60"
              }`} />
              
              {/* Content */}
              <div className="relative z-10 flex flex-col items-center text-center justify-center h-full">
                <h4 className="font-minecraft text-4xl text-white lowercase drop-shadow-lg">
                  {loader.label}
                </h4>
              </div>
            </div>
          ))}
        </div>

        {/* Version Selection */}
        <div className="h-20 flex items-center flex-shrink-0">
          {selectedLoader === "vanilla" ? (
            <div className="text-center w-full">
              <p className="text-lg font-minecraft text-white/50 lowercase">
                no additional version required
              </p>
            </div>
          ) : showLoadingIndicator ? (
            <div className="flex items-center justify-center w-full">
              <Icon icon="solar:refresh-bold" className="w-6 h-6 text-white animate-spin mr-3" />
              <p className="text-lg font-minecraft text-white lowercase">loading versions...</p>
            </div>
          ) : loaderVersions.length > 0 ? (
            <Select
              value={selectedLoaderVersion || ""}
              onChange={setSelectedLoaderVersion}
              options={loaderVersions.map(version => ({
                value: version,
                label: version
              }))}
              placeholder={`Select ${modLoaders.find(l => l.key === selectedLoader)?.label} version...`}
              size="md"
              className="w-full"
            />
          ) : showNoVersionsFound ? (
            <div className="text-center w-full">
              <Icon icon="solar:danger-triangle-bold" className="w-8 h-8 text-white/50 mx-auto mb-2" />
              <p className="text-base font-minecraft text-white/70 lowercase">
                no {selectedLoader} versions available for {selectedMinecraftVersion}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderFooter = () => (
    <div className="flex justify-between">
      <Button
        variant="secondary"
        onClick={onBack}
        disabled={loading || loadingVersions}
        size="md"
        className="text-xl"
        icon={<Icon icon="solar:arrow-left-bold" className="w-5 h-5" />}
        iconPosition="left"
      >
        back
      </Button>
      
      <Button
        variant="default"
        onClick={handleNext}
        disabled={loading || loadingVersions || (selectedLoader !== "vanilla" && !selectedLoaderVersion)}
        size="md"
        className="min-w-[180px] text-xl"
        icon={<Icon icon="solar:arrow-right-bold" className="w-5 h-5" />}
        iconPosition="right"
      >
        next
      </Button>
    </div>
  );

  return (
    <Modal
      title="create profile - select mod loader"
      onClose={onClose}
      width="lg"
      footer={renderFooter()}
    >
      <div className="min-h-[500px] p-6 overflow-hidden">
        {renderContent()}
      </div>
    </Modal>
  );
} 