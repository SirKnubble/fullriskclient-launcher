"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { Profile } from "../../types/profile";
import { useProfileStore } from "../../store/profile-store";
import { useThemeStore } from "../../store/useThemeStore";
import { useBackgroundEffectStore } from "../../store/background-effect-store";
import { LoadingState } from "../ui/LoadingState";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/buttons/Button";
import { ProfileWizardV2 } from "../profiles/wizard-v2/ProfileWizardV2";
import { ProfileImport } from "../profiles/ProfileImport";
import { ProfileSettings } from "../profiles/ProfileSettings";
import { ProfileIcon } from "../profiles/ProfileIcon";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { gsap } from "gsap";

interface GridPosition {
  row: number;
  col: number;
}

interface ProfilePositions {
  [profileId: string]: GridPosition;
}

const GRID_SIZE = 100; // Size of each grid cell
const ICON_SIZE = 80; // Size of the profile icon + text

export function ProfilesTabV2() {
  const {
    profiles,
    loading,
    error,
    fetchProfiles,
    selectedProfile,
    setSelectedProfile,
  } = useProfileStore();

  const accentColor = useThemeStore((state) => state.accentColor);
  const borderRadius = useThemeStore((state) => state.borderRadius);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );
  const currentEffect = useBackgroundEffectStore((state) => state.currentEffect);

  const [showWizard, setShowWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [profilePositions, setProfilePositions] = useState<ProfilePositions>({});
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'profile' | 'folder' } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [insertPosition, setInsertPosition] = useState<GridPosition | null>(null);
  
  // Multi-selection states (for both profiles and folders)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Folders
  const [folders, setFolders] = useState<{ id: string; name: string; position: GridPosition; profileIds: string[] }[]>([]);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const [folderWindow, setFolderWindow] = useState<{ 
    folderId: string; 
    position: { x: number; y: number };
    isDragging: boolean;
    dragOffset: { x: number; y: number };
  } | null>(null);

  const desktopRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (isBackgroundAnimationEnabled && desktopRef.current) {
      gsap.fromTo(
        desktopRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "power2.out" },
      );
    }
  }, [isBackgroundAnimationEnabled]);

  // Helper functions for grid calculations
  const getGridDimensions = () => {
    if (!desktopRef.current) return { cols: 10, rows: 10 };
    const rect = desktopRef.current.getBoundingClientRect();
    const cols = Math.floor(rect.width / GRID_SIZE);
    const rows = Math.floor(rect.height / GRID_SIZE);
    return { cols, rows };
  };

  const gridToPixel = (gridPos: GridPosition) => {
    return {
      x: gridPos.col * GRID_SIZE + (GRID_SIZE - ICON_SIZE) / 2,
      y: gridPos.row * GRID_SIZE + (GRID_SIZE - ICON_SIZE) / 2,
    };
  };

  const pixelToGrid = (x: number, y: number) => {
    return {
      row: Math.floor(y / GRID_SIZE),
      col: Math.floor(x / GRID_SIZE),
    };
  };

  const isGridOccupied = (row: number, col: number, excludeProfileId?: string) => {
    const profileOccupied = Object.entries(profilePositions).some(([profileId, pos]) => 
      profileId !== excludeProfileId && pos.row === row && pos.col === col
    );
    const folderOccupied = folders.some(folder => folder.position.row === row && folder.position.col === col);
    return profileOccupied || folderOccupied;
  };

  const findNextAvailableGrid = () => {
    const { cols, rows } = getGridDimensions();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!isGridOccupied(row, col)) {
          return { row, col };
        }
      }
    }
    return { row: 0, col: 0 }; // Fallback
  };

  const getProfilesInOrder = () => {
    return profiles
      .filter(p => profilePositions[p.id])
      .sort((a, b) => {
        const posA = profilePositions[a.id];
        const posB = profilePositions[b.id];
        if (posA.row !== posB.row) return posA.row - posB.row;
        return posA.col - posB.col;
      });
  };

  const rearrangeProfiles = (insertAtGrid: GridPosition, draggedProfileId: string) => {
    const orderedProfiles = getProfilesInOrder();
    const draggedProfileIndex = orderedProfiles.findIndex(p => p.id === draggedProfileId);
    
    // Remove dragged profile from its current position
    const profilesWithoutDragged = orderedProfiles.filter(p => p.id !== draggedProfileId);
    
    // Calculate insert index based on grid position
    const { cols } = getGridDimensions();
    const insertIndex = insertAtGrid.row * cols + insertAtGrid.col;
    
    // Insert dragged profile at new position
    const newOrder = [...profilesWithoutDragged];
    newOrder.splice(Math.min(insertIndex, newOrder.length), 0, orderedProfiles[draggedProfileIndex]);
    
    // Reassign grid positions
    const newPositions: ProfilePositions = {};
    newOrder.forEach((profile, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      newPositions[profile.id] = { row, col };
    });
    
    return newPositions;
  };

  // Initialize grid positions for new profiles with even distribution
  useEffect(() => {
    const newProfiles = profiles.filter(profile => !profilePositions[profile.id]);
    
    if (newProfiles.length > 0) {
      const { cols, rows } = getGridDimensions();
      const totalCells = cols * rows;
      const existingCount = Object.keys(profilePositions).length;
      const totalProfiles = existingCount + newProfiles.length;
      
      // Calculate spacing for even distribution
      const spacing = Math.max(1, Math.floor(Math.sqrt(totalCells / totalProfiles)));
      
      const newPositions: ProfilePositions = { ...profilePositions };
      
      newProfiles.forEach((profile, index) => {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 100) {
          const baseIndex = existingCount + index;
          const row = Math.floor((baseIndex * spacing) / cols) % rows;
          const col = (baseIndex * spacing) % cols;
          
          if (!isGridOccupied(row, col) && !newPositions[profile.id]) {
            newPositions[profile.id] = { row, col };
            placed = true;
          } else {
            attempts++;
            // Try next available position
            for (let r = 0; r < rows && !placed; r++) {
              for (let c = 0; c < cols && !placed; c++) {
                if (!Object.values(newPositions).some(pos => pos.row === r && pos.col === c)) {
                  newPositions[profile.id] = { row: r, col: c };
                  placed = true;
                }
              }
            }
          }
        }
      });
      
      setProfilePositions(newPositions);
    }
  }, [profiles]);

  const handleItemClick = (e: React.MouseEvent, itemId: string, itemType?: 'profile' | 'folder') => {
    e.stopPropagation();
    
    // Handle folder double-click to open window
    if (itemType === 'folder' && e.detail === 2) {
      const folder = folders.find(f => f.id === itemId);
      if (folder && folder.profileIds.length > 0) {
        setFolderWindow({
          folderId: itemId,
          position: { x: e.clientX - 150, y: e.clientY - 100 }, // Center around click
          isDragging: false,
          dragOffset: { x: 0, y: 0 }
        });
        return;
      }
    }
    
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: Toggle selection
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else if (e.shiftKey && selectedItems.size > 0) {
      // Shift+Click: Select range (simplified)
      setSelectedItems(prev => new Set([...prev, itemId]));
    } else {
      // Normal click: Select only this one
      setSelectedItems(new Set([itemId]));
    }
  };

  const handleItemDragStart = (
    e: React.MouseEvent,
    itemId: string,
    itemType: 'profile' | 'folder',
  ) => {
    e.preventDefault();
    
    // If item is not selected, select it
    if (!selectedItems.has(itemId)) {
      setSelectedItems(new Set([itemId]));
    }
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setDraggedItem({ id: itemId, type: itemType });
  };

  const handleDesktopMouseDown = (e: React.MouseEvent) => {
    if (e.target === desktopRef.current) {
      // Close folder window if clicking on desktop
      setFolderWindow(null);
      
      // Start selection box
      const rect = desktopRef.current.getBoundingClientRect();
      setSelectionStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsSelecting(true);
      setSelectedItems(new Set()); // Clear current selection
    }
  };

  const handleDesktopRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.target === desktopRef.current) {
      const rect = desktopRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const gridPos = pixelToGrid(x, y);
      
      if (!isGridOccupied(gridPos.row, gridPos.col)) {
        const newFolder = {
          id: `folder-${Date.now()}`,
          name: "New Folder",
          position: gridPos,
          profileIds: []
        };
        setFolders(prev => [...prev, newFolder]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting && selectionStart && desktopRef.current) {
      // Update selection box
      const rect = desktopRef.current.getBoundingClientRect();
      setSelectionEnd({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      
      // Calculate which items are in selection
      const newSelected = new Set<string>();
      const selectionRect = {
        left: Math.min(selectionStart.x, e.clientX - rect.left),
        top: Math.min(selectionStart.y, e.clientY - rect.top),
        right: Math.max(selectionStart.x, e.clientX - rect.left),
        bottom: Math.max(selectionStart.y, e.clientY - rect.top),
      };
      
      // Check profiles
      profiles.forEach(profile => {
        const gridPos = profilePositions[profile.id];
        if (gridPos) {
          const pixelPos = gridToPixel(gridPos);
          const itemRect = {
            left: pixelPos.x,
            top: pixelPos.y,
            right: pixelPos.x + ICON_SIZE,
            bottom: pixelPos.y + ICON_SIZE,
          };
          
          if (itemRect.left < selectionRect.right &&
              itemRect.right > selectionRect.left &&
              itemRect.top < selectionRect.bottom &&
              itemRect.bottom > selectionRect.top) {
            newSelected.add(profile.id);
          }
        }
      });
      
      // Check folders
      folders.forEach(folder => {
        const pixelPos = gridToPixel(folder.position);
        const itemRect = {
          left: pixelPos.x,
          top: pixelPos.y,
          right: pixelPos.x + ICON_SIZE,
          bottom: pixelPos.y + ICON_SIZE,
        };
        
        if (itemRect.left < selectionRect.right &&
            itemRect.right > selectionRect.left &&
            itemRect.top < selectionRect.bottom &&
            itemRect.bottom > selectionRect.top) {
          newSelected.add(folder.id);
        }
      });
      
      setSelectedItems(newSelected);
    } else if (draggedItem && desktopRef.current) {
      const rect = desktopRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      
      // Update preview position for smooth dragging
      setDragPreviewPosition({ x: Math.max(0, x), y: Math.max(0, y) });
      
      // Calculate potential drop position (for any grid cell)
      const gridPos = pixelToGrid(x + ICON_SIZE / 2, y + ICON_SIZE / 2);
      const { cols, rows } = getGridDimensions();
      
      if (gridPos.row >= 0 && gridPos.row < rows && gridPos.col >= 0 && gridPos.col < cols) {
        setInsertPosition(gridPos);
        
        // Check if hovering over a folder
        const hoveredFolderId = folders.find(f => 
          f.position.row === gridPos.row && f.position.col === gridPos.col
        )?.id || null;
        setHoveredFolder(hoveredFolderId);
      } else {
        setInsertPosition(null);
        setHoveredFolder(null);
      }
    }
  };

  const handleMouseUp = () => {
    if (isSelecting) {
      // End selection
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    } else if (draggedItem && insertPosition) {
      // Check if dropping on a folder
      if (hoveredFolder && draggedItem.type === 'profile') {
        // Move profiles into folder
        const profilesToMove = selectedItems.has(draggedItem.id) 
          ? Array.from(selectedItems).filter(id => profiles.find(p => p.id === id)) // Only profiles
          : [draggedItem.id];
        
        const newFolders = folders.map(folder => {
          if (folder.id === hoveredFolder) {
            return {
              ...folder,
              profileIds: [...folder.profileIds, ...profilesToMove]
            };
          }
          return folder;
        });
        
        // Remove profiles from desktop
        const newPositions = { ...profilePositions };
        profilesToMove.forEach(profileId => {
          delete newPositions[profileId];
        });
        
        setFolders(newFolders);
        setProfilePositions(newPositions);
        setSelectedItems(new Set()); // Clear selection
      } else {
        // Normal grid positioning
        const itemsToMove = selectedItems.has(draggedItem.id) 
          ? Array.from(selectedItems) 
          : [draggedItem.id];
        
        const newPositions = { ...profilePositions };
        const newFolders = [...folders];
        const { cols, rows } = getGridDimensions();
        
        // Calculate offset from dragged item
        let draggedGridPos: GridPosition;
        if (draggedItem.type === 'profile') {
          draggedGridPos = profilePositions[draggedItem.id];
        } else {
          draggedGridPos = folders.find(f => f.id === draggedItem.id)!.position;
        }
        
        const offsetRow = insertPosition.row - draggedGridPos.row;
        const offsetCol = insertPosition.col - draggedGridPos.col;
        
        // Move all selected items by the same offset
        itemsToMove.forEach(itemId => {
          const profile = profiles.find(p => p.id === itemId);
          const folder = folders.find(f => f.id === itemId);
          
          if (profile) {
            const currentPos = profilePositions[itemId];
            const newRow = currentPos.row + offsetRow;
            const newCol = currentPos.col + offsetCol;
            
            if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
              if (!isGridOccupied(newRow, newCol, itemId)) {
                newPositions[itemId] = { row: newRow, col: newCol };
              }
            }
          } else if (folder) {
            const currentPos = folder.position;
            const newRow = currentPos.row + offsetRow;
            const newCol = currentPos.col + offsetCol;
            
            if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
              if (!isGridOccupied(newRow, newCol)) {
                const folderIndex = newFolders.findIndex(f => f.id === itemId);
                if (folderIndex !== -1) {
                  newFolders[folderIndex].position = { row: newRow, col: newCol };
                }
              }
            }
          }
        });
        
        setProfilePositions(newPositions);
        setFolders(newFolders);
      }
    } else if (draggedItem && dragPreviewPosition) {
      // Fallback to simple grid snap if no insert position
      const gridPos = pixelToGrid(dragPreviewPosition.x, dragPreviewPosition.y);
      const { cols, rows } = getGridDimensions();
      
      if (gridPos.row >= 0 && gridPos.row < rows && gridPos.col >= 0 && gridPos.col < cols) {
        if (!isGridOccupied(gridPos.row, gridPos.col, draggedItem.id)) {
          if (draggedItem.type === 'profile') {
            setProfilePositions(prev => ({
              ...prev,
              [draggedItem.id]: gridPos
            }));
          } else {
            setFolders(prev => prev.map(f => 
              f.id === draggedItem.id ? { ...f, position: gridPos } : f
            ));
          }
        }
      }
    }
    
    setDraggedItem(null);
    setDragPreviewPosition(null);
    setInsertPosition(null);
    setHoveredFolder(null);
  };

  const handleProfileDoubleClick = (profile: Profile) => {
    setSelectedProfile(profile);
    setShowSettings(true);
  };

  const handleCreateProfile = () => {
    setShowWizard(false);
    fetchProfiles();
    navigate("/profiles-v2");
  };

  const handleImportComplete = () => {
    fetchProfiles();
    setShowImport(false);
    navigate("/profiles-v2");
  };



  if (loading) {
    return <LoadingState message="Loading profiles..." />;
  }

  if (error) {
    return <EmptyState icon="solar:danger-triangle-bold" message={error} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Desktop Area */}
      <div
        ref={desktopRef}
        className="flex-1 relative overflow-hidden"
        style={{
          background: currentEffect === 'plain-background' ? 'transparent' : undefined
        }}
        onMouseDown={handleDesktopMouseDown}
        onContextMenu={handleDesktopRightClick}
        onMouseMove={(e) => {
          // Handle folder window dragging
          if (folderWindow?.isDragging) {
            setFolderWindow(prev => prev ? {
              ...prev,
              position: {
                x: e.clientX - prev.dragOffset.x,
                y: e.clientY - prev.dragOffset.y,
              }
            } : null);
          } else {
            handleMouseMove(e);
          }
        }}
        onMouseUp={(e) => {
          if (folderWindow?.isDragging) {
            setFolderWindow(prev => prev ? { ...prev, isDragging: false } : null);
          } else {
            handleMouseUp();
          }
        }}
        onMouseLeave={(e) => {
          if (folderWindow?.isDragging) {
            setFolderWindow(prev => prev ? { ...prev, isDragging: false } : null);
          } else {
            handleMouseUp();
          }
        }}
      >
        {/* Drop Position Indicator */}
        {insertPosition && draggedItem && (
          <div
            className={`absolute border-2 border-dashed rounded-lg pointer-events-none z-40 ${
              isGridOccupied(insertPosition.row, insertPosition.col, draggedItem.id)
                ? "border-red-400/70 bg-red-400/10"
                : "border-green-400/70 bg-green-400/10"
            }`}
            style={{
              left: gridToPixel(insertPosition).x,
              top: gridToPixel(insertPosition).y,
              width: ICON_SIZE,
              height: ICON_SIZE,
            }}
          />
        )}

        {/* Selection Box */}
        {isSelecting && selectionStart && selectionEnd && (
          <div
            className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none z-30"
            style={{
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: Math.abs(selectionEnd.x - selectionStart.x),
              height: Math.abs(selectionEnd.y - selectionStart.y),
            }}
          />
        )}

        {/* Folders */}
        {folders.map((folder) => {
          const isDragging = draggedItem?.id === folder.id;
          const isSelected = selectedItems.has(folder.id);
          const isSelectedButNotDragging = isSelected && !isDragging;
          
          // Calculate preview position for folders when dragging
          let pixelPosition = gridToPixel(folder.position);
          
          if (draggedItem && dragPreviewPosition && isSelected) {
            // Calculate offset for multi-select drag
            let draggedGridPos: GridPosition;
            if (draggedItem.type === 'profile') {
              draggedGridPos = profilePositions[draggedItem.id];
            } else {
              draggedGridPos = folders.find(f => f.id === draggedItem.id)!.position;
            }
            const draggedPixelPos = gridToPixel(draggedGridPos);
            const offsetX = dragPreviewPosition.x - draggedPixelPos.x;
            const offsetY = dragPreviewPosition.y - draggedPixelPos.y;
            
            pixelPosition = {
              x: pixelPosition.x + offsetX,
              y: pixelPosition.y + offsetY,
            };
          }

          return (
            <div
              key={folder.id}
              className={`absolute cursor-pointer select-none ${
                (isDragging || isSelectedButNotDragging) && draggedItem
                  ? "z-50 scale-105 transition-none" 
                  : "hover:scale-105 transition-all duration-200 ease-out"
              }`}
              style={{
                left: pixelPosition.x,
                top: pixelPosition.y,
                width: ICON_SIZE,
                height: ICON_SIZE,
                opacity: (isSelectedButNotDragging && draggedItem) ? 0.8 : 1,
              }}
                              onClick={(e) => handleItemClick(e, folder.id, 'folder')}
                onMouseDown={(e) => handleItemDragStart(e, folder.id, 'folder')}
            >
              <div
                className={`w-16 h-16 rounded-lg flex items-center justify-center mb-2 overflow-hidden shadow-lg transition-all duration-200 ${
                  hoveredFolder === folder.id && draggedItem?.type === 'profile'
                    ? "bg-green-500/30 border-2 border-green-400 scale-110"
                    : "bg-yellow-600/20 border-2 border-yellow-600/60"
                } ${isSelected ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
              >
                <Icon 
                  icon="solar:folder-bold" 
                  className={`w-10 h-10 transition-colors duration-200 ${
                    hoveredFolder === folder.id && draggedItem?.type === 'profile'
                      ? "text-green-400"
                      : "text-yellow-400"
                  }`} 
                />
                {folder.profileIds.length > 0 && (
                  <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {folder.profileIds.length}
                  </div>
                )}
              </div>
              <div className="text-xs font-minecraft-ten text-white text-center max-w-[80px] px-1 py-1 truncate">
                {folder.name}
              </div>
            </div>
          );
        })}

        {/* Folder Window Popup */}
        {folderWindow && (() => {
          const folder = folders.find(f => f.id === folderWindow.folderId);
          if (!folder || folder.profileIds.length === 0) return null;
          
          const folderProfiles = folder.profileIds
            .map(id => profiles.find(p => p.id === id))
            .filter(Boolean) as Profile[];
          
          const cols = 3; // Fixed 3 columns for better icon spacing
          const rows = Math.ceil(folderProfiles.length / cols);
          const windowWidth = 400; // Slightly wider for better icon spacing
          const windowHeight = Math.max(220, rows * 110 + 100);

          return (
            <div
              className="fixed backdrop-blur-md border border-b-2 overflow-hidden"
              style={{
                left: Math.max(10, Math.min(window.innerWidth - windowWidth - 10, folderWindow.position.x)),
                top: Math.max(10, Math.min(window.innerHeight - windowHeight - 10, folderWindow.position.y)),
                width: windowWidth,
                height: windowHeight,
                zIndex: 9999,
                backgroundColor: `${accentColor.value}30`,
                borderColor: `${accentColor.value}80`,
                borderBottomColor: accentColor.value,
                borderRadius: borderRadius === 0 ? "0" : `${borderRadius}px`,
                boxShadow: `0 6px 0 rgba(0,0,0,0.25), 0 8px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.05)`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Window Header */}
              <div
                className="h-12 flex items-center justify-between px-4 cursor-move border-b"
                style={{
                  backgroundColor: `${accentColor.value}20`,
                  borderColor: `${accentColor.value}40`,
                  borderTopLeftRadius: borderRadius === 0 ? "0" : `${borderRadius}px`,
                  borderTopRightRadius: borderRadius === 0 ? "0" : `${borderRadius}px`,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFolderWindow(prev => prev ? {
                    ...prev,
                    isDragging: true,
                    dragOffset: {
                      x: e.clientX - prev.position.x,
                      y: e.clientY - prev.position.y,
                    }
                  } : null);
                }}
              >
                <span className="text-white font-minecraft-ten text-sm uppercase">
                  {folder.name} ({folder.profileIds.length})
                </span>
                <button
                  onClick={() => setFolderWindow(null)}
                  className="text-white/60 hover:text-white text-lg font-bold w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded"
                >
                  ×
                </button>
              </div>

              {/* Window Content */}
              <div 
                className="p-6 grid gap-4 overflow-y-auto overflow-x-hidden"
                style={{ 
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  maxHeight: windowHeight - 60
                }}
              >
                {folderProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex flex-col items-center cursor-pointer hover:scale-105 transition-all duration-200 group"
                    onDoubleClick={() => handleProfileDoubleClick(profile)}
                    draggable
                    onDragStart={(e) => {
                      e.preventDefault();
                      // Move profile from folder back to desktop
                      const nextGrid = findNextAvailableGrid();
                      
                      // Remove from folder
                      setFolders(prev => prev.map(f => 
                        f.id === folder.id 
                          ? { ...f, profileIds: f.profileIds.filter(id => id !== profile.id) }
                          : f
                      ));
                      
                      // Add back to desktop
                      setProfilePositions(prev => ({
                        ...prev,
                        [profile.id]: nextGrid
                      }));
                      
                      // Close window if empty
                      if (folder.profileIds.length === 1) {
                        setFolderWindow(null);
                      }
                    }}
                  >
                    <div
                      className="w-16 h-16 flex items-center justify-center mb-2 overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-200"
                      style={{
                        backgroundColor: `${accentColor.value}20`,
                        borderColor: `${accentColor.value}60`,
                        borderWidth: "2px",
                        borderRadius: borderRadius === 0 ? "0" : `${borderRadius}px`,
                      }}
                    >
                      <ProfileIcon
                        profileId={profile.id}
                        banner={profile.banner}
                        profileName={profile.name}
                        accentColor={accentColor.value}
                        onSuccessfulUpdate={() => {}}
                        isEditable={false}
                        variant="bare"
                        className="w-full h-full"
                        placeholderIcon="ph:package-duotone"
                        iconClassName="w-10 h-10"
                      />
                    </div>
                    <span className="text-white text-xs font-minecraft-ten text-center max-w-[80px] px-1 py-1 truncate">
                      {profile.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {profiles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState
              icon="solar:widget-bold"
              message="No profiles found. Create your first profile!"
            />
          </div>
        ) : (
          profiles.filter(profile => profilePositions[profile.id]).map((profile) => {
            const gridPosition = profilePositions[profile.id];
            const isDragging = draggedItem?.id === profile.id;
            const isSelected = selectedItems.has(profile.id);
            const isSelectedButNotDragging = isSelected && !isDragging;
            
            // Calculate preview position for all selected profiles when dragging
            let pixelPosition = gridToPixel(gridPosition);
            
            if (draggedItem && dragPreviewPosition && isSelected) {
              // Calculate offset for multi-select drag
              let draggedGridPos: GridPosition;
              if (draggedItem.type === 'profile') {
                draggedGridPos = profilePositions[draggedItem.id];
              } else {
                draggedGridPos = folders.find(f => f.id === draggedItem.id)!.position;
              }
              const draggedPixelPos = gridToPixel(draggedGridPos);
              const offsetX = dragPreviewPosition.x - draggedPixelPos.x;
              const offsetY = dragPreviewPosition.y - draggedPixelPos.y;
              
              pixelPosition = {
                x: pixelPosition.x + offsetX,
                y: pixelPosition.y + offsetY,
              };
            }

            return (
              <div
                key={profile.id}
                className={`absolute cursor-pointer select-none ${
                  (isDragging || isSelectedButNotDragging) && draggedItem
                    ? "z-50 scale-105 transition-none" 
                    : "hover:scale-105 transition-all duration-200 ease-out"
                }`}
                style={{
                  left: pixelPosition.x,
                  top: pixelPosition.y,
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  opacity: (isSelectedButNotDragging && draggedItem) ? 0.8 : 1,
                }}
                onClick={(e) => handleItemClick(e, profile.id)}
                onMouseDown={(e) => handleItemDragStart(e, profile.id, 'profile')}
                onDoubleClick={() => handleProfileDoubleClick(profile)}
              >
                {/* Profile Icon */}
                <div
                  className={`w-16 h-16 rounded-lg flex items-center justify-center mb-2 overflow-hidden ${
                    isDragging
                      ? "shadow-2xl transition-none"
                      : "shadow-lg transition-shadow duration-100 ease-out"
                  } ${isSelected ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
                  style={{
                    backgroundColor: `${accentColor.value}20`,
                    borderColor: `${accentColor.value}60`,
                    borderWidth: "2px",
                  }}
                >
                  <ProfileIcon
                    profileId={profile.id}
                    banner={profile.banner}
                    profileName={profile.name}
                    accentColor={accentColor.value}
                    onSuccessfulUpdate={() => {}}
                    isEditable={false}
                    variant="bare"
                    className="w-full h-full"
                    placeholderIcon="ph:package-duotone"
                    iconClassName="w-10 h-10"
                  />
                </div>

                {/* Profile Name */}
                <div
                  className="text-xs font-minecraft-ten text-white text-center max-w-[80px] px-1 py-1 truncate"
                  title={profile.name}
                >
                  {profile.name}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showWizard && (
        <ProfileWizardV2
          onClose={() => setShowWizard(false)}
          onSave={handleCreateProfile}
        />
      )}

      {showSettings && selectedProfile && (
        <ProfileSettings
          profile={selectedProfile}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showImport && (
        <ProfileImport
          onClose={() => setShowImport(false)}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
}
