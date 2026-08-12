#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright";
import { build } from "vite";

const execute = promisify(execFile);
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
if (!options.get("--package")) throw new Error("Usage: test-browser-package-consumer.mjs --package PATH");
const packageRoot = resolve(options.get("--package"));
const archives = (await readdir(packageRoot)).filter(path => path.endsWith(".tgz"));
if (archives.length !== 1) throw new Error(`expected one npm archive in ${packageRoot}`);

const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-browser-package-"));
await execute("npm", ["init", "--yes"], { cwd: scratch });
await execute("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(packageRoot, archives[0])], { cwd: scratch });
const manifest = JSON.parse(await readFile(join(scratch, "node_modules/@lean-bridge/alpha/package.json"), "utf8"));
if (manifest.exports?.["."]?.browser !== "./index.mjs") throw new Error("installed package has no browser conditional export");

await writeFile(join(scratch, "index.html"), '<main id="result">pending</main><script type="module" src="/consumer.mjs"></script>\n');
await writeFile(join(scratch, "consumer.mjs"), `import { Box, makeAdder, roundTrip, withCallback } from "@lean-bridge/alpha";
const box = new Box(42);
const value = box.read();
const identity = box.identity() === box;
box.dispose();
const payload = roundTrip({ enabled: true, count: 41, label: "browser", bytes: new Uint8Array([0, 255]), values: [0, 0xffffffff] });
const callback = withCallback(40, current => current + 2);
const addTwo = makeAdder(2);
const closure = addTwo(40);
addTwo.dispose();
document.querySelector("#result").textContent = JSON.stringify({ value, identity, count: payload.count, callback, closure });
`);
const dist = join(scratch, "dist");
await build({ root: scratch, logLevel: "silent", build: { outDir: dist } });

const media = new Map([[".html", "text/html"], [".js", "text/javascript"], [".wasm", "application/wasm"]]);
const server = createServer(async (request, response) => {
  try {
    const requested = new URL(request.url, "http://localhost").pathname;
    let path = join(dist, requested === "/" ? "index.html" : requested.slice(1));
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
    response.setHeader("Content-Type", media.get(extname(path)) ?? "application/octet-stream");
    response.end(await readFile(path));
  } catch {
    response.statusCode = 404;
    response.end("not found");
  }
});
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const browserLog = [];
  page.on("console", message => browserLog.push(`console:${message.type()}: ${message.text()}`));
  page.on("pageerror", error => browserLog.push(`pageerror: ${error.message}`));
  page.on("requestfailed", request => browserLog.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`));
  await page.goto(`http://127.0.0.1:${address.port}/`);
  try {
    await page.waitForFunction(() => document.querySelector("#result")?.textContent !== "pending");
  } catch (error) {
    throw new Error(`browser consumer did not complete: ${browserLog.join(" | ") || "no browser diagnostics"}`, { cause: error });
  }
  const result = JSON.parse(await page.textContent("#result"));
  if (JSON.stringify(result) !== JSON.stringify({ value: 42, identity: true, count: 42, callback: 44, closure: 42 })) {
    throw new Error(`unexpected browser result: ${JSON.stringify(result)}`);
  }
  process.stdout.write(`${JSON.stringify({ result: "passed", packageInstallation: true, realLeanExecution: true, browserCondition: true, value: 42 }, null, 2)}\n`);
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
