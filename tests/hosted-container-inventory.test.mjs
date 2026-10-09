/**
 * Keep hosted Python/Rust container measurements attached to their exact reports and coverage cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { beforeWasmEntryControlsSource } from "./helpers/wasm-entry-controls-source-history.mjs";
import { assertHostedContainerInventory, assertHostedContainerReferences, hostedContainerCounterScope, hostedContainerObservationIds, hostedContainerReferences, hostedContainerSelectionIds, supplementHostedContainerInventory } from "./helpers/hosted-container-inventory.mjs";
import { beforeHostedContainerInventorySource, hostedContainerInventoryChangedPaths, hostedContainerInventoryHistoryPath, hostedContainerInventoryPredecessor, reverseHostedContainerInventoryUpdate } from "./helpers/hosted-container-inventory-source-history.mjs";

const snapshot = async () => {
	const path = "docs/type-surface.v1.json", source = beforeWasmEntryControlsSource(path, await readFile(path, "utf8"));
	return { current: JSON.parse(source)
		, previous: JSON.parse(beforeHostedContainerInventorySource(path, source))
		, history: JSON.parse(await readFile(hostedContainerInventoryHistoryPath))
		, references: await hostedContainerReferences() };
};

test("hosted container inventory authenticates exact predecessors and refuses unknown history edits", async () => {
	const record = JSON.parse(await readFile(hostedContainerInventoryHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "hosted-container-inventory-v1");
	assert.equal(record.predecessorCommit, hostedContainerInventoryPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), hostedContainerInventoryChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeWasmEntryControlsSource(update.path, await readFile(update.path, "utf8")), previous = reverseHostedContainerInventoryUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeHostedContainerInventorySource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeHostedContainerInventorySource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		assert.equal(beforeHostedContainerInventorySource(update.path, source + "\n"), source + "\n");
		assert.throws(() => reverseHostedContainerInventoryUpdate(source + "\n", update));
		assert.throws(() => reverseHostedContainerInventoryUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseHostedContainerInventoryUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseHostedContainerInventoryUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("hosted container inventory supplements exactly four existing observations without promoting support cells", async () => {
	const { current, previous, references, history } = await snapshot();
	await assertHostedContainerInventory(current, previous, references, history.updates);
	assert.equal(previous.observations.length, 499); assert.equal(current.observations.length, 499);
	assert.equal(previous.evidence.length, 288); assert.equal(current.evidence.length, 292);
	const changed = current.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(previous.observations[index]));
	assert.deepEqual(changed.map(item => item.id).sort(), [...hostedContainerObservationIds].sort());
	for(const item of changed)
	{
		const old = previous.observations.find(old => old.id === item.id);
		for(const key of Object.keys(old).filter(key => !["stages", "limitations"].includes(key))) assert.deepEqual(item[key], old[key]);
		for(const [name, stage] of Object.entries(item.stages))
		{
			if(name !== "installedExecution") assert.deepEqual(stage, old.stages[name]);
			else
			{
				assert.equal(stage.state, old.stages[name].state);
				const selected = references.find(reference => reference.observationId === item.id);
				assert.deepEqual(stage.evidence, [...old.stages[name].evidence, selected.id]);
				assert.ok(stage.note.startsWith(old.stages[name].note));
			}
		}
		assert.deepEqual(item.limitations, [...old.limitations, hostedContainerCounterScope]);
	}
	const { document: unused, ...contracts } = await readTypeSurface(); void unused;
	const states = inventory => typeSurfaceCells(inventory, contracts).map(cell => [cell.id, Object.fromEntries(Object.entries(cell.stages).map(([key, value]) => [key, value.state]))]);
	assert.deepEqual(states(current), states(previous));
	for(const evidence of JSON.parse(await readFile("docs/type-surface.v1.json")).evidence) for(const file of evidence.files)
		assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
	assert.equal(classifyRepositoryTest("tests/hosted-container-inventory.test.mjs"), "contract");
});

test("hosted inventory binds commands, original reports, ZIP membership and raw binary identities", async () => {
	const { current, references } = await snapshot();
	assert.deepEqual(references.map(reference => reference.id), hostedContainerSelectionIds);
	for(const reference of references)
	{
		const entry = current.evidence.find(entry => entry.id === reference.id);
		assert.equal(entry.command, reference.command); assert.equal(entry.revision, reference.revision);
		for(const text of [reference.environment, `${reference.checks} public checks`, reference.consumerSha256, reference.probeSha256, reference.interposerSha256, hostedContainerCounterScope]) assert.ok(entry.scope.includes(text));
		for(const file of [reference.receipt, reference.report, reference.membership]) assert.ok(entry.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256));
		assert.equal(reference.rows.length, 9); assert.equal(reference.columns.length, 4);
		assert.deepEqual(reference.boundaries, { installedTreeRelocation: false, overallWorkflowSucceeded: false, packageArchiveBytesRetained: false });
		assert.deepEqual(entry.artifacts, Object.entries(reference.archives).map(([path, sha256]) => ({ path: `${reference.id}/${path}`, sha256 })));
		for(const file of entry.files.filter(file => file.path.endsWith(".zip")))
		{
			const bytes = await readFile(file.path);
			assert.equal(sha256(bytes), file.sha256);
			assert.notEqual(sha256(bytes.toString("utf8")), file.sha256, "ZIPs must not be decoded as text");
		}
	}
});

test("hosted selections refuse host, route, report, command, entry count and provenance substitutions", async () => {
	const original = await hostedContainerReferences();
	for(const mutate of [
		value => { value.pop(); }
		, value => { value.push(structuredClone(value[0])); }
		, value => { value.reverse(); }
		, value => { value[0].host = "ruby"; }
		, value => { value[0].route = "reviewed-ir"; }
		, value => { value[0].observationId = value[1].observationId; }
		, value => { value[0].report = value[1].report; }
		, value => { value[0].checks++; }
		, value => { value[0].command = "node invented.mjs"; }
		, value => { value[0].job++; }
		, value => { value[0].consumerSha256 = "0".repeat(64); }
		, value => { value[0].probeSha256 = "0".repeat(64); }
		, value => { value[0].columns.reverse(); }
		, value => { value[0].rows[2][2][0]++; }
		, value => { value[0].artifactMember.archive = value[2].artifactMember.archive; }
		, value => { value[0].membership.sha256 = "0".repeat(64); }
		, value => { value[0].boundaries.installedTreeRelocation = true; }
		, value => { value[0].boundaries.overallWorkflowSucceeded = true; }
		, value => { value[0].environment = "Local glibc 2.36"; }
	]) {
		const value = structuredClone(original); mutate(value);
		await assert.rejects(() => assertHostedContainerReferences(value));
	}
});

test("hosted inventory refuses broader claims, altered historical evidence and unrelated coverage changes", async () => {
	const { current, previous, references, history } = await snapshot();
	const target = value => value.observations.find(item => item.id === hostedContainerObservationIds[0]);
	for(const mutate of [
		value => { value.evidence.at(-1).scope += " All exports measured."; }
		, value => { value.evidence.at(-1).files.pop(); }
		, value => { value.evidence.at(-1).command = "invented"; }
		, value => { value.evidence[0].scope += " Historical rewrite."; }
		, value => { value.evidence.pop(); }
		, value => { target(value).positions.push("field"); }
		, value => { target(value).profiles.push("perl"); }
		, value => { target(value).stages.installedExecution.state = "limited"; }
		, value => { target(value).stages.installedExecution.evidence.reverse(); }
		, value => { target(value).stages.analysis.evidence.push(value.evidence.at(-1).id); }
		, value => { value.observations.push(structuredClone(target(value))); }
		, value => { value.observations[0].scope += " Unrelated edit."; }
	]) {
		const value = structuredClone(current); mutate(value);
		await assert.rejects(() => assertHostedContainerInventory(value, previous, references, history.updates));
	}
	await assert.rejects(() => supplementHostedContainerInventory(current, references), /Already supplemented/u);
});

test("hosted container guides name both measured exports and preserve the separate structural scope", async () => {
	for(const path of ["docs/consume/python.md", "docs/consume/rust.md", "docs/lean/existing-package.md"])
	{
		const source = await readFile(path, "utf8");
		const paragraph = source.split(/\n\n/u).find(text => text.includes("python-rust-container-dispatch-20261009/receipt.json"));
		assert.ok(paragraph, path);
		for(const text of ["`mirrorAll`", "`orDefault`", "ordinary-source", "reviewed-IR", "parent workflow was cancelled", "full installed-tree move", "artifact-membership.json"])
			assert.ok(paragraph.includes(text), `${path}: ${text}`);
		assert.match(paragraph, /not (?:measure )?products, fields, callbacks or `Subtype`/u);
		assert.match(paragraph, /[Ii]nvalid public calls enter neither/u);
		assert.match(paragraph, /raw invalid calls enter/u);
	}
	const python = await readFile("docs/consume/python.md", "utf8"), rust = await readFile("docs/consume/rust.md", "utf8");
	assert.ok(python.includes("2,029 Python checks per source route")); assert.ok(python.includes("manylinux_2_38_x86_64"));
	assert.ok(rust.includes("2,027 Rust checks per source route")); assert.ok(rust.includes("Cargo still compiles the consumer without Lean or producer tools"));
	assert.doesNotMatch(python, /dispatch probes currently run only in C/u);
	assert.ok(python.includes("That receipt's container `Fin` and `Subtype` checks measured dispatch separately in C"));
	assert.ok(python.includes("Both local reviewed reports measure source and adapter rejection inside the installed Python process"));
});

test("hosted container inventory updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-hosted-container-inventory-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-hosted-container-inventory-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Hosted container inventory history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
