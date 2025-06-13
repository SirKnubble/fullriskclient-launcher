"use client";

import React, { type ReactNode, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { useThemeStore } from "../../store/useThemeStore";
import { Checkbox } from "./Checkbox";
import { Label } from "./Label";
import { gsap } from "gsap";
import { cn } from "../../lib/utils";

interface ContentTableHeader {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  className?: string;
}

interface ContentTableProps {
  headers: ContentTableHeader[];
  children: ReactNode;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  selectedCount?: number;
  totalCount?: number;
  filteredCount?: number;
  enabledCount?: number;
  onSelectAll?: () => void;
  contentType?: string;
  searchQuery?: string;
  className?: string;
}

export function ContentTable({
  headers,
  children,
  sortKey,
  sortDirection = "asc",
  onSort,
  selectedCount = 0,
  totalCount = 0,
  filteredCount = 0,
  enabledCount = 0,
  onSelectAll,
  contentType = "item",
  searchQuery,
  className,
}: ContentTableProps) {
  const accentColor = useThemeStore((state) => state.accentColor);
  const tableRef = useRef<HTMLDivElement>(null);
  const headerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (tableRef.current) {
      gsap.fromTo(
        tableRef.current,
        { scale: 0.98, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          ease: "power2.out",
        },
      );
    }
  }, []);

  const handleHeaderClick = (header: ContentTableHeader, index: number) => {
    if (!header.sortable || !onSort) return;

    if (headerRefs.current[index]) {
      gsap.to(headerRefs.current[index], {
        scale: 0.95,
        duration: 0.1,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(headerRefs.current[index], {
            scale: 1,
            duration: 0.2,
            ease: "elastic.out(1.2, 0.4)",
          });
        },
      });
    }

    onSort(header.key);
  };

  return (
    <div
      ref={tableRef}
      className={cn(
        "h-full flex flex-col rounded-lg border-2 border-b-4 overflow-hidden",
        className,
      )}
      style={{
        backgroundColor: `${accentColor.value}10`,
        borderColor: `${accentColor.value}40`,
        borderBottomColor: `${accentColor.value}60`,
        boxShadow: `0 8px 0 rgba(0,0,0,0.2), 0 12px 20px rgba(0,0,0,0.3), inset 0 1px 0 ${accentColor.value}30, inset 0 0 0 1px ${accentColor.value}10`,
      }}
    >
      <span
        className="absolute inset-x-0 top-0 h-[2px] rounded-t-sm"
        style={{ backgroundColor: `${accentColor.value}80` }}
      />

      <div
        className="sticky top-0 z-10 border-b-2"
        style={{
          backgroundColor: `${accentColor.value}30`,
          borderColor: `${accentColor.value}60`,
        }}
      >
        <div className="flex items-center h-14 px-4">
          {onSelectAll && (
            <div className="w-8 flex justify-center">
              <Checkbox
                checked={selectedCount > 0 && selectedCount === filteredCount}
                onChange={onSelectAll}
                aria-label={`Select all ${contentType}s`}
              />
            </div>
          )}

          {headers.map((header, index) => (
            <div
              key={header.key}
              ref={(el) => (headerRefs.current[index] = el)}
              className={cn(
                header.width || "flex-1",
                header.className || "",
                header.sortable
                  ? "cursor-pointer hover:text-white transition-colors duration-200"
                  : "",
                "px-2",
              )}
              onClick={() => handleHeaderClick(header, index)}
            >
              <div className="flex items-center">
                <span className="font-minecraft text-lg lowercase">
                  {header.label}
                </span>
                {header.sortable && sortKey === header.key && (
                  <Icon
                    icon={
                      sortDirection === "asc"
                        ? "solar:alt-arrow-up-bold"
                        : "solar:alt-arrow-down-bold"
                    }
                    className="ml-1 w-4 h-4"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {React.Children.count(children) > 0 ? (
          children
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <Icon
              icon="solar:box-bold"
              className="w-16 h-16 text-white/30 mb-4"
            />
            <div className="text-white/60 font-minecraft text-2xl text-center lowercase">
              {searchQuery
                ? `no ${contentType}s match your search`
                : `no ${contentType}s found`}
            </div>
          </div>
        )}
      </div>

      <div
        className="border-t-2 py-3 px-4 flex justify-between items-center sticky bottom-0"
        style={{
          backgroundColor: `${accentColor.value}20`,
          borderColor: `${accentColor.value}40`,
        }}
      >
        <div className="text-white/70 font-minecraft text-lg">
          {filteredCount > 0 ? (
            <>
              {filteredCount} {contentType}
              {filteredCount !== 1 ? "s" : ""} • {enabledCount} enabled
              {searchQuery && ` • filtered from ${totalCount}`}
            </>
          ) : (
            <span>
              No {contentType}s{searchQuery ? " match your search" : ""}
            </span>
          )}
        </div>

        {selectedCount > 0 && (
          <Label variant="info" size="xs">
            {selectedCount} selected
          </Label>
        )}
      </div>
    </div>
  );
}
