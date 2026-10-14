/**
 * Check browser CI selection, TAP and record boundaries before installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { parseNominalPrimitiveSubtypeBrowserCiArgs, checkNominalPrimitiveSubtypeBrowserCiRecords } from "./nominal-primitive-subtype-browser-ci-report.mjs";
import { assertNominalPrimitiveSubtypeBrowserTap } from "./nominal-primitive-subtype-browser-ci-report.mjs";
import { nominalPrimitiveSubtypeBrowserRecords } from "./nominal-primitive-subtype-browser-report.mjs";

const root = "docs/evidence/nominal-primitive-subtype-npm-20261014";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const originalIndex = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "302238528cb14b32f5b6c6cff5c621244e2948a4d04a33a7d4549c6cd48fc576");
	return JSON.parse(bytes);
};

test("primitive-base browser CI refuses incomplete, repeated and unknown options before reading records", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "records", tap: "run.tap", runtime: "runtime.json" };
	const args = argsOf(options); assert.deepEqual(parseNominalPrimitiveSubtypeBrowserCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalPrimitiveSubtypeBrowserCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalPrimitiveSubtypeBrowserCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseNominalPrimitiveSubtypeBrowserCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changes of [{ route: "unknown" }, { route: "ordinary,reviewed" }, { mode: "unknown" }, { mode: "full,result-only" }, { producer: "HEAD" }, { producer: "g".repeat(40) }, { extra: "yes" }])
		assert.throws(() => parseNominalPrimitiveSubtypeBrowserCiArgs(argsOf({ ...options, ...changes })));
	for(const value of [undefined, {}, [], args.slice(0, -1), ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalPrimitiveSubtypeBrowserCiArgs(value));
});

test("primitive-base browser CI requires exact terminal TAP without hidden failures or skipped selections", async t => {
	const index = await originalIndex(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = await readFile(`${root}/${run.route}/${run.mode}/producer/run.tap`, "utf8"); assertNominalPrimitiveSubtypeBrowserTap(tap, run.route, run.mode);
		const changes = [tap.slice(1), tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n")
			, tap.replace("ok 1 -", "not ok 1 -"), tap.replace("# Subtest:", "# Wrong:")
			, tap + "Bail out! incomplete\n", tap + "# SKIP disabled\n"
			, tap + "# TODO later\n"
			, tap + tap, tap + "ok 2 - extra\n", tap + "incomplete\n"
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"].map(line => tap.replace("\n1..1\n", `\n    ${line}\n1..1\n`))
			, ...["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changes)
		{ assert.notEqual(source, tap); assert.throws(() => assertNominalPrimitiveSubtypeBrowserTap(source, run.route, run.mode)); controls++; }
		assert.throws(() => assertNominalPrimitiveSubtypeBrowserTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalPrimitiveSubtypeBrowserTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	assert.equal(controls, 156); t.diagnostic(`${controls} incomplete, substituted, skipped and failed TAP controls`);
});


test("primitive-base browser CI refuses incomplete paths and TAP before reading installed artifacts", async t => {
	const index = await originalIndex(); let controls = 0;
	for(const run of index.runs)
	{
		const options = { route: run.route, mode: run.mode
			, producer: run.producerCommit, directory: "records", tap: "run.tap"
			, runtime: "runtime.json" };
		const npm = JSON.parse(await readFile(root + "/" + run.route + "/" + run.mode + "/records/report.json"));
		const expected = nominalPrimitiveSubtypeBrowserRecords(run.mode, npm.receipt).sort();
		const tap = await readFile(root + "/" + run.route + "/" + run.mode + "/producer/run.tap", "utf8");
		for(const paths of [expected.slice(1), [...expected, "invented.json"], [...expected, expected[0]], [...expected].reverse()])
		{
			const reads = [];
			await assert.rejects(checkNominalPrimitiveSubtypeBrowserCiRecords(options, {
				tap, runtime: run.runtime, paths
				, read: async path => {
					reads.push(path); assert.equal(path, "report.json");
					return Buffer.from(canonicalJson(npm));
				}
			}));
			assert.deepEqual(reads, ["report.json"]); controls++;
		}
		for(const source of [tap + "incomplete\n", tap.replace("# skipped 0", "# skipped 1")])
		{
			let reads = 0;
			await assert.rejects(checkNominalPrimitiveSubtypeBrowserCiRecords(options, {
				tap: source, runtime: run.runtime, paths: expected
				, read: async () => { reads++; throw new Error("Unexpected record access"); }
			}));
			assert.equal(reads, 0); controls++;
		}
	}
	assert.equal(controls, 24);
	t.diagnostic("Twenty-four early record/TAP refusals. Existing npm logs are parser controls, not browser acceptance.");
});
