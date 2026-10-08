/**
 * Reviewed Subtype execution from source-free npm archives, with strict TypeScript and corpus mutants.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { reviewedSubtypeInstalledIr, reviewedSubtypeInstalledSource } from "./reviewed-subtype-installed-fixture.mjs";
import { checkReviewedSubtype } from "../fixtures/reviewed-subtype-consumers/javascript.mjs";

const expected = { checks: 2036, rejections: 2024 };
const fail = () => { throw new Error("Component scalar call failed (6)"); };
// This model checks that the consumer detects faults. It is not installed-package evidence.
const mock = () => ({
	shout: value => value.length ? value + "!" : fail()
	, half: value => value % 2n === 0n ? value / 2n : fail()
	, scale: (factor, value) => value >= -128n && value < 128n ? factor * value : fail()
	, head: value => value.length ? value[0] : fail()
	, pad: value => value * 2n
	, join: (left, right) => left.length && right.length ? left + right : fail()
	, clamp: value => value > 100n ? 100n : value
	, mix: (value, digit) => digit < 10n && value % 2n === 0n ? value + digit : fail()
	, byte: value => value !== 0 ? value : fail()
	, firstEven: value => value % 2n === 0n ? value : fail()
	, secondEven: value => value * 2n
	, zeroEven: () => 0n
});
const publicMock = raw => ({ ...raw, mix: (value, digit) => {
	if(digit >= 10n) throw new Error("mix.arg1 must be below 10");
	return raw.mix(value, digit);
} });

test("the reviewed Subtype npm corpus rejects permissive bounds, wrong failure layers and wrong constructor choices", () => {
	const run = (publicApi, rawApi) => checkReviewedSubtype(publicApi, (name, args) => rawApi[name](...args));
	const raw = mock(), api = publicMock(raw);
	assert.deepEqual(run(api, raw), expected);
	const changes = [
		["accepted subtype", { half: value => value / 2n }, /accepted: public half/u]
		, ["wrong layer", { half: () => { throw new Error("Component scalar call failed (5)"); } }, /wrong rejection: raw half/u]
		, ["normalization omitted", { clamp: value => value }, /failed: public clamp/u]
		, ["wrong specialization constructor", { secondEven: raw.firstEven }, /failed \(6\)/u]
		, ["result-only constant", { zeroEven: () => 1n }, /failed: public zeroEven/u]
		, ["caller mutation", { head: value => { if(!value.length) return fail(); const first = value[0]; value[1] = 0; return first; } }, /caller bytes/u]
	];
	for(const [label, change, message] of changes)
	{
		if(label === "wrong layer")
		{
			const altered = { ...raw, half: value => value % 2n === 0n ? raw.half(value) : change.half(value) };
			assert.throws(() => run(api, altered), message, label);
		}
		else assert.throws(() => run({ ...api, ...change }, raw), message, label);
	}
	assert.throws(() => run(api, { ...raw, half: value => value / 2n }), /accepted: raw half/u);
});

const typescript = `import * as api from "subtypes";
const text: string = api.shout("hello") + api.join("a", "b");
const nat: bigint = api.half(4n) + api.pad(3n) + api.clamp(200n) + api.mix(4n, 3n);
const signed: bigint = api.scale(-3n, 127n);
const byte: number = api.head(new Uint8Array([255])) + api.byte(1);
const first: bigint = api.firstEven(6n), second: bigint = api.secondEven(7n), zero: bigint = api.zeroEven();
// @ts-expect-error Nat retains bigint, including in specialized Subtype exports.
api.firstEven(6);
// @ts-expect-error UInt8 retains number.
api.byte(1n);
// @ts-expect-error ByteArray retains Uint8Array.
api.head([1, 2]);
// @ts-expect-error A zero-argument result is not a Unit-argument function.
api.zeroEven(undefined);
void text; void nat; void signed; void byte; void first; void second; void zero;
`;
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };

test("source-free reviewed npm archives execute checked Subtype constructors for Node and strict TypeScript", {
	skip: process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_NPM_TEST !== "1"
	, timeout: 3_600_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const producers = join(directory, "producers"), releases = [], facts = [];
	const review = reviewedSubtypeInstalledIr(), fixture = "tests/fixtures/onboarding/native-subtype";
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	for(const [index, projectRoot] of [join(producers, "project"), join(producers, "relocated")].entries())
	{
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Subtypes.lean", await readFile(join(fixture, "Subtypes.lean"), "utf8") + reviewedSubtypeInstalledSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Subtypes"] }));
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot), outputRoot = join(producers, `build-${index}`);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
			.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const bundleRoot = join(outputRoot, "bundle"), irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
		const ir = JSON.parse(irBytes), plan = JSON.parse(await readFile(join(bundleRoot, "locks/compiler-adapters.json"), "utf8"));
		assert.equal(reviewedContractDifference(review, ir), null);
		assert.equal(plan.privateAbi.version, 2);
		facts.push({ bindingIrSha256: hashBindingIr(ir), bindingIrFileSha256: sha256(irBytes), privateAbi: plan.privateAbi.version });
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(producers, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		assert.equal(release.report.bindingIrSha256, facts[index].bindingIrSha256);
		assert.deepEqual(await lakeInputState(projectRoot), before);
		releases.push(release);
	}
	assert.deepEqual(facts[1], facts[0]);
	assert.deepEqual(releases[1].report, releases[0].report);
	for(const name of ["componentArchive", "runtimeArchive"]) assert.deepEqual(await readFile(releases[1][name]), await readFile(releases[0][name]));
	const receipt = releases[0].report, handoff = join(directory, "handoff");
	await mkdir(handoff);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(releases[0].output, name), join(handoff, name));
	await rm(producers, { recursive: true, force: true });
	await assert.rejects(lstat(producers), { code: "ENOENT" });
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	const consumer = join(directory, "consumer"), bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm")), env = { ...clean, PATH: bin };
	const run = args => processBuildRunner.capture({ command: process.execPath, args, cwd: consumer, env, timeoutMs: 300_000 })
		.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	const configuration = ["--userconfig", join(consumer, "user.npmrc"), "--globalconfig", join(consumer, "global.npmrc"), "--cache", join(consumer, "empty-cache")];
	await run([npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...configuration, join(handoff, receipt.runtime.archive), join(handoff, receipt.package.archive)]);
	const corpus = await readFile("tests/fixtures/reviewed-subtype-consumers/javascript.mjs", "utf8");
	const script = 'import * as api from "subtypes";\nimport { runtime } from "./node_modules/subtypes/internal/runtime.mjs";\nimport { checkReviewedSubtype } from "./check.mjs";\nconsole.log(JSON.stringify(checkReviewedSubtype(api, (name, args) => runtime.call("lean:Subtypes." + name, args))));\n';
	await saveLakeFile(consumer, "check.mjs", corpus);
	await saveLakeFile(consumer, "index.mjs", script);
	const result = await run(["index.mjs"]);
	assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout.trim());
	assert.deepEqual(observed, expected);
	await saveLakeFile(consumer, "index.mts", typescript);
	await run([join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"]);
	const declarations = await readFile(join(consumer, "node_modules/subtypes/index.d.ts"));
	const report = { schemaVersion: 1, profile: "npm", path: "reviewed-source"
		, ...facts[0], reviewedBindingIrSha256: hashBindingIr(review), receipt
		, receiptSha256: sha256(await readFile(join(handoff, "component-package-receipt.json")))
		, corpusSha256: sha256(corpus), consumerSha256: sha256(script)
		, ...observed
		, typescript: { strict: true, skipLibCheck: false, sourceSha256: sha256(typescript), declarationsSha256: sha256(declarations) }
		, reproducible: true, independentBuilds: 2, offlineInstall: true
		, sourceRemovedBeforeInstallation: true, compilerFreePath: true
		, dispatch: "not measured" };
	const reportPath = resolve(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_NPM_REPORT ?? "build/reviewed-subtype/npm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson(report));
});
