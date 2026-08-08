"use client";

import { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

type LandingLottieProps = {
  src: string;
  className?: string;
  loop?: boolean;
  speed?: number;
  /** Soften vivid third-party palettes on dark hero */
  tone?: "default" | "mist" | "ink";
};

/**
 * Client Lottie player with reduced-motion respect and lazy mount.
 */
export function LandingLottie({
  src,
  className,
  loop = true,
  speed = 1,
  tone = "default",
}: LandingLottieProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [data, setData] = useState<object | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`Lottie fetch ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (lottieRef.current && speed !== 1) {
      lottieRef.current.setSpeed(speed);
    }
  }, [speed, data]);

  if (!data) {
    return (
      <div
        className={className}
        aria-hidden
        style={{ background: "transparent" }}
      />
    );
  }

  const toneClass =
    tone === "mist"
      ? "opacity-90 [filter:saturate(0.85)_hue-rotate(165deg)]"
      : tone === "ink"
        ? "opacity-95 [filter:saturate(0.7)_brightness(1.05)_hue-rotate(150deg)]"
        : "";

  return (
    <div className={`${className ?? ""} ${toneClass}`.trim()} aria-hidden>
      <Lottie
        lottieRef={lottieRef}
        animationData={data}
        loop={loop && !reduced}
        autoplay={!reduced}
        className="h-full w-full"
      />
    </div>
  );
}
