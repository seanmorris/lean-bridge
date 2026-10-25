/**
 * Build an independently owned peer with the same Lean declarations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { readVerifiedPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { readVerifiedPhpWasmCopiedPackageSet } from "../../src/release/php-wasm-copied-package.mjs";
import { ownedCheckedRecordFixture } from "./owned-checked-record-fixture.mjs";
import { ownedCheckedRecordMixedSelection } from "./owned-checked-record-mixed-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { bindPhpWasmReceiptArchives } from "./php-wasm-graph-packages.mjs";
import { retainPackageSetEvidence } from "./package-set.mjs";

export const ownedCheckedRecordPhpWasmPeerName = "@lean-bridge-test/owned-checked-record-peer";

/**
 * Keep the peer result-only; its owners come from compiled Lean in both modes.
 *
 * @param reviewed - Select the independently reviewed source route.
 */
export const ownedCheckedRecordPhpWasmPeerSelection = reviewed => {
	assert.equal(typeof reviewed, "boolean");
	const selected = structuredClone(ownedCheckedRecordMixedSelection(
		`${reviewed ? "reviewed" : "ordinary"}-result-only`));
	selected.reviewedIr.component = { id: "owned-checked-records-peer@1.0.0"
		, name: "owned-checked-records-peer", version: "1.0.0" };
	selected.configuration.targets = { "php-wasm": { hostCallbacks: false
		, npm: { name: ownedCheckedRecordPhpWasmPeerName, version: "1.0.0" }
		, composer: { name: "lean-bridge-test/owned-checked-record-peer", version: "1.0.0" } } };
	return selected;
};

/**
 * Retain original peer archives before the caller removes all author sources.
 *
 * @param options - Author root, retained handoff, source route and installed CLI.
 * @param options.author - Test-owned author directory.
 * @param options.handoff - Receipt-only retained archive directory.
 * @param options.reviewed - Select the reviewed author route.
 * @param options.cli - Installed standalone CLI commands.
 * @param options.runtimeIdentity - Verified runtime digest.
 */
export const buildOwnedCheckedRecordPhpWasmPeer = async ({ author, handoff, reviewed, cli, runtimeIdentity }) => {
	const project = join(author, "checked-peer-source");
	const built = join(author, "checked-peer-built");
	const selected = ownedCheckedRecordPhpWasmPeerSelection(reviewed);
	for(const path of ["OwnedCheckedRecords.lean", "lean-toolchain", "lakefile.toml"])
	{
		let source = await readFile(join(ownedCheckedRecordFixture, path), "utf8");
		if(path === "lakefile.toml") source = source.replace('name = "owned-checked-records"', 'name = "owned-checked-records-peer"');
		await saveLakeFile(project, path, source);
	}
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(selected.configuration));
	if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(selected.reviewedIr));
	const before = await lakeInputState(project);
	const cliBuild = await cli.build(project, built);
	assert.deepEqual(await lakeInputState(project), before);
	const component = await readVerifiedPhpWasmCopiedComponent(join(built, "php-wasm/component"), runtimeIdentity);
	assert.equal(component.model.component.name, "owned-checked-records-peer");
	assert.equal(component.model.exports.length, 3);
	assert.equal(component.model.ownedGraph.hostCallbacks, undefined);
	assert.equal(component.model.ownedGraph.inputTransfers, undefined);
	const release = { output: join(built, "packages/php-wasm")
		, ...await readVerifiedPhpWasmCopiedPackageSet(join(built, "packages/php-wasm")) };
	const relocated = join(author, "checked-peer-relocated"), rebuilt = join(author, "checked-peer-rebuilt");
	await cp(project, relocated, { recursive: true });
	const relocatedBefore = await lakeInputState(relocated);
	const repeatedCliBuild = await cli.build(relocated, rebuilt);
	assert.deepEqual(await lakeInputState(project), before);
	assert.deepEqual(await lakeInputState(relocated), relocatedBefore);
	const repeated = await readVerifiedPhpWasmCopiedPackageSet(join(rebuilt, "packages/php-wasm"));
	assert.deepEqual(repeated.report, release.report);
	const retained = await retainPackageSetEvidence(built, handoff);
	const archiveRoot = await bindPhpWasmReceiptArchives(handoff, release.report);
	return { release: { ...release, archiveRoot }
		, observation: { reviewed, model: component.model, receipt: component.receipt
			, packageSetReceipt: retained.receipt, packageReceipt: release.report
			, reproducedArchives: repeated.report.archives, cliBuild, repeatedCliBuild
			, sourceUnchanged: true, independentlyRebuiltExactly: true } };
};
