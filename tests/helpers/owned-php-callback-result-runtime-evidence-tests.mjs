/**
 * Reject forged direct PHP observations without executing native producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPhpCallbackRuntime, assertOwnedPhpCallbackRuntimeLog
	, assertOwnedPhpCallbackStaged, ownedPhpCallbackReportNames
	, ownedPhpCallbackStagedPath, ownedPhpCallbackStagedSha256
	, readOwnedPhpCallbackStaged } from "./owned-php-callback-result-runtime-evidence.mjs";

const wrong = "0".repeat(64);
const resealLog = execution => {
	execution.bytes = Buffer.byteLength(execution.text); execution.sha256 = sha256(execution.text);
};
const resealObserved = item => {
	const keys = Object.keys(JSON.parse(item.execution.stdout));
	item.execution.stdout = JSON.stringify(Object.fromEntries(keys.map(key => [key, item.observed[key]]))) + "\n";
};
const repack = item => {
	const bytes = Buffer.from(canonicalJson(item));
	return { bytes: bytes.length, sha256: sha256(bytes), gzipBase64: gzipSync(bytes, { level: 9 }).toString("base64") };
};

test("staged PHP direct reports reconstruct six original source-bound observations", async t => {
	const bytes = await readFile(ownedPhpCallbackStagedPath);
	assert.equal(sha256(bytes), ownedPhpCallbackStagedSha256);
	const { archive, reports } = await readOwnedPhpCallbackStaged();
	const original = structuredClone(archive);
	assert.deepEqual(await assertOwnedPhpCallbackStaged(archive), reports);
	assert.deepEqual(await assertOwnedPhpCallbackStaged(structuredClone(archive)), reports);
	assert.deepEqual(archive, original);
	assert.equal(Object.values(reports).reduce((sum, item) => sum + item.observed.checks, 0), 640);
	t.diagnostic("6 captured direct reports, 640 probe assertions; regenerated adapters; compiler products are observed baselines, not rebuilt artifacts.");
});

test("staged PHP direct report readers reject resealed semantic and source forgeries", async t => {
	const { reports } = await readOwnedPhpCallbackStaged(); let rejected = 0;
	for(const name of ownedPhpCallbackReportNames)
	{
		const original = reports[name];
		const changes = [
			item => { item.schemaVersion = 2; }
			, item => { item.kind = "owned-php-callback-acceptance"; }
			, item => { item.actualLean = false; }
			, item => { item.installedPackage = true; }
			, item => { item.mode = "forged"; }
			, item => { item.variant = "forged"; }
			, item => { item.extra = true; }
			, item => { delete item.input; }
			, item => { item.input.extra = true; }
			, item => { item.input.component.version = "1.0.1"; }
			, item => { item.input.metadata.extra = true; }
			, item => { item.input.sourceIdentity.extra = true; }
			, item => { item.input.sourceIdentity.leanCompilerSha256 = wrong; }
			, item => { item.input.sourceIdentity.sourceTreeSha256 = wrong; }
			, item => { item.input.sourceIdentity.modules[0].source.sha256 = wrong; }
			, item => { item.input.sourceIdentity.exportConfigurationSource += "\n"; }
			, item => { item.command.args[1] = "ffi.enable=0"; }
			, item => { item.command.command = "/forged/php"; }
			, item => { item.command.cwd += "x"; item.compilation.cwd = item.command.cwd; }
			, item => { item.command.extra = true; }
			, item => { item.compilation.command = "/forged/cc"; }
			, item => { item.compilation.args.splice(0, 1); }
			, item => { item.compilation.env.PATH += ":/forged"; }
			, item => { item.compilation.result.code = 1; }
			, item => { item.compilation.result.stderr = "warning: forged\n"; }
			, item => { item.compilation.result.stdout = "unexpected\n"; }
			, item => { item.compilation.result.extra = true; }
			, item => { item.execution.code = 1; }
			, item => { item.execution.stderr = "Fatal error\n"; }
			, item => { item.execution.stdout += "{}\n"; }
			, item => { item.execution.stdout = JSON.stringify(item.observed) + "\n"; }
			, item => { item.execution.extra = true; }
			, item => { item.probe += "\n// forged\n"; item.probeSha256 = sha256(item.probe); }
			, item => { item.probePath = "other.php"; }
			, item => { item.probeSha256 = wrong; }
			, item => { item.nativeSourceSha256 = wrong; item.nativeLibraries.identity = wrong; }
			, item => { item.publicHeaderSha256 = wrong; }
			, item => { item.helpersSha256 = wrong; }
			, item => { item.nativeLibraries.componentId = "forged@1.0.0"; }
			, item => { item.nativeLibraries.loadOrder.reverse(); }
			, item => { item.nativeLibraries.runtimeIdentity = wrong; }
			, item => { item.nativeLibraries.extra = true; }
			, item => {
				item.compiledInputs["libowned-php.so"] = wrong;
				item.nativeLibraries.libraries["libowned-php.so"] = wrong;
			}
		];
		for(const key of Object.keys(original.options)) changes.push(item => { item.options[key] = !item.options[key]; });
		for(const key of Object.keys(original.generated)) changes.push(item => { item.generated[key] = wrong; });
		for(const key of Object.keys(original.compiledInputs)) changes.push(item => { item.compiledInputs[key] = wrong; });
		for(const key of Object.keys(original.nativeLibraries.libraries)) changes.push(item => { item.nativeLibraries.libraries[key] = wrong; });
		for(const [key, value] of Object.entries({ checks: 641, actualLean: false
			, installedPackage: true
			, live: 1, identities: 1, phpVersion: "8.5.10", phpIntSize: 4, phpZts: true
			, phpSapi: "fpm-fcgi", phpOs: "Darwin", machine: "aarch64"
			, ffi: false, variant: "forged", extra: true }))
			changes.push(item => { item.observed[key] = value; resealObserved(item); });
		changes.push(item => { item.observed.phases.native++; item.observed.checks++; resealObserved(item); });
		changes.push(item => { item.observed.phases.extra = 0; resealObserved(item); });
		changes.push(item => { item.observed.checks = Number.MAX_SAFE_INTEGER + 1; resealObserved(item); });
		for(const change of changes)
		{
			const forged = structuredClone(original); change(forged);
			await assert.rejects(() => assertOwnedPhpCallbackRuntime(name, forged)); rejected++;
		}
		const other = ownedPhpCallbackReportNames.find(candidate => candidate !== name);
		await assert.rejects(() => assertOwnedPhpCallbackRuntime(name, reports[other])); rejected++;
	}
	t.diagnostic(`${rejected} report forgeries rejected, including resealed raw observations and compiler/native identity pairs.`);
});

test("staged PHP execution reader rejects contradictory or truncated complete TAP", async t => {
	const { archive, reports } = await readOwnedPhpCallbackStaged();
	await assertOwnedPhpCallbackRuntimeLog(archive.execution, reports);
	const changes = [
		item => { item.command = "node producer.mjs"; }
		, item => { item.exitCode = 1; }
		, item => { item.teeExitCode = 1; }
		, item => { item.bytes = Number.MAX_SAFE_INTEGER + 1; }
		, item => { item.sha256 = wrong; }
		, item => { item.extra = true; }
		, item => { item.text += "not ok 13 - hidden failure\n"; }
		, item => { item.text += "Error: hidden failure\n"; }
		, item => { item.text = item.text.replace("ok 1 -", "not ok 1 -"); }
		, item => { item.text = item.text.replace("# pass 12", "# pass 11"); }
		, item => { item.text = item.text.replace("# fail 0", "# fail 1"); }
		, item => { item.text = item.text.replace("# skipped 0", "# skipped 1"); }
		, item => { item.text = item.text.replace("1..12", "1..11"); }
		, item => { item.text = item.text.replace("ACTUAL_NPM_EXIT=0", "ACTUAL_NPM_EXIT=143"); }
		, item => { item.text = item.text.replace("ACTUAL_TEE_EXIT=0\n", ""); }
		, item => { item.text = item.text.replace("TAP version 13", "TAP version 13\n# fail 1"); }
		, item => { item.text = item.text.replace("8.2.33 NTS: 68", "8.5.10 NTS: 68"); }
		, item => { item.text = item.text.replace("68 actual Lean", "67 actual Lean"); }
		, item => { item.text = item.text.replace("duration_ms: 17331.410333", "duration_ms: NaN"); }
		, item => { item.text = item.text.replace("duration_ms: 17331.410333", "duration_ms: 9007199254740992.0"); }
		, item => { item.text = item.text.replace("duration_ms: 17331.410333", "duration_ms: 0.0"); }
		, item => { item.text = item.text.slice(1); }
		, item => { item.text = item.text.trimEnd(); }
		, item => { item.text = item.text.replace('"nativeFunctions":0', '"nativeFunctions":1'); }
	];
	for(const [index, change] of changes.entries())
	{
		const forged = structuredClone(archive.execution); change(forged);
		if(index >= 6) resealLog(forged);
		await assert.rejects(() => assertOwnedPhpCallbackRuntimeLog(forged, reports));
	}
	t.diagnostic(`${changes.length} terminal forgeries rejected after resealing changed log bytes.`);
});

test("staged PHP archive reader rejects schema, source-history and compressed substitutions", async t => {
	const { archive, reports } = await readOwnedPhpCallbackStaged();
	const first = ownedPhpCallbackReportNames[0];
	const changes = [
		item => { item.schemaVersion = 2; }
		, item => { item.kind = "accepted"; }
		, item => { item.acceptance = true; }
		, item => { item.sourceCheckpoint = "0".repeat(40); }
		, item => { item.sourceHistory.sha256 = wrong; }
		, item => { item.sourceHistory.path = "other.json"; }
		, item => { item.sourceHistory.extra = true; }
		, item => { delete item.reports[first]; }
		, item => { item.reports["extra.json"] = item.reports[first]; }
		, item => { item.reports[first].extra = true; }
		, item => { item.reports[first].bytes = Number.MAX_SAFE_INTEGER + 1; }
		, item => { item.reports[first].bytes++; }
		, item => { item.reports[first].sha256 = wrong; }
		, item => { item.reports[first].gzipBase64 += "\n"; }
		, item => { item.reports[first].gzipBase64 = "AAAA"; }
		, item => {
			const forged = structuredClone(reports[first]); forged.observed.live = 1; resealObserved(forged);
			item.reports[first] = repack(forged);
		}
		, item => { item.reports[first] = item.reports[ownedPhpCallbackReportNames[1]]; }
		, item => { item.execution.text += "# fail 1\n"; resealLog(item.execution); }
	];
	for(const change of changes)
	{
		const forged = structuredClone(archive); change(forged);
		await assert.rejects(() => assertOwnedPhpCallbackStaged(forged));
	}
	t.diagnostic(`${changes.length} archive forgeries rejected; no installed-package or support status inferred.`);
});
