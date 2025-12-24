import { useThemeStore } from "../../store/useThemeStore";

export function FriendSkeleton() {
  const { accentColor } = useThemeStore();

  return (
    <div className="flex items-center gap-3 p-2 animate-pulse">
      <div
        className="w-8 h-8 rounded"
        style={{ backgroundColor: `${accentColor.value}15` }}
      />
      <div className="flex-1">
        <div
          className="h-4 rounded w-24 mb-1"
          style={{ backgroundColor: `${accentColor.value}12` }}
        />
        <div
          className="h-3 rounded w-16"
          style={{ backgroundColor: `${accentColor.value}08` }}
        />
      </div>
    </div>
  );
}
