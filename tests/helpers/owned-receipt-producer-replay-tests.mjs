/**
 * Reconstruct original owned receipts without substituting current generators.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { bytesAtProducer, typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { historicalTypeSurfaceCells } from "./historical-type-surface-cells.mjs";

const jvmReceipt = "docs/evidence/owned-jvm-execution-20260927.json";
const perlReceipt = "docs/evidence/owned-perl-callback-results-20261003.json";
const phpReceipt = "docs/evidence/owned-php-transfers-20260930.json";
const phpProducer = "7a05e2fa3186112a364df8451d16f5dfa34348c6";
const json = async path => JSON.parse(await readFile(path));

test("Owned JVM replay authenticates the original receipt, sources and Lean inputs", async () => {
	const { ownedJvmPackageProducer: producer, ownedJvmPackageProducerEntries }
		= await import("./owned-jvm-package-evidence.mjs");
	const bytes = await readFile(jvmReceipt), record = JSON.parse(bytes);
	assert.deepEqual(bytesAtProducer(producer, jvmReceipt), bytes);
	assert.equal(Object.keys(record.packages).length, 4);
	for(const [path, digest] of Object.entries(record.sources))
		assert.equal(sha256(bytesAtProducer(producer, path, digest)), digest, path);
	for(const path of ownedJvmPackageProducerEntries)
		assert.match(record.sources[path], /^[a-f0-9]{64}$/u, path);
	for(const [name, report] of Object.entries(record.packages))
	{
		const identity = report.input.sourceIdentity;
		const fixture = name.startsWith("scalars-") ? "owned-scalars" : "owned-dotnet-callables";
		assert.equal(identity.modules.length, 1);
		assert.equal(sha256(bytesAtProducer(producer
			, `tests/fixtures/onboarding/${fixture}/Owned.lean`)), identity.modules[0].source.sha256);
		assert.equal(sha256(bytesAtProducer(producer, "src/analyze/NativeExports.lean"))
			, identity.extractorSha256);
	}
});

test("Owned JVM replay reconstructs all four installed package reports", async () => {
	const { assertOwnedJvmPackageReport } = await import("./owned-jvm-package-evidence.mjs");
	for(const [name, report] of Object.entries((await json(jvmReceipt)).packages))
		await assertOwnedJvmPackageReport(report, name.startsWith("scalars-"), name.endsWith("-reviewed"));
});

test("Owned JVM replay rejects changed models, manifests and installed observations", async t => {
	const { assertOwnedJvmPackageReport } = await import("./owned-jvm-package-evidence.mjs");
	const original = (await json(jvmReceipt)).packages["callbacks-ordinary"];
	await assertOwnedJvmPackageReport(original, false, false);
	const changes = [
		report => { report.componentReceipt.modelSha256 = "0".repeat(64); }
		, report => { report.componentReceipt.adaptersSha256 = "0".repeat(64); }
		, report => { report.manifest.compiledProjectionSha256 = "0".repeat(64); }
		, report => { report.sourceRemovedBeforeInstallation = false; }
		, report => { report.observations[0].jvm.offline = false; }
		, report => { report.tamperRejections.pop(); }
	];
	for(const change of changes)
	{
		const candidate = structuredClone(original); change(candidate);
		await assert.rejects(() => assertOwnedJvmPackageReport(candidate, false, false));
	}
	t.diagnostic(`${changes.length} changed package claims rejected`);
});

test("Perl retained replay binds its original generator entries and report receipt", async () => {
	const { ownedPerlCallbackProducer: producer } = await import("./owned-perl-callback-result-history.mjs");
	const { ownedPerlCallbackProducerEntries } = await import("./owned-perl-callback-result-acceptance.mjs");
	const bytes = await readFile(perlReceipt), record = JSON.parse(bytes);
	assert.deepEqual(bytesAtProducer(producer, perlReceipt), bytes);
	assert.equal(Object.keys(record.archive.reports).length, 18);
	for(const path of ownedPerlCallbackProducerEntries)
	{
		assert.match(record.sources[path], /^[a-f0-9]{64}$/u);
		assert.equal(sha256(bytesAtProducer(producer, path, record.sources[path])), record.sources[path]);
	}
});

test("Perl retained acceptance rejects absent and forged source identities", async () => {
	const { assertOwnedPerlCallbackAcceptance } = await import("./owned-perl-callback-result-acceptance.mjs");
	const record = await json(perlReceipt);
	const path = Object.keys(record.sources)[0];
	for(const digest of [undefined, "", "0".repeat(64)])
		await assert.rejects(() => assertOwnedPerlCallbackAcceptance({
			...record, sources: { ...record.sources, [path]: digest }
		}));
});

test("Perl retained replay rejects changed source hashes and report slots", async t => {
	const { unpackOwnedCallbackReports } = await import("./owned-callback-result-evidence.mjs");
	const { assertOwnedPerlCallbackHistoricalReport: replay }
		= await import("./owned-perl-callback-result-acceptance.mjs");
	const reports = unpackOwnedCallbackReports((await json(perlReceipt)).archive);
	const path = "build/owned-perl-callback-results/ordinary-combined.json";
	const original = reports[path];
	await replay(path, original);
	const changes = [
		item => { item.nativeSourceSha256 = "0".repeat(64); }
		, item => { item.xsSha256 = "0".repeat(64); }
		, item => { item.observations[0].execution.code = 1; }
	];
	for(const change of changes)
	{
		const candidate = structuredClone(original); change(candidate);
		await assert.rejects(() => replay(path, candidate));
	}
	for(const [slot, item] of Object.entries(reports))
	{
		await assert.rejects(() => replay(slot + ".unrecorded", item));
		await assert.rejects(() => replay(slot
			, { ...item, mode: item.mode === "ordinary" ? "reviewed" : "ordinary" }));
	}
	t.diagnostic("3 changed runtime reports and 36 false slot claims rejected");
});

test("Perl retained packages authenticate copied files outside the source map", async () => {
	const { unpackOwnedCallbackReports } = await import("./owned-callback-result-evidence.mjs");
	const { ownedPerlCallbackProducer: producer } = await import("./owned-perl-callback-result-history.mjs");
	const { assertOwnedPerlCallbackHistoricalReport: replay }
		= await import("./owned-perl-callback-result-acceptance.mjs");
	const record = await json(perlReceipt);
	const path = "build/owned-perl-callback-results/ordinary-combined-package.json";
	const item = unpackOwnedCallbackReports(record.archive)[path];
	await replay(path, item);
	for(const changed of ["src/backends/perl/Platform.pm", "containers/builder/.dockerignore"])
	{
		assert.equal(Object.hasOwn(record.sources, changed), false, changed);
		let reached = false;
		await assert.rejects(() => replay(path, item, async source => {
			const bytes = bytesAtProducer(producer, source, record.sources[source]);
			if(source !== changed) return bytes;
			reached = true;
			return Buffer.concat([bytes, Buffer.from("\nunknown\n")]);
		}));
		assert.equal(reached, true, changed);
	}
});

test("Native PHP transfer callers supply every recorded history endpoint", async () => {
	const path = "tests/owned-php-transfer-evidence.test.mjs";
	const source = await readFile(path, "utf8");
	const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const calls = [];
	const names = new Set(["beforeOwnedPhpWasmTransfer", "beforeOwnedPhpTransfer"
		, "ownedPhpWasmTransferHistoricalBytes"]);
	const visit = node => {
		if(ts.isCallExpression(node) && ts.isIdentifier(node.expression)
			&& names.has(node.expression.text)) {
			calls.push(node.expression.text);
			assert.equal(node.arguments.length, 3, node.getText(tree));
			assert.notEqual(node.arguments[2].getText(tree), "undefined");
			}
		ts.forEachChild(node, visit);
	};
	visit(tree);
	assert.equal(calls.length, 10);
	assert.deepEqual([...new Set(calls)].sort(), [...names].sort());
});

test("Native PHP transfer receipt preserves all original transitions and inventory cells", async () => {
	const { reverseOwnedPhpTransferUpdate, ownedPhpTransferChangedPaths }
		= await import("./owned-php-transfer-history.mjs");
	const bytes = await readFile(phpReceipt), record = JSON.parse(bytes);
	assert.deepEqual(bytesAtProducer(phpProducer, phpReceipt), bytes);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpTransferChangedPaths);
	assert.equal(record.updates.length, 27);
	for(const update of record.updates)
	{
		const current = bytesAtProducer(phpProducer, update.path, update.currentSha256).toString();
		const previous = reverseOwnedPhpTransferUpdate(current, update);
		assert.equal(previous, bytesAtProducer(record.baselineRevision
			, update.path, update.previousSha256).toString());
		assert.throws(() => reverseOwnedPhpTransferUpdate(current + "\nunknown\n", update));
		assert.throws(() => reverseOwnedPhpTransferUpdate(current
			, { ...update, previousSha256: "0".repeat(64) }));
	}
	const path = "docs/type-surface.v1.json";
	const current = JSON.parse(bytesAtProducer(phpProducer, path, record.sources[path]));
	const previous = JSON.parse(bytesAtProducer(record.baselineRevision, path));
	const contracts = typeSurfaceContractsAtProducer(phpProducer);
	assert.deepEqual(historicalTypeSurfaceCells(current, contracts)
		, historicalTypeSurfaceCells(previous, contracts));
	for(const evidence of previous.evidence) for(const file of evidence.files)
		file.sha256 = sha256(bytesAtProducer(phpProducer, file.path
			, record.sources[file.path] ?? file.sha256));
	assert.deepEqual(current, previous);
});
