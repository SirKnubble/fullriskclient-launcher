"use client";

import type React from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { Card } from "./Card";

interface NewsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  imageUrl: string;
  postUrl: string;
  variant?: "default" | "elevated" | "flat" | "secondary";
  withAnimation?: boolean;
}

export const NewsCard = forwardRef<HTMLDivElement, NewsCardProps>(
  (
    {
      className,
      title,
      imageUrl,
      postUrl,
      onClick,
      variant = "flat",
      withAnimation = true,
      ...props
    },
    ref,
  ) => {
    return (
      <Card
        ref={ref}
        className={cn("w-full h-full p-0", className)}
        onClick={onClick}
        variant={variant}
        withAnimation={withAnimation}
        {...props}
      >
        <div
          className={cn("relative w-full h-full overflow-hidden rounded-lg")}
        >
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={title || "News image"}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/placeholder.svg";
            }}
          />
        </div>
      </Card>
    );
  },
);

NewsCard.displayName = "NewsCard";
