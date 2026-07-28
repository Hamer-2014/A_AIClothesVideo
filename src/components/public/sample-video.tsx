"use client";

import { useEffect, useRef } from "react";

import { trackFunnelEvent } from "@/lib/analytics/client-funnel";

export function SampleVideo({
  autoPlay = false,
  className,
  controls = false,
  sourcePage,
  testId,
}: {
  autoPlay?: boolean;
  className?: string;
  controls?: boolean;
  sourcePage: string;
  testId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const halfwayRef = useRef(false);

  useEffect(() => {
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    videoRef.current?.pause();
  }, []);

  return (
    <video
      autoPlay={autoPlay}
      className={className}
      controls={controls}
      data-testid={testId}
      loop
      muted
      onPlay={controls ? () => {
        if (startedRef.current) return;
        startedRef.current = true;
        void trackFunnelEvent("sample_video_play_started", {
          sourcePage,
          milestone: "started",
        });
      } : undefined}
      onTimeUpdate={controls ? (event) => {
        const video = event.currentTarget;
        if (
          halfwayRef.current ||
          !Number.isFinite(video.duration) ||
          video.duration <= 0 ||
          video.currentTime < video.duration / 2
        ) {
          return;
        }
        halfwayRef.current = true;
        void trackFunnelEvent("sample_video_played_50", {
          sourcePage,
          milestone: "50_percent",
        });
      } : undefined}
      playsInline
      poster="/demo/red-dress-poster.webp"
      preload="metadata"
      ref={videoRef}
      src="/demo/red-dress-video.mp4"
    >
      你的浏览器不支持视频播放。
    </video>
  );
}
