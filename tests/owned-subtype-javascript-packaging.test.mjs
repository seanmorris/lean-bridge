/**
 * Installed npm acceptance for proof-erased checked fields inside owned values.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-component.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";
import { ownedSubtypePackageReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_JS_TEST === "1";
const target = resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME
	?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser");
const prepared = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT
	?? "build/lean-link-spike", "lazy");
const reports = [];

test.after(async () => {
	if(enabled && reports.length === 2)
		await saveLakeFile("build/owned-subtype-javascript-packaging", "report.json"
			, canonicalJson({
				schemaVersion: 1
				, profile: "installed-owned-subtype-javascript"
				, reports: reports.toSorted((left, right) => Number(left.reviewed) - Number(right.reviewed)) }));
});

const probe = name => `import api from ${JSON.stringify(name)};
export const close = () => api.close();
export function run() {
  let checks = 0;
  const check = value => { checks++; if(!value) throw new Error("Owned Subtype check " + checks); };
  const ticket = api.newTicket(41n, "checked");
  const value = {primary:ticket,spare:{tag:"none"},peers:[ticket],history:[ticket],payload:{count:7n,bytes:new Uint8Array([0,255])}};
  check(api.echoRecord(value).payload.count === 7n);
  check(api.echoRecordAlternate(value).payload.bytes[1] === 255);
  const invalid = {...value,payload:{...value.payload,count:-1n}};
  let first = false, second = false;
  try { api.echoRecord(invalid); } catch { first = true; }
  try { api.echoRecordAlternate(invalid); } catch { second = true; }
  check(first); check(second); check(api.serial(ticket) === 41n);
  ticket.dispose(); check(ticket.disposed);
  return {checks,serial:"41",first,second};
}
`;

for(const reviewed of [false, true]) test(`installed ${reviewed ? "reviewed" : "ordinary"} owned Subtypes execute from source-free npm archives`, {
	skip: !enabled, timeout: 900000
}, async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-owned-subtype-javascript-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const project = join(scratch, "author"), componentRoot = join(scratch, "component");
	await cp(resolve("tests/fixtures/onboarding/owned-subtypes"), project, { recursive: true });
	if(reviewed)
	{
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Owned"]
			, targets: { npm: { name: "@lean-bridge/owned-subtypes", version: "1.0.0" } }
		}));
		await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedSubtypePackageReviewedIr()));
	}
	const before = await lakeInputState(project);
	const built = await buildOwnedJavaScriptWasmComponent({
		projectRoot: project, outputRoot: componentRoot
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
			?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, leanRuntimeRoot: target
		, emsdkRoot: resolve(process.env.LEAN_WASM_EMSDK ?? ".toolchains/emsdk")
	});
	assert.deepEqual(await lakeInputState(project), before, "builds must not modify authored inputs");
	const verified = await readVerifiedOwnedJavaScriptWasmComponent(componentRoot);
	assert.deepEqual(verified.model, built.model);
	const echo = verified.model.bindingIr.declarations.find(item => item.name === "echoRecord");
	assert.ok(echo.source.extensions["lean-lang.org/refinements"]);
	assert.equal(echo.parameters[0].ownership, "borrow");
	const first = await buildOwnedJavaScriptNpmPackages({
		componentRoot, runtimeRoot: prepared, outputRoot: join(scratch, "packages")
	});
	const repeated = await buildOwnedJavaScriptNpmPackages({
		componentRoot
		, runtimeRoot: prepared
		, outputRoot: join(scratch, "packages-repeated")
	});
	assert.deepEqual(await readFile(first.runtimeArchive), await readFile(repeated.runtimeArchive));
	assert.deepEqual(await readFile(first.componentArchive), await readFile(repeated.componentArchive));
	const receipt = await readVerifiedPackageSetReceipt({
		receiptPath: join(first.output, "package-set-receipt.json")
	});
	assert.deepEqual(receipt.result.profiles, ["javascript-wasm-owned-v1"]);
	const archives = { runtime: sha256(await readFile(first.runtimeArchive))
		, component: sha256(await readFile(first.componentArchive)) };
	const consumer = join(scratch, "consumer"), handoff = join(consumer, "handoff");
	await saveLakeFile(consumer, "package.json", canonicalJson({
		name: "owned-subtype-consumer"
		, version: "1.0.0"
		, private: true
		, type: "module"
	}));
	await saveLakeFile(handoff, "runtime.tgz", await readFile(first.runtimeArchive));
	await saveLakeFile(handoff, "component.tgz", await readFile(first.componentArchive));
	await rm(project, { recursive: true }); await rm(componentRoot, { recursive: true });
	await rm(first.output, { recursive: true }); await rm(repeated.output, { recursive: true });
	const run = (command, args) => processBuildRunner.capture({
		command, args, cwd: consumer, timeoutMs: 180000
	});
	await run("npm", ["install"
		, "--offline"
		, "--ignore-scripts"
		, "--no-audit"
		, "--no-fund"
		, "./handoff/runtime.tgz"
		, "./handoff/component.tgz"]);
	await rm(handoff, { recursive: true });
	await saveLakeFile(consumer, "probe.mjs", probe(first.coordinate.name));
	await saveLakeFile(consumer, "call.mjs", `import {run,close} from "./probe.mjs";
console.log(JSON.stringify(run()));
if(!close() || close()) throw new Error("Component close failed");
`);
	const observed = JSON.parse((await run(process.execPath, ["call.mjs"])).stdout);
	assert.deepEqual(observed, { checks: 6, serial: "41", first: true, second: true });
	await saveLakeFile(consumer, "consumer.mts", `import api, {type Bundle} from ${JSON.stringify(first.coordinate.name)};
const ticket = api.newTicket(41n, "typed");
const value: Bundle = {primary:ticket,spare:{tag:"none"},peers:[ticket],history:[ticket],payload:{count:7n,bytes:new Uint8Array()}};
const count: bigint = api.echoRecord(value).payload.count;
api.echoRecordAlternate(value);
// @ts-expect-error proof-erased Int fields remain bigint, never number.
api.echoRecord({...value,payload:{...value.payload,count:7}});
ticket.dispose(); api.close(); void count;
`);
	await run(process.execPath, [resolve("node_modules/typescript/bin/tsc")
		, "--strict"
		, "--noEmit"
		, "--target"
		, "ES2022"
		, "--module"
		, "NodeNext"
		, "--moduleResolution"
		, "NodeNext"
		, "--skipLibCheck", "false", "consumer.mts"]);
	const browser = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_BROWSER_TEST === "1"
		? await checkOwnedJavaScriptBrowsers({ root: consumer
			, name: first.coordinate.name
			, run
			, probeSource: probe(first.coordinate.name)
			, expected: observed }) : null;
	reports.push({ reviewed, componentIdentity: verified.identity
		, bindingIrSha256: verified.model.bindingIrSha256
		, sourceIdentity: verified.receipt.sourceIdentity
		, packageSetReceipt: receipt.receipt, archives, observed
		, installedNode: true
		, installedTypeScript: true
		, sourceRemovedBeforeInstall: true
		, archiveReproduction: true, browser
		, wasm: { bytes: verified.receipt.wasmLibrary.bytes
			, sha256: verified.receipt.wasmLibrary.sha256 } });
	t.diagnostic(JSON.stringify({ reviewed
		, installedNode: true
		, installedTypeScript: true
		, archiveReproduction: true
		, browser
		, wasmBytes: verified.receipt.wasmLibrary.bytes }));
});
