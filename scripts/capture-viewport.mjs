import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const [url, output, size] = process.argv.slice(2);
const chrome = process.env.CHROME_BIN;

if (!chrome) throw new Error("CHROME_BIN is required for viewport capture.");
if (!url || !output || !size) {
  throw new Error("Usage: capture-viewport.mjs <url> <output> <width,height>");
}

const match = /^(\d+),(\d+)$/.exec(size);
if (!match) throw new Error(`Invalid viewport size: ${size}`);
const width = Number(match[1]);
const height = Number(match[2]);
if (width < 240 || width > 3000 || height < 240 || height > 3000) {
  throw new Error(`Viewport outside capture bounds: ${width}x${height}`);
}

const targetUrl = new URL(url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-viewport-"));
let browser = null;

async function waitForDevToolsPort() {
  const file = join(profileDir, "DevToolsActivePort");
  for (let attempt = 0; attempt < 140; attempt += 1) {
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {}
    await sleep(50);
  }
  throw new Error("Chrome DevToolsActivePort was not created.");
}

async function waitForPageTarget(port) {
  for (let attempt = 0; attempt < 140; attempt += 1) {
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

async function waitForRenderableDocument(send) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({
        ready: document.readyState,
        hasBody: Boolean(document.body),
        width: document.documentElement?.clientWidth ?? 0,
        height: document.documentElement?.clientHeight ?? 0,
        href: location.href
      })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (
      value?.hasBody
      && value.ready !== "loading"
      && value.width > 0
      && value.height > 0
      && typeof value.href === "string"
    ) {
      await sleep(650);
      return value.href;
    }
    await sleep(75);
  }
  throw new Error(`Document did not become renderable: ${targetUrl.href}`);
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
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });

  await send("Page.navigate", { url: targetUrl.href });
  const effectiveUrl = await waitForRenderableDocument(send);

  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(screenshot.data, "base64"));
  console.log(
    `viewport-capture-pass requested=${targetUrl.href} effective=${effectiveUrl} size=${width}x${height} output=${output}`,
  );

  socket.close();
} finally {
  if (browser && browser.exitCode === null) {
    browser.kill("SIGTERM");
    for (let attempt = 0; attempt < 50 && browser.exitCode === null; attempt += 1) {
      await sleep(50);
    }
    if (browser.exitCode === null) browser.kill("SIGKILL");
  }
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
