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

function applyTransferProfile(strength: number) {
  const root = document.documentElement;
  const normalizedStrength = clampStrength(strength);
  const n = normalizedStrength / 100;

  if (cleanupTimer !== null) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  root.dataset.pcTransferSourceStrength = compact(normalizedStrength);
  root.style.setProperty("--pc-transfer-source-strength", compact(normalizedStrength));
  root.style.setProperty("--pc-transfer-opacity", compact(1 - (0.9 * n)));
  root.style.setProperty("--pc-transfer-blur", `${compact(6 * n)}px`);
  root.style.setProperty("--pc-transfer-brightness", compact(1 + (0.22 * n)));
  root.style.setProperty("--pc-transfer-contrast", compact(1 + (0.12 * n)));
  root.style.setProperty("--pc-transfer-saturate", compact(1 + (0.12 * n)));
  root.style.setProperty("--pc-transfer-scale-soft-x", compact(1 - (0.12 * n)));
  root.style.setProperty("--pc-transfer-scale-value-x", compact(1 - (0.08 * n)));
  root.style.setProperty("--pc-transfer-scale-hard-x", compact(1 - (0.28 * n)));
  root.style.setProperty("--pc-transfer-scale-hard-y", compact(1 - (0.24 * n)));
  root.style.setProperty("--pc-transfer-scale-focus-x", compact(1 - (0.14 * n)));
  root.style.setProperty("--pc-transfer-scale-orbit-y", compact(1 - (0.18 * n)));
  root.style.setProperty("--pc-transfer-scale-expand-x", compact(1 + (0.08 * n)));
  root.style.setProperty("--pc-transfer-scale-expand-mid-x", compact(1 + (0.06 * n)));
  root.style.setProperty("--pc-transfer-scale-expand-y", compact(1 + (0.04 * n)));
  root.style.setProperty("--pc-transfer-rotate-pos", `${compact(1 * n)}deg`);
  root.style.setProperty("--pc-transfer-rotate-neg", `${compact(-1.4 * n)}deg`);
  root.style.setProperty("--pc-transfer-rotate-network", `${compact(0.9 * n)}deg`);

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
