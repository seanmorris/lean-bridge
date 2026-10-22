/**
 * Adversarial controls for the hosted nominal entry-measurement promotion summary. Synthetic
 * artifacts exercise matrix, closure, identity and output binding; they are not measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	nominalSubtypeEntryHostedLanes, nominalSubtypeEntryHostedModes, nominalSubtypeEntryHostedRoutes
	, summarizeNominalSubtypeEntryHostedRun
} from "./nominal-subtype-entry-hosted-summary.mjs";

const producer = "a".repeat(40);
const result = (lane, options) => ({
	route: options.route, mode: options.mode, producer: options.producer
	, [nominalSubtypeEntryHostedLanes[lane].observed]: options.mode === "full"
});
// A stand-in for the real per-selection checker: it reads every record it was handed and
// echoes the selection, so the summary's own closure and binding rules are what is tested.
const fake = lane => async (options, original) => {
	for(const path of original.paths) await original.read(path);
	assert.match(original.tap, /^ok 1/u);
	if(lane === "browser") assert.deepEqual(original.runtime, { node: "v22" });
	return result(lane, options);
};
const checkers = { native: fake("native"), browser: fake("browser") };

const artifact = lane => {
	const layout = nominalSubtypeEntryHostedLanes[lane], files = new Map();
	for(const log of layout.logs) files.set(log, "log\n");
	for(const route of nominalSubtypeEntryHostedRoutes) for(const mode of nominalSubtypeEntryHostedModes)
	{
		const prefix = `${layout.root}/${route}/${mode}/`;
		files.set(`${prefix}run.tap`, "ok 1\n");
		files.set(`${prefix}records/${route}/${mode}/report.json`, "{}");
		files.set(`${prefix}check.log`, canonicalJson(result(lane, { route, mode, producer })));
		if(lane === "browser")
		{
			files.set(`${prefix}runtime-before.json`, '{"node":"v22"}');
			files.set(`${prefix}runtime-after.json`, '{"node":"v22"}');
		}
	}
	return files;
};
const run = (lane, files, overrides = {}) => summarizeNominalSubtypeEntryHostedRun(lane, {
	name: `nominal-subtype-entry-${lane}-${producer}`, producer
	, paths: [...files.keys()].sort()
	, read: async path => Buffer.from(files.get(path))
	, ...overrides
}, overrides.checkers ?? checkers);

test("hosted nominal entry summary accepts only the complete fixed matrix for each lane", async () => {
	for(const lane of ["native", "browser"])
	{
		const summary = await run(lane, artifact(lane));
		assert.equal(summary.kind, `nominal-subtype-entry-${lane}-hosted-v1`);
		assert.equal(summary.artifact, `nominal-subtype-entry-${lane}-${producer}`);
		assert.deepEqual(summary.selections.map(item => [item.route, item.mode, item.observed]), [
			["ordinary", "full", true], ["ordinary", "result-only", false]
			, ["reviewed", "full", true], ["reviewed", "result-only", false]]);
		assert.ok(summary.selections.every(item => item.recordCount === 1
			&& /^[a-f0-9]{64}$/u.test(item.tapSha256) && /^[a-f0-9]{64}$/u.test(item.checkSha256)));
	}
});

test("hosted nominal entry summary refuses identity, matrix and closure drift", async () => {
	for(const lane of ["native", "browser"])
	{
		const root = nominalSubtypeEntryHostedLanes[lane].root;
		const refused = async (mutate, pattern, overrides = {}) => {
			const files = artifact(lane); mutate(files);
			await assert.rejects(run(lane, files, overrides), pattern);
		};
		await refused(() => {}, /artifact name binds the producer revision/u, { name: `nominal-subtype-entry-${lane}-${"b".repeat(40)}` });
		await refused(() => {}, /artifact name binds the producer revision/u, { name: `nominal-subtype-entry-${lane === "native" ? "browser" : "native"}-${producer}` });
		await refused(() => {}, /did not match the regular expression/u, { producer: "a".repeat(39) });
		// A missing selection, an extra file at any level, or an absent lane log is not a complete run.
		await refused(files => { for(const path of [...files.keys()]) if(path.startsWith(`${root}/reviewed/result-only/`)) files.delete(path); }, /missing/u);
		await refused(files => files.set(`${root}/ordinary/full/extra.json`, "{}"), /unexpected selection path/u);
		await refused(files => files.set("stray.txt", "x"), /unexpected artifact path/u);
		await refused(files => files.set(`${root}/ordinary/partial/run.tap`, "x"), /unexpected artifact path/u);
		await refused(files => files.delete(nominalSubtypeEntryHostedLanes[lane].logs[0]), /missing/u);
		await refused(files => { for(const path of [...files.keys()]) if(path.startsWith(`${root}/ordinary/full/records/`)) files.delete(path); }, /missing records/u);
		await refused(files => files.set(`${root}/../escape`, "x"), /closed and relative/u);
		// The retained check output must be exactly what a fresh check of the same records prints.
		await refused(files => files.set(`${root}/reviewed/full/check.log`, `${files.get(`${root}/reviewed/full/check.log`)}\n`), /reviewed full check output/u);
		await refused(files => files.set(`${root}/ordinary/full/check.log`, canonicalJson(result(lane, { route: "reviewed", mode: "full", producer }))), /ordinary full check output/u);
		// Full modes must be measured and result-only modes must stay unmeasured.
		const flipped = async (options, original) => ({ ...await checkers[lane](options, original)
			, [nominalSubtypeEntryHostedLanes[lane].observed]: options.mode !== "full" });
		const files = artifact(lane);
		for(const [path, value] of files) if(path.endsWith("check.log"))
		{
			const [route, mode] = path.slice(root.length + 1).split("/");
			files.set(path, canonicalJson({ ...JSON.parse(value), [nominalSubtypeEntryHostedLanes[lane].observed]: mode !== "full", route }));
		}
		await assert.rejects(run(lane, files, { checkers: { [lane]: flipped } }), /measured split/u);
		// A checker cannot read outside the records it was handed.
		const escaping = async (options, original) => { await original.read("../../run.tap"); return result(lane, options); };
		await assert.rejects(run(lane, artifact(lane), { checkers: { [lane]: escaping } }), /unlisted record/u);
	}
	const drift = artifact("browser");
	drift.set("nominal-subtype-entry-browser-ci/reviewed/full/runtime-after.json", '{"node":"v23"}');
	await assert.rejects(run("browser", drift), /reviewed full runtime drift/u);
	await assert.rejects(summarizeNominalSubtypeEntryHostedRun("wit", { name: "x", producer, paths: [], read: async () => Buffer.alloc(0) }), /unknown lane/u);
});

test("hosted nominal entry summary defaults to the real record checkers", async () => {
	// Synthetic records are not a passing producer TAP, so the real checkers refuse them before
	// any output comparison; the summary cannot be satisfied without original hosted records.
	for(const lane of ["native", "browser"])
		await assert.rejects(summarizeNominalSubtypeEntryHostedRun(lane, {
			name: `nominal-subtype-entry-${lane}-${producer}`, producer
			, paths: [...artifact(lane).keys()].sort()
			, read: async path => Buffer.from(artifact(lane).get(path))
		}));
});
