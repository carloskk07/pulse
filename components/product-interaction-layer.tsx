"use client";

import { useEffect } from "react";

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

    const releasePress = () => {
      activeSurface?.classList.remove("pc-interaction-pressed");
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
