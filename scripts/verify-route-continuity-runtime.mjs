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
  for (let attempt = 0; attempt < 160; attempt += 1) {
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
      await sleep(120);
      return;
    }
    await sleep(50);
  }
  throw new Error(`Route ${path} did not settle.`);
}

async function readContinuityState(send) {
  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      const carrier = document.querySelector(".pc-route-carrier");
      const orbit = document.querySelector(".pc-space-orbit.orbit-a");
      const index = document.querySelector(".pc-space-datum.datum-a");
      const activeTop = document.querySelector(".app-topbar-nav a.active");
      const activeBottom = document.querySelector(".bottom-nav > a.active");
      const readName = (node) => node ? getComputedStyle(node).viewTransitionName : null;
      return {
        path: location.pathname,
        supports: typeof document.startViewTransition === "function",
        carrier: readName(carrier),
        orbit: readName(orbit),
        index: readName(index),
        activeTop: readName(activeTop),
        activeBottom: readName(activeBottom),
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        calls: window.__pcRouteTransitionCalls ?? 0,
        returnedTransition: window.__pcRouteTransitionReturned ?? false,
      };
    })()`,
    returnByValue: true,
  });
  return result.result?.value;
}

async function installTransitionProbe(send) {
  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      if (window.__pcRouteTransitionProbeInstalled) return true;
      if (typeof Document.prototype.startViewTransition !== "function") return false;
      const original = Document.prototype.startViewTransition;
      window.__pcRouteTransitionCalls = 0;
      window.__pcRouteTransitionReturned = false;
      Document.prototype.startViewTransition = function(...args) {
        window.__pcRouteTransitionCalls += 1;
        const transition = original.apply(this, args);
        window.__pcRouteTransitionReturned = !!transition;
        return transition;
      };
      window.__pcRouteTransitionProbeInstalled = true;
      return true;
    })()`,
    returnByValue: true,
  });
  return result.result?.value === true;
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

  const installed = await installTransitionProbe(send);
  if (!installed) throw new Error("Browser does not expose document.startViewTransition.");

  const before = await readContinuityState(send);
  if (
    !before?.supports
    || before.carrier !== "pc-route-carrier"
    || before.orbit !== "pc-route-orbit"
    || before.index !== "pc-route-index"
    || before.activeTop !== "pc-active-nav"
  ) {
    throw new Error(`Named route geometry is incomplete before navigation: ${JSON.stringify(before)}`);
  }

  await clickRoute(send, "/earn");
  await waitForPath(send, "/earn");
  const earn = await readContinuityState(send);
  if (
    earn?.path !== "/earn"
    || earn.calls < 1
    || !earn.returnedTransition
    || earn.carrier !== "pc-route-carrier"
    || earn.orbit !== "pc-route-orbit"
    || earn.index !== "pc-route-index"
    || earn.activeTop !== "pc-active-nav"
  ) {
    throw new Error(`Rewards → Earn continuity failed: ${JSON.stringify(earn)}`);
  }

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await sleep(80);

  const reducedBefore = await readContinuityState(send);
  if (
    reducedBefore?.reduced !== true
    || reducedBefore.carrier !== "none"
    || reducedBefore.orbit !== "none"
    || reducedBefore.index !== "none"
    || reducedBefore.activeTop !== "none"
  ) {
    throw new Error(`Reduced-motion geometry must opt out of named transitions: ${JSON.stringify(reducedBefore)}`);
  }

  const callsBeforeReducedNavigation = reducedBefore.calls;
  await clickRoute(send, "/wallet");
  await waitForPath(send, "/wallet");
  const wallet = await readContinuityState(send);
  if (
    wallet?.path !== "/wallet"
    || wallet.reduced !== true
    || wallet.carrier !== "none"
    || wallet.orbit !== "none"
    || wallet.index !== "none"
    || wallet.activeTop !== "none"
    || wallet.calls <= callsBeforeReducedNavigation
  ) {
    throw new Error(`Reduced-motion Earn → Balance navigation failed: ${JSON.stringify(wallet)}`);
  }

  console.log(
    `Native route continuity PASS: Rewards -> Earn used view transition; reduced-motion Earn -> Balance stayed unnamed (calls=${wallet.calls}).`,
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
