/**
 * Bind the post-Perl contract fixes without rewriting their accepted predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforePerlContractRepair, perlContractRepairBaseline, perlContractRepairPath
	, perlContractRepairPrevious, perlContractRepairChangedPaths
	, perlContractRepairAddedPaths, perlContractRepairBytes
	, reversePerlContractRepair } from "./helpers/perl-contract-repair-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const commands = [
	"node --test --test-name-pattern='CI requires recursive' tests/dotnet-recursive-callable-evidence.test.mjs"
	, "node --test --test-name-pattern='owned C# callback evidence preserves' tests/owned-dotnet-callback-evidence.test.mjs"
];
const verify = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "post-perl-contract-repair");
	assert.equal(record.baselineRevision, perlContractRepairBaseline);
	assert.deepEqual(record.previous, perlContractRepairPrevious);
	assert.deepEqual(record.scope, { productionCodeChanged: false, packageArtifactsChanged: false, promotedCells: 0 });
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(record.updates.map(update => update.path), perlContractRepairChangedPaths);
	assert.deepEqual(Object.keys(record.sources).sort(), [...perlContractRepairChangedPaths, ...perlContractRepairAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reversePerlContractRepair(source, update)), update.previousSha256);
	}
	for(const [kind, code] of [["reproductions", 1], ["acceptance", 0]])
	{
		assert.equal(record[kind].length, 2);
		for(const [index, observation] of record[kind].entries())
		{
			assert.equal(observation.command, commands[index]);
			assert.equal(observation.exitCode, code);
			assert.equal(sha256(observation.output), observation.outputSha256);
			for(const line of ["# tests 1", `# pass ${code ? 0 : 1}`, `# fail ${code}`, "# skipped 0", "# cancelled 0"])
				assert.ok(observation.output.split("\n").includes(line), line);
			if(!code) assert.doesNotMatch(observation.output, /^not ok/mu);
		}
	}
	assert.match(record.reproductions[0].output, /timeout-minutes: 90/u);
	assert.match(record.reproductions[0].output, /timeout-minutes: 120/u);
	assert.match(record.reproductions[1].output, /src\/build\/elaborated-component\.mjs/u);
	const current = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforePerlContractRepair("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	for(const evidence of prior.evidence) for(const file of evidence.files)
		file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(current, prior);
};

test("post-Perl contract repair preserves the frozen receipt and binds both reproduced fixes", async () => {
	await verify(await json(perlContractRepairPath));
});

test("post-Perl contract history rejects unknown bytes and forged predecessor edits", async () => {
	for(const update of (await json(perlContractRepairPath)).updates)
	{
		const source = await readFile(update.path, "utf8"), previous = beforePerlContractRepair(update.path, source);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforePerlContractRepair(update.path, source, update.currentSha256), source);
		assert.equal(beforePerlContractRepair(update.path, previous), previous);
		const changed = source + "\n/* unrecorded source change */\n";
		assert.equal(beforePerlContractRepair(update.path, changed), changed);
		assert.throws(() => reversePerlContractRepair(changed, update));
		assert.throws(() => reversePerlContractRepair(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reversePerlContractRepair(source, { ...update, path: "unrecorded.mjs" }));
		assert.throws(() => reversePerlContractRepair(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(perlContractRepairBytes("unrecorded.bin", binary), binary);
});

test("post-Perl repair rejects widened scope and substituted execution evidence", async () => {
	const original = await json(perlContractRepairPath);
	for(const mutate of [
		record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.scope.productionCodeChanged = true; }
		, record => { record.scope.promotedCells = 1; }
		, record => { record.updates.pop(); }
		, record => { delete record.sources["src/adoption/test-profiles.mjs"]; }
		, record => { record.reproductions.pop(); }
		, record => { record.reproductions[0].exitCode = 0; }
		, record => { record.acceptance[0].exitCode = 1; }
		, record => { record.acceptance[0].command += " --import substitute.mjs"; }
		, record => { record.acceptance[0].output += "\nsubstituted\n"; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => verify(changed));
	}
});
