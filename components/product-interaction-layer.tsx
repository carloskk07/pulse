"use client";

import { useEffect } from "react";
import { getRouteDimension, getRouteDimensionFromHref, type RouteDimension } from "@/lib/route-dimension";


type TransferVector = {
  opacity: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
  blur: number;
  brightness: number;
  contrast: number;
  saturate: number;
  bridgeScaleX: number;
  bridgeScaleY: number;
  bridgeRotate: number;
  bridgeBlur: number;
  bridgeBrightness: number;
  bridgeContrast: number;
  bridgeSaturate: number;
};

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function transferVector(from: RouteDimension, to: RouteDimension, strength: number): TransferVector {
  const energy = Math.max(0, Math.min(1, strength));

  if (from === "value" && to === "signal") {
    return {
      opacity: lerp(1, 0.12, energy),
      scaleX: lerp(1, 0.88, energy),
      scaleY: lerp(1, 0.76, energy),
      rotate: 0,
      blur: lerp(0, 6, energy),
      brightness: lerp(1, 1.22, energy),
      contrast: 1,
      saturate: 1,
      bridgeScaleX: lerp(1, 0.96, energy),
      bridgeScaleY: lerp(1, 0.9, energy),
      bridgeRotate: 0,
      bridgeBlur: lerp(0, 2, energy),
      bridgeBrightness: 1,
      bridgeContrast: lerp(1, 1.05, energy),
      bridgeSaturate: 1,
    };
  }
  if (from === "signal" && to === "value") {
    return {
      opacity: lerp(1, 0.14, energy),
      scaleX: lerp(1, 0.92, energy),
      scaleY: lerp(1, 0.92, energy),
      rotate: lerp(0, 1, energy),
      blur: lerp(0, 5, energy),
      brightness: 1,
      contrast: lerp(1, 1.12, energy),
      saturate: 1,
      bridgeScaleX: lerp(1, 0.94, energy),
      bridgeScaleY: lerp(1, 0.88, energy),
      bridgeRotate: 0,
      bridgeBlur: lerp(0, 2, energy),
      bridgeBrightness: lerp(1, 1.08, energy),
      bridgeContrast: 1,
      bridgeSaturate: 1,
    };
  }
  if (from === "value" && to === "network") {
    return {
      opacity: lerp(1, 0.12, energy),
      scaleX: lerp(1, 0.72, energy),
      scaleY: lerp(1, 1.04, energy),
      rotate: 0,
      blur: lerp(0, 5, energy),
      brightness: lerp(1, 1.12, energy),
      contrast: 1,
      saturate: 1,
      bridgeScaleX: lerp(1, 1.04, energy),
      bridgeScaleY: lerp(1, 0.92, energy),
      bridgeRotate: 0,
      bridgeBlur: lerp(0, 2, energy),
      bridgeBrightness: 1,
      bridgeContrast: 1,
      bridgeSaturate: lerp(1, 1.08, energy),
    };
  }
  if (from === "network" && to === "value") {
    return {
      opacity: lerp(1, 0.1, energy),
      scaleX: lerp(1, 1.08, energy),
      scaleY: lerp(1, 0.76, energy),
      rotate: 0,
      blur: lerp(0, 6, energy),
      brightness: 1,
      contrast: 1,
      saturate: lerp(1, 1.12, energy),
      bridgeScaleX: lerp(1, 0.92, energy),
      bridgeScaleY: lerp(1, 1.03, energy),
      bridgeRotate: 0,
      bridgeBlur: lerp(0, 2, energy),
      bridgeBrightness: lerp(1, 1.06, energy),
      bridgeContrast: 1,
      bridgeSaturate: 1,
    };
  }
  if (from === "signal" && to === "network") {
    return {
      opacity: lerp(1, 0.12, energy),
      scaleX: lerp(1, 0.86, energy),
      scaleY: lerp(1, 0.86, energy),
      rotate: lerp(0, -1.4, energy),
      blur: lerp(0, 5, energy),
      brightness: 1,
      contrast: 1,
      saturate: 1,
      bridgeScaleX: lerp(1, 1.03, energy),
      bridgeScaleY: lerp(1, 0.94, energy),
      bridgeRotate: lerp(0, 0.4, energy),
      bridgeBlur: lerp(0, 2, energy),
      bridgeBrightness: 1,
      bridgeContrast: 1,
      bridgeSaturate: 1,
    };
  }
  return {
    opacity: lerp(1, 0.1, energy),
    scaleX: lerp(1, 1.06, energy),
    scaleY: lerp(1, 0.82, energy),
    rotate: lerp(0, 0.9, energy),
    blur: lerp(0, 6, energy),
    brightness: 1,
    contrast: 1,
    saturate: 1,
    bridgeScaleX: lerp(1, 0.96, energy),
    bridgeScaleY: lerp(1, 0.96, energy),
    bridgeRotate: lerp(0, -0.4, energy),
    bridgeBlur: lerp(0, 2, energy),
    bridgeBrightness: 1,
    bridgeContrast: 1,
    bridgeSaturate: 1,
  };
}

function syncRouteTransferAuthority(frame: HTMLElement, href: string | null) {
  const currentDimension = getRouteDimension(frame.dataset.section);
  const targetDimension = getRouteDimensionFromHref(href);
  if (!currentDimension || !targetDimension || currentDimension === targetDimension) return;

  const strength = Math.max(0, Math.min(100, Number(frame.dataset.productResidueStrength ?? 0)));
  const energy = strength / 100;
  const vector = transferVector(currentDimension, targetDimension, energy);
  const root = document.documentElement;

  root.dataset.pcRouteTransferSourceStrength = String(strength);
  root.dataset.pcRouteTransferPair = `${currentDimension}-${targetDimension}`;
  root.style.setProperty("--pc-route-transfer-source-strength", energy.toFixed(4));
  root.style.setProperty("--pc-transfer-out-opacity", vector.opacity.toFixed(4));
  root.style.setProperty("--pc-transfer-out-scale-x", vector.scaleX.toFixed(4));
  root.style.setProperty("--pc-transfer-out-scale-y", vector.scaleY.toFixed(4));
  root.style.setProperty("--pc-transfer-out-rotate", `${vector.rotate.toFixed(3)}deg`);
  root.style.setProperty("--pc-transfer-out-blur", `${vector.blur.toFixed(3)}px`);
  root.style.setProperty("--pc-transfer-out-brightness", vector.brightness.toFixed(4));
  root.style.setProperty("--pc-transfer-out-contrast", vector.contrast.toFixed(4));
  root.style.setProperty("--pc-transfer-out-saturate", vector.saturate.toFixed(4));
  root.style.setProperty("--pc-transfer-bridge-scale-x", vector.bridgeScaleX.toFixed(4));
  root.style.setProperty("--pc-transfer-bridge-scale-y", vector.bridgeScaleY.toFixed(4));
  root.style.setProperty("--pc-transfer-bridge-rotate", `${vector.bridgeRotate.toFixed(3)}deg`);
  root.style.setProperty("--pc-transfer-bridge-blur", `${vector.bridgeBlur.toFixed(3)}px`);
  root.style.setProperty("--pc-transfer-bridge-brightness", vector.bridgeBrightness.toFixed(4));
  root.style.setProperty("--pc-transfer-bridge-contrast", vector.bridgeContrast.toFixed(4));
  root.style.setProperty("--pc-transfer-bridge-saturate", vector.bridgeSaturate.toFixed(4));
}

const REACTIVE_SELECTOR = [
  ".pc-v9-chamber",
  ".pc-luxe-best-turbo",
  ".pc-v3-vault-balance",
  ".pc-v3-prestige-card",
  ".pc-luxe-invite-hero",
  ".pc-value-flow",
].join(",");

function clamp(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function setField(frame: HTMLElement, x: number, y: number) {
  frame.style.setProperty("--pc-field-x-near", `${(x * 9).toFixed(2)}px`);
  frame.style.setProperty("--pc-field-y-near", `${(y * 7).toFixed(2)}px`);
  frame.style.setProperty("--pc-field-x-far", `${(x * 4).toFixed(2)}px`);
  frame.style.setProperty("--pc-field-y-far", `${(y * 3).toFixed(2)}px`);
  frame.style.setProperty("--pc-field-x-counter", `${(x * -3).toFixed(2)}px`);
  frame.style.setProperty("--pc-field-y-counter", `${(y * -2).toFixed(2)}px`);
}

function resetField(frame: HTMLElement) {
  setField(frame, 0, 0);
}

function clearSurface(surface: HTMLElement | null) {
  if (!surface) return;
  surface.classList.remove("pc-interaction-active", "pc-interaction-pressed");
  for (const property of [
    "--pc-surface-x",
    "--pc-surface-y",
    "--pc-surface-counter-x",
    "--pc-surface-counter-y",
    "--pc-surface-light-x",
    "--pc-surface-light-y",
  ]) {
    surface.style.removeProperty(property);
  }
}

function applySurface(surface: HTMLElement, clientX: number, clientY: number) {
  const rect = surface.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = clamp(((clientX - rect.left) / rect.width) * 2 - 1);
  const y = clamp(((clientY - rect.top) / rect.height) * 2 - 1);
  const lightX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const lightY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

  surface.style.setProperty("--pc-surface-x", `${(x * 8).toFixed(2)}px`);
  surface.style.setProperty("--pc-surface-y", `${(y * 6).toFixed(2)}px`);
  surface.style.setProperty("--pc-surface-counter-x", `${(x * -3.4).toFixed(2)}px`);
  surface.style.setProperty("--pc-surface-counter-y", `${(y * -2.6).toFixed(2)}px`);
  surface.style.setProperty("--pc-surface-light-x", `${lightX.toFixed(2)}%`);
  surface.style.setProperty("--pc-surface-light-y", `${lightY.toFixed(2)}%`);
  surface.classList.add("pc-interaction-active");
}

export function ProductInteractionLayer() {
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>(".app-frame");
    if (!frame) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    let activeSurface: HTMLElement | null = null;
    let raf = 0;
    let queued:
      | { clientX: number; clientY: number; surface: HTMLElement | null }
      | null = null;

    const markMode = () => {
      frame.dataset.productInteraction = reducedMotion.matches
        ? "reduced"
        : finePointer.matches
          ? "reactive"
          : "touch";
    };

    const updateField = (clientX: number, clientY: number) => {
      const rect = frame.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = clamp(((clientX - rect.left) / rect.width) * 2 - 1);
      const y = clamp(((clientY - rect.top) / rect.height) * 2 - 1);
      setField(frame, x, y);
    };

    const flushPointer = () => {
      raf = 0;
      const next = queued;
      queued = null;
      if (!next) return;

      if (activeSurface !== next.surface) {
        clearSurface(activeSurface);
        activeSurface = next.surface;
      }

      updateField(next.clientX, next.clientY);
      if (next.surface) {
        applySurface(next.surface, next.clientX, next.clientY);
      }
    };

    const findSurface = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const surface = target.closest<HTMLElement>(REACTIVE_SELECTOR);
      return surface && frame.contains(surface) ? surface : null;
    };


    const onRouteClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || !frame.contains(link)) return;
      syncRouteTransferAuthority(frame, link.getAttribute("href"));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType === "touch") return;
      queued = {
        clientX: event.clientX,
        clientY: event.clientY,
        surface: findSurface(event.target),
      };
      if (!raf) raf = window.requestAnimationFrame(flushPointer);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (reducedMotion.matches) return;
      const surface = findSurface(event.target);
      if (!surface) return;

      if (activeSurface !== surface) {
        clearSurface(activeSurface);
        activeSurface = surface;
      }
      applySurface(surface, event.clientX, event.clientY);
      surface.classList.add("pc-interaction-pressed");
    };

    const releasePress = (event: PointerEvent) => {
      activeSurface?.classList.remove("pc-interaction-pressed");
      if (event.pointerType === "touch" || !finePointer.matches) {
        clearSurface(activeSurface);
        activeSurface = null;
        resetField(frame);
      }
    };

    const onPointerLeave = () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      queued = null;
      clearSurface(activeSurface);
      activeSurface = null;
      resetField(frame);
    };

    const onPreferenceChange = () => {
      markMode();
      if (reducedMotion.matches) onPointerLeave();
    };

    markMode();
    resetField(frame);

    frame.addEventListener("click", onRouteClick, true);
    frame.addEventListener("pointermove", onPointerMove, { passive: true });
    frame.addEventListener("pointerdown", onPointerDown, { passive: true });
    frame.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("pointerup", releasePress, { passive: true });
    window.addEventListener("pointercancel", releasePress, { passive: true });
    reducedMotion.addEventListener("change", onPreferenceChange);
    finePointer.addEventListener("change", onPreferenceChange);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      clearSurface(activeSurface);
      resetField(frame);
      delete frame.dataset.productInteraction;
      frame.removeEventListener("click", onRouteClick, true);
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerdown", onPointerDown);
      frame.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerup", releasePress);
      window.removeEventListener("pointercancel", releasePress);
      reducedMotion.removeEventListener("change", onPreferenceChange);
      finePointer.removeEventListener("change", onPreferenceChange);
    };
  }, []);

  return null;
}
