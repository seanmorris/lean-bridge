/**
 * Installed checked records: relocated source-free npm packages build a checked record only through
 * each site's constructor, and return Lean-produced records as payload-only values.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { checkedRecordFixture } from "./checked-record-fixture.mjs";

/**
 * Read the fixture source under another module name, for the npm author project.
 *
 * @param module - Lean module and namespace name.
 */
export const checkedRecordSource = async (module = "CheckedRecords") => (await readFile(join(checkedRecordFixture, "CheckedRecords.lean"), "utf8")).replaceAll("CheckedRecords", module);

/** Node consumer: accepted and refused sites, per-site constructors, results, and recovery. */
export const checkedRecordNodeConsumer = () => `import * as api from "onboarding-small";
let checks = 0, rejections = 0;
const check = (ok, label) => { if(!ok) throw new Error("failed: " + label); checks++; };
// A constructor refusal is the checked-refinement status, never a transport or shape error.
const refused = (call, label) => { try { call(); } catch(error) { if(!/failed \\(5\\)/.test(String(error?.message))) throw new Error("wrong refusal: " + label + ": " + error?.message); rejections++; return; } throw new Error("accepted: " + label); };
const shape = (call, label) => { try { call(); } catch { rejections++; return; } throw new Error("accepted: " + label); };
const same = (value, expected) => value.data.length === expected.length && value.data.every((item, i) => item === expected[i]);
check(api.width({ lo: 3n, hi: 10n }) === 7n, "width");
refused(() => api.width({ lo: 10n, hi: 3n }), "reversed interval");
check(api.span({ lo: 1n, hi: 5n }, { lo: 2n, hi: 9n }) === 8n, "span");
refused(() => api.span({ lo: 1n, hi: 5n }, { lo: 9n, hi: 2n }), "second interval");
refused(() => api.span({ lo: 5n, hi: 1n }, { lo: 2n, hi: 9n }), "first interval");
const three = { data: [3n, 1n, 2n] };
check(api.total(three) === 6n, "total");
refused(() => api.total({ data: [1n, 2n] }), "short triple");
check(api.firstOf(three) === 3n, "mkTriple keeps the caller's order");
check(api.smallest(three) === 1n, "sortedTriple normalizes inside Lean");
check(three.data[0] === 3n && three.data[1] === 1n && three.data[2] === 2n, "caller payload unchanged");
refused(() => api.smallest({ data: [1n, 2n] }), "short sorted triple");
const scaled = api.scale(2n, three);
check(same(scaled, [6n, 2n, 4n]) && Object.keys(scaled).join() === "data", "scale returns only the payload");
refused(() => api.scale(2n, { data: [1n] }), "scaled short triple");
check(api.smallest(scaled) === 2n, "a Lean-produced record re-enters through its constructor");
check(same(api.repeated(4n), [4n, 4n, 4n]), "repeated");
check(api.total({ data: [2n ** 70n, 1n, 2n] }) === 2n ** 70n + 3n, "Nat precision");
check(api.complement({ value: 40n }) === 60n, "complement");
refused(() => api.complement({ value: 101n }), "out-of-range percent");
// A host cannot supply a proof field or drop a payload field.
shape(() => api.width({ lo: 3n, hi: 10n, ordered: true }), "a supplied proof field");
shape(() => api.width({ lo: 3n }), "a missing payload field");
for(let i = 0n; i < 1000n; i++) {
  check(api.width({ lo: i, hi: i + 1n }) === 1n, "round");
  refused(() => api.width({ lo: i + 1n, hi: i }), "refusal round");
}
console.log(JSON.stringify({ checks, rejections }));
`;

/** Node consumer for a package whose only checked record is a Lean-produced result. */
export const checkedRecordResultOnlyConsumer = () => `import * as api from "onboarding-small";
let checks = 0;
const check = (ok, label) => { if(!ok) throw new Error("failed: " + label); checks++; };
for(let i = 0n; i < 1000n; i++) {
  const value = api.repeated(i);
  check(Object.keys(value).join() === "data" && value.data.length === 3 && value.data.every(item => item === i), "round");
}
check(api.repeated(2n ** 80n).data[2] === 2n ** 80n, "Nat precision");
console.log(JSON.stringify({ checks, rejections: 0 }));
`;

const resultOnlyTypescript = `import * as api from "onboarding-small";
const triple: api.Triple = api.repeated(4n);
const data: ReadonlyArray<bigint> = triple.data;
// @ts-expect-error The Lean-produced record carries no proof field.
const proof: boolean = triple.sized;
void data; void proof;
`;

const typescript = `import * as api from "onboarding-small";
const interval: api.Interval = { lo: 1n, hi: 2n };
const width: bigint = api.width(interval) + api.span(interval, interval);
const triple: api.Triple = api.repeated(4n);
const data: ReadonlyArray<bigint> = api.scale(2n, triple).data;
const percent: api.Percent = { value: 40n };
const rest: bigint = api.complement(percent) + api.total(triple) + api.firstOf(triple) + api.smallest(triple);
// @ts-expect-error A proof field is never part of the host type.
api.width({ lo: 1n, hi: 2n, ordered: true });
// @ts-expect-error The payload keeps bigint Nat values.
api.total({ data: [1, 2, 3] });
void width; void data; void rest;
`;

/**
 * Build the npm package from two clean roots, delete both, install offline under a Node-only PATH and
 * run the Node and strict TypeScript consumers.
 *
 * @param t - Test context.
 * @param options - Build helpers.
 * @param options.build - Builds the canonical project for npm.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param options.engineRoot - Checkout containing the TypeScript compiler.
 * @param options.contracts - Export contracts for a configured package.
 * @param options.review - Independent reviewed Binding IR instead of contracts.
 * @param options.resultOnly - The package's only checked record is a Lean-produced result.
 */
export const checkCheckedRecordNpmPackages = async (t, { build, runtimeRoot, engineRoot, contracts, review, resultOnly = false }) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project"), moved = join(directory, "moved"), releases = [], facts = [];
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	await saveLakeFile(root, "OnboardingSmall.lean", await checkedRecordSource("OnboardingSmall"));
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson(review ? { schemaVersion: 1, modules: ["OnboardingSmall"] }
		: { schemaVersion: 1, modules: ["OnboardingSmall"], exports: Object.keys(contracts), contracts }));
	if(review) await saveLakeFile(root, "api.binding-ir.json", canonicalJson(review));
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const irBytes = await readFile(join(outputRoot, "bundle/binding/binding-ir.json")), ir = JSON.parse(irBytes);
		const erased = (resultOnly ? [["Triple", ["sized"]]] : [["Interval", ["ordered"]], ["Percent", ["above", "below"]], ["Triple", ["sized"]]]).map(([name, fields]) => [`lean:OnboardingSmall.${name}`, { fields }]);
		assert.deepEqual(ir.types.map(type => [type.id, type.source.extensions["lean-lang.org/erased-proofs"]]), erased);
		facts.push({ bindingIrSha256: hashBindingIr(ir), bindingIrFileSha256: sha256(irBytes) });
		releases.push(await buildComponentNpmPackages({ bundleRoot: join(outputRoot, "bundle"), runtimeRoot, outputRoot: join(directory, `npm-${index}`) }));
		await verifyComponentPackageReceipt({ receiptPath: join(releases[index].output, "component-package-receipt.json") });
		assert.equal(releases[index].report.bindingIrSha256, facts[index].bindingIrSha256);
		assert.deepEqual(await lakeInputState(projectRoot), before);
	}
	assert.deepEqual(releases[0].report, releases[1].report);
	assert.deepEqual(facts[0], facts[1]);
	const archiveSha256 = sha256(await readFile(releases[0].componentArchive));
	assert.equal(archiveSha256, sha256(await readFile(releases[1].componentArchive)));
	const runtimeArchiveSha256 = sha256(await readFile(releases[0].runtimeArchive));
	assert.equal(runtimeArchiveSha256, sha256(await readFile(releases[1].runtimeArchive)));
	const receipt = releases[0].report;
	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-consumer-"));
	t.after(() => rm(consumer, { recursive: true, force: true }));
	const handoff = join(consumer, "handoff"), bin = join(consumer, "bin");
	await mkdir(handoff);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(releases[0].output, name), join(handoff, name));
	// This test owns the temporary directory: delete both author roots and all build staging.
	await rm(directory, { recursive: true, force: true });
	await assert.rejects(lstat(directory), { code: "ENOENT" });
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	// A tampered copy of the receipt is refused before anything is installed.
	const tampered = join(consumer, "tampered");
	await cp(handoff, tampered, { recursive: true });
	const forged = JSON.parse(await readFile(join(tampered, "component-package-receipt.json"), "utf8"));
	forged.package.sha256 = forged.package.sha256.replace(/^./u, value => value === "0" ? "1" : "0");
	await saveLakeFile(tampered, "component-package-receipt.json", canonicalJson(forged));
	await assert.rejects(() => verifyComponentPackageReceipt({ receiptPath: join(tampered, "component-package-receipt.json") }));
	await rm(tampered, { recursive: true, force: true });
	await mkdir(bin);
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
	const env = { PATH: bin, CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };
	const execute = args => processBuildRunner.capture({ command: process.execPath, args, cwd: consumer, env, timeoutMs: 300_000 })
		.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	await execute([npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--userconfig", join(consumer, "user.npmrc"), "--globalconfig", join(consumer, "global.npmrc"), "--cache", join(consumer, "empty-cache"), join(handoff, receipt.runtime.archive), join(handoff, receipt.package.archive)]);
	const script = resultOnly ? checkedRecordResultOnlyConsumer() : checkedRecordNodeConsumer();
	await saveLakeFile(consumer, "index.mjs", script);
	const run = await execute(["index.mjs"]);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout.trim());
	assert.deepEqual(result, resultOnly ? { checks: 1001, rejections: 0 } : { checks: 1011, rejections: 1009 });
	// Strict TypeScript sees payload-only interfaces: no proof field exists in any host type.
	const declarations = await readFile(join(consumer, "node_modules/onboarding-small/index.d.ts"), "utf8");
	const interfaces = [["Interval", ["lo: bigint", "hi: bigint"]], ["Triple", ["data: ReadonlyArray<bigint>"]], ["Percent", ["value: bigint"]]].filter(([name]) => !resultOnly || name === "Triple");
	for(const [name, fields] of interfaces)
		assert.match(declarations, new RegExp(`export interface ${name} \\{\\s*${fields.map(field => `readonly ${field};`).join("\\s*")}\\s*\\}`), name);
	const source = resultOnly ? resultOnlyTypescript : typescript;
	await saveLakeFile(consumer, "index.mts", source);
	await execute([join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"]);
	return { archiveSha256, runtimeArchiveSha256
		, ...facts[0], ...result, receipt
		, receiptSha256: sha256(await readFile(join(handoff, "component-package-receipt.json")))
		, consumerSha256: sha256(script)
		, typescript: { strict: true, skipLibCheck: false, sourceSha256: sha256(source), declarationsSha256: sha256(declarations) }
		, receiptTamperRefused: true
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreePath: true, dispatch: "not measured" };
};

const reportKeys = ["route", "path", "reproducible", "independentBuilds"];
/**
 * Refuse a checked-record acceptance report that drops a required claim or contradicts itself.
 *
 * @param report - Report about to be written.
 */
export const assertCheckedRecordReport = report => {
	for(const key of reportKeys) assert.ok(Object.hasOwn(report, key), `report lacks ${key}`);
	assert.ok(["ordinary", "reviewed", "result-only"].includes(report.route), "unknown route");
	assert.equal(report.path, report.route === "reviewed" ? "reviewed-source" : "ordinary-source");
	assert.equal(report.reproducible, true);
	assert.equal(report.independentBuilds, 2);
	const installs = report.reports ?? [report];
	assert.ok(installs.length > 0 && installs.every(item => item.sourceRemovedBeforeInstallation === true), "an install ran with its source present");
	assert.ok(report.route === "reviewed" ? typeof report.reviewedBindingIrSha256 === "string" && !report.contracts : report.contracts && !report.reviewedBindingIrSha256, "route evidence mismatch");
};
