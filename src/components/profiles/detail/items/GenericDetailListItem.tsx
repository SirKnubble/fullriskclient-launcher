"use client";

import React, { ReactNode, useState } from 'react';
import { Icon } from '@iconify/react'; // For default icons if needed
import { Checkbox } from '../../../ui/Checkbox'; // Assuming Checkbox is in ui folder

export interface GenericDetailListItemProps {
  id: string;
  isSelected: boolean;
  onSelectionChange: (isSelected: boolean) => void;

  iconNode?: ReactNode;
  title: ReactNode;
  descriptionNode?: ReactNode;
  badgesNode?: ReactNode;

  mainActionNode?: ReactNode; // e.g., Enable/Disable button
  updateActionNode?: ReactNode; // e.g., Update button
  
  // Individual action buttons (delete, more actions trigger)
  // These will be grouped together.
  deleteActionNode?: ReactNode;
  moreActionsTriggerNode?: ReactNode;
  
  // Dropdown content, controlled by the parent via a prop or visibility toggle from moreActionsTriggerNode
  dropdownNode?: ReactNode; 
  isDropdownVisible?: boolean; // Parent controls visibility based on activeDropdownId

  // Visuals / Theming
  accentColor?: string; // For internal theming if necessary
}

export function GenericDetailListItem({
  id,
  isSelected,
  onSelectionChange,
  iconNode,
  title,
  descriptionNode,
  badgesNode,
  mainActionNode,
  updateActionNode,
  deleteActionNode,
  moreActionsTriggerNode,
  dropdownNode,
  isDropdownVisible,
  accentColor = '#FFFFFF', // Default accent if not provided
}: GenericDetailListItemProps) {

  const [isHovered, setIsHovered] = useState(false);

  // Determine default icon if none provided (example)
  const defaultIcon = <Icon icon="solar:box-bold-duotone" className="w-10 h-10 text-white/30" />;
  const displayIconNode = iconNode || defaultIcon;

  return (
    <div 
      className="relative flex items-center p-3 transition-colors duration-150 rounded-lg border group focus-within:border-[var(--accent-color-soft)]"
      style={{
        backgroundColor: isHovered ? `${accentColor}15` : `${accentColor}08`,
        borderColor: isHovered ? `${accentColor}40` : `${accentColor}20`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox Area */}
      <div className="mr-3 flex-shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          customSize="sm"
          checked={isSelected}
          onChange={(e) => onSelectionChange(e.target.checked)}
          aria-label={`Select item ${typeof title === 'string' ? title : id}`}
        />
      </div>

      {/* Icon Area - Updated size */}
      <div 
        className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden mr-4 border-2 border-b-4"
        style={{
          backgroundColor: `${accentColor}10`,
          borderColor: `${accentColor}30`,
          borderBottomColor: `${accentColor}40`,
        }}
      >
        {displayIconNode}
      </div>

      {/* Content Area - Title, Description, Badges */}
      <div className="flex-grow overflow-hidden flex flex-col min-w-0 pr-3 h-24">
        <div className="font-minecraft-ten text-base tracking-wide truncate text-white" title={typeof title === 'string' ? title : undefined}>
          {title}
        </div>
        {descriptionNode && (
          <div className="text-white/70 text-xs truncate mt-0.5 font-minecraft-ten flex-grow flex items-center">
            <div>
              {descriptionNode}
            </div>
          </div>
        )}
        {badgesNode && (
          <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1.5">
            {badgesNode}
          </div>
        )}
      </div>

      {/* Actions Area - Main Action, Update, Other Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-2 ml-auto flex-shrink-0 pl-2 relative">
        {updateActionNode}
        {mainActionNode}
        {/* Group for delete and more actions */}
        {(deleteActionNode || moreActionsTriggerNode) && (
          <div className="flex items-center gap-1 relative">
            {deleteActionNode}
            {moreActionsTriggerNode}
            {isDropdownVisible && dropdownNode} 
          </div>
        )}
      </div>
    </div>
  );
} 