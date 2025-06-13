"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Icon } from "@iconify/react";
import { fetchNewsAndChangelogs } from "../../services/nrc-service";
import { openExternalUrl } from "../../services/tauri-service";
import type { BlogPost } from "../../types/wordPress";
import { cn } from "../../lib/utils";
import { NewsCard } from "../ui/NewsCard";
import { useThemeStore } from "../../store/useThemeStore";
import { Skeleton } from "../ui/Skeleton";
import { Card } from "../ui/Card";

interface NewsSectionProps {
  className?: string;
}

export function NewsSection({ className }: NewsSectionProps) {
  const newsRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const accentColor = useThemeStore((state) => state.accentColor);
  const isBackgroundAnimationEnabled = useThemeStore(
    (state) => state.isBackgroundAnimationEnabled,
  );

  const loadNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const startTime = Date.now();
    try {
      const fetchedPosts = await fetchNewsAndChangelogs();
      const elapsedTime = Date.now() - startTime;
      const minimumLoadingTime = 1000;
      if (elapsedTime < minimumLoadingTime) {
        await new Promise((resolve) =>
          setTimeout(resolve, minimumLoadingTime - elapsedTime),
        );
      }
      setPosts(fetchedPosts);
    } catch (err) {
      console.error("[NewsSection] Error fetching news:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    if (!isBackgroundAnimationEnabled) return;

    if (posts.length > 0 && !isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".news-item-card",
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.5,
            delay: 0.2,
            ease: "power3.out",
            clearProps: "opacity,y",
          },
        );
      }, newsRef);
      return () => ctx.revert();
    }
  }, [posts, isLoading, isBackgroundAnimationEnabled]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col space-y-4 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-full">
              <div className="px-2">
                <Skeleton
                  variant="text"
                  height={12}
                  width="70%"
                  className="mb-1"
                />
              </div>
              <Card variant="flat" className="w-full opacity-50 p-0">
                <div className="relative w-full pt-[56.25%]">
                  <Skeleton
                    variant="image"
                    className="absolute top-0 left-0 w-full h-full"
                  />
                </div>
              </Card>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-2">
          <Icon
            icon="pixel:exclamation-triangle-solid"
            className="w-8 h-8 text-red-400 mx-auto mb-2"
          />
          <p className="text-red-400">Error: {error}</p>
        </div>
      );
    }

    if (posts.length === 0) {
      return (
        <div className="text-center p-2">
          <Icon
            icon="pixel:newspaper-solid"
            className="w-8 h-8 text-white/50 mx-auto mb-2"
          />
          <p className="text-white/70">No news available at the moment.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col space-y-1 w-full">
        {posts.map((post) => {
          const rawTitle = post.yoast_head_json?.title || "News Item";
          const suffixToRemove = " - NoRisk Client Blog";
          let displayTitle = rawTitle;
          if (rawTitle.endsWith(suffixToRemove)) {
            displayTitle = rawTitle.substring(
              0,
              rawTitle.length - suffixToRemove.length,
            );
          }

          const imageUrl =
            post.yoast_head_json?.og_image?.[0]?.url || "/placeholder.svg";
          const postUrl = post.yoast_head_json?.og_url || "#";

          return (
            <div key={post.id} className="news-item w-full flex flex-col">
              <p
                className="font-minecraft text-2xl text-white/70 truncate"
                title={displayTitle}
              >
                {displayTitle.toLowerCase()}
              </p>
              <div className="relative w-full pt-[56.25%]">
                <NewsCard
                  id={`news-item-card-${post.id}`}
                  className="absolute top-0 left-0 w-full h-full news-item-card"
                  title={displayTitle}
                  imageUrl={imageUrl}
                  postUrl={postUrl}
                  variant="flat"
                  onClick={() => {
                    if (postUrl !== "#") {
                      openExternalUrl(postUrl).catch((err) =>
                        console.error("Failed to open URL:", err),
                      );
                    }
                    gsap.to(`#news-item-card-${post.id}`, {
                      scale: 0.98,
                      duration: 0.1,
                      yoyo: true,
                      repeat: 1,
                    });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={newsRef}
      className={cn("h-full flex flex-col !p-3 z-0", className)}
      style={{
        borderLeft: `2px solid ${accentColor.value}60`,
        borderRight: `2px solid ${accentColor.value}60`,
        boxShadow: `0 0 15px ${accentColor.value}30 inset`,
      }}
    >
      <div className="pb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon icon="pixel:newspaper-solid" className="w-7 h-7 text-white" />
            <h2 className="text-2xl font-minecraft lowercase text-white">NEWS</h2>
          </div>
        </div>
        <hr
          className="mt-2 border-t-2"
          style={{ borderColor: `${accentColor.value}40` }}
        />
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {renderContent()}
      </div>
    </div>
  );
}
