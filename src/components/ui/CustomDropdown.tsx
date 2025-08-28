"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../store/useThemeStore";

interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

interface CustomDropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function CustomDropdown({
  label,
  value,
  options,
  onChange,
  className = "",
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accentColor = useThemeStore((state) => state.accentColor);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Label above (only if provided) */}
      {label && (
        <label className="block text-white/70 font-minecraft text-xs uppercase mb-2 tracking-wide">
          {label}
        </label>
      )}

      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 bg-transparent hover:bg-white/5 rounded-md px-2 py-1 text-white font-minecraft text-sm transition-all duration-200 focus:outline-none ${
          label ? 'w-full justify-between border border-white/10 hover:border-white/20 bg-black/50 hover:bg-black/60 px-4 py-3' : 'hover:bg-white/10'
        }`}
        style={{
          boxShadow: isOpen ? `0 0 0 1px ${accentColor.value}40` : 'none',
        }}
        title={selectedOption?.label}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.icon && (
            <Icon icon={selectedOption.icon} className="w-4 h-4 text-white/70" />
          )}
          {label && <span>{selectedOption?.label}</span>}
        </div>
        {label && (
          <Icon 
            icon="solar:alt-arrow-down-bold" 
            className={`w-4 h-4 text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute top-full mt-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden ${
          label ? 'left-0 right-0' : 'left-0 w-48'
        }`}>
          <div className="py-2">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left font-minecraft text-sm transition-colors duration-150 ${
                  option.value === value
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
                style={{
                  backgroundColor: option.value === value ? `${accentColor.value}20` : undefined,
                }}
              >
                {option.icon && (
                  <Icon icon={option.icon} className="w-4 h-4 text-white/70" />
                )}
                <span>{option.label}</span>
                {option.value === value && (
                  <Icon 
                    icon="solar:check-circle-bold" 
                    className="w-4 h-4 ml-auto"
                    style={{ color: accentColor.value }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
