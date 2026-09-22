import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.FULL_PAGE_BASE_URL ?? "https://pulsercuit.pro";
const outputRoot = process.env.FULL_PAGE_OUTPUT_ROOT ?? "visual-smoke/production/full-page";

if (!chrome) {
  throw new Error("CHROME_BIN is required for full-page visual capture.");
}

const routes = [
  ["home", "/"],
  ["faucet", "/faucet"],
  ["proof", "/proof"],
  ["auth", "/auth"],
];

const viewports = [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-full-page-"));
let browser = null;

async function waitForDevToolsPort() {
  const file = join(profileDir, "DevToolsActivePort");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {}
    await sleep(50);
  }
  throw new Error("Chrome DevToolsActivePort was not created.");
}

async function waitForPageTarget(port) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
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

async function waitForDocument(send, expectedPath) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({ ready: document.readyState, path: location.pathname, host: location.hostname })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (
      value?.ready === "complete"
      && value.path === expectedPath
      && value.host === new URL(baseUrl).hostname
    ) {
      await send("Runtime.evaluate", {
        expression: "document.fonts?.ready ?? Promise.resolve()",
        awaitPromise: true,
        returnByValue: true,
      });
      await sleep(350);
      return;
    }
    await sleep(75);
  }
  throw new Error(`Document did not settle on ${expectedPath}.`);
}

try {
  browser = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-domain-reliability",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=MediaRouter,OptimizationHints,Translate",
    "--force-device-scale-factor=1",
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
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

  for (const [profile, width, height] of viewports) {
    await mkdir(join(outputRoot, profile), { recursive: true });

    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });

    for (const [name, route] of routes) {
      const url = new URL(route, baseUrl).href;
      await send("Page.navigate", { url });
      await waitForDocument(send, route);

      const metrics = await send("Page.getLayoutMetrics");
      const contentSize = metrics.cssContentSize ?? metrics.contentSize;
      if (!contentSize?.width || !contentSize?.height) {
        throw new Error(`No content size for ${profile}/${name}.`);
      }

      const captureWidth = Math.ceil(contentSize.width);
      const captureHeight = Math.ceil(contentSize.height);
      if (captureWidth > 3000 || captureHeight > 20000) {
        throw new Error(
          `Unexpected full-page geometry for ${profile}/${name}: ${captureWidth}x${captureHeight}.`,
        );
      }

      const screenshot = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: captureWidth,
          height: captureHeight,
          scale: 1,
        },
      });

      const output = join(outputRoot, profile, `${name}.png`);
      await writeFile(output, Buffer.from(screenshot.data, "base64"));
      console.log(
        `full-page-capture-pass profile=${profile} route=${route} size=${captureWidth}x${captureHeight} output=${output}`,
      );
    }
  }

  socket.close();
} finally {
  if (browser && browser.exitCode === null) {
    browser.kill("SIGTERM");
    for (let attempt = 0; attempt < 40 && browser.exitCode === null; attempt += 1) {
      await sleep(50);
    }
  }

  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
