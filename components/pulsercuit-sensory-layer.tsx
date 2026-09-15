"use client";

import { useEffect } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function PulsercuitSensoryLayer() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".pc-v6");
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const revealTargets = Array.from(
      root.querySelectorAll<HTMLElement>(".pc-v6-section, .pc-v6-final"),
    );

    let observer: IntersectionObserver | null = null;
    if (!reducedMotion.matches && "IntersectionObserver" in window) {
      root.classList.add("pc-sensory-reveal-ready");
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            (entry.target as HTMLElement).classList.add("pc-sensory-visible");
            observer?.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -9% 0px" },
      );
      revealTargets.forEach((target) => observer?.observe(target));
    } else {
      revealTargets.forEach((target) => target.classList.add("pc-sensory-visible"));
    }

    let pointerEnabled = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let targetScroll = 0;
    let currentScroll = 0;
    let animationFrame = 0;

    const updateScrollTarget = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      targetScroll = clamp(window.scrollY / scrollable, 0, 1);
    };

    const renderFrame = () => {
      currentX += (targetX - currentX) * 0.085;
      currentY += (targetY - currentY) * 0.085;
      currentScroll += (targetScroll - currentScroll) * 0.12;

      root.style.setProperty("--pc-sx", currentX.toFixed(4));
      root.style.setProperty("--pc-sy", currentY.toFixed(4));
      root.style.setProperty("--pc-scroll", currentScroll.toFixed(4));
      root.style.setProperty("--pc-light-x", `${((currentX + 1) * 50).toFixed(2)}%`);
      root.style.setProperty("--pc-light-y", `${((currentY + 1) * 50).toFixed(2)}%`);

      const moving =
        Math.abs(targetX - currentX) > 0.001 ||
        Math.abs(targetY - currentY) > 0.001 ||
        Math.abs(targetScroll - currentScroll) > 0.001;

      animationFrame = moving ? window.requestAnimationFrame(renderFrame) : 0;
    };

    const scheduleFrame = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(renderFrame);
    };

    const syncPointerMode = () => {
      pointerEnabled = finePointer.matches && !reducedMotion.matches && window.innerWidth >= 900;
      root.classList.toggle("pc-sensory-pointer", pointerEnabled);
      if (!pointerEnabled) {
        targetX = 0;
        targetY = 0;
        scheduleFrame();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerEnabled) return;
      targetX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      targetY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
      scheduleFrame();
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      scheduleFrame();
    };

    const onScroll = () => {
      updateScrollTarget();
      scheduleFrame();
    };

    const onResize = () => {
      syncPointerMode();
      updateScrollTarget();
      scheduleFrame();
    };

    syncPointerMode();
    updateScrollTarget();
    currentScroll = targetScroll;
    root.style.setProperty("--pc-scroll", currentScroll.toFixed(4));

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    finePointer.addEventListener("change", syncPointerMode);
    reducedMotion.addEventListener("change", syncPointerMode);

    return () => {
      observer?.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      root.classList.remove("pc-sensory-pointer", "pc-sensory-reveal-ready");
      root.style.removeProperty("--pc-sx");
      root.style.removeProperty("--pc-sy");
      root.style.removeProperty("--pc-scroll");
      root.style.removeProperty("--pc-light-x");
      root.style.removeProperty("--pc-light-y");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      finePointer.removeEventListener("change", syncPointerMode);
      reducedMotion.removeEventListener("change", syncPointerMode);
    };
  }, []);

  return <div className="pc-sensory-progress" aria-hidden="true" />;
}
