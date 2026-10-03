/**
 * Verify retained direct WIT executions and reject coordinated report alterations.
 * These tests read existing evidence and never build Lean or Wasmtime fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedWitCallbackRuntime, assertOwnedWitCallbackRuntimeMatrix
	, assertOwnedWitCallbackRuntimeLogs, ownedWitCallbackRuntimeReports
	, ownedWitCallbackRuntimeLogs, ownedWitCallbackRuntimeSourcePaths } from "./helpers/wit-owned-callback-result-runtime-evidence.mjs";

const options = { skip: process.env.LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_RUNTIME_TEST !== "1", timeout: 300000 };
const originals = async () => Object.fromEntries(await Promise.all(ownedWitCallbackRuntimeReports
	.map(async name => [name, JSON.parse(await readFile(`build/owned-wit-callback-results/${name}`, "utf8"))])));
const logRoot = resolve(process.env.LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_LOG_ROOT ?? "build");
const logs = async () => Object.fromEntries(await Promise.all(ownedWitCallbackRuntimeLogs
	.map(async name => [name, await readFile(join(logRoot, name), "utf8")])));
const zero = "0".repeat(64);
const coordinate = (item, change) => {
	const [result, counts] = item.execution.stdout.trim().split("\n").map(JSON.parse);
	change(result, counts); item.result = result; item.counts = counts;
	item.execution.stdout = JSON.stringify(result) + "\n" + JSON.stringify(counts) + "\n";
};

test("WIT callback runtime evidence reconstructs six reports and three exact selected TAP logs", options, async t => {
	const reports = await originals(), selected = await logs();
	await assertOwnedWitCallbackRuntimeMatrix(reports);
	assertOwnedWitCallbackRuntimeLogs(selected, reports);
	t.diagnostic(JSON.stringify({ reports: 6, selectedLogs: 3, cases: 6, installedPackageClaims: 0 }));
});

test("WIT callback runtime evidence rejects altered contracts, sources, masks and raw observations", options, async t => {
	let rejected = 0;
	for(const [name, original] of Object.entries(await originals()))
	{
		const changes = [
			...["schemaVersion", "mode", "variant", "sourceSha256", "observedSourceSha256", "probeSha256", "componentSha256"]
				.map(key => item => { item[key] = key.endsWith("Sha256") ? zero : "forged"; })
			, ...Object.keys(original).map(key => item => { delete item[key]; })
			, item => { item.installedPackage = true; }
			, item => { item.input.extra = true; }
			, item => { item.input.component.name = "substitute"; }
			, ...["hostCallbacks", "callbackResultAnchors", "transferredInputs", "anchoredResults", "receiverExports"]
				.map(key => item => { item.input[key] = !item.input[key]; })
			, item => { delete item.input.callbackResultAnchors; }
			, item => { item.input.metadata.diagnostics.push({ message: "forged" }); }
			, item => { item.input.sourceIdentity.sourceTreeSha256 = zero; }
			, item => { item.input.sourceIdentity.leanCompilerSha256 = zero; }
			, item => { item.input.sourceIdentity.leanCommit = "0".repeat(40); }
			, item => { item.input.sourceIdentity.extractorSha256 = zero; }
			, item => { item.input.sourceIdentity.modules[0].interface.sha256 = zero; }
			, item => { item.input.sourceIdentity.exportConfigurationSource = "{}\n"; }
			, item => { item.input.sourceIdentity.extra = true; }
			, item => { item.native.schemaVersion--; }
			, item => { item.native.ownedGraph.schemaVersion--; }
			, item => { delete item.native.ownedGraph.callbackResultAnchors; }
			, item => { item.manifest.graph.schemaVersion--; }
			, item => { delete item.manifest.graph.callbackResultAnchors; }
			, item => { item.manifest.graph.callbackResultAnchors[0].parameter++; }
			, item => { item.manifest.graph.callbackResultAnchors[0].id += "-forged"; }
			, item => { item.ownedValues.schemaVersion--; }
			, item => { delete item.ownedValues.callbackResultAnchors; }
			, item => { item.ownedValues.callbackResultAnchors.extra = true; }
			, item => { item.ownedValues.headerSha256 = zero; }
			, item => { item.ownedValues.sourceSha256 = zero; }
			, item => { item.input.callbackResultAnchors = false; delete item.native.ownedGraph.callbackResultAnchors;
				delete item.manifest.graph.callbackResultAnchors; delete item.ownedValues.callbackResultAnchors;
				item.native.schemaVersion--; item.native.ownedGraph.schemaVersion--; item.manifest.graph.schemaVersion--; item.ownedValues.schemaVersion--; }
			, item => { const bytes = Buffer.from(item.componentBase64, "base64"); bytes[bytes.length - 1] ^= 1;
				item.componentBase64 = bytes.toString("base64"); item.componentSha256 = sha256(bytes); }
			, item => { item.componentBase64 += "\n"; }
			, ...["expectedExports", "expectedClosures", "observedExports", "observedClosures"]
				.flatMap(key => [item => { item[key].pop(); }, item => { item[key].reverse(); }, item => { item[key].push(item[key][0]); }])
			, ...Object.keys(original.result).map(key => item => coordinate(item, result => { result[key]++; }))
			, ...Object.keys(original.counts).map(key => item => coordinate(item, (result, counts) => { counts[key]++; }))
			, item => coordinate(item, result => { result.allocationFailures = 0; })
			, item => coordinate(item, (result, counts) => { counts.componentCalls = counts.nativeImports = counts.leanCalls; })
			, item => coordinate(item, (result, counts) => { counts.exportMask += 2 ** 40; counts.closureMask += 2 ** 40; })
			, item => coordinate(item, (result, counts) => { counts.closureCalls = 0; counts.closureMask = 0;
				item.expectedClosures = []; item.observedClosures = []; })
			, item => { item.execution.code = 1; }
			, item => { item.execution.stderr = "unexpected runtime diagnostic\n"; }
			, item => { item.execution.extra = true; }
			, item => { item.execution.stdout += "{}\n"; }
			, item => { item.execution.stdout = item.execution.stdout.replace("\n", "\r\n"); }
			, item => { item.execution.stdout = item.execution.stdout.trim(); }
			, item => { item.execution.stdout = JSON.stringify(item.result, null, 2) + "\n" + JSON.stringify(item.counts) + "\n"; }
			, item => { item.freeBytesBefore = 2 * 1024 ** 3; }
			, item => { item.freeBytesAfterExecution = -1; }
			, item => { item.wasmTools.stdout = "wasm-tools 1.244.0\n"; }
			, item => { item.wasmTools.code = 1; }
			, item => { item.wasmtime["lib/libwasmtime.so"].sha256 = zero; }
			, item => { delete item.wasmtime["lib/libwasmtime.so"]; }
			, item => { item.wasmtime["lib/unverified.so"] = { bytes: 1, sha256: zero }; }
			, item => { item.validation.pop(); }
			, item => { item.validation.reverse(); }
			, ...[0, 1, 2, 3].flatMap(index => [
				item => { item.validation[index].code = 1; }
				, item => { item.validation[index].stderr = "failed"; }
				, item => { item.validation[index].stdout += "\n"; }
				, item => { item.validation[index].args.push("--forged"); }
				, item => { item.validation[index].extra = true; }
			])
		];
		for(const change of changes)
		{
			const altered = structuredClone(original); change(altered);
			await assert.rejects(assertOwnedWitCallbackRuntime(name, altered), `${name}: ${change}`); rejected++;
		}
	}
	assert.equal(rejected, 756);
	t.diagnostic(JSON.stringify({ reports: 6, rejected }));
});

test("WIT callback runtime evidence rejects omitted cases and forged selected TAP streams", options, async t => {
	const reports = await originals(), selected = await logs(); let rejected = 0;
	for(const name of ownedWitCallbackRuntimeReports)
	{
		const missing = structuredClone(reports); delete missing[name];
		await assert.rejects(assertOwnedWitCallbackRuntimeMatrix(missing)); rejected++;
		const mislabeled = structuredClone(reports); mislabeled[name] = reports[ownedWitCallbackRuntimeReports[(ownedWitCallbackRuntimeReports.indexOf(name) + 1) % 6]];
		await assert.rejects(assertOwnedWitCallbackRuntimeMatrix(mislabeled)); rejected++;
	}
	const extra = { ...reports, "ordinary-no-host-failure.json": reports[ownedWitCallbackRuntimeReports[0]] };
	await assert.rejects(assertOwnedWitCallbackRuntimeMatrix(extra)); rejected++;
	for(const name of ownedWitCallbackRuntimeLogs)
	{
		const missing = { ...selected }; delete missing[name];
		assert.throws(() => assertOwnedWitCallbackRuntimeLogs(missing, reports)); rejected++;
		const changes = [
			text => text.replace("TAP version 13", "TAP version 12")
			, text => text.replace("ok 1 -", "not ok 1 -")
			, text => text.replace("  ---", "# SKIP\n  ---")
			, text => text.replace("  ---", "# TODO\n  ---")
			, text => text.replace("# tests 1", "# tests 2")
			, text => text.replace("# pass 1", "# pass 0")
			, text => text.replace("# fail 0", "# fail 1")
			, text => text.replace("# skipped 0", "# skipped 1")
			, text => text.replace("# todo 0", "# todo 1")
			, text => text.replace("# cancelled 0", "# cancelled 1")
			, text => text.replace("1..1", "1..0")
			, text => text.replace('"live":0', '"live":1')
			, text => text.replace('"closureMask":62', '"closureMask":63')
			, text => text.replace(/duration_ms: [0-9.]+/u, "duration_ms: -1")
			, text => text.replace(/duration_ms: [0-9.]+/u, "duration_ms: 1")
			, text => text.replace("  type: 'test'\n", "")
			, text => text.replace("\n", "\r\n")
			, text => text.trim()
			, text => text + "not ok 2 - unrelated failure\n"
			, text => text + text
			, text => "unverified prelude\n" + text
		];
		if(name.includes("remaining")) changes.push(
			text => text.replace("WIT_CASE_EXIT=0", "WIT_CASE_EXIT=1")
			, text => text.replace(/WIT_CASE_EXIT=0 CASE=[^\n]+\n/u, "")
			, text => text.split(/(?=TAP version 13)/u).reverse().join("")
			, text => text.split(/(?=TAP version 13)/u).slice(1).join("")
			, text => text + text.split(/(?=TAP version 13)/u)[0]
		);
		for(const change of changes)
		{
			const altered = { ...selected, [name]: change(selected[name]) };
			assert.throws(() => assertOwnedWitCallbackRuntimeLogs(altered, reports), String(change)); rejected++;
		}
	}
	for(const name of ["wit-callback-runtime-ordinary-no-host-r1.log", "wit-callback-runtime-remaining-r1.log"])
	{
		// Synthetic failed-run content, not an additional execution claim.
		const diagnostic = selected[ownedWitCallbackRuntimeLogs[0]].replace("ok 1 -", "not ok 1 -");
		assert.throws(() => assertOwnedWitCallbackRuntimeLogs({ ...selected, [name]: diagnostic }, reports)); rejected++;
		assert.throws(() => assertOwnedWitCallbackRuntimeLogs({ ...selected, [ownedWitCallbackRuntimeLogs[0]]: diagnostic }, reports)); rejected++;
	}
	assert.equal(rejected, 88);
	t.diagnostic(JSON.stringify({ rejected }));
});

test("WIT callback runtime evidence reads only injected repository fixtures and rejects changed source bytes", options, async t => {
	const reports = await originals();
	const sources = new Map(await Promise.all(ownedWitCallbackRuntimeSourcePaths.map(async path => [path, await readFile(path)])));
	const seen = new Set(), readSource = async (path, encoding) => {
		assert.ok(sources.has(path), path); seen.add(path);
		return encoding ? sources.get(path).toString(encoding) : sources.get(path);
	};
	await assertOwnedWitCallbackRuntimeMatrix(reports, readSource);
	assert.deepEqual([...seen].sort(), [...ownedWitCallbackRuntimeSourcePaths].sort());
	let rejected = 0;
	for(const path of ownedWitCallbackRuntimeSourcePaths)
	{
		const changed = async (name, encoding) => {
			const value = await readSource(name, encoding);
			return name === path ? encoding ? value + "\n" : Buffer.concat([value, Buffer.from("\n")]) : value;
		};
		await assert.rejects(assertOwnedWitCallbackRuntime("ordinary-combined.json", reports["ordinary-combined.json"], changed)); rejected++;
	}
	assert.equal(rejected, 5);
	t.diagnostic(JSON.stringify({ injectedSources: seen.size, rejected }));
});
