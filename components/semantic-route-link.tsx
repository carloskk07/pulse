"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

type SemanticRouteLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  sourceStrength: number;
};

const transferVars = [
  "--pc-transfer-source-strength",
  "--pc-transfer-opacity",
  "--pc-transfer-blur",
  "--pc-transfer-brightness",
  "--pc-transfer-lift",
  "--pc-transfer-contrast",
  "--pc-transfer-saturate",
  "--pc-transfer-scale-soft-x",
  "--pc-transfer-scale-value-x",
  "--pc-transfer-scale-hard-x",
  "--pc-transfer-scale-hard-y",
  "--pc-transfer-scale-focus-x",
  "--pc-transfer-scale-orbit-y",
  "--pc-transfer-scale-expand-x",
  "--pc-transfer-scale-expand-mid-x",
  "--pc-transfer-scale-expand-y",
  "--pc-transfer-rotate-pos",
  "--pc-transfer-rotate-neg",
  "--pc-transfer-rotate-network",
  "--pc-bridge-blur",
  "--pc-bridge-value-signal-x",
  "--pc-bridge-value-signal-y",
  "--pc-bridge-signal-value-x",
  "--pc-bridge-signal-value-y",
  "--pc-bridge-value-network-x",
  "--pc-bridge-value-network-y",
  "--pc-bridge-network-value-x",
  "--pc-bridge-network-value-y",
  "--pc-bridge-signal-network-x",
  "--pc-bridge-signal-network-y",
  "--pc-bridge-network-signal-x",
  "--pc-bridge-contrast",
  "--pc-bridge-brightness",
  "--pc-bridge-brightness-soft",
  "--pc-bridge-saturate",
  "--pc-bridge-rotate-pos",
  "--pc-bridge-rotate-neg",
] as const;

let cleanupTimer: number | null = null;

function clampStrength(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function compact(value: number) {
  return Number(value.toFixed(4)).toString();
}

function clearTransferProfile(root: HTMLElement) {
  for (const name of transferVars) root.style.removeProperty(name);
  delete root.dataset.pcTransferSourceStrength;
}

function setNumber(root: HTMLElement, name: string, value: number) {
  root.style.setProperty(name, compact(value));
}

function setPx(root: HTMLElement, name: string, value: number) {
  root.style.setProperty(name, `${compact(value)}px`);
}

function setDeg(root: HTMLElement, name: string, value: number) {
  root.style.setProperty(name, `${compact(value)}deg`);
}

function applyTransferProfile(strength: number) {
  const root = document.documentElement;
  const normalizedStrength = clampStrength(strength);
  const n = normalizedStrength / 100;

  if (cleanupTimer !== null) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  root.dataset.pcTransferSourceStrength = compact(normalizedStrength);
  setNumber(root, "--pc-transfer-source-strength", normalizedStrength);
  setNumber(root, "--pc-transfer-opacity", 1 - (0.9 * n));
  setPx(root, "--pc-transfer-blur", 6 * n);
  setNumber(root, "--pc-transfer-brightness", 1 + (0.22 * n));
  setNumber(root, "--pc-transfer-lift", 1 + (0.12 * n));
  setNumber(root, "--pc-transfer-contrast", 1 + (0.12 * n));
  setNumber(root, "--pc-transfer-saturate", 1 + (0.12 * n));
  setNumber(root, "--pc-transfer-scale-soft-x", 1 - (0.12 * n));
  setNumber(root, "--pc-transfer-scale-value-x", 1 - (0.08 * n));
  setNumber(root, "--pc-transfer-scale-hard-x", 1 - (0.28 * n));
  setNumber(root, "--pc-transfer-scale-hard-y", 1 - (0.24 * n));
  setNumber(root, "--pc-transfer-scale-focus-x", 1 - (0.14 * n));
  setNumber(root, "--pc-transfer-scale-orbit-y", 1 - (0.18 * n));
  setNumber(root, "--pc-transfer-scale-expand-x", 1 + (0.08 * n));
  setNumber(root, "--pc-transfer-scale-expand-mid-x", 1 + (0.06 * n));
  setNumber(root, "--pc-transfer-scale-expand-y", 1 + (0.04 * n));
  setDeg(root, "--pc-transfer-rotate-pos", 1 * n);
  setDeg(root, "--pc-transfer-rotate-neg", -1.4 * n);
  setDeg(root, "--pc-transfer-rotate-network", 0.9 * n);

  setPx(root, "--pc-bridge-blur", 2 * n);
  setNumber(root, "--pc-bridge-value-signal-x", 1 - (0.04 * n));
  setNumber(root, "--pc-bridge-value-signal-y", 1 - (0.10 * n));
  setNumber(root, "--pc-bridge-signal-value-x", 1 - (0.06 * n));
  setNumber(root, "--pc-bridge-signal-value-y", 1 - (0.12 * n));
  setNumber(root, "--pc-bridge-value-network-x", 1 + (0.04 * n));
  setNumber(root, "--pc-bridge-value-network-y", 1 - (0.08 * n));
  setNumber(root, "--pc-bridge-network-value-x", 1 - (0.08 * n));
  setNumber(root, "--pc-bridge-network-value-y", 1 + (0.03 * n));
  setNumber(root, "--pc-bridge-signal-network-x", 1 + (0.03 * n));
  setNumber(root, "--pc-bridge-signal-network-y", 1 - (0.06 * n));
  setNumber(root, "--pc-bridge-network-signal-x", 1 - (0.04 * n));
  setNumber(root, "--pc-bridge-contrast", 1 + (0.05 * n));
  setNumber(root, "--pc-bridge-brightness", 1 + (0.08 * n));
  setNumber(root, "--pc-bridge-brightness-soft", 1 + (0.06 * n));
  setNumber(root, "--pc-bridge-saturate", 1 + (0.08 * n));
  setDeg(root, "--pc-bridge-rotate-pos", 0.4 * n);
  setDeg(root, "--pc-bridge-rotate-neg", -0.4 * n);

  cleanupTimer = window.setTimeout(() => {
    clearTransferProfile(root);
    cleanupTimer = null;
  }, 900);
}

export function SemanticRouteLink({
  sourceStrength,
  transitionTypes,
  ...props
}: SemanticRouteLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const semanticTransfer = Array.isArray(transitionTypes)
      && transitionTypes.some((type) => type.startsWith("pc-transfer-"));

    if (semanticTransfer) applyTransferProfile(sourceStrength);
    else {
      const root = document.documentElement;
      if (cleanupTimer !== null) {
        window.clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      clearTransferProfile(root);
    }
  }

  return <Link {...props} transitionTypes={transitionTypes} onClick={handleClick} />;
}
