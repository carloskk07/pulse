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
    "      entry.animationEvidence = [...new Set([...(entry.animationEvidence || []), ...entry.animations.filter((animation) => animation.name && animation.pseudo).map((animation) => animation.name + '@' + animation.pseudo)])];",
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
        transferDuration: rootStyle.getPropertyValue("--pc-route-transfer-duration").trim(),
        frameStrength: Number(document.querySelector(".app-frame")?.getAttribute("data-product-residue-strength") ?? "NaN"),
        frameDimension: document.querySelector(".app-frame")?.getAttribute("data-product-residue-dimension") ?? null,
        transferSourceStrength: Number(document.documentElement.dataset.pcRouteTransferSourceStrength ?? "NaN"),
        transferPair: document.documentElement.dataset.pcRouteTransferPair ?? null,
        transferSource: rootStyle.getPropertyValue("--pc-route-transfer-source-strength").trim(),
        transferOpacity: rootStyle.getPropertyValue("--pc-transfer-out-opacity").trim(),
        transferScaleX: rootStyle.getPropertyValue("--pc-transfer-out-scale-x").trim(),
        transferScaleY: rootStyle.getPropertyValue("--pc-transfer-out-scale-y").trim(),
        transferRotate: rootStyle.getPropertyValue("--pc-transfer-out-rotate").trim(),
        transferBlur: rootStyle.getPropertyValue("--pc-transfer-out-blur").trim(),
        transferBrightness: rootStyle.getPropertyValue("--pc-transfer-out-brightness").trim(),
        transferContrast: rootStyle.getPropertyValue("--pc-transfer-out-contrast").trim(),
        transferSaturate: rootStyle.getPropertyValue("--pc-transfer-out-saturate").trim(),
        bridgeScaleX: rootStyle.getPropertyValue("--pc-transfer-bridge-scale-x").trim(),
        bridgeScaleY: rootStyle.getPropertyValue("--pc-transfer-bridge-scale-y").trim(),
        bridgeRotate: rootStyle.getPropertyValue("--pc-transfer-bridge-rotate").trim(),
        bridgeBlur: rootStyle.getPropertyValue("--pc-transfer-bridge-blur").trim(),
        bridgeBrightness: rootStyle.getPropertyValue("--pc-transfer-bridge-brightness").trim(),
        bridgeContrast: rootStyle.getPropertyValue("--pc-transfer-bridge-contrast").trim(),
        bridgeSaturate: rootStyle.getPropertyValue("--pc-transfer-bridge-saturate").trim(),
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

async function waitForTransitionTypes(send, expectedTypes, afterCall, label, expectedAnimation = null, expectedPseudo = null, secondaryAnimation = null, secondaryPseudo = null) {
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
            || (
              expectedPseudo
                ? (
                    Array.isArray(entry?.animationEvidence)
                    && entry.animationEvidence.includes(`${expectedAnimation}@${expectedPseudo}`)
                  )
                : (Array.isArray(entry?.animationNames) && entry.animationNames.includes(expectedAnimation))
            )
          )
          && (
            !secondaryAnimation
            || (
              secondaryPseudo
                ? (
                    Array.isArray(entry?.animationEvidence)
                    && entry.animationEvidence.includes(`${secondaryAnimation}@${secondaryPseudo}`)
                  )
                : (Array.isArray(entry?.animationNames) && entry.animationNames.includes(secondaryAnimation))
            )
          ),
      )
    ) {
      return state;
    }
    await sleep(25);
  }
  throw new Error(
    `${label} expected transition types ${expectedTypes.join(", ")}${expectedAnimation ? ` with animation ${expectedAnimation}${expectedPseudo ? ` on ${expectedPseudo}` : ""}` : ""}${secondaryAnimation ? ` and animation ${secondaryAnimation}${secondaryPseudo ? ` on ${secondaryPseudo}` : ""}` : ""} after call ${afterCall}: ${JSON.stringify(lastState)}`,
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


function assertNoSemanticRootAnimation(state, afterCall, label) {
  const entries = Array.isArray(state?.history)
    ? state.history.filter((entry) => Number(entry?.call) > afterCall)
    : [];
  const leaked = entries
    .flatMap((entry) => Array.isArray(entry?.animationEvidence) ? entry.animationEvidence : [])
    .find((evidence) => String(evidence).startsWith("pcTransfer") && String(evidence).includes("(root)"));
  if (leaked) {
    throw new Error(`${label} leaked semantic deformation onto the root snapshot: ${leaked}`);
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


function assertNear(actual, expected, tolerance, label) {
  const value = Number.parseFloat(String(actual));
  if (!Number.isFinite(value) || Math.abs(value - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
  }
}

function assertTransferAmplitude(state, expected, label) {
  if (state?.transferPair !== expected.pair || state?.transferSourceStrength !== expected.strength) {
    throw new Error(`${label}: transfer authority mismatch: ${JSON.stringify(state)}`);
  }

  assertNear(state.transferSource, expected.strength / 100, 0.0001, `${label} source strength`);
  assertNear(state.transferOpacity, expected.opacity, 0.0002, `${label} opacity`);
  assertNear(state.transferScaleX, expected.scaleX, 0.0002, `${label} scaleX`);
  assertNear(state.transferScaleY, expected.scaleY, 0.0002, `${label} scaleY`);
  assertNear(state.transferRotate, expected.rotate, 0.002, `${label} rotate`);
  assertNear(state.transferBlur, expected.blur, 0.002, `${label} blur`);
  assertNear(state.transferBrightness, expected.brightness, 0.0002, `${label} brightness`);
  assertNear(state.transferContrast, expected.contrast, 0.0002, `${label} contrast`);
  assertNear(state.transferSaturate, expected.saturate, 0.0002, `${label} saturate`);
  assertNear(state.bridgeScaleX, expected.bridgeScaleX, 0.0002, `${label} bridge scaleX`);
  assertNear(state.bridgeScaleY, expected.bridgeScaleY, 0.0002, `${label} bridge scaleY`);
  assertNear(state.bridgeRotate, expected.bridgeRotate, 0.002, `${label} bridge rotate`);
  assertNear(state.bridgeBlur, expected.bridgeBlur, 0.002, `${label} bridge blur`);
  assertNear(state.bridgeBrightness, expected.bridgeBrightness, 0.0002, `${label} bridge brightness`);
  assertNear(state.bridgeContrast, expected.bridgeContrast, 0.0002, `${label} bridge contrast`);
  assertNear(state.bridgeSaturate, expected.bridgeSaturate, 0.0002, `${label} bridge saturate`);
}

async function verifyAuthoritativeTransferAmplitude(send) {
  await send("Page.navigate", { url: `${baseUrl}/visual-smoke-fixture/core-state?scene=reward` });
  await waitForPath(send, "/visual-smoke-fixture/core-state");
  await waitForHydratedLink(send, "/progress");
  const reward = await readState(send);
  if (reward?.frameStrength !== 83 || reward?.frameDimension !== "value") {
    throw new Error(`Reward fixture did not expose the expected authoritative strength: ${JSON.stringify(reward)}`);
  }
  const rewardCalls = reward.calls;
  await clickRoute(send, "/progress");
  await waitForPath(send, "/progress");
  const valueSignal = await waitForTransitionTypes(
    send,
    ["pc-forward", "pc-transfer-value-signal"],
    rewardCalls,
    "Fixture Value 83 → Signal",
    "pcTransferValueSignalOut",
    "::view-transition-old(pc-spatial-field)",
    "pcTransferValueSignalBridge",
    "::view-transition-group(pc-spatial-field)",
  );
  assertTransferAmplitude(valueSignal, {
    pair: "value-signal",
    strength: 83,
    opacity: 0.2696,
    scaleX: 0.9004,
    scaleY: 0.8008,
    rotate: 0,
    blur: 4.98,
    brightness: 1.1826,
    contrast: 1,
    saturate: 1,
    bridgeScaleX: 0.9668,
    bridgeScaleY: 0.917,
    bridgeRotate: 0,
    bridgeBlur: 1.66,
    bridgeBrightness: 1,
    bridgeContrast: 1.0415,
    bridgeSaturate: 1,
  }, "Fixture Value 83 → Signal");

  await send("Page.navigate", { url: `${baseUrl}/visual-smoke-fixture/core-state?scene=progress` });
  await waitForPath(send, "/visual-smoke-fixture/core-state");
  await waitForHydratedLink(send, "/invite");
  const progress = await readState(send);
  if (progress?.frameStrength !== 94 || progress?.frameDimension !== "signal") {
    throw new Error(`Progress fixture did not expose the expected authoritative strength: ${JSON.stringify(progress)}`);
  }
  const progressCalls = progress.calls;
  await clickRoute(send, "/invite");
  await waitForPath(send, "/invite");
  const signalNetwork = await waitForTransitionTypes(
    send,
    ["pc-forward", "pc-transfer-signal-network"],
    progressCalls,
    "Fixture Signal 94 → Network",
    "pcTransferSignalNetworkOut",
    "::view-transition-old(pc-spatial-field)",
    "pcTransferSignalNetworkBridge",
    "::view-transition-group(pc-spatial-field)",
  );
  assertTransferAmplitude(signalNetwork, {
    pair: "signal-network",
    strength: 94,
    opacity: 0.1728,
    scaleX: 0.8684,
    scaleY: 0.8684,
    rotate: -1.316,
    blur: 4.7,
    brightness: 1,
    contrast: 1,
    saturate: 1,
    bridgeScaleX: 1.0282,
    bridgeScaleY: 0.9436,
    bridgeRotate: 0.376,
    bridgeBlur: 1.88,
    bridgeBrightness: 1,
    bridgeContrast: 1,
    bridgeSaturate: 1,
  }, "Fixture Signal 94 → Network");

  console.log("Authoritative semantic transfer amplitude PASS: source strengths 83 and 94 produced exact outgoing + bridge vectors.");
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
  await verifyAuthoritativeTransferAmplitude(send);

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
  await sleep(120);
  const reducedProgress = await readState(send);
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

  async function crossRoute(href, direction, semantic, outAnimation, bridgeAnimation, label) {
    const callsBefore = (await readState(send)).calls;
    await waitForHydratedLink(send, href);
    await clickRoute(send, href);
    await waitForPath(send, href);
    const outgoingPseudo = "::view-transition-old(pc-spatial-field)";
    const bridgePseudo = "::view-transition-group(pc-spatial-field)";
    const state = await waitForTransitionTypes(
      send,
      [direction, semantic],
      callsBefore,
      label,
      outAnimation,
      outgoingPseudo,
      bridgeAnimation,
      bridgePseudo,
    );
    if (state?.documentId !== before.documentId || state.motion !== "1" || state.calls <= callsBefore) {
      throw new Error(`${label} lost native SPA continuity: ${JSON.stringify(state)}`);
    }
    assertNoSemanticRootAnimation(state, callsBefore, label);
    return state;
  }

  await crossRoute("/wallet", "pc-forward", "pc-transfer-signal-value", "pcTransferSignalValueOut", "pcTransferSignalValueBridge", "Progress → Balance");
  await crossRoute("/invite", "pc-forward", "pc-transfer-value-network", "pcTransferValueNetworkOut", "pcTransferValueNetworkBridge", "Balance → Referrals");
  await crossRoute("/wallet", "pc-back", "pc-transfer-network-value", "pcTransferNetworkValueOut", "pcTransferNetworkValueBridge", "Referrals → Balance");
  await crossRoute("/progress", "pc-back", "pc-transfer-value-signal", "pcTransferValueSignalOut", "pcTransferValueSignalBridge", "Balance → Progress");
  await crossRoute("/invite", "pc-forward", "pc-transfer-signal-network", "pcTransferSignalNetworkOut", "pcTransferSignalNetworkBridge", "Progress → Referrals");
  await crossRoute("/progress", "pc-back", "pc-transfer-network-signal", "pcTransferNetworkSignalOut", "pcTransferNetworkSignalBridge", "Referrals → Progress");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });
  await sleep(120);

  const mobileBefore = await readState(send);
  if (mobileBefore?.transferDuration !== ".28s") {
    throw new Error(`Mobile semantic bridge expected .28s transfer duration at 390px, received ${mobileBefore?.transferDuration ?? "missing"}: ${JSON.stringify(mobileBefore)}`);
  }

  const mobileInvite = await crossRoute(
    "/invite",
    "pc-forward",
    "pc-transfer-signal-network",
    "pcTransferSignalNetworkOut",
    "pcTransferSignalNetworkBridge",
    "Mobile Progress → Referrals",
  );
  if (mobileInvite?.transferDuration !== ".28s") {
    throw new Error(`Mobile Progress → Referrals lost the compact semantic bridge duration: ${JSON.stringify(mobileInvite)}`);
  }

  const mobileProgress = await crossRoute(
    "/progress",
    "pc-back",
    "pc-transfer-network-signal",
    "pcTransferNetworkSignalOut",
    "pcTransferNetworkSignalBridge",
    "Mobile Referrals → Progress",
  );
  if (mobileProgress?.transferDuration !== ".28s") {
    throw new Error(`Mobile Referrals → Progress lost the compact semantic bridge duration: ${JSON.stringify(mobileProgress)}`);
  }

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await sleep(80);

  const mobileReducedBefore = await readState(send);
  if (mobileReducedBefore?.reduced !== true || mobileReducedBefore?.motion !== "0") {
    throw new Error(`Mobile reduced-motion authority did not activate: ${JSON.stringify(mobileReducedBefore)}`);
  }
  assertReducedMotionState(mobileReducedBefore, "Mobile semantic bridge");

  const mobileReducedCalls = mobileReducedBefore.calls;
  await clickRoute(send, "/wallet");
  await waitForPath(send, "/wallet");
  await sleep(120);
  const mobileReducedWallet = await readState(send);
  if (mobileReducedWallet?.documentId !== before.documentId) {
    throw new Error(`Mobile reduced-motion Progress → Balance performed a full document navigation: ${JSON.stringify(mobileReducedWallet)}`);
  }
  assertReducedMotionState(mobileReducedWallet, "Mobile Progress → Balance");
  if (mobileReducedWallet?.calls <= mobileReducedCalls) {
    throw new Error(`Mobile reduced-motion semantic bridge did not execute a native transition call: ${JSON.stringify(mobileReducedWallet)}`);
  }

  console.log(
    `Native route continuity PASS: desktop six-direction semantic bridge + mobile bridge profile (.28s, filterless old/group) + mobile reduced-motion override (calls=${mobileReducedWallet.calls}).`,
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
