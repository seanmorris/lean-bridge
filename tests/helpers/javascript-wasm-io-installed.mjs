/** @file Verify a handoff and make downstream calls from one offline npm installation. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

import { runInstalledChromium } from "./javascript-wasm-installed-browser.mjs";

const fromRelease = process.env.LEAN_BRIDGE_JS_IO_RELEASE;
const run = promisify(execFile);

test("install exact npm archives offline and use the same public package in Node and Chromium", {skip: !fromRelease}, async t => {
	const root = await mkdtemp(join(tmpdir(), "js-io-consumer-"));
	const archiveRoot = fromRelease;
	t.after(() => rm(root, {recursive: true, force: true}));
	const {receipt} = await readVerifiedPackageSetReceipt({receiptPath: join(archiveRoot, "package-set-receipt.json")});
	const pkg = receipt.packages.find(p => p.role === "component"), provider = receipt.packages.find(p => p.role === "runtime");
	assert.equal(pkg.profile, "javascript-wasm-sync-io-v1"); assert.equal(pkg.requires[0].version, provider.version);
	const consumer = join(root, "consumer"); await mkdir(consumer);
	await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}');
	const archives = receipt.packages.map(p => join(archiveRoot, p.artifacts[0].path));
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "cache"), ...archives], {cwd: consumer});
	await copyFile(new URL("./javascript-wasm-io-calls.mjs", import.meta.url), join(consumer, "calls.mjs"));
	const source = `import * as api from ${JSON.stringify(pkg.name)};\nimport {exercise} from "./calls.mjs";\nconsole.log(JSON.stringify(exercise(api)));\n`;
	await writeFile(join(consumer, "consume.mjs"), source);
	const node = JSON.parse((await run(process.execPath, ["consume.mjs"], {cwd: consumer})).stdout);
	assert.equal(node.scalarKinds, 19); assert.ok(node.checks >= 40); assert.equal(node.counter, 3);
	const types = `import { add, nested, choose, EIO_RubyIO_nested } from ${JSON.stringify(pkg.name)};
const counter: number = add(2);
const decision = choose(false, true, "x");
const either: string | number = "ok" in decision ? decision.ok : decision.error;
try { nested(true, 2, 123n, "x", new Uint8Array()); }
catch (e) {
  if (!(e instanceof EIO_RubyIO_nested)) throw e;
  const payload = e.payload;
  const leaf: string | bigint | Uint8Array = "ok" in payload ? payload.ok :
    "ok" in payload.error ? payload.error.ok : payload.error.error;
}
// @ts-expect-error -- USize is a wasm32 number, not a bigint.
add(2n);
// @ts-expect-error -- synchronous IO does not promise its answer.
const pending: Promise<number> = add(1);
`;
	await writeFile(join(consumer, "consume.mts"), types);
	await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({compilerOptions: {target: "es2022", module: "nodenext", types: [], strict: true, noEmit: true}, files: ["consume.mts"]}));
	const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
	await run(process.execPath, [tsc, "-p", "tsconfig.json"], {cwd: consumer});
	const chromium = await runInstalledChromium({root, consumer
		, names: [pkg.name], argument: pkg.name
		, evaluate: async name => { const {exercise} = await import("/calls.mjs"); return exercise(await import(name)); }});
	assert.deepEqual(chromium, node);
	t.diagnostic(JSON.stringify({node, chromium, archives: receipt.packages.map(p => p.artifacts[0]), root}));
});
