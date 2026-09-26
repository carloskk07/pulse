import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.ROUTE_CONTINUITY_BASE_URL ?? "http://127.0.0.1:3100";

if (!chrome) throw new Error("CHROME_BIN is required for route-continuity verification.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-route-continuity-"));
let browser = null;

async function waitForDevToolsPort() {
  const file = join(profileDir, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {}
    await sleep(50);
  }
  throw new Error("Chrome DevToolsActivePort was not created.");
}

async function waitForPageTarget(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(50);
  }
  throw new Error("Chrome page target did not become available.");
}

function createRpc(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let id = 0;
  const pending = new Map();

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${message.error.code}: ${message.error.message}`));
    else waiter.resolve(message.result);
  });

  function send(method, params = {}) {
    const messageId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(messageId, { resolve, reject });
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });
  }

  return { socket, opened, send };
}

async function waitForPath(send, path) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({
        path: location.pathname,
        ready: document.readyState,
        frame: !!document.querySelector(".app-frame"),
        carrier: !!document.querySelector(".pc-route-carrier")
      })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.path === path && value?.ready === "complete" && value?.frame && value?.carrier) {
      await sleep(100);
      return;
    }
    await sleep(50);
  }
  throw new Error(`Route ${path} did not settle.`);
}

async function waitForHydratedLink(send, href) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `(() => {
        const link = document.querySelector('.app-topbar-nav a[href="${href}"]')
          ?? document.querySelector('.bottom-nav a[href="${href}"]');
        if (!link) return { exists: false, hydrated: false, keys: [] };
        const keys = Object.keys(link);
        return {
          exists: true,
          hydrated: keys.some((key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$")),
          keys: keys.filter((key) => key.startsWith("__react")).slice(0, 8),
        };
      })()`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.exists && value?.hydrated) return value;
    await sleep(50);
  }
  throw new Error(`Next/React navigation link ${href} did not hydrate.`);
}

async function waitForHydratedSelector(send, selector) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return { exists: false, hydrated: false, keys: [] };
        const keys = Object.keys(node);
        return {
          exists: true,
          hydrated: keys.some((key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$")),
          keys: keys.filter((key) => key.startsWith("__react")).slice(0, 8),
        };
      })()`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.exists && value?.hydrated) return value;
    await sleep(50);
  }
  throw new Error(`React node ${selector} did not hydrate.`);
}

async function verifyMinimalReactViewTransition(send) {
  await send("Page.navigate", { url: `${baseUrl}/visual-smoke-fixture/view-transition` });

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({
        ready: document.readyState,
        trigger: !!document.querySelector("#vt-runtime-trigger"),
        state: document.querySelector("#vt-runtime-state")?.getAttribute("data-step") ?? null
      })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.ready === "complete" && value?.trigger && value?.state === "0") break;
    if (attempt === 179) throw new Error("Minimal React ViewTransition fixture did not settle.");
    await sleep(50);
  }

  await waitForHydratedSelector(send, "#vt-runtime-trigger");

  const capabilities = await send("Runtime.evaluate", {
    expression: `({
      native: typeof document.startViewTransition === "function",
      classSupport: CSS.supports("view-transition-class", "pc-probe"),
      nameSupport: CSS.supports("view-transition-name", "pc-probe"),
      probeInstalled: window.__pcRouteTransitionProbeInstalled === true,
      calls: window.__pcRouteTransitionCalls ?? 0
    })`,
    returnByValue: true,
  });
  const before = capabilities.result?.value;
  if (!before?.native || !before?.classSupport || !before?.nameSupport || !before?.probeInstalled) {
    throw new Error(`Minimal React ViewTransition fixture lacks browser/runtime capability: ${JSON.stringify(before)}`);
  }

  const clicked = await send("Runtime.evaluate", {
    expression: `(() => {
      const button = document.querySelector("#vt-runtime-trigger");
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (clicked.result?.value !== true) {
    throw new Error("Minimal React ViewTransition fixture trigger was unavailable.");
  }

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({
        step: document.querySelector("#vt-runtime-state")?.getAttribute("data-step") ?? null,
        calls: window.__pcRouteTransitionCalls ?? 0,
        returnedTransition: window.__pcRouteTransitionReturned ?? false,
        animations: window.__pcRouteTransitionAnimations ?? []
      })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.step === "1" && value?.calls >= 1 && value?.returnedTransition) {
      console.log(`Minimal React ViewTransition runtime PASS: calls=${value.calls} animations=${JSON.stringify(value.animations)}`);
      return;
    }
    await sleep(50);
  }

  const result = await send("Runtime.evaluate", {
    expression: `({
      step: document.querySelector("#vt-runtime-state")?.getAttribute("data-step") ?? null,
      calls: window.__pcRouteTransitionCalls ?? 0,
      returnedTransition: window.__pcRouteTransitionReturned ?? false,
      animations: window.__pcRouteTransitionAnimations ?? [],
      reactKeys: Object.keys(document.querySelector("#vt-runtime-trigger") ?? {}).filter((key) => key.startsWith("__react")).slice(0, 8)
    })`,
    returnByValue: true,
  });
  throw new Error(`Minimal React ViewTransition fixture did not call the native API: ${JSON.stringify(result.result?.value)}`);
}

async function installTransitionProbeBeforeHydration(send) {
  const source = [
    "(() => {",
    "  if (window.__pcRouteTransitionProbeInstalled) return;",
    "  const original = Document.prototype.startViewTransition;",
    "  if (typeof original !== 'function') { window.__pcRouteTransitionUnsupported = true; return; }",
    "  window.__pcRouteTransitionCalls = 0;",
    "  window.__pcRouteTransitionReturned = false;",
    "  window.__pcRouteTransitionTypes = [];",
    "  window.__pcRouteTransitionAnimations = [];",
    "  window.__pcRouteTransitionHistory = [];",
    "  Document.prototype.startViewTransition = function(...args) {",
    "    const call = ++window.__pcRouteTransitionCalls;",
    "    const options = args[0];",
    "    const initialTypes = options && typeof options === 'object' && Array.isArray(options.types) ? [...options.types] : [];",
    "    const entry = { call, returned: false, initialTypes, types: [...initialTypes], animations: [] };",
    "    window.__pcRouteTransitionHistory.push(entry);",
    "    const transition = original.apply(this, args);",
    "    entry.returned = !!transition;",
    "    window.__pcRouteTransitionReturned = !!transition;",
    "    const collect = (phase) => {",
    "      const runtimeTypes = transition?.types ? Array.from(transition.types) : [];",
    "      const selectorTypes = [",
    "        'pc-forward', 'pc-back',",
    "        'pc-transfer-value-signal', 'pc-transfer-signal-value',",
    "        'pc-transfer-value-network', 'pc-transfer-network-value',",
    "        'pc-transfer-signal-network', 'pc-transfer-network-signal',",
    "      ].filter((type) => {",
    "        try { return document.documentElement.matches(':active-view-transition-type(' + type + ')'); } catch { return false; }",
    "      });",
    "      entry.types = [...new Set([...(entry.types || []), ...initialTypes, ...runtimeTypes, ...selectorTypes])];",
    "      entry.samples = [...(entry.samples || []), { phase, runtimeTypes, selectorTypes }].slice(-40);",
    "      entry.animations = document.getAnimations().map((animation) => ({",
    "        name: typeof animation.animationName === 'string' ? animation.animationName : '',",
    "        pseudo: animation.effect && typeof animation.effect.pseudoElement === 'string' ? animation.effect.pseudoElement : '',",
    "        playState: animation.playState,",
    "      }));",
    "      entry.animationNames = [...new Set([...(entry.animationNames || []), ...entry.animations.map((animation) => animation.name).filter(Boolean)])];",
    "      window.__pcRouteTransitionTypes = [...new Set([...(window.__pcRouteTransitionTypes || []), ...entry.types])];",
    "      window.__pcRouteTransitionAnimations = [...entry.animations];",
    "    };",
    "    collect('sync');",
    "    queueMicrotask(() => collect('microtask'));",
    "    setTimeout(() => collect('timeout-0'), 0);",
    "    let frame = 0;",
    "    const sampleFrame = () => {",
    "      frame += 1;",
    "      collect('raf-' + frame);",
    "      if (frame < 18) requestAnimationFrame(sampleFrame);",
    "    };",
    "    requestAnimationFrame(sampleFrame);",
    "    Promise.resolve(transition?.updateCallbackDone).then(() => collect('update-callback-done')).catch(() => {});",
    "    Promise.resolve(transition?.ready).then(() => collect('ready')).catch(() => {});",
    "    Promise.resolve(transition?.finished).then(() => collect('finished')).catch(() => {});",
    "    return transition;",
    "  };",
    "  window.__pcRouteTransitionProbeInstalled = true;",
    "})();",
  ].join("\n");

  await send("Page.addScriptToEvaluateOnNewDocument", { source });
}

async function readState(send) {
  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      return {
        path: location.pathname,
        documentId: performance.timeOrigin,
        supports: typeof document.startViewTransition === "function",
        calls: window.__pcRouteTransitionCalls ?? 0,
        returnedTransition: window.__pcRouteTransitionReturned ?? false,
        types: window.__pcRouteTransitionTypes ?? [],
        animations: window.__pcRouteTransitionAnimations ?? [],
        history: window.__pcRouteTransitionHistory ?? [],
        probeInstalled: window.__pcRouteTransitionProbeInstalled === true,
        probeUnsupported: window.__pcRouteTransitionUnsupported === true,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        motion: rootStyle.getPropertyValue("--pc-route-vt-motion").trim(),
        carrierDuration: rootStyle.getPropertyValue("--pc-route-vt-carrier-duration").trim(),
        orbitDuration: rootStyle.getPropertyValue("--pc-route-vt-orbit-duration").trim(),
        indexDuration: rootStyle.getPropertyValue("--pc-route-vt-index-duration").trim(),
        carrier: !!document.querySelector(".pc-route-carrier"),
        orbit: !!document.querySelector(".pc-space-orbit.orbit-a"),
        index: !!document.querySelector(".pc-space-datum.datum-a"),
      };
    })()`,
    returnByValue: true,
  });
  return result.result?.value;
}

async function clickRoute(send, href) {
  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      const link = document.querySelector('.app-topbar-nav a[href="${href}"]')
        ?? document.querySelector('.bottom-nav a[href="${href}"]');
      if (!link) return false;
      link.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (result.result?.value !== true) throw new Error(`Navigation link ${href} was not found.`);
}

async function waitForTransitionTypes(send, expectedTypes, afterCall, label, expectedAnimation = null) {
  let lastState = null;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const state = await readState(send);
    lastState = state;
    const entries = Array.isArray(state?.history)
      ? state.history.filter((entry) => Number(entry?.call) > afterCall)
      : [];
    if (
      entries.some(
        (entry) =>
          entry?.returned === true
          && Array.isArray(entry?.types)
          && expectedTypes.every((type) => entry.types.includes(type))
          && (
            !expectedAnimation
            || (Array.isArray(entry?.animationNames) && entry.animationNames.includes(expectedAnimation))
          ),
      )
    ) {
      return state;
    }
    await sleep(25);
  }
  throw new Error(
    `${label} expected transition types ${expectedTypes.join(", ")}${expectedAnimation ? ` with animation ${expectedAnimation}` : ""} after call ${afterCall}: ${JSON.stringify(lastState)}`,
  );
}

function assertNoSemanticTransfer(state, afterCall, label) {
  const entries = Array.isArray(state?.history)
    ? state.history.filter((entry) => Number(entry?.call) > afterCall)
    : [];
  const leaked = entries.flatMap((entry) => Array.isArray(entry?.types) ? entry.types : [])
    .find((type) => String(type).startsWith("pc-transfer-"));
  if (leaked) {
    throw new Error(`${label} must stay within one semantic dimension; received ${leaked}: ${JSON.stringify(entries)}`);
  }
}

function assertReducedMotionState(state, label) {
  const nearZero = new Set([".001ms", "0.001ms"]);
  if (
    state?.reduced !== true
    || state?.motion !== "0"
    || !nearZero.has(state?.carrierDuration)
    || !nearZero.has(state?.orbitDuration)
    || !nearZero.has(state?.indexDuration)
    || !nearZero.has(state?.transferDuration)
  ) {
    throw new Error(`${label} reduced-motion authority is incomplete: ${JSON.stringify(state)}`);
  }
}

try {
  browser = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  const port = await waitForDevToolsPort();
  const webSocketUrl = await waitForPageTarget(port);
  const { socket, opened, send } = createRpc(webSocketUrl);
  await opened;

  await send("Page.enable");
  await send("Runtime.enable");
  await installTransitionProbeBeforeHydration(send);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1440,
    screenHeight: 900,
  });

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

  await verifyMinimalReactViewTransition(send);

  await send("Page.navigate", { url: `${baseUrl}/dashboard` });
  await waitForPath(send, "/dashboard");

  await waitForHydratedLink(send, "/earn");
  const before = await readState(send);
  if (before?.probeUnsupported || !before?.probeInstalled) {
    throw new Error(`Pre-hydration route transition probe did not install: ${JSON.stringify(before)}`);
  }
  if (!before?.supports || before.motion !== "1" || !before.carrier || !before.orbit || !before.index) {
    throw new Error(`Initial route continuity state is incomplete: ${JSON.stringify(before)}`);
  }

  const earnCallsBefore = before.calls;
  await clickRoute(send, "/earn");
  await waitForPath(send, "/earn");
  await waitForHydratedLink(send, "/progress");
  const earn = await waitForTransitionTypes(send, ["pc-forward"], earnCallsBefore, "Rewards → Earn");
  assertNoSemanticTransfer(earn, earnCallsBefore, "Rewards → Earn");
  if (earn?.documentId !== before.documentId) {
    throw new Error(`Rewards → Earn performed a full document navigation instead of App Router navigation: before=${before.documentId} after=${earn?.documentId}`);
  }
  if (earn?.calls < 1 || !earn.returnedTransition || earn.motion !== "1") {
    throw new Error(`Rewards → Earn did not activate native route continuity: ${JSON.stringify(earn)}`);
  }

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await sleep(80);
  const reducedBefore = await readState(send);
  if (reducedBefore?.reduced !== true || reducedBefore.motion !== "0") {
    throw new Error(`Reduced-motion CSS authority did not activate: ${JSON.stringify(reducedBefore)}`);
  }

  const reducedCalls = reducedBefore.calls;
  await clickRoute(send, "/progress");
  await waitForPath(send, "/progress");
  await waitForHydratedLink(send, "/wallet");
  const reducedProgress = await waitForTransitionTypes(
    send,
    ["pc-back", "pc-transfer-value-signal"],
    reducedCalls,
    "Earn → Progress (reduced)",
  );
  if (reducedProgress?.documentId !== before.documentId) {
    throw new Error(`Reduced-motion Earn → Progress performed a full document navigation: before=${before.documentId} after=${reducedProgress?.documentId}`);
  }
  assertReducedMotionState(reducedProgress, "Earn → Progress");
  if (reducedProgress?.path !== "/progress" || reducedProgress?.calls <= reducedCalls) {
    throw new Error(`Reduced-motion semantic transfer did not stay in SPA navigation: ${JSON.stringify(reducedProgress)}`);
  }

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await sleep(80);

  async function crossRoute(href, direction, semantic, animation, label) {
    const callsBefore = (await readState(send)).calls;
    await waitForHydratedLink(send, href);
    await clickRoute(send, href);
    await waitForPath(send, href);
    const state = await waitForTransitionTypes(send, [direction, semantic], callsBefore, label, animation);
    if (state?.documentId !== before.documentId || state.motion !== "1" || state.calls <= callsBefore) {
      throw new Error(`${label} lost native SPA continuity: ${JSON.stringify(state)}`);
    }
    return state;
  }

  await crossRoute("/wallet", "pc-forward", "pc-transfer-signal-value", "pcTransferSignalValueIn", "Progress → Balance");
  await crossRoute("/invite", "pc-forward", "pc-transfer-value-network", "pcTransferValueNetworkIn", "Balance → Referrals");
  await crossRoute("/wallet", "pc-back", "pc-transfer-network-value", "pcTransferNetworkValueIn", "Referrals → Balance");
  await crossRoute("/progress", "pc-back", "pc-transfer-value-signal", "pcTransferValueSignalIn", "Balance → Progress");
  await crossRoute("/invite", "pc-forward", "pc-transfer-signal-network", "pcTransferSignalNetworkIn", "Progress → Referrals");
  const finalProgress = await crossRoute("/progress", "pc-back", "pc-transfer-network-signal", "pcTransferNetworkSignalIn", "Referrals → Progress");

  console.log(
    `Native route continuity PASS: same-dimension continuity + reduced semantic transfer + six directional dimension transfers (calls=${finalProgress.calls}).`,
  );
  socket.close();
} finally {
  if (browser && browser.exitCode === null) {
    browser.kill("SIGTERM");
    for (let attempt = 0; attempt < 40 && browser.exitCode === null; attempt += 1) {
      await sleep(50);
    }
  }

  try {
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    console.warn(`Route-continuity probe cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
}
