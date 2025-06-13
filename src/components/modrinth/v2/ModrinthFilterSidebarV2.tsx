"use client";

import React, { useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import type {
  ModrinthProjectType,
  ModrinthCategory,
  ModrinthGameVersion,
  ModrinthLoader,
} from '../../../types/modrinth';
import type { AccentColor } from '../../../store/useThemeStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { Icon } from '@iconify/react';
import { SearchInput } from '../../ui/SearchInput';
import { Checkbox } from '../../ui/Checkbox';
import { gsap } from "gsap";

// Re-define UIDynamicFilterGroup if it's specific to the sidebar and not used elsewhere globally
// For now, assuming it might be defined in the parent or a shared types file if used elsewhere.
// If not, it should be defined here.
interface UIDynamicFilterGroup {
  accordionTitle: string;
  headerValue: string;
  options: ModrinthCategory[];
}

// Re-define AccordionItemProps or import if it becomes a shared component
// For now, assuming the AccordionItem component is passed or available in context/parent
interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  activeCount?: number;
}


// --- AccordionItem Component Definition (Moved Here) ---
const AccordionItem: React.FC<AccordionItemProps> = ({ 
  title, 
  children, 
  defaultOpen = false,
  activeCount = 0
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || activeCount > 0);
  const accentColor = useThemeStore((state) => state.accentColor);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const toggleAccordion = () => {
    if (contentRef.current) {
      if (isOpen) {
        // Animate closing
        gsap.to(contentRef.current, {
          height: 0,
          opacity: 0,
          duration: 0.3,
          ease: "power2.out",
          onComplete: () => setIsOpen(false),
        });
      } else {
        // Set to open first to measure height
        setIsOpen(true);
        // Then animate opening
        gsap.fromTo(
          contentRef.current,
          { height: 0, opacity: 0 },
          {
            height: "auto",
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
          },
        );
      }
    } else {
      setIsOpen(!isOpen);
    }

    // Animate the button on click
    if (buttonRef.current) {
      gsap.fromTo(
        buttonRef.current,
        { y: 0 },
        {
          y: -3,
          duration: 0.1,
          ease: "power1.out",
          yoyo: true,
          repeat: 1,
        },
      );
    }
  };

  return (
    <div 
      className={cn(
        "relative overflow-hidden transition-all duration-300 rounded-lg border backdrop-blur-sm"
      )}
      style={{
        backgroundColor: `${accentColor.value}10`,
        borderColor: `${accentColor.value}30`,
      }}
    >
      <button
        ref={buttonRef}
        onClick={toggleAccordion}
        className={cn(
          "w-full px-3 py-2.5 text-left font-minecraft text-gray-200 flex justify-between items-center focus:outline-none transition-colors lowercase text-2xl",
          isOpen && "border-b", 
          "hover:bg-white/5",
          "relative z-10"
        )}
        style={{
          borderBottomColor: isOpen ? `${accentColor.value}20` : 'transparent',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="truncate mr-2">{title}</span>
          {/* {activeCount > 0 && (
            <div
              className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
              style={{ backgroundColor: accentColor.value }}
            >
              {activeCount}
            </div>
          )} */}
        </div>
        <Icon 
          icon={isOpen ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} 
          className="w-4 h-4 flex-shrink-0" 
        />
      </button>

      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden",
          !defaultOpen && !isOpen && "h-0 opacity-0",
        )}
      >
        {(isOpen || defaultOpen) && (
          <div className="p-2 text-sm relative z-10">{children}</div>
        )}
      </div>
    </div>
  );
};
// --- End AccordionItem Component Definition ---

// FilterOption component for consistent styling
const FilterOption = ({
  label,
  icon,
  isSelected,
  onClick,
  accentColor,
}: {
  label: string;
  icon?: React.ReactNode | string;
  isSelected: boolean;
  onClick: () => void;
  accentColor: AccentColor;
}) => {
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    onClick();

    // Add a small animation on click
    if (buttonRef.current) {
      gsap.fromTo(
        buttonRef.current,
        { y: 0 },
        {
          y: -3,
          duration: 0.1,
          ease: "power1.out",
          yoyo: true,
          repeat: 1,
        },
      );
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className={cn(
        "w-full flex items-center justify-between p-1.5 text-xl font-minecraft transition-colors duration-200 cursor-pointer rounded-md mb-1.5 border",
        !isSelected && "text-gray-300 hover:brightness-[1.15]" // Default text color for unselected, and hover effect
      )}
      style={{
        backgroundColor: isSelected ? `${accentColor.value}2E` : `${accentColor.value}12`, // Approx 18% and 7% opacity
        borderColor: isSelected ? `${accentColor.value}59` : `${accentColor.value}29`,    // Approx 35% and 16% opacity
        color: isSelected ? accentColor.value : undefined, // Accent text color for selected, inherit for unselected
        // Removed boxShadow and transform properties
      }}
    >
      <span className="flex items-center flex-grow text-left">
        {typeof icon === "string" ? (
          <span
            className="w-4 h-4 mr-1.5 flex-shrink-0"
            dangerouslySetInnerHTML={{ __html: icon }}
          />
        ) : icon ? (
          <span className="mr-1.5 flex-shrink-0">{icon}</span>
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      {isSelected && (
        <Icon
          icon="solar:check-circle-bold"
          className="w-4 h-4 flex-shrink-0 ml-2"
          style={{ color: accentColor.value }}
        />
      )}
    </button>
  );
};

interface ModrinthFilterSidebarV2Props {
  projectType: ModrinthProjectType;
  accentColor: AccentColor;
  // Game Version Filter Props
  gameVersionSearchTerm: string;
  onGameVersionSearchTermChange: (term: string) => void;
  displayedGameVersions: ModrinthGameVersion[];
  selectedGameVersions: string[];
  onGameVersionToggle: (version: string) => void;
  showAllGameVersionsSidebar: boolean;
  onShowAllGameVersionsSidebarChange: (show: boolean) => void;
  // Loader Filter Props
  availableLoaders: ModrinthLoader[]; // Already sorted and filtered by projectType
  currentSelectedLoaders: string[];
  onLoaderToggle: (loaderName: string) => void;
  allLoadersData: ModrinthLoader[]; // For icons
  // Dynamic Category Filter Props
  dynamicFilterGroups: UIDynamicFilterGroup[];
  currentSelectedCategories: string[];
  onCategoryToggle: (categoryName: string) => void;
  // Environment Filter Props
  filterClientRequired: boolean;
  onClientRequiredToggle: () => void;
  filterServerRequired: boolean;
  onServerRequiredToggle: () => void;
}

export const ModrinthFilterSidebarV2: React.FC<ModrinthFilterSidebarV2Props> = ({
  projectType,
  accentColor,
  gameVersionSearchTerm,
  onGameVersionSearchTermChange,
  displayedGameVersions,
  selectedGameVersions,
  onGameVersionToggle,
  showAllGameVersionsSidebar,
  onShowAllGameVersionsSidebarChange,
  availableLoaders,
  currentSelectedLoaders,
  onLoaderToggle,
  allLoadersData,
  dynamicFilterGroups,
  currentSelectedCategories,
  onCategoryToggle,
  filterClientRequired,
  onClientRequiredToggle,
  filterServerRequired,
  onServerRequiredToggle,
}) => {
  // Extract the 'Categories' group if it exists
  const categoriesGroup = dynamicFilterGroups.find(
    group => group.headerValue.toLowerCase() === 'categories'
  );

  // Filter out the 'Categories' group from the main list to avoid rendering it twice
  const otherDynamicGroups = dynamicFilterGroups.filter(
    group => group.headerValue.toLowerCase() !== 'categories'
  );
  
  // Calculate counts for badges
  const totalGameVersionFilters = selectedGameVersions.length;
  const totalLoaderFilters = currentSelectedLoaders.length;
  const totalEnvironmentFilters = (filterClientRequired ? 1 : 0) + (filterServerRequired ? 1 : 0);

  const dynamicGroupCounts = dynamicFilterGroups.reduce(
    (acc, group) => {
      acc[group.headerValue] = group.options.filter((opt) =>
        currentSelectedCategories.includes(opt.name),
      ).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const categoryActiveCount = (categoriesGroup && dynamicGroupCounts[categoriesGroup.headerValue]) || 0;

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isAnimationEnabled = useThemeStore((state) => state.isBackgroundAnimationEnabled);

  React.useEffect(() => {
    if (sidebarRef.current && isAnimationEnabled) {
      gsap.fromTo(
        sidebarRef.current,
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          ease: "power2.out",
        },
      );
    }
  }, [isAnimationEnabled]);

  return (
    <div 
      ref={sidebarRef}
      className={cn(
        "filters-sidebar w-1/4 max-w-[15rem] flex-shrink-0 overflow-y-auto h-full",
        "hide-scrollbar rounded-lg border backdrop-blur-sm"
      )}
      style={{
        backgroundColor: `${accentColor.value}08`,
        borderColor: `${accentColor.value}20`,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <div className="">
        <AccordionItem 
          title="Game Version" 
          defaultOpen={totalGameVersionFilters > 0}
          activeCount={totalGameVersionFilters}
        >
          <div className="space-y-2">
            <div
              className="relative mb-2"
              style={{
                borderColor: `${accentColor.value}60`,
                borderBottomColor: accentColor.value,
                boxShadow: `0 4px 0 rgba(0,0,0,0.2), 0 6px 10px rgba(0,0,0,0.15), inset 0 1px 0 ${accentColor.value}20, inset 0 0 0 1px ${accentColor.value}10`,
              }}
            >
              <SearchInput
                value={gameVersionSearchTerm}
                onChange={onGameVersionSearchTermChange}
                placeholder="Search version..."
                className="w-full h-[40px]"
                size="sm"
              />
            </div>

            <div className="space-y-1 pr-1 overflow-y-auto hide-scrollbar max-h-96">
              {displayedGameVersions.map((gv) => (
                <FilterOption
                  key={gv.version}
                  label={`${gv.version} ${gv.version_type !== "release" ? `(${gv.version_type})` : ""}`}
                  isSelected={selectedGameVersions.includes(gv.version)}
                  onClick={() => onGameVersionToggle(gv.version)}
                  accentColor={accentColor}
                />
              ))}
              
              {displayedGameVersions.length === 0 && (
                <p className="text-gray-500 italic p-1 text-xs text-center">No matching versions.</p>
              )}
            </div>
            
            <div className="flex items-center mt-2 p-1">
              <Checkbox
                id="showAllVersionsSidebarInNewComponent"
                checked={showAllGameVersionsSidebar}
                onChange={(e) => onShowAllGameVersionsSidebarChange(e.target.checked)}
                className="rounded-sm"
              />
              <label 
                htmlFor="showAllVersionsSidebarInNewComponent" 
                className="ml-2 text-sm truncate cursor-pointer text-gray-200"
              >
                Show all versions
              </label>
            </div>
          </div>
        </AccordionItem>

        {/* Hardcoded Categories filter for project types other than 'datapack' */}
        {projectType !== 'datapack' && (
          <AccordionItem
            key={categoriesGroup?.headerValue || "categories_filter_accordion"} // Use a fallback key
            title={categoriesGroup?.accordionTitle || "Categories"} // Use a fallback title
            defaultOpen={categoryActiveCount > 0}
            activeCount={categoryActiveCount}
          >
            <div className="space-y-1 pr-1 overflow-y-auto hide-scrollbar max-h-96">
              {categoriesGroup && categoriesGroup.options.length > 0 ? (
                categoriesGroup.options.map(cat => (
                  <FilterOption
                    key={cat.name}
                    label={cat.name}
                    icon={cat.icon}
                    isSelected={currentSelectedCategories.includes(cat.name)}
                    onClick={() => onCategoryToggle(cat.name)}
                    accentColor={accentColor}
                  />
                ))
              ) : (
                <p className="text-xs text-gray-500 italic p-1 text-center">
                  No category options available.
                </p>
              )}
            </div>
          </AccordionItem>
        )}

        <AccordionItem 
          title="Loader" 
          defaultOpen={totalLoaderFilters > 0}
          activeCount={totalLoaderFilters}
        >
          <div className="space-y-1 pr-1 overflow-y-auto hide-scrollbar max-h-96">
            {availableLoaders.map(loader => {
              const fullLoaderData = allLoadersData.find(l => l.name === loader.name);
              return (
                <FilterOption
                  key={loader.name}
                  label={loader.name}
                  icon={fullLoaderData?.icon}
                  isSelected={currentSelectedLoaders.includes(loader.name)}
                  onClick={() => onLoaderToggle(loader.name)}
                  accentColor={accentColor}
                />
              );
            })}
            {availableLoaders.length === 0 && <p className="text-gray-500 italic p-1 text-xs text-center">No loaders for {projectType}.</p>}
          </div>
        </AccordionItem>

        {/* Render other dynamic groups here */}
        {otherDynamicGroups.map(group => (
          <AccordionItem 
            key={group.headerValue} 
            title={group.accordionTitle} 
            defaultOpen={dynamicGroupCounts[group.headerValue] > 0}
            activeCount={dynamicGroupCounts[group.headerValue]}
          >
            <div className="space-y-1 pr-1 overflow-y-auto hide-scrollbar max-h-96"> 
              {group.options.length > 0 ? group.options.map(cat => (
                <FilterOption
                  key={cat.name}
                  label={cat.name}
                  icon={cat.icon}
                  isSelected={currentSelectedCategories.includes(cat.name)}
                  onClick={() => onCategoryToggle(cat.name)}
                  accentColor={accentColor}
                />
              )) : (
                <p className="text-xs text-gray-500 italic p-1 text-center">No options for {group.accordionTitle}.</p>
              )}
            </div>
          </AccordionItem>
        ))}

        <AccordionItem 
          title="Environment" 
          defaultOpen={totalEnvironmentFilters > 0}
          activeCount={totalEnvironmentFilters}
        > 
          <div className="space-y-1 pr-1">
            <FilterOption
              label="Client"
              icon={<Icon icon="solar:devices-bold" className="w-4 h-4 mr-1.5" />}
              isSelected={filterClientRequired}
              onClick={onClientRequiredToggle}
              accentColor={accentColor}
            />
            <FilterOption
              label="Server"
              icon={<Icon icon="solar:server-bold" className="w-4 h-4 mr-1.5" />}
              isSelected={filterServerRequired}
              onClick={onServerRequiredToggle}
              accentColor={accentColor}
            />
          </div>
        </AccordionItem>
      </div>
    </div>
  );
}; 