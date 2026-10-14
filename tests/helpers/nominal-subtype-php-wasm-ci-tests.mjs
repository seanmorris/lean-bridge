/**
 * Exercise the recurring PHP-Wasm checker against original installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { parseNominalSubtypePhpWasmCiArgs, checkNominalSubtypePhpWasmCiRecords } from "./nominal-subtype-php-wasm-ci-report.mjs";
import { assertNominalSubtypePhpWasmTap } from "./nominal-subtype-php-wasm-provenance.mjs";
import { readOwnedPerlCallbackVariantTar } from "./owned-perl-callback-result-variant-archives.mjs";

const root = "docs/evidence/nominal-subtype-php-wasm-20261014";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const originalIndex = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "4eb5779d93b8b6b4fb098fa6b5c72f86e0e977f327b597bf5d07a60b873c0988");
	return JSON.parse(bytes);
};

test("nominal PHP-Wasm CI refuses incomplete, repeated and unknown options before reading records", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "records", tap: "run.tap", runtime: "runtime.json" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypePhpWasmCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypePhpWasmCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypePhpWasmCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseNominalSubtypePhpWasmCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changes of [{ route: "unknown" }, { route: "ordinary,reviewed" }, { mode: "unknown" }, { mode: "full,result-only" }, { producer: "HEAD" }, { producer: "g".repeat(40) }, { extra: "yes" }])
		assert.throws(() => parseNominalSubtypePhpWasmCiArgs(argsOf({ ...options, ...changes })));
	for(const value of [undefined, {}, [], args.slice(0, -1), ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypePhpWasmCiArgs(value));
});

test("nominal PHP-Wasm CI requires exact terminal TAP without hidden failures or skipped selections", async t => {
	const index = await originalIndex(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = await readFile(`${root}/${run.label}/run.tap`, "utf8"); assertNominalSubtypePhpWasmTap(tap, run.route, run.mode);
		const changes = [tap.slice(1), tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n")
			, tap.replace("ok 1 -", "not ok 1 -"), tap.replace("# Subtest:", "# Wrong:")
			, tap + "Bail out! incomplete\n", tap + "# SKIP disabled\n"
			, tap + "# TODO later\n"
			, tap + tap, tap + "ok 2 - extra\n", tap + "incomplete\n"
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"].map(line => tap.replace("\n1..1\n", `\n    ${line}\n1..1\n`))
			, ...["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changes)
		{ assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypePhpWasmTap(source, run.route, run.mode)); controls++; }
		assert.throws(() => assertNominalSubtypePhpWasmTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypePhpWasmTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	assert.equal(controls, 156); t.diagnostic(`${controls} incomplete, substituted, skipped and failed TAP controls`);
});

test("nominal PHP-Wasm CI and CLI authenticate all four originals with independent runtime and complete archive closure", async t => {
	const index = await originalIndex(), temporary = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-php-wasm-ci-checker-"));
	t.after(() => rm(temporary, { recursive: true }));
	const runtimePath = join(temporary, "runtime.json");
	for(const run of index.runs)
	{
		const options = { route: run.route, mode: run.mode
			, producer: run.producerCommit
			, directory: `${root}/${run.label}/records`
			, tap: `${root}/${run.label}/run.tap`, runtime: runtimePath };
		assert.deepEqual(parseNominalSubtypePhpWasmCiArgs(argsOf(options)), options);
		const start = JSON.parse(await readFile(`${root}/${run.label}/start.json`));
		const independent = JSON.parse(await readFile(`${root}/${run.label}/independent-runtime.json`));
		const runtime = { schemaVersion: 1
			, producerCommit: run.producerCommit
			, host: { schemaVersion: 1
				, ...start.runtime
				, nodeSha256: start.nodeExecutable.sha256
				, phpSha256: start.toolIdentities.php.sha256
				, composerSha256: start.toolIdentities.composer.sha256
				, chromiumSha256: start.toolIdentities.chromium.sha256 }
			, runtime: independent };
		await writeFile(runtimePath, canonicalJson(runtime));
		const original = { tap: await readFile(options.tap, "utf8")
			, runtime
			, paths: await nativeArtifactPaths(options.directory)
			, read: path => readFile(join(options.directory, path)) };
		const checked = await checkNominalSubtypePhpWasmCiRecords(options, original);
		assert.equal(checked.route, run.route); assert.equal(checked.mode, run.mode); assert.equal(checked.producerCommit, run.producerCommit);
		const result = spawnSync(process.execPath, ["scripts/check-nominal-subtype-php-wasm-ci.mjs", ...argsOf(options)], { encoding: "utf8" });
		assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stderr, ""); assert.deepEqual(JSON.parse(result.stdout), checked);
		for(const changes of [{ producer: "0".repeat(40) }, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }, { mode: run.mode === "full" ? "result-only" : "full" }])
			await assert.rejects(checkNominalSubtypePhpWasmCiRecords({ ...options, ...changes }, original));
		for(const mutate of [
			value => { value.schemaVersion = 0; }
			, value => { value.producerCommit = "0".repeat(40); }
			, value => { value.extra = true; }
			, value => { delete value.host; }
			, value => { value.host.node = "v0.0.0"; }
			, value => { value.host.platform = "win32"; }
			, value => { value.host.arch = "arm64"; }
			, value => { value.host.schemaVersion = 0; }
			, ...["nodeSha256", "phpSha256", "composerSha256", "chromiumSha256"].flatMap(key => [
				value => { value.host[key] = "0".repeat(64); }
				, value => { delete value.host[key]; }
			])
			, value => { value.runtime.identity = "0".repeat(64); }
			, value => { value.runtime.manifest.pointerBits = 64; value.runtime.identity = sha256(canonicalJson(value.runtime.manifest)); }
			, value => { value.runtime.extra = true; }
		]) {
			const changed = structuredClone(runtime); mutate(changed);
			await assert.rejects(checkNominalSubtypePhpWasmCiRecords(options, { ...original, runtime: changed }));
		}
		for(const paths of [original.paths.slice(1), [...original.paths, "invented.json"], [...original.paths, original.paths[0]]])
			await assert.rejects(checkNominalSubtypePhpWasmCiRecords(options, { ...original, paths }));
		for(const missing of ["report.json", "resources.json", "build-0/author-inputs.json", "build-1/NominalSubtypes.lean", "executions/0.json", ...run.records.filter(path => path.startsWith("handoff/"))])
			await assert.rejects(checkNominalSubtypePhpWasmCiRecords(options, { ...original, read: async path => { assert.notEqual(path, missing); return original.read(path); } }));
	}
});

test("nominal PHP-Wasm CI snapshot verifies original runtime bytes and selected host identities", async t => {
	const index = await originalIndex(), run = index.runs[0];
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-php-wasm-ci-snapshot-"));
	t.after(() => rm(directory, { recursive: true }));
	const base = `${root}/${run.label}/records`, report = JSON.parse(await readFile(`${base}/report.json`));
	const pkg = report.receipt.packages.find(item => item.role === "runtime");
	const archive = await readFile(`${base}/handoff/${pkg.artifacts[0].path}`);
	assert.equal(sha256(archive), pkg.artifacts[0].sha256);
	const members = readOwnedPerlCallbackVariantTar(archive, "package", report.phpWasm.packageSet.packing.collationLocale);
	const runtimeRoot = join(directory, "runtime");
	for(const [path, bytes] of members) if(path.startsWith("compiled/"))
	{
		const destination = join(runtimeRoot, path.slice("compiled/".length));
		await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes);
	}
	const script = resolve("scripts/snapshot-nominal-subtype-php-wasm-ci.mjs");
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && key !== "NODE_TEST_CONTEXT"));
	env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME = runtimeRoot;
	const toolPaths = { phpSha256: "LEAN_BRIDGE_PHP", composerSha256: "LEAN_BRIDGE_COMPOSER", chromiumSha256: "CHROMIUM_PATH" };
	const expected = { nodeSha256: sha256(await readFile(process.execPath)) };
	for(const [key, variable] of Object.entries(toolPaths))
	{
		const path = join(directory, key), bytes = `#!/bin/sh\n# explicit snapshot stand-in ${key}\nexit 99\n`;
		await writeFile(path, bytes); await chmod(path, 0o755); env[variable] = path; expected[key] = sha256(bytes);
	}
	const git = args => execFileSync("git", args, { cwd: directory, env, encoding: "utf8" });
	git(["init", "--quiet"]); await writeFile(join(directory, "tracked.txt"), "original"); git(["add", "tracked.txt"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "snapshot test"]);
	const invoke = (environment = env, args = []) => spawnSync(process.execPath, [script, ...args], { cwd: directory, env: environment, encoding: "utf8" });
	const result = invoke(); assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stderr);
	const snapshot = JSON.parse(result.stdout);
	assert.equal(result.stdout, canonicalJson(snapshot)); assert.equal(result.stderr, "");
	assert.deepEqual(snapshot, { schemaVersion: 1
		, producerCommit: git(["rev-parse", "HEAD"]).trim()
		, host: { schemaVersion: 1, node: process.version
			, platform: process.platform, arch: process.arch, ...expected }
		, runtime: JSON.parse(await readFile(`${root}/${run.label}/independent-runtime.json`)) });
	const refused = result => { assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 1); assert.equal(result.stdout, ""); };
	refused(invoke(env, ["unexpected"]));
	refused(invoke({ ...env, LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: "" }));
	refused(invoke({ ...env, LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: join(directory, "missing") }));
	for(const variable of Object.values(toolPaths))
	{
		refused(invoke({ ...env, [variable]: join(directory, "missing") }));
		await chmod(env[variable], 0o644); refused(invoke()); await chmod(env[variable], 0o755);
	}
	await writeFile(join(directory, "tracked.txt"), "changed"); refused(invoke()); await writeFile(join(directory, "tracked.txt"), "original");
	const library = join(runtimeRoot, snapshot.runtime.manifest.library), bytes = await readFile(library);
	await writeFile(library, Buffer.concat([bytes, Buffer.from("changed")])); refused(invoke()); await writeFile(library, bytes);
	const manifest = join(runtimeRoot, "runtime.json");
	await writeFile(manifest, canonicalJson({ ...snapshot.runtime.manifest, pointerBits: 64 })); refused(invoke());
	await writeFile(manifest, canonicalJson(snapshot.runtime.manifest));
	const extra = join(runtimeRoot, "unrecorded.json"); await writeFile(extra, "{}"); refused(invoke()); await rm(extra);
	const restored = invoke(); assert.equal(restored.status, 0, restored.stderr); assert.equal(restored.stdout, result.stdout);
	t.diagnostic("The snapshot checker read an original archived runtime and explicit tool-file stand-ins. This test does not claim new PHP, Composer or Chromium execution.");
});
