/**
 * Current collection and documentation evidence preserves every historical receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { beforeCurrentCollectionVerification } from "./helpers/current-collection-evidence.mjs";
import { beforeCurrentPhpGraphVerification } from "./helpers/current-php-graph-evidence.mjs";
import { assertAdditiveRecursiveHistory, assertRecursiveDocumentationRecord, assertRecursiveDocumentationSource, reverseRecursiveDocumentation } from "./helpers/recursive-documentation-history.mjs";
import { assertPhpFamilyRegressionEvidence } from "./helpers/php-installed-regressions.mjs";
import { assertDotnetFamilyRegressionEvidence } from "./helpers/dotnet-installed-regressions.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";
import { beforeRecursiveAcceptance, recursiveAcceptanceRecord, reverseAcceptanceUpdate } from "./helpers/recursive-acceptance-updates.mjs";
import { assertRecursiveManagedAcceptance, assertRecursiveManagedAcceptanceIndex } from "./helpers/recursive-managed-acceptance.mjs";

const documentPath = "docs/evidence/recursive-documentation-updates-20260924.json";
const receipt = async () => JSON.parse(await readFile(documentPath));

test("recursive documentation changes retain original documents and all prior registration steps", async () => {
	const record = await receipt();
	await assertRecursiveDocumentationRecord(record);
	for(const [path, update] of Object.entries(record.files))
		assert.equal(await assertRecursiveDocumentationSource(path, await readFile(path, "utf8"), update.previousSha256), true);
	assert.equal(await assertRecursiveDocumentationSource(record.lineage.path, await readFile(record.lineage.path, "utf8"), record.lineage.previousSha256), true);
	assert.equal(await assertRecursiveDocumentationSource("src/build/native-project.mjs", "", "0".repeat(64)), false);
});

test("documentation verification rejects unrelated edits, unknown predecessors and altered history", async () => {
	const record = await receipt(), path = "docs/consume/dotnet.md", source = await readFile(path, "utf8");
	assert.throws(() => reverseRecursiveDocumentation(source + "\nunreviewed\n", record.files[path]));
	for(const mutate of [
		r => { r.previousSha256 = "0".repeat(64); }
		, r => { r.edits[0].previous += "unreviewed"; }
		, r => { r.edits.push(r.edits[0]); }
		, r => { r.edits = []; }
	]) {
		const update = structuredClone(record.files[path]); mutate(update);
		assert.throws(() => reverseRecursiveDocumentation(source, update));
	}
	await assert.rejects(() => assertRecursiveDocumentationSource(path, source, "0".repeat(64)), /Unknown documentation predecessor/);
	const original = JSON.parse(record.lineage.previousText);
	for(const mutate of [
		r => { r.registrationUpdates.pop(); }
		, r => { r.sourceRegistrationUpdates.pop(); }
		, r => { r.registrationUpdates.push(r.registrationUpdates[0]); }
		, r => { r.historicalReceipts["kotlin-collections-20260922"].receiptSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertAdditiveRecursiveHistory(JSON.stringify(changed), record.lineage.previousText));
	}
});

test("five recursive profiles have original installed evidence on both paths without promoting callable payloads", async () => {
	const record = recursiveAcceptanceRecord();
	await assertRecursiveManagedAcceptance(record);
	for(const mutate of [
		r => { r.profiles.pop(); }
		, r => { r.profiles.push("wit-wasi"); }
		, r => { r.positions.push("callback-result"); }
		, r => { r.paths.pop(); }
		, r => { r.acceptedCells++; }
		, r => { r.finalAcceptance = true; }
		, r => { delete r.sources.shared; }
		, r => { r.sources.php.sha256 = "0".repeat(64); }
		, r => { r.artifacts.pop(); }
		, r => { r.artifacts[0].sha256 = "0".repeat(64); }
		, r => { r.updates[0].previousSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertRecursiveManagedAcceptanceIndex(changed));
	}
});

test("acceptance table updates retain executed examples and reject unrelated source changes", async () => {
	for(const update of recursiveAcceptanceRecord().updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseAcceptanceUpdate(source, update)), update.previousSha256);
		assert.throws(() => reverseAcceptanceUpdate(source + "\nunreviewed\n", update));
		assert.throws(() => reverseAcceptanceUpdate(source, { ...update, edits: [] }));
		assert.throws(() => reverseAcceptanceUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
		assert.throws(() => beforeRecursiveAcceptance(update.path, source, "0".repeat(64)));
	}
	const update = recursiveAcceptanceRecord().updates[0];
	const source = await readFile(update.path, "utf8");
	assert.throws(() => reverseAcceptanceUpdate(source, { ...update, path: "src/build/native-project.mjs" }));
});

test("collection and Composer checker upgrades retain their complete previous test bodies", async () => {
	const history = JSON.parse(await readFile("docs/evidence/recursive-npm-source-lineage-20260922.json"));
	for(const [path, expected, restore] of [
		["tests/kotlin-collection-evidence.test.mjs", history.historicalReceipts["kotlin-collections-20260922"].sources["tests/kotlin-collection-evidence.test.mjs"].currentSha256, source => beforeCurrentCollectionVerification("tests/kotlin-collection-evidence.test.mjs", source)]
		, ["tests/php-wasm-collection-evidence.test.mjs", JSON.parse(await readFile("docs/evidence/php-wasm-collections-20260922.json")).sourceHashes["tests/php-wasm-collection-evidence.test.mjs"], source => beforeCurrentCollectionVerification("tests/php-wasm-collection-evidence.test.mjs", source)]
		, ["tests/php-graph-package.test.mjs", JSON.parse(await readFile("docs/evidence/php-recursive-packages-20260923.json")).sourceHashes["tests/php-graph-package.test.mjs"], beforeCurrentPhpGraphVerification]
	]) {
		const source = await readFile(path, "utf8");
		assert.equal(sha256(restore(source)), expected, path);
		assert.notEqual(sha256(restore(source + "\n// unrelated\n")), expected, path);
		assert.throws(() => restore(source + source), /Exactly one/);
	}
});

test("current PHP family evidence preserves every public result and failure probe on both source paths", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-current-family-regressions-20260924.json"));
	await assertPhpFamilyRegressionEvidence(record);
	for(const mutate of [
		r => { delete r.runs.lists; }
		, r => { delete r.sourceHashes["src/build/native-php-artifacts.mjs"]; }
		, r => { r.sourceHashes["src/release/native-composer.mjs"] = "0".repeat(64); }
		, r => { r.runs.aliases.reports.pop(); }
		, r => { r.runs.variants.reports[0].php.executions.pop(); }
		, r => { r.runs.collections.reports[0].php.executions[0].observation.checks--; }
		, r => { r.runs.lists.reports[1].faults.failures--; }
		, r => { r.runs.variants.reports[0].nativeFaults.allocationFailures--; }
		, r => { r.runs.callables.reports[0].php.consumerSources.weak = "0".repeat(64); }
		, r => { r.runs.compounds.reports[1].sourceTreeSha256 = "0".repeat(64); }
		, r => { r.runs.aliases.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, r => { r.runs.collections.reports[0].php.offline = false; }
		, r => { r.runs.lists.reports[1].sourceRemovedBeforeInstallation = false; }
		, r => { r.log.text = r.log.text.replace("# skipped 0", "# skipped 1"); r.log.sha256 = sha256(r.log.text); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		changed.runsSha256 = sha256(canonicalJson(changed.runs));
		await assert.rejects(() => assertPhpFamilyRegressionEvidence(changed));
	}
});

test("support inventory source updates require their compiled regressions or exact administrative transitions", async () => {
	const record = JSON.parse(await readFile("docs/evidence/structured-source-refresh-20260924.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "verified-source-inventory-refresh"); assert.equal(record.finalAcceptance, false);
	assert.equal(new Set(record.entries.map(item => item.path)).size, record.entries.length);
	const proofs = {};
	for(const [name, reference] of Object.entries(record.proofs))
	{
		const bytes = await readFile(reference.path); assert.equal(sha256(bytes), reference.sha256);
		proofs[name] = JSON.parse(bytes);
	}
	await assertDotnetFamilyRegressionEvidence(proofs.dotnet);
	await assertPhpFamilyRegressionEvidence(proofs.php);
	const inventory = JSON.parse(await readFile("docs/type-surface.v1.json"));
	for(const entry of record.entries)
	{
		const currentSource = await readFile(entry.path, "utf8");
		const source = beforeRecursiveAcceptance(entry.path, currentSource, entry.currentSha256);
		assert.equal(sha256(source), entry.currentSha256, entry.path);
		assert.ok(inventory.evidence.some(e => e.files.some(f => f.path === entry.path && f.sha256 === sha256(currentSource))), entry.path);
		if(entry.verification === "dotnet-family-regressions")
		{
			assert.equal(record.dotnetPredecessors[entry.path].sha256, entry.previousSha256);
			assert.equal(sha256(record.dotnetPredecessors[entry.path].text), entry.previousSha256);
			assert.equal(proofs.dotnet.sourceHashes[entry.path], entry.currentSha256);
		}
		else if(entry.verification === "php-family-regressions")
		{
			assert.equal(proofs.php.predecessorSources[entry.path].sha256, entry.previousSha256);
			assert.equal(proofs.php.sourceHashes[entry.path], entry.currentSha256);
		}
		else if(entry.verification === "exact-collection-checker-upgrade")
			assert.equal(sha256(beforeCurrentCollectionVerification(entry.path, source)), entry.previousSha256);
		else if(entry.verification === "reviewed-documentation")
			assert.equal(await assertRecursiveDocumentationSource(entry.path, source, entry.previousSha256), true);
		else
		{
			assert.equal(entry.verification, "administrative");
			await assertAdministrativeSourceUpdate(entry.path, entry.previousSha256);
		}
	}
});
