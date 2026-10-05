/**
 * Reconstruct the six captured direct PHP observations without running producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { postPerlCallbackHistoryPath, postPerlCallbackHistorySha256
	, postPerlCallbackLineage } from "./post-perl-callback-staging-history.mjs";
import { assertOwnedPhpCallbackRuntimeSources } from "./owned-php-callback-result-runtime-sources.mjs";

export const ownedPhpCallbackStagedPath = "docs/evidence/owned-php-callback-runtime-staged-20261003.json";
export const ownedPhpCallbackStagedSha256 = "5c3313daf3e6e444bce99977ddaef44da56b8f2b2f01bf710053cbfb76d5fb11";
export const ownedPhpCallbackReportNames = Object.freeze(["ordinary", "reviewed"]
	.flatMap(mode => ["no-host", "host", "combined"].map(variant => `${mode}-${variant}.json`)));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), expected.split(" ").sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const freeze = value => {
	if(value && typeof value === "object")
	{
		Object.values(value).forEach(freeze); Object.freeze(value);
	}
	return value;
};
let captured;
const unpack = archive => {
	assert.deepEqual(Object.keys(archive.reports).sort(), [...ownedPhpCallbackReportNames].sort());
	return Object.fromEntries(ownedPhpCallbackReportNames.map(name => {
		const entry = archive.reports[name]; keys(entry, "bytes sha256 gzipBase64");
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes < 2 * 1024 * 1024);
		digest(entry.sha256); assert.equal(typeof entry.gzipBase64, "string");
		assert.ok(entry.gzipBase64.length < 2 * 1024 * 1024);
		const compressed = Buffer.from(entry.gzipBase64, "base64");
		assert.equal(compressed.toString("base64"), entry.gzipBase64);
		const bytes = gunzipSync(compressed, { maxOutputLength: entry.bytes });
		assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256);
		const report = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(report));
		return [name, report];
	}));
};

/** Read immutable original reports, independent of current build output directories. */
export const readOwnedPhpCallbackStaged = async () => {
	if(!captured)
	{
		const bytes = await readFile(ownedPhpCallbackStagedPath);
		assert.equal(sha256(bytes), ownedPhpCallbackStagedSha256);
		const archive = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(archive));
		captured = freeze({ archive, reports: unpack(archive) });
	}
	return captured;
};

/**
 * Validate source-derived behavior and hash-bound observed compiler products.
 *
 * @param name - One of the six selected report filenames.
 * @param item - Untrusted parsed report, never used as its own compiler baseline.
 */
export const assertOwnedPhpCallbackRuntime = async (name, item) => {
	assert.ok(ownedPhpCallbackReportNames.includes(name));
	const baseline = (await readOwnedPhpCallbackStaged()).reports[name];
	const mode = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	const variant = name.slice(mode.length + 1, -5);
	keys(item, "schemaVersion kind mode variant actualLean installedPackage options command execution observed input compilation compiledInputs nativeLibraries generated nativeSourceSha256 publicHeaderSha256 helpersSha256 probePath probe probeSha256");
	assert.equal(item.schemaVersion, 1); assert.equal(item.kind, "owned-php-callback-results-runtime");
	assert.equal(item.mode, mode); assert.equal(item.variant, variant);
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	const phases = { native: 66, ...variant !== "no-host" ? { host: 34 } : {}, ...variant === "combined" ? { combined: 48 } : {} };
	const checks = Object.values(phases).reduce((sum, value) => sum + value, 2);
	const observed = { checks, phases, variant, actualLean: true
		, installedPackage: false
		, live: 0, identities: 0, phpVersion: "8.2.33", phpIntSize: 8, phpZts: false
		, phpSapi: "cli", phpOs: "Linux", machine: "x86_64", ffi: true };
	assert.deepEqual(item.observed, observed);
	assert.deepEqual(item.execution, { code: 0, stderr: "", stdout: JSON.stringify(observed) + "\n" });
	keys(item.command, "command args cwd");
	assert.equal(item.command.command, baseline.command.command);
	assert.match(item.command.command, /^\/(?:[^/\n]+\/)*php(?:8\.2)?$/u);
	assert.equal(item.command.cwd, baseline.command.cwd);
	assert.match(item.command.cwd, /^\/tmp\/lean-bridge-owned-native-[a-zA-Z0-9]{6}$/u);
	assert.deepEqual(item.command.args, ["-d", "ffi.enable=1", "-d", "display_errors=stderr", "consumer.php", variant]);
	const cwd = item.command.cwd;
	assert.deepEqual(item.compilation, {
		command: baseline.compilation.command
		, args: ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror"
			, "-fPIC", "-shared", "-I", `${cwd}/runtime/include`
			, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
			, ...variant !== "no-host" ? ["Callbacks.o"] : []
			, "-L", `${cwd}/runtime/lib`, "-llean_bridge_native", "-lleanshared", "-lgmp"
			, `-Wl,-rpath,${cwd}/runtime/lib`, "-o", "libowned-php.so"]
		, cwd, env: { PATH: "/usr/bin:/bin" }
		, result: { code: 0, stdout: "", stderr: "" }
	});
	assert.match(item.compilation.command, /^\/(?:[^/\n]+\/)*cc$/u);
	const compiled = ["Owned.lean", "Owned.c", "Owned.o"
		, "Carriers.c", "Carriers.o"
		, "Witness.lean", "Witness.c", "Witness.o", "public-api.c", "libowned-php.so"
		, ...variant !== "no-host" ? ["Callbacks.c", "Callbacks.o"] : []];
	assert.deepEqual(Object.keys(item.compiledInputs).sort(), compiled.sort());
	Object.values(item.compiledInputs).forEach(digest);
	// Opaque compiler and linker outputs are exact observed golden baselines.
	// No local compiler installation, current path or regeneration is assumed.
	assert.deepEqual(item.compiledInputs, baseline.compiledInputs);
	assert.deepEqual(item.nativeLibraries, baseline.nativeLibraries);
	const native = item.nativeLibraries;
	assert.equal(native.identity, item.nativeSourceSha256);
	assert.equal(native.libraries[native.library], item.compiledInputs[native.library]);
	assert.equal(native.runtimeIdentity, sha256(canonicalJson(native.loadOrder.slice(0, 2).map(path => native.libraries[path]))));
	assert.equal(item.probePath, "tests/fixtures/structured-types/owned-php-callback-results.php");
	assert.equal(item.probe, await readFile(item.probePath, "utf8"));
	assert.equal(item.probeSha256, sha256(item.probe));
	await assertOwnedPhpCallbackRuntimeSources(mode, variant, item, baseline);
	return { mode, variant, checks, phases };
};

/**
 * Check the complete selected npm/TAP log, including diagnostics and terminal exits.
 *
 * @param execution - Original complete log envelope or an untrusted mutation.
 * @param reports - Six independently validated parsed report observations.
 */
export const assertOwnedPhpCallbackRuntimeLog = async (execution, reports) => {
	keys(execution, "command exitCode teeExitCode bytes sha256 text");
	assert.equal(execution.command, "npm run test:owned-php-callback-results");
	assert.equal(execution.exitCode, 0); assert.equal(execution.teeExitCode, 0);
	assert.equal(typeof execution.text, "string");
	assert.ok(Number.isSafeInteger(execution.bytes) && execution.bytes > 0);
	assert.equal(execution.bytes, Buffer.byteLength(execution.text)); assert.equal(execution.sha256, sha256(execution.text));
	const lines = execution.text.split("\n"); let position = 0;
	const next = expected => assert.equal(lines[position++], expected, `terminal line ${position}`);
	const duration = prefix => {
		const line = lines[position++]; assert.ok(line.startsWith(prefix));
		const value = line.slice(prefix.length); assert.match(value, /^(?:0|[1-9]\d*)\.\d+$/u);
		assert.ok(Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 600000);
	};
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	const command = "LEAN_BRIDGE_OWNED_PHP_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 tests/owned-php-callback-results.test.mjs";
	assert.equal(manifest.scripts["test:owned-php-callback-results"], command);
	next(""); next(`> ${manifest.name}@${manifest.version} test:owned-php-callback-results`);
	next(`> ${command}`); next(""); next("TAP version 13");
	const source = await readFile("tests/owned-php-callback-results.test.mjs", "utf8");
	const staticTitles = [...source.matchAll(/^test\("([^"]+)"/gmu)].map(match => match[1]);
	assert.equal(staticTitles.length, 6);
	const titles = [...ownedPhpCallbackReportNames.map(name => {
		const item = reports[name]; assert.ok(item);
		return `PHP callback-result owners execute real Lean (${item.mode}, ${item.variant})`;
	})
	, ...staticTitles];
	for(const [index, title] of titles.entries())
	{
		next(`# Subtest: ${title}`); next(`ok ${index + 1} - ${title}`);
		next("  ---"); duration("  duration_ms: "); next("  type: 'test'"); next("  ...");
		if(index < 6)
		{
			const { observed } = reports[ownedPhpCallbackReportNames[index]];
			next(`# ${observed.phpVersion} NTS: ${observed.checks} actual Lean ${observed.variant} callback checks`);
		}
		if(index === 10) next("# Five generated PHP/C models checked; no Lean build or installed-package execution.");
		if(index === 11) next('# {"scope":"type-only-ffi-unit","nativeFunctions":0,"checks":64,"selectors":6}');
	}
	for(const line of ["1..12", "# tests 12", "# suites 0", "# pass 12", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0"]) next(line);
	duration("# duration_ms "); next("ACTUAL_NPM_EXIT=0"); next("ACTUAL_TEE_EXIT=0"); next("");
	assert.equal(position, lines.length, "no unparsed terminal output");
};

/**
 * Reconstruct a closed six-report staged archive, preserving original observations.
 *
 * @param archive - Untrusted parsed archive; original bytes have a separate digest.
 */
export const assertOwnedPhpCallbackStaged = async archive => {
	keys(archive, "schemaVersion kind sourceCheckpoint sourceHistory reports execution");
	assert.equal(archive.schemaVersion, 1); assert.equal(archive.kind, "owned-php-callback-runtime-staged-observations");
	assert.equal(archive.sourceCheckpoint, postPerlCallbackLineage.at(-1));
	assert.deepEqual(archive.sourceHistory, { path: postPerlCallbackHistoryPath, sha256: postPerlCallbackHistorySha256 });
	const reports = unpack(archive);
	const baseline = await readOwnedPhpCallbackStaged();
	for(const name of ownedPhpCallbackReportNames)
	{
		await assertOwnedPhpCallbackRuntime(name, reports[name]);
		assert.equal(archive.reports[name].sha256, baseline.archive.reports[name].sha256);
	}
	assert.equal(new Set(Object.values(reports).map(item => item.command.cwd)).size, 6);
	assert.equal(Object.values(reports).reduce((sum, item) => sum + item.observed.checks, 0), 640);
	await assertOwnedPhpCallbackRuntimeLog(archive.execution, reports);
	assert.equal(archive.execution.sha256, baseline.archive.execution.sha256);
	return reports;
};
