import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.DENSE_STATE_BASE_URL ?? "http://127.0.0.1:3100";

if (!chrome) {
  throw new Error("CHROME_BIN is required for dense-state runtime verification.");
}

const scenes = [
  ["reward", "/visual-smoke-fixture/core-state?scene=reward", "balance-funded"],
  ["earn", "/visual-smoke-fixture/core-state?scene=earn", "balance-funded"],
  ["wallet", "/visual-smoke-fixture/core-state?scene=wallet", "balance-funded"],
  ["progress", "/visual-smoke-fixture/core-state?scene=progress", "rank-circuit"],
  ["invite", "/visual-smoke-fixture/core-state?scene=invite", "network-active"],
];

const viewports = [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-dense-state-"));
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
      expression: `({ ready: document.readyState, path: location.pathname })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.ready === "complete" && value.path === "/visual-smoke-fixture/core-state") {
      await sleep(250);
      return;
    }
    await sleep(50);
  }
  throw new Error("Dense visual fixture did not settle.");
}

const runtimeProbe = `(() => {
  const root = document.documentElement;
  const body = document.body;
  const frame = document.querySelector(".app-frame");
  const appContent = document.querySelector(".app-content");
  const topbar = document.querySelector(".app-topbar");
  const bottomNav = document.querySelector(".bottom-nav");
  const telemetry = document.querySelector(".pc-scene-telemetry");
  const scene = document.querySelector("[data-dense-scene]");
  const headline = document.querySelector(".app-page-head h1");
  const telemetryItems = [...document.querySelectorAll(".pc-scene-telemetry-item")];
  const telemetryValues = [...document.querySelectorAll(".pc-scene-telemetry-item strong")];
  const valueFlowLabels = [...document.querySelectorAll(".pc-value-flow-copy strong")];

  const inspect = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: style.display,
      visibility: style.visibility,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  };

  const originalX = scrollX;
  window.scrollTo(100000, scrollY);
  const maxScrollX = scrollX;
  window.scrollTo(originalX, scrollY);

  return {
    sceneName: scene?.getAttribute("data-dense-scene") ?? null,
    productResidue: frame?.getAttribute("data-product-residue") ?? null,
    innerWidth,
    clientWidth: root.clientWidth,
    scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth ?? 0),
    maxScrollX,
    appContent: inspect(appContent),
    topbar: inspect(topbar),
    bottomNav: inspect(bottomNav),
    telemetry: inspect(telemetry),
    headline: inspect(headline),
    telemetryItemCount: telemetryItems.length,
    telemetryValueOverflow: telemetryValues.map((value) => ({
      text: value.textContent?.trim() ?? "",
      scrollWidth: value.scrollWidth,
      clientWidth: value.clientWidth,
    })),
    valueFlowOverflow: valueFlowLabels.map((value) => {
      const visibleLabel = [...value.children].find((child) => getComputedStyle(child).display !== "none");
      const target = visibleLabel ?? value;
      return {
        text: target.textContent?.trim() ?? "",
        display: getComputedStyle(target).display,
        scrollWidth: target.scrollWidth,
        clientWidth: target.clientWidth,
      };
    }),
  };
})()`;

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

  for (const [profile, width, height] of viewports) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });

    for (const [sceneName, route, expectedResidue] of scenes) {
      await send("Page.navigate", { url: `${baseUrl}${route}` });
      await waitForDocument(send);

      const evaluated = await send("Runtime.evaluate", {
        expression: runtimeProbe,
        returnByValue: true,
      });
      const state = evaluated.result?.value;
      const label = `${profile} ${sceneName}`;

      if (!state) {
        failures.push(`${label}: runtime probe returned no value`);
        continue;
      }

      const tolerance = 1;
      const rawOverflow = state.scrollWidth - state.clientWidth;
      if (state.sceneName !== sceneName) {
        failures.push(`${label}: expected scene ${sceneName}, rendered ${state.sceneName ?? "missing"}`);
      }
      if (state.productResidue !== expectedResidue) {
        failures.push(`${label}: expected residue ${expectedResidue}, rendered ${state.productResidue ?? "missing"}`);
      }
      if (state.maxScrollX > tolerance) {
        failures.push(`${label}: horizontal scrolling possible maxScrollX=${state.maxScrollX}, rawOverflow=${rawOverflow}`);
      }
      if (
        !state.appContent
        || state.appContent.width <= 0
        || state.appContent.left < -tolerance
        || state.appContent.right > state.innerWidth + tolerance
      ) {
        failures.push(`${label}: app content escapes or is not measurable`);
      }
      if (
        !state.telemetry
        || state.telemetry.display === "none"
        || state.telemetry.width <= 0
        || state.telemetry.left < -tolerance
        || state.telemetry.right > state.innerWidth + tolerance
      ) {
        failures.push(`${label}: dense telemetry is missing or escapes viewport`);
      }
      if (!state.headline || state.headline.width <= 0) {
        failures.push(`${label}: first-fold headline is not measurable`);
      }
      if (state.telemetryItemCount !== 3) {
        failures.push(`${label}: expected 3 telemetry readouts, found ${state.telemetryItemCount}`);
      }

      for (const value of state.telemetryValueOverflow ?? []) {
        if (value.scrollWidth > value.clientWidth + tolerance) {
          failures.push(
            `${label}: telemetry value "${value.text}" clips ${value.scrollWidth}/${value.clientWidth}`,
          );
        }
      }

      for (const value of state.valueFlowOverflow ?? []) {
        if (value.display !== "none" && value.scrollWidth > value.clientWidth + tolerance) {
          failures.push(
            `${label}: value-flow label "${value.text}" clips ${value.scrollWidth}/${value.clientWidth}`,
          );
        }
      }

      if (width <= 1120) {
        if (state.topbar && state.topbar.display !== "none" && state.topbar.width > 0) {
          failures.push(`${label}: topbar must be hidden at ${width}px`);
        }
        if (!state.bottomNav || state.bottomNav.display === "none" || state.bottomNav.width <= 0) {
          failures.push(`${label}: bottom nav must be visible at ${width}px`);
        }
      } else {
        if (!state.topbar || state.topbar.display === "none" || state.topbar.width <= 0) {
          failures.push(`${label}: topbar must be visible at ${width}px`);
        }
        if (state.bottomNav && state.bottomNav.display !== "none" && state.bottomNav.width > 0) {
          failures.push(`${label}: bottom nav must be hidden at ${width}px`);
        }
      }

      console.log(
        `DENSE_STATE_PROBE profile=${profile} scene=${sceneName} residue=${state.productResidue ?? "missing"} width=${width} rawScroll=${state.scrollWidth}/${state.clientWidth} maxScrollX=${state.maxScrollX} telemetry=${state.telemetry?.width ?? 0} values=${state.telemetryItemCount}`,
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

  try {
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    console.warn(`Dense-state probe cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error("Dense signed-in runtime contract FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dense signed-in runtime contract PASS: ${scenes.length * viewports.length} scene/viewport probes`);
