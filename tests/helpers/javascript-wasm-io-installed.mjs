/** @file Verify a handoff and make downstream calls from one offline npm installation. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

import { runInstalledChromium } from "./javascript-wasm-installed-browser.mjs";
import { ledgerDelivery, ledgerFrameworkArchives } from "./javascript-ledger-delivery.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const fromRelease = process.env.LEAN_BRIDGE_JS_IO_RELEASE;
const run = promisify(execFile);

test("install exact npm archives offline and use the same public package in Node and Chromium", {skip: !fromRelease}, async t => {
	const root = await mkdtemp(join(tmpdir(), "js-io-consumer-"));
	const archiveRoot = fromRelease;
	t.after(() => rm(root, {recursive: true, force: true}));
	const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(archiveRoot, "package-set-receipt.json")});
	const pkg = receipt.packages.find(p => p.role === "component"), provider = receipt.packages.find(p => p.role === "runtime");
	assert.equal(pkg.profile, "javascript-wasm-sync-io-v1"); assert.equal(pkg.requires[0].version, provider.version);
	const consumer = join(root, "consumer"); await mkdir(consumer);
	await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}');
	const archives = receipt.packages.map(p => join(archiveRoot, p.artifacts[0].path));
	archives.push(...await ledgerFrameworkArchives(root));
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "cache"), ...archives], {cwd: consumer});
	await copyFile(new URL("./javascript-wasm-io-calls.mjs", import.meta.url), join(consumer, "calls.mjs"));
	const source = `import * as api from ${JSON.stringify(pkg.name)};\nimport {exercise} from "./calls.mjs";\nconsole.log(JSON.stringify(exercise(api)));\n`;
	await writeFile(join(consumer, "consume.mjs"), source);
	const node = JSON.parse((await run(process.execPath, ["consume.mjs"], {cwd: consumer})).stdout);
	assert.equal(node.scalarKinds, 19); assert.ok(node.checks >= 40); assert.equal(node.counter, 3);
	const chromium = await runInstalledChromium({root, consumer
		, names: [pkg.name], argument: pkg.name
		, evaluate: async name => { const {exercise} = await import("/calls.mjs"); return exercise(await import(name)); }});
	assert.deepEqual(chromium, node);
	const delivery = await ledgerDelivery({root, consumer, node, sourceTreeSha256: receipt.source.treeSha256});
	const report = {node, chromium, packageSetSha256: result.receiptSha256, ...delivery};
	if(process.env.LEAN_BRIDGE_JS_IO_CLIENT_EVIDENCE)
		await saveLakeFile(process.env.LEAN_BRIDGE_JS_IO_CLIENT_EVIDENCE, delivery.route + ".json", JSON.stringify(report, null, 2) + "\n");
	t.diagnostic(JSON.stringify(report));
});
