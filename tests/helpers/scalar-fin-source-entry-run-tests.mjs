/**
 * Keep the source-entry run checker and its CI step exact (VO #1430): a real archived run passes, and a
 * skipped, partial, reordered, modified or compensated run fails, as does a weakened workflow step.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertSourceEntryRun, sourceEntryLateMultiplicities } from "./scalar-fin-source-entry-run.mjs";
import { assertSourceEntryWorkflow, insertSourceEntryWorkflow, sourceEntryStepName, sourceEntryUploadLine, sourceEntryWorkflowStep } from "./scalar-fin-source-entry-ci.mjs";

// The archived six-ABI run has the layout CI writes: run.tap, report.json and calls/.
const archive = "docs/evidence/scalar-fin-source-entry-20261008";
const runDirectory = `${archive}/six-abi`;
const abis = ["scalar", "callable", "copied", "record", "compound", "nominal"];

/** The archived run as in-memory files, with the archived inputs it executed. */
const archivedRun = async () => {
	const files = new Map();
	for(const name of ["run.tap", "report.json", ...abis.flatMap(abi => [`calls/${abi}.stderr.txt`, `calls/${abi}.stdout.json`])])
		files.set(name, await readFile(join(runDirectory, name), "utf8"));
	const inputs = {};
	for(const abi of abis)
	{
		const lean = await readFile(`${archive}/inputs/${abi}.lean.txt`, "utf8");
		const names = [...lean.matchAll(/^def (\w+) .* := dbgTrace "lean-bridge-source-entry \1" fun _ => /gmu)].map(match => match[1]);
		inputs[abi] = { lean, names, consumer: await readFile(`${archive}/inputs/${abi}.consumer.mjs.txt`, "utf8") };
	}
	return { files, inputs };
};
const check = ({ files, inputs }, observed = []) => assertSourceEntryRun({
	tap: files.get("run.tap")
	, report: files.get("report.json")
	, read: async name => {
		observed.push(name);
		assert.ok(files.has(name), `missing ${name}`);
		return Buffer.from(files.get(name));
	}
	, inputs: abi => inputs[abi]
});

// Split one ABI's call files into per-call marker lists and records, and render them back exactly.
const parse = files => {
	const segments = [];
	for(const line of files.stderr.split("\n").slice(0, -1))
		if(line.startsWith("lean-bridge-call-begin ")) segments.push([]);
		else if(line.startsWith("lean-bridge-source-entry ")) segments.at(-1).push(line);
	return { segments, result: JSON.parse(files.stdout) };
};
const render = ({ segments, result }) => ({
	stderr: segments.map((markers, id) => [`lean-bridge-call-begin ${id}`, ...markers, `lean-bridge-call-end ${id}`].join("\n")).join("\n") + "\n"
	, stdout: JSON.stringify(result) + "\n"
});

/**
 * Change one ABI's call files and rebind the report's retained digests, so only the accounting can catch it.
 *
 * @param run - Archived run.
 * @param abi - ABI to change.
 * @param change - Mutates the parsed segments and records.
 */
const rebound = (run, abi, change) => {
	const files = new Map(run.files), parsed = parse({ stderr: files.get(`calls/${abi}.stderr.txt`), stdout: files.get(`calls/${abi}.stdout.json`) });
	change(parsed);
	const { stderr, stdout } = render(parsed), report = JSON.parse(files.get("report.json"));
	files.set(`calls/${abi}.stderr.txt`, stderr); files.set(`calls/${abi}.stdout.json`, stdout);
	const retained = report.observations.find(item => item.abi === abi).sourceEntry.retained;
	retained["stderr.txt"] = { ...retained["stderr.txt"], sha256: sha256(stderr), bytes: Buffer.byteLength(stderr) };
	retained["stdout.json"] = { ...retained["stdout.json"], sha256: sha256(stdout), bytes: Buffer.byteLength(stdout) };
	files.set("report.json", JSON.stringify(report));
	return { ...run, files };
};

test("the run checker re-accounts a real archived six-ABI run from fixed call files only", async () => {
	const run = await archivedRun(), observed = [];
	for(const abi of abis) assert.deepEqual(render(parse({ stderr: run.files.get(`calls/${abi}.stderr.txt`), stdout: run.files.get(`calls/${abi}.stdout.json`) })), { stderr: run.files.get(`calls/${abi}.stderr.txt`), stdout: run.files.get(`calls/${abi}.stdout.json`) });
	const summary = await check(run, observed);
	assert.deepEqual(Object.keys(summary), abis);
	assert.deepEqual(summary.scalar, { checks: 1545, rejections: 2546, calls: 5094, entered: 2548 });
	// Only the fixed directory-relative call files are read, never a recorded retained path.
	assert.deepEqual(observed, abis.flatMap(abi => [`calls/${abi}.stderr.txt`, `calls/${abi}.stdout.json`]));
	const report = JSON.parse(run.files.get("report.json"));
	report.observations[0].sourceEntry.retained["stderr.txt"].path = "/etc/calls/scalar.stderr.txt";
	const moved = [];
	await check({ ...run, files: new Map(run.files).set("report.json", JSON.stringify(report)) }, moved);
	assert.ok(!moved.some(name => name.startsWith("/")));
});

test("the run checker refuses skipped, failed, partial, reordered or altered runs", async () => {
	const run = await archivedRun(), tap = run.files.get("run.tap");
	const withFile = (name, text) => ({ ...run, files: new Map(run.files).set(name, text) });
	const without = name => {
		const files = new Map(run.files);
		files.delete(name);
		return { ...run, files };
	};
	const report = change => {
		const copy = JSON.parse(run.files.get("report.json"));
		change(copy);
		return withFile("report.json", JSON.stringify(copy));
	};
	const mix = parsed => parsed.result.calls.map((record, index) => [record, index]).filter(([record]) => record[4] === "mix cycle late Fin");
	const refused = {
		"skipped test": withFile("run.tap", tap.replace(/^(ok 1 - .*)$/mu, "$1 # SKIP").replace("# pass 1", "# pass 0").replace("# skipped 0", "# skipped 1"))
		, "failed test": withFile("run.tap", tap.replace("ok 1 -", "not ok 1 -").replace("# pass 1", "# pass 0").replace("# fail 0", "# fail 1"))
		, "two tests": withFile("run.tap", tap.replace("# tests 1", "# tests 2").replace(/^(ok 1 - .*)$/mu, "$1\nok 2 - extra"))
		, "no tests": withFile("run.tap", "TAP version 13\n1..0\n# tests 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n")
		, "missing report": withFile("report.json", undefined)
		, "dropped ABI": report(copy => { copy.observations.pop(); })
		, "reordered ABIs": report(copy => { copy.observations.reverse(); })
		, "missing calls file": without("calls/record.stdout.json")
		, "modified calls file": withFile("calls/copied.stderr.txt", run.files.get("calls/copied.stderr.txt").replace("lean-bridge-source-entry mirror\n", ""))
		, "report count": report(copy => { copy.observations[1].checks++; })
		, "report accounting": report(copy => { copy.observations[2].sourceEntry.exports.mirror.entered--; })
		, "retained digest": report(copy => { copy.observations[3].sourceEntry.retained["stdout.json"].sha256 = "0".repeat(64); })
		, "consumer input": report(copy => { copy.observations[4].sourceEntry.consumerSha256 = "0".repeat(64); })
		// Rebound: the report matches the changed files, so only the per-call accounting can refuse these.
		, "compensated totals": rebound(run, "nominal", parsed => {
			const rejected = parsed.result.calls.findIndex(record => record[3] === 0 && record[1] === "mirror");
			const entered = parsed.result.calls.findIndex((record, index) => index > rejected && record[3] === 1 && record[1] === "mirror");
			parsed.segments[rejected].push(parsed.segments[entered].pop());
		})
		, "shortened late cycle": rebound(run, "scalar", parsed => {
			const [[, index]] = mix(parsed);
			parsed.result.calls[index][4] = null;
		})
		, "control call dropped": rebound(run, "callable", parsed => {
			const index = parsed.result.calls.findLastIndex(record => record[1] === "traceNat");
			parsed.result.calls.splice(index, 1); parsed.segments.splice(index, 1);
			parsed.result.calls.forEach((record, position) => { record[0] = position; });
			parsed.result.checks--;
		})
	};
	for(const [label, changed] of Object.entries(refused))
		await assert.rejects(() => check(changed), assert.AssertionError, label);
	assert.equal(sourceEntryLateMultiplicities["mix cycle late Fin"], 500);
});

test("the run checker refuses malformed counts and TAP ids or plans even when the report is rebound to them", async () => {
	const run = await archivedRun(), tap = run.files.get("run.tap");
	// Change a consumer count in the raw stdout and the report together, with digests rebound, so only
	// the count validation itself can refuse it.
	const counted = (abi, key, value) => {
		const changed = rebound(run, abi, parsed => {
			if(value === undefined) delete parsed.result[key];
			else parsed.result[key] = value;
		});
		const report = JSON.parse(changed.files.get("report.json")), observation = report.observations.find(item => item.abi === abi);
		if(value === undefined) delete observation[key];
		else observation[key] = value;
		return { ...changed, files: new Map(changed.files).set("report.json", JSON.stringify(report)) };
	};
	const refused = {
		"negative checks": counted("scalar", "checks", -1)
		, "fractional checks": counted("callable", "checks", 1546.5)
		, "text checks": counted("copied", "checks", "1546")
		, "missing checks": counted("record", "checks", undefined)
		, "checks below the producer threshold": counted("compound", "checks", 100)
		, "unsafe checks": counted("nominal", "checks", 2 ** 53)
		, "text rejections": counted("scalar", "rejections", "2546")
		, "extra consumer field": rebound(run, "callable", parsed => { parsed.result.extra = 1; })
		, "wrong TAP id": { ...run, files: new Map(run.files).set("run.tap", tap.replace("ok 1 -", "ok 9 -")) }
		, "second plan": { ...run, files: new Map(run.files).set("run.tap", tap.replace("1..1\n", "1..1\n1..1\n")) }
		, "plan for two": { ...run, files: new Map(run.files).set("run.tap", tap.replace("1..1\n", "1..2\n")) }
		, "missing plan": { ...run, files: new Map(run.files).set("run.tap", tap.replace("1..1\n", "")) }
	};
	for(const [label, changed] of Object.entries(refused))
		await assert.rejects(() => check(changed), assert.AssertionError, label);
});

test("the checker command exits zero on a complete run and nonzero without a report, a calls file or a passing test", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-source-entry-run-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const command = target => spawnSync(process.execPath, ["scripts/check-scalar-fin-source-entry-run.mjs", target, `--inputs=${archive}/inputs`], { encoding: "utf8" });
	const copy = async name => {
		const target = join(directory, name);
		await cp(runDirectory, target, { recursive: true });
		return target;
	};
	const complete = command(await copy("complete"));
	assert.equal(complete.status, 0, complete.stderr); assert.match(complete.stdout, /^Source-entry run accounted: scalar 5094 calls, 2548 entered;/u);
	const missingReport = await copy("missing-report");
	await rm(join(missingReport, "report.json"));
	const missingCalls = await copy("missing-calls");
	await rm(join(missingCalls, "calls/compound.stderr.txt"));
	const skipped = await copy("skipped");
	await writeFile(join(skipped, "run.tap"), (await readFile(join(skipped, "run.tap"), "utf8")).replace(/^(ok 1 - .*)$/mu, "$1 # SKIP"));
	for(const target of [missingReport, missingCalls, skipped, join(directory, "absent")])
	{
		const result = command(target);
		assert.notEqual(result.status, 0, target); assert.equal(result.stdout, "", target);
	}
});

test("the CI step runs right after locked compilation, cannot be skipped or hidden by tee and uploads its whole directory", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	// Validate the checked-in step before exercising the insertion helper. A missing step must fail.
	assertSourceEntryWorkflow(workflow);
	const previous = workflow.replace(sourceEntryWorkflowStep, "").replace(sourceEntryUploadLine, "");
	assert.equal(insertSourceEntryWorkflow(previous), workflow);
	assert.equal(workflow.length, previous.length + sourceEntryWorkflowStep.length + sourceEntryUploadLine.length);
	assert.throws(() => insertSourceEntryWorkflow(workflow), assert.AssertionError, "inserted only once");
	const stepLine = (from, to) => workflow.replace(sourceEntryWorkflowStep, sourceEntryWorkflowStep.replace(from, to));
	const corpus = "      - name: Compare installed Node, browser, React and worker corpus packages with fresh Lean\n";
	const refused = {
		"missing probe": previous
		, "continue-on-error": stepLine("        shell: bash\n", "        shell: bash\n        continue-on-error: true\n")
		, "if false": stepLine("        shell: bash\n", "        shell: bash\n        if: false\n")
		, "no bash shell": stepLine("        shell: bash\n", "")
		, "no pipefail": stepLine("          set -euo pipefail\n", "")
		, "pipe without pipefail": stepLine("set -euo pipefail", "set -eu")
		, "gate off": stepLine("LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY: \"1\"", "LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY: \"0\"")
		, "unanchored selection": stepLine("--test-name-pattern='^installed", "--test-name-pattern='installed")
		, "checker removed": stepLine("          node scripts/check-scalar-fin-source-entry-run.mjs build/scalar-fin-source-entry\n", "")
		, "uninstrumented suite removed": workflow.replace("          node --test tests/scalar-fin-rejection.test.mjs\n          test -s build/scalar-fin-rejection/report.json\n", "")
		, "uninstrumented report check removed": workflow.replace("          test -s build/scalar-fin-rejection/report.json\n", "")
		, "upload removed": workflow.replace(sourceEntryUploadLine, "")
		, "upload not always": workflow.replace("      - name: Preserve installed npm corpus observations\n        if: always()\n", "      - name: Preserve installed npm corpus observations\n        if: success()\n")
		, "after the corpus": workflow.replace(sourceEntryWorkflowStep, "").replace(corpus, sourceEntryWorkflowStep + corpus)
		, "older budget": workflow.replace(/(\n {2}node-consumers:\n(?: {4}.*\n)*? {4}timeout-minutes: )330\n/u, "$1180\n")
		, "duplicated step": workflow.replace(sourceEntryWorkflowStep, sourceEntryWorkflowStep + sourceEntryWorkflowStep)
	};
	for(const [label, changed] of Object.entries(refused))
	{
		assert.notEqual(changed, workflow, label);
		assert.throws(() => assertSourceEntryWorkflow(changed), assert.AssertionError, label);
	}
	assert.ok(sourceEntryWorkflowStep.startsWith(`      - name: ${sourceEntryStepName}\n`));
});
