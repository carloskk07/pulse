import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.PRODUCT_INTERACTION_BASE_URL ?? "http://127.0.0.1:3100";

if (!chrome) throw new Error("CHROME_BIN is required for product interaction verification.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-interaction-"));
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

async function waitForDocument(send) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({ ready: document.readyState, path: location.pathname, mode: document.querySelector(".app-frame")?.dataset.productInteraction ?? "" })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (
      value?.ready === "complete"
      && value.path === "/visual-smoke-fixture/core-state"
      && value.mode
    ) {
      await sleep(120);
      return value.mode;
    }
    await sleep(50);
  }
  throw new Error("Reactive interaction layer did not hydrate.");
}

async function dispatchSurfacePress(send) {
  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      const surface = document.querySelector(".pc-v9-chamber");
      if (!surface) return false;
      const rect = surface.getBoundingClientRect();
      surface.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        clientX: rect.left + rect.width * .72,
        clientY: rect.top + rect.height * .38,
      }));
      return true;
    })()`,
    returnByValue: true,
  });
  if (result.result?.value !== true) throw new Error("Reward surface was not available for interaction probe.");
  await sleep(80);
}

async function probe(send) {
  const result = await send("Runtime.evaluate", {
    expression: `(() => {
      const frame = document.querySelector(".app-frame");
      const surface = document.querySelector(".pc-v9-chamber");
      if (!frame || !surface) return null;
      const style = surface.style;
      return {
        mode: frame.dataset.productInteraction ?? "",
        active: surface.classList.contains("pc-interaction-active"),
        pressed: surface.classList.contains("pc-interaction-pressed"),
        x: style.getPropertyValue("--pc-surface-x"),
        y: style.getPropertyValue("--pc-surface-y"),
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    })()`,
    returnByValue: true,
  });
  return result.result?.value;
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
  await send("Page.navigate", { url: `${baseUrl}/visual-smoke-fixture/core-state?scene=reward` });
  const normalMode = await waitForDocument(send);
  if (normalMode === "reduced") throw new Error("Normal interaction probe unexpectedly entered reduced mode.");

  await dispatchSurfacePress(send);
  const active = await probe(send);
  if (!active?.active || !active?.pressed || !active?.x || !active?.y) {
    throw new Error(`Reactive surface press failed: ${JSON.stringify(active)}`);
  }

  await send("Runtime.evaluate", {
    expression: 'window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }))',
  });
  await sleep(40);
  const released = await probe(send);
  if (released?.pressed) throw new Error("Reactive surface remained pressed after pointerup.");

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await send("Page.navigate", { url: `${baseUrl}/visual-smoke-fixture/core-state?scene=reward&motion=reduce` });
  const reducedMode = await waitForDocument(send);
  if (reducedMode !== "reduced") throw new Error(`Expected reduced interaction mode; received ${reducedMode}.`);

  await dispatchSurfacePress(send);
  const reduced = await probe(send);
  if (reduced?.active || reduced?.pressed || reduced?.x || reduced?.y || reduced?.reduced !== true) {
    throw new Error(`Reduced-motion interaction must stay inert: ${JSON.stringify(reduced)}`);
  }

  console.log("Reactive spatial interaction contract PASS: touch feedback + reduced-motion safety");
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
    console.warn(`Interaction probe cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
}
