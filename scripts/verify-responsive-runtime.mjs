import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = process.env.CHROME_BIN;
const baseUrl = process.env.RESPONSIVE_BASE_URL ?? "http://127.0.0.1:3100";

if (!chrome) {
  throw new Error("CHROME_BIN is required for responsive runtime verification.");
}

const routes = [
  ["dashboard", "/dashboard"],
  ["momentum", "/progress"],
  ["turbo", "/earn"],
  ["vault", "/wallet"],
  ["share", "/invite"],
];

const viewports = [
  ["phone-320", 320, 568],
  ["phone-360", 360, 800],
  ["mobile", 390, 844],
  ["phone-430", 430, 932],
  ["bp-560", 560, 900],
  ["bp-561", 561, 900],
  ["bp-760", 760, 1024],
  ["bp-761", 761, 1024],
  ["tablet-768", 768, 1024],
  ["bp-820", 820, 1024],
  ["bp-821", 821, 1024],
  ["bp-980", 980, 900],
  ["bp-981", 981, 900],
  ["tablet-1024", 1024, 768],
  ["bp-1100", 1100, 800],
  ["bp-1101", 1101, 800],
  ["bp-1120", 1120, 800],
  ["bp-1121", 1121, 800],
  ["bp-1180", 1180, 800],
  ["bp-1181", 1181, 800],
  ["desktop-1366", 1366, 768],
  ["bp-1400", 1400, 900],
  ["bp-1401", 1401, 900],
  ["desktop", 1440, 900],
  ["wide-1920", 1920, 1080],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = await mkdtemp(join(tmpdir(), "pulsercuit-responsive-"));
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
      expression: `({ ready: document.readyState, path: location.pathname })`,
      returnByValue: true,
    });
    const value = result.result?.value;
    if (value?.ready === "complete" && value.path === expectedPath) {
      await sleep(250);
      return;
    }
    await sleep(50);
  }
  throw new Error(`Document did not settle on ${expectedPath}.`);
}

const runtimeProbe = `(() => {
  const root = document.documentElement;
  const body = document.body;
  const topbar = document.querySelector(".app-topbar");
  const bottomNav = document.querySelector(".bottom-nav");
  const appContent = document.querySelector(".app-content");

  const inspect = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: style.display,
      visibility: style.visibility,
      position: style.position,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    };
  };

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
    htmlOverflowX: getComputedStyle(root).overflowX,
    bodyOverflowX: body ? getComputedStyle(body).overflowX : null,
    topbar: inspect(topbar),
    bottomNav: inspect(bottomNav),
    appContent: inspect(appContent),
  };
})()`;

function hasMeasurableGeometry(state, width) {
  if (!state?.appContent || state.appContent.width <= 0) return false;
  const compactShell = width <= 1120;
  const nav = compactShell ? state.bottomNav : state.topbar;
  return Boolean(nav && nav.display !== "none" && nav.width > 0);
}

function geometryIsStable(previous, current, width) {
  if (!hasMeasurableGeometry(previous, width) || !hasMeasurableGeometry(current, width)) return false;
  const compactShell = width <= 1120;
  const previousNav = compactShell ? previous.bottomNav : previous.topbar;
  const currentNav = compactShell ? current.bottomNav : current.topbar;
  return (
    previous.clientWidth === current.clientWidth
    && Math.abs(previous.appContent.width - current.appContent.width) <= 1
    && Math.abs(previousNav.width - currentNav.width) <= 1
  );
}

async function waitForStableGeometry(send, width, label) {
  let previous = null;
  let stableSamples = 0;
  let lastState = null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const evaluated = await send("Runtime.evaluate", {
      expression: runtimeProbe,
      returnByValue: true,
    });
    const state = evaluated.result?.value;
    lastState = state ?? lastState;

    if (geometryIsStable(previous, state, width)) {
      stableSamples += 1;
      if (stableSamples >= 2) return state;
    } else {
      stableSamples = hasMeasurableGeometry(state, width) ? 1 : 0;
    }

    previous = state;
    await sleep(50);
  }

  throw new Error(`Responsive geometry did not stabilize for ${label}: ${JSON.stringify(lastState)}`);
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

  for (const [profile, width, height] of viewports) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });

    for (const [routeName, route] of routes) {
      await send("Page.navigate", { url: `${baseUrl}${route}` });
      await waitForDocument(send, route);

      const state = await waitForStableGeometry(send, width, `${profile} ${routeName}`);

      if (!state) {
        failures.push(`${profile} ${routeName}: runtime probe returned no value`);
        continue;
      }

      const tolerance = 1;
      const rawOverflow = state.scrollWidth - state.clientWidth;
      if (state.maxScrollX > tolerance) {
        failures.push(
          `${profile} ${routeName}: horizontal scrolling is possible maxScrollX=${state.maxScrollX}, rawOverflow=${rawOverflow}`,
        );
      }

      if (
        state.appContent
        && (
          state.appContent.left < -tolerance
          || state.appContent.right > state.innerWidth + tolerance
        )
      ) {
        failures.push(
          `${profile} ${routeName}: app content escapes viewport [${state.appContent.left}, ${state.appContent.right}] vs ${state.innerWidth}`,
        );
      }

      const compactShell = width <= 1120;
      if (compactShell) {
        if (state.topbar && state.topbar.display !== "none" && state.topbar.width > 0) {
          failures.push(`${profile} ${routeName}: topbar must be hidden at ${width}px`);
        }
        if (!state.bottomNav || state.bottomNav.display === "none" || state.bottomNav.width <= 0) {
          failures.push(`${profile} ${routeName}: bottom nav must be visible at ${width}px`);
        } else if (
          state.bottomNav.left < -tolerance
          || state.bottomNav.right > state.innerWidth + tolerance
        ) {
          failures.push(
            `${profile} ${routeName}: bottom nav escapes viewport [${state.bottomNav.left}, ${state.bottomNav.right}] vs ${state.innerWidth}`,
          );
        }
      } else {
        if (!state.topbar || state.topbar.display === "none" || state.topbar.width <= 0) {
          failures.push(`${profile} ${routeName}: topbar must be visible at ${width}px`);
        } else if (
          state.topbar.left < -tolerance
          || state.topbar.right > state.innerWidth + tolerance
        ) {
          failures.push(
            `${profile} ${routeName}: topbar escapes viewport [${state.topbar.left}, ${state.topbar.right}] vs ${state.innerWidth}`,
          );
        }
        if (state.bottomNav && state.bottomNav.display !== "none" && state.bottomNav.width > 0) {
          failures.push(`${profile} ${routeName}: bottom nav must be hidden at ${width}px`);
        }
      }

      if (!state.appContent || state.appContent.width <= 0) {
        failures.push(`${profile} ${routeName}: app content has no measurable width`);
      }

      console.log(
        `RESPONSIVE_PROBE profile=${profile} route=${routeName} width=${width} rawScroll=${state.scrollWidth}/${state.clientWidth} maxScrollX=${state.maxScrollX} overflow=${state.htmlOverflowX}/${state.bodyOverflowX} topbar=${state.topbar?.display ?? "missing"} bottom=${state.bottomNav?.display ?? "missing"}`,
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
    console.warn(`Responsive probe cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error("Responsive runtime contract FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Responsive runtime contract PASS: ${routes.length * viewports.length} route/viewport probes`);
