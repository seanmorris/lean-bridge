/**
 * Authenticate inherited-record coverage without extending unmeasured hosts or source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertInheritedRecordArchive } from "./inherited-record-evidence.mjs";
import { beforeInheritedRecordPromotionSource, inheritedRecordPromotionChangedPaths, inheritedRecordPromotionHistoryPath, inheritedRecordPromotionPredecessor, reverseInheritedRecordPromotionUpdate } from "./inherited-record-promotion-source-history.mjs";
import { inheritedRecordEvidenceIds, inheritedRecordPromotedCells, inheritedRecordPromotedEvidence, inheritedRecordReceiptPath, reconcileInheritedRecordObservations } from "./inherited-record-promotion.mjs";

test("inherited record promotion authenticates exact predecessors and rejects unrecorded source edits", async () => {
	const history = JSON.parse(await readFile(inheritedRecordPromotionHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1); assert.equal(history.milestone, "inherited-record-promotion-v1");
	assert.equal(history.predecessorCommit, inheritedRecordPromotionPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), inheritedRecordPromotionChangedPaths);
	for(const update of history.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseInheritedRecordPromotionUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeInheritedRecordPromotionSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeInheritedRecordPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeInheritedRecordPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseInheritedRecordPromotionUpdate(changed, update));
		assert.throws(() => reverseInheritedRecordPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseInheritedRecordPromotionUpdate(source, { ...update, path: "unregistered.mjs" }));
		assert.throws(() => reverseInheritedRecordPromotionUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("inherited record reconciliation changes exactly fourteen scopes without changing stage states", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const path = "docs/type-surface.v1.json";
	const previous = JSON.parse(beforeInheritedRecordPromotionSource(path, await readFile(path, "utf8")));
	assert.deepEqual(document.observations, reconcileInheritedRecordObservations(previous.observations));
	const before = typeSurfaceCells(previous, contracts), after = typeSurfaceCells(document, contracts);
	const changed = [];
	assert.equal(after.length, 6732); assert.equal(before.length, after.length);
	for(const [index, cell] of after.entries())
	{
		const prior = before[index];
		assert.equal(cell.id, prior.id);
		if(!inheritedRecordPromotedCells.includes(cell.id))
		{ assert.deepEqual(cell, prior, cell.id); continue; }
		changed.push(cell.id);
		assert.ok(cell.scope.startsWith(prior.scope));
		const ids = cell.shape === "fin" ? [inheritedRecordEvidenceIds.plain]
			: ["c", "cpp"].includes(cell.profile) ? [inheritedRecordEvidenceIds.plain, inheritedRecordEvidenceIds.native]
				: [inheritedRecordEvidenceIds.npm];
		for(const [stage, value] of Object.entries(cell.stages))
		{
			assert.equal(value.state, prior.stages[stage].state); assert.equal(value.state, "passed");
			assert.deepEqual(value.evidence, [...prior.stages[stage].evidence, ...ids]);
		}
		if(cell.shape === "record")
		{
			assert.match(cell.limitations.join(" "), /No browser, reviewed-inheritance, configured inherited-record function specialization, instance dictionary/u);
			assert.match(cell.scope, /direct exports/u);
			if(["node-javascript", "node-typescript"].includes(cell.profile))
				assert.match(cell.limitations.join(" "), /No dependent or recursive records, variants or List promotion in these Node record cells/u);
		}
		else assert.match(cell.scope, /Fin 10 field inside a parent/u);
	}
	assert.deepEqual(changed.sort(), [...inheritedRecordPromotedCells].sort());
	assert.equal(changed.length, 14);
	const history = JSON.parse(await readFile(inheritedRecordPromotionHistoryPath, "utf8"));
	const updates = new Map(history.updates.map(update => [update.path, update]));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(update && file.sha256 === update.previousSha256) file.sha256 = update.currentSha256;
	}
	assert.deepEqual(document.evidence.slice(0, previous.evidence.length), previous.evidence);
	assert.deepEqual(document.evidence.slice(previous.evidence.length), await inheritedRecordPromotedEvidence());
	for(const key of Object.keys(previous).filter(key => !["observations", "evidence"].includes(key)))
		assert.deepEqual(document[key], previous[key]);
	assert.equal(document.observations.length, previous.observations.length + 3);
	assert.equal(document.evidence.length, previous.evidence.length + 3);
});

test("inherited record evidence preserves original producer identities, selectors and scope limits", async () => {
	const bytes = await readFile(inheritedRecordReceiptPath), receipt = JSON.parse(bytes);
	assert.equal(sha256(bytes), "ebca0e21cecc65b708b8cce1c7999932d7934287085a8291e52022ec2c0883c9");
	await assertInheritedRecordArchive(receipt);
	const { document } = await readTypeSurface();
	for(const [kind, id] of Object.entries(inheritedRecordEvidenceIds))
	{
		const entry = document.evidence.find(item => item.id === id);
		assert.equal(entry.revision, receipt.producers[kind === "plain" ? "plain" : "generic"].revision);
		assert.equal(entry.artifacts.length, 2);
		assert.match(entry.scope, /fresh-Lean log has no original queue or execution-revision record/u);
		assert.match(entry.scope, /Selected producer pins are recovered from Git, not a complete dependency closure/u);
		assert.match(entry.scope, /No inherited-record function specialization, instance dictionary, browser, reviewed-inheritance, hosted CI, source-entry counter or sanitizer claim/u);
		assert.match(entry.scope, /Binary package hashes are retained, not the packages/u);
		const source = await readFile(kind === "plain" ? "tests/inherited-records.test.mjs" : "tests/generic-inheritance-installed.test.mjs", "utf8");
		const pattern = /--test-name-pattern='([^']+)'/u.exec(entry.command);
		assert.ok(pattern);
		const selected = [...source.matchAll(/^test\("([^"]+)"/gmu)].map(match => match[1]).filter(name => new RegExp(pattern[1], "u").test(name));
		assert.equal(selected.length, 1);
		assert.match(selected[0], kind === "npm" ? /npm/u : /C and C\+\+/u);
		assert.match(entry.command, kind === "npm" ? /LEAN_BRIDGE_GENERIC_INHERITANCE_NPM_TEST=1/u
			: kind === "native" ? /LEAN_BRIDGE_GENERIC_INHERITANCE_PROFILES=c,cpp/u : /LEAN_BRIDGE_INHERITED_RECORD_PROFILES=c,cpp/u);
	}
});

test("inherited record promotion rejects duplicate, redirected, broadened or unpassed baseline observations", async () => {
	const path = "docs/type-surface.v1.json", previous = JSON.parse(beforeInheritedRecordPromotionSource(path, await readFile(path, "utf8")));
	for(const mutate of [
		values => { values.find(item => item.id === "native-c-copied").shapes.push("fin"); }
		, values => { values.find(item => item.id === "native-c-copied").profiles.push("ruby"); }
		, values => { values.find(item => item.id === "npm-records-ordinary-source").path = "reviewed-ir"; }
		, values => { values.find(item => item.id === "npm-records-ordinary-source").positions.push("signature"); }
		, values => { values.find(item => item.id === "npm-records-ordinary-source").stages.installedExecution.state = "unverified"; }
		, values => { values.find(item => item.id === "native-nominal-fin-c-family-ordinary-source").profiles.push("ruby"); }
		, values => { values.push({ id: "native-c-copied-inherited" }); }
	]){
		const changed = structuredClone(previous.observations);
		mutate(changed);
		assert.throws(() => reconcileInheritedRecordObservations(changed));
	}
});

test("consumer and author inheritance guides name nested parents and the installed acceptance scope", async () => {
	for(const path of ["docs/javascript-typescript.md", "docs/consume/c.md", "docs/consume/cpp.md", "docs/lean/existing-package.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("evidence/inherited-records-20261008/receipt.json"), path);
		assert.match(source, /toBase|to_base/u);
		assert.match(source, /ordinary-source/u);
	}
	const js = await readFile("docs/javascript-typescript.md", "utf8");
	assert.ok(js.includes("api.grow({ toBase: { base: 4n }, child: 7n })"));
	assert.ok(js.includes("skipLibCheck: false"));
	assert.match(js, /not browser, React, worker, reviewed-inheritance or\nconfigured function-specialization acceptance/u);
	const cpp = await readFile("docs/consume/cpp.md", "utf8");
	assert.ok(cpp.includes("const api::NatChild child{api::NatBase{4}, 7};"));
	const c = await readFile("docs/consume/c.md", "utf8");
	assert.ok(c.includes("mpz_set_ui(child.to_base.base, 4);"));
});

test("the inherited record promotion updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-record-promotion-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-inherited-record-promotion-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Inherited record promotion history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
