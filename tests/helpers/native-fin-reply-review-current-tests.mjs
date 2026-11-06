/**
 * Keep current host-reply documentation and producer selection eager.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { nativeFinReplyPromotionId } from "./native-fin-reply-promotion-references.mjs";
import { readTypeSurfaceContracts } from "./type-surface-contracts.mjs";
import {
	nativeReplyReviewEarlierShapes, nativeReplyReviewPattern
} from "./native-fin-reply-review-notes.mjs";

const readCurrentSurface = async () => {
	const [document, contracts] = await Promise.all([
		readFile("docs/type-surface.v1.json", "utf8").then(JSON.parse)
		, readTypeSurfaceContracts()
	]);
	validateTypeSurface(document, contracts);
	return { document, ...contracts };
};

test("C/C++ documentation labels both routes and scopes the measured environment and dispatch", async () => {
	const { document } = await readCurrentSurface();
	for(const profile of ["c", "cpp"])
	{
		const text = await readFile(`docs/consume/${profile}.md`, "utf8"), row = text.split("\n").find(line => line.startsWith("| `Fin n` |"));
		const ordinary = document.observations.find(item => item.id === `callback-fin-${profile}-ordinary-source`);
		const reviewed = document.observations.find(item => item.id === `callback-fin-${profile}-reviewed-ir`);
		for(const item of [ordinary, reviewed])
		{
			assert.ok(row.includes(item.hostTypes.fin["callback-result"]));
			assert.ok(row.includes(item.conversionNotes.fin));
			assert.match(item.hostTypes.fin["callback-result"], /below the declared Fin bound/u);
		}
		assert.ok(ordinary.conversionNotes.fin.startsWith("Ordinary source: "));
		assert.ok(reviewed.conversionNotes.fin.startsWith("Reviewed IR: "));
		assert.match(reviewed.conversionNotes.fin, /Native host-produced refined replies are not established by this evidence/u);
		assert.ok(ordinary.stages.installedExecution.note.includes(nativeReplyReviewEarlierShapes));
		assert.ok(ordinary.limitations[1].startsWith("Host-reply run: "));
		assert.match(ordinary.limitations[1], /measured glibc 2\.36/u);
		assert.ok(ordinary.limitations[3].startsWith("Earlier closure-argument run: "));
		assert.match(ordinary.limitations[3], /does not measure host glibc/u);
		assert.ok(ordinary.stages.packaging.note.includes(ordinary.limitations[3]));
		assert.match(text, /retains the original installed-package reports and does not extend the earlier reports' dispatch measurements[.]/u);
		assert.ok(!text.includes("Source-dispatch counters were measured in C only."));
	}
});

test("host-reply reproduction selects exactly the five intended gated producers", async () => {
	const { document } = await readCurrentSurface();
	const entry = document.evidence.find(item => item.id === nativeFinReplyPromotionId);
	assert.ok(entry.command.includes(`--test-name-pattern='${nativeReplyReviewPattern}'`));
	const env = {
		...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT"))
		, LEAN_BRIDGE_RETAINED_CONTRACTS: "deferred"
	};
	const run = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=tap", `--test-name-pattern=${nativeReplyReviewPattern}`, "tests/native-fin-callbacks.test.mjs"], { env, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
	assert.equal(run.status, 0, run.stderr);
	const names = [...run.stdout.matchAll(/^ok \d+ - (.*) # SKIP$/gmu)].map(match => match[1]);
	assert.deepEqual(names.sort(), [
		"fresh Lean admits every safe direction and compiles the generated adapter"
		, "fresh Lean refuses a host callback's result without a Fin-free failure value and admits one with it"
		, "fresh Lean admits every checked host reply family and compiles each typed reconstruction"
		, "generated C wrapper execution: C reply walks and Lean's own reconstruction both refuse host replies under ASan and UBSan"
		, "relocated source-free C and C++ packages check every host reply bound and recover"
	].sort());
	for(const line of ["# tests 5", "# pass 0", "# fail 0", "# skipped 5"]) assert.ok(run.stdout.includes(line + "\n"), line);
	const matcher = new RegExp(nativeReplyReviewPattern, "u"), unanchored = new RegExp(nativeReplyReviewPattern.slice(4, -1), "u");
	for(const name of names)
	{
		assert.ok(matcher.test(name));
		assert.ok(unanchored.test(`archive of ${name}`));
		assert.ok(!matcher.test(`archive of ${name}`));
	}
});
