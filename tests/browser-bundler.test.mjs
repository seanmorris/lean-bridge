import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import test from "node:test";

import { chromium } from "playwright";
import json from "@rollup/plugin-json";
import { importMetaAssets } from "@web/rollup-plugin-import-meta-assets";
import { rollup } from "rollup";
import { build as buildVite } from "vite";
import webpack from "webpack";
import packageManifest from "../package.json" with { type: "json" };

const root = resolve(".");
const browserAvailable = existsSync(chromium.executablePath());
if (!browserAvailable && process.env.LEAN_BRIDGE_REQUIRE_BROWSER === "1") {
  throw new Error("Playwright Chromium is missing. Run `npx playwright install chromium`.");
}
const browserTest = browserAvailable ? test : test.skip;
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json"],
  [".wasm", "application/wasm"],
]);

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://fixture.invalid").pathname);
  const path = resolve(root, `.${pathname}`);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "content-type": mime.get(extname(path)) ?? "application/octet-stream",
      "cache-control": "no-store",
      "cross-origin-resource-policy": "same-origin",
    });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolveListening => server.listen(0, "127.0.0.1", resolveListening));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

const expected = {
  value: 42,
  canonical: true,
  copied: {
    enabled: true,
    count: 9,
    label: "browser λ",
    bytes: [0, 127, 255],
    values: [1, 5, 13],
  },
  runtimeInitializations: 1,
};

const outputRoot = resolve("build/browser-bundler-tests");
const consumerEntry = resolve("tests/fixtures/browser-consumer/runner.mjs");
const reactEntry = resolve("tests/fixtures/browser-consumer/react-runner.mjs");
const measurements = new Map();

const browserPath = path => `/${relative(root, path).split(sep).join("/")}`;

const runPage = async path => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on("pageerror", error => {
      browserErrors.push(error.stack ?? error.message);
      page.evaluate(message => {
        globalThis.leanBridgeError = message;
      }, error.stack ?? error.message).catch(() => {});
    });
    page.on("requestfailed", request => {
      browserErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    });
    await page.goto(`${origin}${path}`);
    try {
      await page.waitForFunction(
        () => globalThis.leanBridgeResult !== undefined || globalThis.leanBridgeError !== undefined,
        undefined,
        { timeout: 10_000 },
      );
    } catch (error) {
      throw new Error(`${error.message}\n${browserErrors.join("\n")}`);
    }
    const state = await page.evaluate(() => ({
      result: globalThis.leanBridgeResult,
      error: globalThis.leanBridgeError,
      elapsedMs: globalThis.leanBridgeElapsedMs,
    }));
    assert.equal(state.error, undefined);
    assert.deepEqual(state.result, expected);
    return state.elapsedMs;
  } finally {
    await browser.close();
  }
};

const runModule = async path => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on("pageerror", error => browserErrors.push(error.stack ?? error.message));
    page.on("requestfailed", request => {
      browserErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    });
    await page.goto(`${origin}/tests/fixtures/browser-consumer/index.html`);
    const observation = await page.evaluate(async url => {
      const started = performance.now();
      await import(url);
      const result = await globalThis.leanBridgeResultPromise;
      return { result, elapsedMs: performance.now() - started };
    }, `${origin}${browserPath(path)}`);
    assert.deepEqual(observation.result, expected, browserErrors.join("\n"));
    return observation.elapsedMs;
  } finally {
    await browser.close();
  }
};

const runWebpack = config => new Promise((resolveRun, reject) => {
  const compiler = webpack(config);
  compiler.run((error, stats) => {
    compiler.close(closeError => {
      if (error || closeError) {
        reject(error ?? closeError);
        return;
      }
      if (stats.hasErrors()) {
        reject(new Error(stats.toString({ all: false, errors: true, errorDetails: true })));
        return;
      }
      resolveRun();
    });
  });
});

browserTest("raw browser ESM loads one shared runtime and native API", async () => {
  measurements.set("raw-esm", await runPage("/tests/fixtures/browser-consumer/index.html"));
});

browserTest("a module worker uses the same ordinary native API", async () => {
  measurements.set("module-worker", await runPage("/tests/fixtures/browser-consumer/worker.html"));
});

test("the browser acceptance environment uses exact tool versions", () => {
  assert.deepEqual(packageManifest.devDependencies, {
    "@rollup/plugin-json": "6.1.0",
    "@web/rollup-plugin-import-meta-assets": "3.0.0",
    playwright: "1.62.1",
    react: "19.2.8",
    "react-dom": "19.2.8",
    rollup: "4.62.4",
    vite: "8.2.1",
    webpack: "5.109.2",
  });
});

browserTest("Vite preserves the Wasm runtime and side-module URLs", async () => {
  const outDir = resolve(outputRoot, "vite");
  await buildVite({
    configFile: false,
    logLevel: "silent",
    base: "./",
    build: {
      outDir,
      emptyOutDir: true,
      assetsInlineLimit: 0,
      rollupOptions: {
        input: consumerEntry,
        output: { entryFileNames: "consumer.js" },
      },
    },
  });
  measurements.set("vite", await runModule(resolve(outDir, "consumer.js")));
});

browserTest("Rollup preserves an ordinary ESM consumer", async () => {
  const outDir = resolve(outputRoot, "rollup");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const bundle = await rollup({
    input: consumerEntry,
    plugins: [json(), importMetaAssets()],
  });
  try {
    await bundle.write({ dir: outDir, format: "es", entryFileNames: "consumer.js" });
  } finally {
    await bundle.close();
  }
  measurements.set("rollup", await runModule(resolve(outDir, "consumer.js")));
});

browserTest("Webpack preserves the Wasm runtime and side-module URLs", async () => {
  const outDir = resolve(outputRoot, "webpack");
  await rm(outDir, { recursive: true, force: true });
  await runWebpack({
    mode: "production",
    entry: consumerEntry,
    experiments: { outputModule: true },
    output: {
      path: outDir,
      filename: "consumer.js",
      module: true,
      clean: true,
    },
  });
  measurements.set("webpack", await runModule(resolve(outDir, "consumer.js")));
});

browserTest("React Strict Mode effects share one lazy Lean runtime", async () => {
  const outDir = resolve(outputRoot, "react");
  await buildVite({
    configFile: false,
    logLevel: "silent",
    base: "./",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      assetsInlineLimit: 0,
      rollupOptions: {
        input: reactEntry,
        output: { entryFileNames: "consumer.js" },
      },
    },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/tests/fixtures/browser-consumer/index.html`);
    const observation = await page.evaluate(async url => {
      const started = performance.now();
      await import(url);
      const result = await globalThis.leanBridgeResultPromise;
      return { result, elapsedMs: performance.now() - started };
    }, `${origin}${browserPath(resolve(outDir, "consumer.js"))}`);
    assert.deepEqual(observation.result, { ...expected, strictModeEffects: 2 });
    measurements.set("react-strict-mode", observation.elapsedMs);
  } finally {
    await browser.close();
  }
});

test.after(async () => {
  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, "report.json"), `${JSON.stringify({
    schemaVersion: 1,
    browser: `playwright-chromium-${packageManifest.devDependencies.playwright}`,
    measurements: Object.fromEntries(
      [...measurements].map(([name, elapsedMs]) => [name, { importToFirstCallMs: elapsedMs }]),
    ),
  }, null, 2)}\n`);
  await new Promise((resolveClose, reject) =>
    server.close(error => error ? reject(error) : resolveClose()),
  );
});
