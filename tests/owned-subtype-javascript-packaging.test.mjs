/**
 * Installed npm acceptance for proof-erased checked fields inside owned values.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
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
import {
	clearOwnedSubtypeRetainedPackages, retainOwnedSubtypeRoute
	, writeOwnedSubtypeRetainedPackages
} from "./helpers/owned-subtype-retained-packages.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_JS_TEST === "1";
const target = resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME
	?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser");
const prepared = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT
	?? "build/lean-link-spike", "lazy");
const output = resolve("build/owned-subtype-javascript-packaging/report.json");
const reports = [], retainedEntries = [];

test.before(async () => {
	if(!enabled) return;
	await clearOwnedSubtypeRetainedPackages(output);
	await rm(output, { force: true });
	await rm(resolve("build/owned-subtype-javascript-packaging/verification.json"), { force: true });
});

test.after(async () => {
	if(enabled && reports.length === 2)
	{
		await writeOwnedSubtypeRetainedPackages(output, retainedEntries);
		await saveLakeFile("build/owned-subtype-javascript-packaging", "report.json"
			, canonicalJson({
				schemaVersion: 2
				, profile: "installed-owned-subtype-javascript"
				, reports: reports.toSorted((left, right) => Number(left.reviewed) - Number(right.reviewed)) }));
	}
});

const probe = name => `import api from ${JSON.stringify(name)};
export const close = () => api.close();
export function run() {
  let checks = 0;
  const check = value => { checks++; if(!value) throw new Error("Owned Subtype check " + checks); };
  const release = (value, seen = new Set()) => {
    if(value === null || value === undefined || seen.has(value)) return;
    if((typeof value === "object" || typeof value === "function")) seen.add(value);
    if(value && typeof value.dispose === "function") { value.dispose(); return; }
    if(value && typeof value === "object") for(const child of Object.values(value)) release(child, seen);
  };
  const bundle = (ticket, count = 7n) => ({primary:ticket,spare:{tag:"none"},peers:[ticket],history:[ticket],payload:{count,bytes:new Uint8Array([0,255])}});
  const ticket = api.newTicket(41n, "checked");
  const retained = ticket.retain();
  const value = bundle(ticket);
  const echoed = api.echoRecord(value); check(echoed.payload.count === 7n);
  const alternate = api.echoRecordAlternate(value); check(alternate.payload.bytes[1] === 255);
  const invalid = {...value,payload:{...value.payload,count:-1n}};
  let first = false, second = false;
  try { api.echoRecord(invalid); } catch { first = true; }
  try { api.echoRecordAlternate(invalid); } catch { second = true; }
  check(first); check(second); check(api.serial(ticket) === 41n);
  release(echoed); release(alternate); ticket.dispose(); check(ticket.disposed);
  check(api.serial(retained) === 41n);
  const retainedEcho = api.echoRecord(bundle(retained, 8n));
  check(retainedEcho.payload.count === 8n);
  let retainedRejected = false;
  try { api.echoRecord(bundle(retained, -1n)); } catch { retainedRejected = true; }
  check(retainedRejected); check(api.serial(retained) === 41n);
  release(retainedEcho);
  const moving = api.newTicket(51n, "moving"), kept = moving.retain();
  let transferRejected = false;
  try { api.transferRecord(bundle(moving, -1n)); } catch { transferRejected = true; }
  check(transferRejected); check(!moving.disposed); check(api.serial(moving) === 51n);
  const moved = api.transferRecord(bundle(moving, 9n));
  check(moving.disposed); check(api.serial(kept) === 51n);
  check(moved.payload.count === 9n); check(api.serial(moved.primary) === 51n);
  release(moved); kept.dispose(); retained.dispose();
  check(kept.disposed && retained.disposed);
  return {checks,serial:"41",first,second,retainedRejected,transferRejected,transferred:true};
}
`;

for(const reviewed of [false, true]) test(`installed ${reviewed ? "reviewed" : "ordinary"} owned Subtypes execute from source-free npm archives`, {
	skip: !enabled, timeout: 900000
}, async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-owned-subtype-javascript-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const builds = [];
	for(const attempt of [0, 1])
	{
		const authorRoot = `author-${attempt}`, author = join(scratch, authorRoot);
		const project = join(author, "project"), componentRoot = join(author, "component");
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
		const packages = await buildOwnedJavaScriptNpmPackages({
			componentRoot, runtimeRoot: prepared, outputRoot: join(author, "packages")
		});
		builds.push({ author, authorRoot, verified, packages });
	}
	const [{ verified, packages: first }, { verified: repeatedVerified, packages: repeated }] = builds;
	assert.deepEqual(repeatedVerified.model, verified.model, "Independent author roots must compile the same model");
	assert.deepEqual(repeatedVerified.receipt.wasmLibrary, verified.receipt.wasmLibrary
		, "Independent author roots must compile the same Wasm");
	const echo = verified.model.bindingIr.declarations.find(item => item.name === "echoRecord");
	const transfer = verified.model.bindingIr.declarations.find(
		item => item.name === "transferRecord"
	);
	assert.ok(echo.source.extensions["lean-lang.org/refinements"]);
	assert.equal(echo.parameters[0].ownership, "borrow");
	assert.equal(transfer.parameters[0].ownership, "transfer");
	assert.equal(transfer.source.extensions["lean-lang.org/refinements"]
		.parameters[0].fields[4].refinement.fields[0]
		.refinement.constructor, "Owned.checkedCount");
	assert.deepEqual(await readFile(first.runtimeArchive), await readFile(repeated.runtimeArchive));
	assert.deepEqual(await readFile(first.componentArchive), await readFile(repeated.componentArchive));
	const receipt = await readVerifiedPackageSetReceipt({
		receiptPath: join(first.output, "package-set-receipt.json")
	});
	assert.deepEqual(receipt.result.profiles, ["javascript-wasm-owned-v1"]);
	const archives = { runtime: sha256(await readFile(first.runtimeArchive))
		, component: sha256(await readFile(first.componentArchive)) };
	const independentBuilds = builds.map(build => ({
		authorRoot: build.authorRoot, componentIdentity: build.verified.identity
		, bindingIrSha256: build.verified.model.bindingIrSha256
		, sourceIdentity: build.verified.receipt.sourceIdentity
		, wasm: build.verified.receipt.wasmLibrary, archives
		, sourceUnchanged: true, removedBeforeInstall: true
	}));
	let consumer = join(scratch, "consumer");
	const handoff = join(consumer, "handoff");
	await saveLakeFile(consumer, "package.json", canonicalJson({
		name: "owned-subtype-consumer"
		, version: "1.0.0"
		, private: true
		, type: "module"
	}));
	const { receipt: handoffReceipt, entry } = await retainOwnedSubtypeRoute({
		output, route: reviewed ? "reviewed" : "ordinary"
		, source: first.output, handoff
	});
	assert.deepEqual(handoffReceipt, receipt.receipt);
	retainedEntries.push(entry);
	for(const build of builds) await rm(build.author, { recursive: true });
	const run = (command, args) => processBuildRunner.capture({
		command, args, cwd: consumer, timeoutMs: 180000
	}).catch(error => {
		t.diagnostic(JSON.stringify(error.details ?? error.message));
		throw error;
	});
	await run("npm", ["install"
		, "--offline"
		, "--ignore-scripts"
		, "--no-audit"
		, "--no-fund"
		, ...handoffReceipt.packages.flatMap(pkg => pkg.artifacts.map(
			artifact => join(handoff, artifact.path)))]);
	await rm(handoff, { recursive: true });
	await saveLakeFile(consumer, "probe.mjs", probe(first.coordinate.name));
	await saveLakeFile(consumer, "call.mjs", `import {run,close} from "./probe.mjs";
console.log(JSON.stringify(run()));
if(!close() || close()) throw new Error("Component close failed");
`);
	const relocated = join(scratch, "relocated-consumer");
	await rename(consumer, relocated); consumer = relocated;
	const observed = JSON.parse((await run(process.execPath, ["call.mjs"])).stdout);
	assert.deepEqual(observed, { checks: 18, serial: "41", first: true
		, second: true, retainedRejected: true
		, transferRejected: true, transferred: true });
	await saveLakeFile(consumer, "consumer.mts", `import api, {type Bundle} from ${JSON.stringify(first.coordinate.name)};
const ticket = api.newTicket(41n, "typed");
const value: Bundle = {primary:ticket,spare:{tag:"none"},peers:[ticket],history:[ticket],payload:{count:7n,bytes:new Uint8Array()}};
const count: bigint = api.echoRecord(value).payload.count;
api.echoRecordAlternate(value);
api.transferRecord(value);
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
			, expected: observed, productionReact: true }) : null;
	reports.push({ reviewed, componentIdentity: verified.identity
		, bindingIrSha256: verified.model.bindingIrSha256
		, sourceIdentity: verified.receipt.sourceIdentity
		, packageSetReceipt: receipt.receipt, archives, observed, independentBuilds
		, installedNode: true
		, installedTypeScript: true
		, sourceRemovedBeforeInstall: true
		, relocatedInstallation: true
		, archiveReproduction: true, browser
		, transferredInputCheckedBeforeHandoff: true
		, wasm: { bytes: verified.receipt.wasmLibrary.bytes
			, sha256: verified.receipt.wasmLibrary.sha256 } });
	t.diagnostic(JSON.stringify({ reviewed
		, installedNode: true
		, installedTypeScript: true
		, archiveReproduction: true
		, browser
		, wasmBytes: verified.receipt.wasmLibrary.bytes }));
});
