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
    "  Document.prototype.startViewTransition = function(...args) {",
    "    window.__pcRouteTransitionCalls += 1;",
    "    const options = args[0];",
    "    window.__pcRouteTransitionTypes = options && typeof options === 'object' && Array.isArray(options.types) ? [...options.types] : [];",
    "    const transition = original.apply(this, args);",
    "    window.__pcRouteTransitionReturned = !!transition;",
    "    Promise.resolve(transition?.ready).then(() => {",
    "      window.__pcRouteTransitionAnimations = document.getAnimations().map((animation) => ({",
    "        name: typeof animation.animationName === 'string' ? animation.animationName : '',",
    "        pseudo: animation.effect && typeof animation.effect.pseudoElement === 'string' ? animation.effect.pseudoElement : '',",
    "        playState: animation.playState,",
    "      }));",
    "    }).catch(() => {});",
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
        probeInstalled: window.__pcRouteTransitionProbeInstalled === true,
        probeUnsupported: window.__pcRouteTransitionUnsupported === true,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        motion: rootStyle.getPropertyValue("--pc-route-vt-motion").trim(),
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

function assertTypes(state, expected, label) {
  if (!Array.isArray(state?.types) || !state.types.includes(expected)) {
    throw new Error(`${label} expected transition type ${expected}: ${JSON.stringify(state)}`);
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

  await clickRoute(send, "/earn");
  await waitForPath(send, "/earn");
  await waitForHydratedLink(send, "/wallet");
  const earn = await readState(send);
  if (earn?.documentId !== before.documentId) {
    throw new Error(`Rewards → Earn performed a full document navigation instead of App Router navigation: before=${before.documentId} after=${earn?.documentId}`);
  }
  if (earn?.calls < 1 || !earn.returnedTransition || earn.motion !== "1") {
    throw new Error(`Rewards → Earn did not activate native route continuity: ${JSON.stringify(earn)}`);
  }
  assertTypes(earn, "pc-forward", "Rewards → Earn");

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await sleep(80);
  const reducedBefore = await readState(send);
  if (reducedBefore?.reduced !== true || reducedBefore.motion !== "0") {
    throw new Error(`Reduced-motion CSS authority did not activate: ${JSON.stringify(reducedBefore)}`);
  }

  const reducedCalls = reducedBefore.calls;
  await waitForHydratedLink(send, "/wallet");
  await clickRoute(send, "/wallet");
  await waitForPath(send, "/wallet");
  await waitForHydratedLink(send, "/progress");
  const wallet = await readState(send);
  if (wallet?.documentId !== before.documentId) {
    throw new Error(`Earn → Balance performed a full document navigation instead of App Router navigation: before=${before.documentId} after=${wallet?.documentId}`);
  }
  if (wallet?.calls <= reducedCalls || wallet.reduced !== true || wallet.motion !== "0") {
    throw new Error(`Reduced-motion Earn → Balance navigation failed: ${JSON.stringify(wallet)}`);
  }
  assertTypes(wallet, "pc-forward", "Earn → Balance under reduced motion");

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await sleep(80);
  const backCalls = (await readState(send)).calls;
  await waitForHydratedLink(send, "/progress");
  await clickRoute(send, "/progress");
  await waitForPath(send, "/progress");
  const progress = await readState(send);
  if (progress?.documentId !== before.documentId) {
    throw new Error(`Balance → Progress performed a full document navigation instead of App Router navigation: before=${before.documentId} after=${progress?.documentId}`);
  }
  if (progress?.calls <= backCalls || progress.motion !== "1") {
    throw new Error(`Balance → Progress did not reactivate route continuity: ${JSON.stringify(progress)}`);
  }
  assertTypes(progress, "pc-back", "Balance → Progress");

  console.log(
    `Native route continuity PASS: forward + reduced-motion + back (calls=${progress.calls}).`,
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
