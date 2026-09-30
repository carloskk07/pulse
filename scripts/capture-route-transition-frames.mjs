import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.ROUTE_TRANSITION_CAPTURE_BASE_URL ?? "http://127.0.0.1:3100";
const outputRoot = process.argv[2] ?? "visual-smoke/local-preview/route-transition";
const phase = 0.5;

if (!chrome) throw new Error("CHROME_BIN is required for route-transition frame capture.");

const cases = [
  {
    profile: "desktop",
    width: 1440,
    height: 900,
    mobile: false,
    from: "/progress",
    to: "/wallet",
    slug: "signal-to-value",
    outgoing: ["pcTransferSignalValueOut", "::view-transition-old(pc-field-signal)"],
    incoming: ["pcTransferSignalValueIn", "::view-transition-group(pc-field-value)"],
  },
  {
    profile: "desktop",
    width: 1440,
    height: 900,
    mobile: false,
    from: "/wallet",
    to: "/invite",
    slug: "value-to-network",
    outgoing: ["pcTransferValueNetworkOut", "::view-transition-old(pc-field-value)"],
    incoming: ["pcTransferValueNetworkIn", "::view-transition-group(pc-field-network)"],
  },
  {
    profile: "desktop",
    width: 1440,
    height: 900,
    mobile: false,
    from: "/invite",
    to: "/wallet",
    slug: "network-to-value",
    outgoing: ["pcTransferNetworkValueOut", "::view-transition-old(pc-field-network)"],
    incoming: ["pcTransferNetworkValueIn", "::view-transition-group(pc-field-value)"],
  },
  {
    profile: "desktop",
    width: 1440,
    height: 900,
    mobile: false,
    from: "/wallet",
    to: "/progress",
    slug: "value-to-signal",
    outgoing: ["pcTransferValueSignalOut", "::view-transition-old(pc-field-value)"],
    incoming: ["pcTransferValueSignalIn", "::view-transition-group(pc-field-signal)"],
  },
  {
    profile: "desktop",
    width: 1440,
    height: 900,
    mobile: false,
    from: "/progress",
    to: "/invite",
    slug: "signal-to-network",
    outgoing: ["pcTransferSignalNetworkOut", "::view-transition-old(pc-field-signal)"],
    incoming: ["pcTransferSignalNetworkIn", "::view-transition-group(pc-field-network)"],
  },
  {
    profile: "desktop",
    width: 1440,
    height: 900,
    mobile: false,
    from: "/invite",
    to: "/progress",
    slug: "network-to-signal",
    outgoing: ["pcTransferNetworkSignalOut", "::view-transition-old(pc-field-network)"],
    incoming: ["pcTransferNetworkSignalIn", "::view-transition-group(pc-field-signal)"],
  },
  {
    profile: "mobile",
    width: 390,
    height: 844,
    mobile: true,
    from: "/progress",
    to: "/invite",
    slug: "signal-to-network",
    outgoing: ["pcTransferSignalNetworkOut", "::view-transition-old(pc-field-signal)"],
    incoming: ["pcTransferSignalNetworkIn", "::view-transition-group(pc-field-network)"],
  },
  {
    profile: "mobile",
    width: 390,
    height: 844,
    mobile: true,
    from: "/invite",
    to: "/progress",
    slug: "network-to-signal",
    outgoing: ["pcTransferNetworkSignalOut", "::view-transition-old(pc-field-network)"],
    incoming: ["pcTransferNetworkSignalIn", "::view-transition-group(pc-field-signal)"],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-route-frame-"));
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

async function waitForPath(send, path) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({
        path: location.pathname,
        ready: document.readyState,
        frame: Boolean(document.querySelector(".app-frame"))
      })`,
      returnByValue: true,
    });
    const state = result.result?.value;
    if (state?.path === path && state?.ready === "complete" && state?.frame) {
      await sleep(120);
      return;
    }
    await sleep(50);
  }
  throw new Error(`Route ${path} did not settle before transition capture.`);
}

async function waitForHydratedLink(send, href) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `(() => {
        const link = document.querySelector('.app-topbar-nav a[href="${href}"]')
          ?? document.querySelector('.bottom-nav a[href="${href}"]');
        if (!link) return { exists: false, hydrated: false };
        const keys = Object.keys(link);
        return {
          exists: true,
          hydrated: keys.some((key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$")),
        };
      })()`,
      returnByValue: true,
    });
    const state = result.result?.value;
    if (state?.exists && state?.hydrated) return;
    await sleep(50);
  }
  throw new Error(`Route link ${href} did not hydrate before transition capture.`);
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

async function freezeSemanticTransition(send, item) {
  let last = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `(() => {
        const expected = ${JSON.stringify({
          outgoing: null,
          incoming: null,
          phase: null,
        })};
        expected.outgoing = ${JSON.stringify(item.outgoing)};
        expected.incoming = ${JSON.stringify(item.incoming)};
        expected.phase = ${phase};

        const animations = document.getAnimations();
        const evidence = animations.map((animation) => ({
          name: typeof animation.animationName === "string" ? animation.animationName : "",
          pseudo: animation.effect && typeof animation.effect.pseudoElement === "string"
            ? animation.effect.pseudoElement
            : "",
          playState: animation.playState,
        }));
        const hasOutgoing = evidence.some((entry) => entry.name === expected.outgoing[0] && entry.pseudo === expected.outgoing[1]);
        const hasIncoming = evidence.some((entry) => entry.name === expected.incoming[0] && entry.pseudo === expected.incoming[1]);

        if (!hasOutgoing || !hasIncoming) {
          return { ready: false, path: location.pathname, evidence };
        }

        const viewAnimations = animations.filter((animation) => {
          const pseudo = animation.effect && typeof animation.effect.pseudoElement === "string"
            ? animation.effect.pseudoElement
            : "";
          return pseudo.startsWith("::view-transition");
        });

        const frozen = [];
        for (const animation of viewAnimations) {
          const pseudo = animation.effect && typeof animation.effect.pseudoElement === "string"
            ? animation.effect.pseudoElement
            : "";
          const timing = animation.effect?.getTiming?.() ?? {};
          const computed = animation.effect?.getComputedTiming?.() ?? {};
          const duration = typeof computed.duration === "number" && Number.isFinite(computed.duration)
            ? computed.duration
            : typeof timing.duration === "number" && Number.isFinite(timing.duration)
              ? timing.duration
              : 0;
          const delay = typeof timing.delay === "number" && Number.isFinite(timing.delay) ? timing.delay : 0;
          try {
            animation.pause();
            if (duration > 0) animation.currentTime = Math.max(0, delay) + duration * expected.phase;
          } catch {}
          frozen.push({
            name: typeof animation.animationName === "string" ? animation.animationName : "",
            pseudo,
            duration,
            delay,
            currentTime: typeof animation.currentTime === "number" ? animation.currentTime : null,
          });
        }

        return {
          ready: true,
          path: location.pathname,
          evidence,
          frozen,
        };
      })()`,
      returnByValue: true,
    });
    const state = result.result?.value;
    last = state;
    if (state?.ready && state?.path === item.to) {
      await send("Runtime.evaluate", {
        expression: "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        awaitPromise: true,
        returnByValue: true,
      });
      return state;
    }
    await sleep(10);
  }
  throw new Error(
    `Transition frame did not reach deterministic capture state for ${item.profile} ${item.slug}: ${JSON.stringify(last)}`,
  );
}

async function capture(send, item) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: item.width,
    height: item.height,
    deviceScaleFactor: 1,
    mobile: item.mobile,
    screenWidth: item.width,
    screenHeight: item.height,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

  await send("Page.navigate", { url: `${baseUrl}${item.from}` });
  await waitForPath(send, item.from);
  await waitForHydratedLink(send, item.to);
  await clickRoute(send, item.to);

  const frozen = await freezeSemanticTransition(send, item);
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: item.width, height: item.height, scale: 1 },
  });

  const output = join(outputRoot, item.profile, `${item.slug}-mid.png`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(screenshot.data, "base64"));

  console.log(
    `route-transition-frame-pass profile=${item.profile} transition=${item.slug} phase=${phase} output=${output} evidence=${JSON.stringify(frozen.evidence.filter((entry) => entry.name.startsWith("pcTransfer")))}`,
  );
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

  for (const item of cases) {
    await capture(send, item);
  }

  console.log(`Route transition frame evidence PASS: ${cases.length} deterministic mid-transition screenshots.`);
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
