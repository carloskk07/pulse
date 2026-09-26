import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.PUBLIC_READABILITY_BASE_URL ?? "http://127.0.0.1:3100";

if (!chrome) {
  throw new Error("CHROME_BIN is required for public mobile readability verification.");
}

const viewport = { width: 390, height: 844 };
const routes = [
  {
    name: "home",
    path: "/",
    checks: [
      [".pc-home-trust-row span", 11, true, "entry trust"],
      [".pc-home-core-status>small", 11, true, "reward status explanation"],
      [".pc-home-value-strip span", 11, true, "reward summary explanation"],
      [".pc-home-loop-grid p", 12, true, "how-it-works explanation"],
      [".pc-home-return-board small", 11, true, "earning-path explanation"],
      [".pc-home-proof-points span", 11, true, "proof explanation"],
    ],
  },
  {
    name: "faucet",
    path: "/faucet",
    checks: [
      [".pc-faucet-trust span", 11, true, "faucet trust"],
      [".pc-faucet-live-foot span", 11, true, "availability explanation"],
      [".pc-faucet-bands-head p", 12, false, "reward-band explanation"],
      [".pc-faucet-band-grid span", 10, false, "reward probability"],
      [".pc-faucet-path p", 12, true, "faucet journey explanation"],
      [".pc-faucet-difference-grid p", 12, true, "product difference explanation"],
      [".pc-faucet-launch-note p", 12, false, "launch availability explanation"],
      [".pc-faucet-final p", 12, true, "final conversion explanation"],
    ],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-public-readability-"));
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

async function waitForDocument(send, expectedPath) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await send("Runtime.evaluate", {
      expression: `({ ready: document.readyState, path: location.pathname, width: document.documentElement.clientWidth })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.ready === "complete" && value.path === expectedPath && value.width > 0) {
      await sleep(250);
      return;
    }
    await sleep(50);
  }
  throw new Error(`Public readability route did not settle on ${expectedPath}.`);
}

const failures = [];

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
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });

  for (const route of routes) {
    await send("Page.navigate", { url: `${baseUrl}${route.path}` });
    await waitForDocument(send, route.path);

    const expression = `(() => {
      const checks = ${JSON.stringify(route.checks)};
      const root = document.documentElement;
      const body = document.body;
      const originalX = scrollX;
      window.scrollTo(100000, scrollY);
      const maxScrollX = scrollX;
      window.scrollTo(originalX, scrollY);

      return {
        path: location.pathname,
        innerWidth,
        clientWidth: root.clientWidth,
        scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth ?? 0),
        maxScrollX,
        checks: checks.map(([selector, minPx, required, label]) => {
          const nodes = [...document.querySelectorAll(selector)];
          return {
            selector,
            minPx,
            required,
            label,
            count: nodes.length,
            samples: nodes.map((node) => {
              const style = getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              return {
                text: node.textContent?.trim() ?? "",
                fontPx: Number.parseFloat(style.fontSize),
                display: style.display,
                visibility: style.visibility,
                width: rect.width,
                height: rect.height,
              };
            }),
          };
        }),
      };
    })()`;

    const evaluated = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    const state = evaluated.result?.value;

    if (!state) {
      failures.push(`${route.name}: runtime probe returned no value`);
      continue;
    }
    if (state.maxScrollX > 1) {
      failures.push(
        `${route.name}: mobile page permits horizontal scrolling maxScrollX=${state.maxScrollX}, raw=${state.scrollWidth}/${state.clientWidth}`,
      );
    }

    for (const check of state.checks ?? []) {
      if (check.required && check.count === 0) {
        failures.push(`${route.name}: required readability surface is missing: ${check.label} (${check.selector})`);
        continue;
      }
      if (!check.count) {
        console.log(`PUBLIC_READABILITY_SKIP route=${route.name} label=${check.label} selector=${check.selector}`);
        continue;
      }

      for (const sample of check.samples) {
        if (sample.display === "none" || sample.visibility === "hidden" || sample.width <= 0 || sample.height <= 0) {
          failures.push(`${route.name}: ${check.label} is not visibly measurable: "${sample.text}"`);
          continue;
        }
        if (!Number.isFinite(sample.fontPx) || sample.fontPx + 0.01 < check.minPx) {
          failures.push(
            `${route.name}: ${check.label} is ${sample.fontPx}px, below ${check.minPx}px: "${sample.text}"`,
          );
        }
      }

      const minimum = Math.min(...check.samples.map((sample) => sample.fontPx));
      console.log(
        `PUBLIC_READABILITY_PROBE route=${route.name} label=${check.label} selector=${check.selector} count=${check.count} minFont=${minimum}px required=${check.required}`,
      );
    }

    console.log(
      `PUBLIC_READABILITY_ROUTE route=${route.name} width=${state.innerWidth} rawScroll=${state.scrollWidth}/${state.clientWidth} maxScrollX=${state.maxScrollX}`,
    );
  }

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
    console.warn(`Public readability probe cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error("Public mobile readability contract FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public mobile readability contract PASS: ${routes.length} routes at ${viewport.width}x${viewport.height}`);
