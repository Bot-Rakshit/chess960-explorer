"use client";

import { useCallback, useRef, useEffect } from "react";

type SoundType = "move" | "capture" | "castle" | "check" | "promote";

const soundFiles: Record<SoundType, string> = {
  move: "/sounds/move-self.mp3",
  capture: "/sounds/move-capture.mp3",
  castle: "/sounds/move-castle.mp3",
  check: "/sounds/move-check.mp3",
  promote: "/sounds/move-promote.mp3",
};

export function useSound() {
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    move: null,
    capture: null,
    castle: null,
    check: null,
    promote: null,
  });

  useEffect(() => {
    // Preload audio files
    Object.entries(soundFiles).forEach(([type, src]) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audioRefs.current[type as SoundType] = audio;
    });

    return () => {
      // Cleanup
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, []);

  const play = useCallback((type: SoundType) => {
    const audio = audioRefs.current[type];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, []);

  return { play };
}
