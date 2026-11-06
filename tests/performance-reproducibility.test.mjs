/**
 * Tests the performance reproducibility behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { performanceProfiles, runPerformanceSuite } from "../src/performance/harness.mjs";
import {
	analyzePerformanceSelfConsistency,
	collectPerformanceInventory,
	comparePerformanceInventories,
} from "../src/performance/reproducibility.mjs";

const manifest = JSON.parse(await readFile("poc/performance/workloads.v1.json", "utf8"));

test("the self-consistency result schema closes the report envelope", async () => {
  const schema = JSON.parse(await readFile(
    "schema/performance-self-consistency-result.schema.json",
    "utf8",
  ));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.properties.kind.const, "lean-bridge-performance-self-consistency");
});

test("the benchmark inventory covers executable artifacts and inputs but excludes transient products", async () => {
  const inventory = await collectPerformanceInventory(".");
  assert.ok(inventory.artifactCount > 300);
  assert.ok(inventory.totalBytes > 0);
  assert.match(inventory.sha256, /^[a-f0-9]{64}$/);
  const paths = inventory.entries.map(entry => entry.path);
  assert.ok(paths.includes("poc/performance/corpus.v1.json"));
  assert.ok(paths.includes("build/performance-wasm/main.wasm"));
  assert.ok(paths.includes("build/performance-scale/lazy/main.wasm"));
  assert.equal(paths.some(path => /(?:interactive|scaling)-suite/.test(path)), false);
  assert.equal(paths.some(path => path.endsWith(".o")), false);
  assert.equal(paths.some(path => path.endsWith(".olean")), false);
  assert.equal(paths.some(path => path.endsWith(".link.map")), false);
  assert.ok(inventory.scope.included.includes("executable Wasm and JavaScript artifacts"));
  assert.ok(inventory.scope.excluded.includes("raw linker maps containing build-root paths"));
});

test("inventory comparison accepts equality and reports exact artifact drift", () => {
  const entry = Object.freeze({ path: "build/performance-wasm/main.wasm", bytes: 3, sha256: "a".repeat(64) });
  const first = Object.freeze({ entries: Object.freeze([entry]), artifactCount: 1, totalBytes: 3, sha256: "b".repeat(64) });
  assert.equal(comparePerformanceInventories(first, first).accepted, true);
  const changed = Object.freeze({
    ...first,
    entries: Object.freeze([{ ...entry, sha256: "c".repeat(64) }])
    , sha256: "d".repeat(64)
  });
  const comparison = comparePerformanceInventories(first, changed);
  assert.equal(comparison.accepted, false);
  assert.deepEqual(comparison.differences.map(item => [item.path, item.kind]), [
    ["build/performance-wasm/main.wasm", "content-drift"]
  ]);
});

test("fixed workloads preserve semantics while timing remains measured variance", async () => {
  const suites = [];
  for(let repetition = 0; repetition < 2; repetition += 1)
{
    suites.push(await runPerformanceSuite({
      manifest
      , workload: "interactive-clustered-2d"
      , profiles: performanceProfiles
    }));
}
  const result = analyzePerformanceSelfConsistency(suites);
  assert.equal(result.accepted, true);
  assert.equal(result.repetitions, 2);
  assert.equal(new Set(result.semanticHashes).size, 1);
  assert.match(result.semanticSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.keys(result.timingVariance).length > 20);
  for(const metric of Object.values(result.timingVariance))
{
    assert.equal(metric.repetitions, 2);
    assert.equal(metric.valuesNs.length, 2);
    assert.ok(metric.maximumNs >= metric.minimumNs);
    assert.ok(metric.coefficientOfVariation >= 0);
}
});

test("semantic drift fails independently from timing noise", async () => {
  const first = await runPerformanceSuite({
    manifest
    , workload: "interactive-clustered-2d"
    , profiles: ["lazy"]
  });
  const changed = structuredClone(first);
  changed.runs[0].correctness.resultSha256 = "0".repeat(64);
  assert.throws(
    () => analyzePerformanceSelfConsistency([first, changed]),
    error => error.code === "benchmark-semantic-drift",
  );
});

test("performance reproducibility clients never reach private dispatch", async () => {
  const paths = [
    "src/performance/reproducibility.mjs"
    , "scripts/compare-performance-builds.mjs"
    , "scripts/benchmark-self-consistency.mjs"
  ];
  for(const path of paths)
{
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /\bccall\b|\bcwrap\b|_bridge_|generic\s+(?:invoke|dispatch)|numeric handle/i,
    );
}
});

test("the clean build gate isolates two committed source and build roots", async () => {
  const source = await readFile("scripts/check-performance-build-reproducibility.sh", "utf8");
  assert.match(source, /status --porcelain=v1 --untracked-files=all/);
  assert.match(source, /rev-parse --is-shallow-repository\) == true \]\]; then\n\s+printf .*\n\s+exit 1\nfi\n/);
  assert.match(source, /git clone --quiet --shared --no-checkout/);
  assert.doesNotMatch(source, /--no-local|--no-hardlinks/);
  assert.match(source, /sparse-checkout set --no-cone '\/\*' '!\/docs\/evidence\/'\n\s+git -C "\$checkout" checkout --quiet --detach "\$PERFORMANCE_REVISION"/);
  assert.match(source, /df -h \/ "\$PERFORMANCE_SCRATCH" >&2/);
  assert.match(source, /report_disk "before the clean builds"\n\nfor name in a b; do/);
  assert.match(source, /^done\n\nreport_disk "after the clean builds"\n/m);
  assert.match(source, /source-a/);
  assert.match(source, /source-b/);
  assert.match(source, /build-performance-wasm\.sh/);
  assert.match(source, /build-performance-scaling\.sh/);
  assert.match(source, /compare-performance-builds\.mjs/);
});

const sparse = "          sparse-checkout: |\n            /*\n            !/docs/evidence/\n          sparse-checkout-cone-mode: false\n";
const filtered = "          filter: blob:none\n";
const performanceJobs = ["build", "spatial", "scaling", "overhead", "lifecycle", "reproducibility", "report"];
const measuringJobs = ["spatial", "scaling", "overhead", "lifecycle", "report"];
// The last workflow revision before blob filtering: nothing but the filter lines and comments may differ.
const unfilteredPredecessor = "51770fecbfb4a19e085381225557df6427938112";
// The build job's native graph test imports the history hub, which reads retained root records and
// committed history, so it keeps the whole tree with complete history and fetches historical blobs only
// when read. The clean-build gate's shared clones report every excluded blob as invalid when their
// source is blob-filtered, so reproducibility stays unfiltered.
const performanceCheckout = job => job === "build"
	? `          fetch-depth: 0\n${filtered}          persist-credentials: false\n`
	: job === "reproducibility"
		? `          fetch-depth: 0\n          persist-credentials: false\n${sparse}`
		: `          fetch-depth: 1\n${filtered}          persist-credentials: false\n${sparse}`;
const assertPerformanceCheckouts = workflow => {
	const bodies = workflow.slice(workflow.indexOf("\njobs:\n")).split(/^ {2}(?=[a-z]+:\n)/mu).slice(1);
	assert.deepEqual(bodies.map(body => body.slice(0, body.indexOf(":"))), performanceJobs);
	for(const body of bodies)
	{
		const job = body.slice(0, body.indexOf(":"));
		assert.doesNotMatch(body, /uses: actions\/checkout@(?!v6\n)/u, job);
		const checkouts = [...body.matchAll(/uses: actions\/checkout@v6\n {8}with:\n((?: {10}.*\n)+)/gu)];
		assert.equal(checkouts.length, 1, job);
		assert.equal(checkouts[0][1].replaceAll(/^ {10}#.*\n/gmu, ""), performanceCheckout(job), job);
	}
	const uncommented = workflow.replaceAll(/^ *#.*\n/gmu, "");
	assert.equal(uncommented.split("docs/evidence").length - 1, performanceJobs.length - 1);
	assert.match(workflow, /tests\/native-graph-model\.test\.mjs/u);
	assert.ok(workflow.includes("      - name: Report disk after the sparse checkout\n        run: df -h / \"$GITHUB_WORKSPACE\"\n"));
};

test("performance jobs check out live source without the retained evidence tree", async () => {
  const workflow = await readFile(".github/workflows/performance.yml", "utf8");
  assertPerformanceCheckouts(workflow);
  // Every sparse line, command, artifact, timeout and job stays exactly where the unfiltered revision had it.
  const strip = text => text.replaceAll(/^ *#.*\n/gmu, "").replaceAll(filtered, "");
  const predecessor = execFileSync("git", ["show", `${unfilteredPredecessor}:.github/workflows/performance.yml`], { encoding: "utf8" });
  assert.equal(strip(workflow), strip(predecessor));
  assert.equal(predecessor.split(filtered).length - 1, 0);
  assert.equal(workflow.split(filtered).length - 1, 6);
});

test("performance checkouts reject a dropped filter, a widened tree, a shallow history reader or an older action", async () => {
  const workflow = await readFile(".github/workflows/performance.yml", "utf8");
  const body = job => {
    const start = workflow.indexOf(`\n  ${job}:\n`);
    assert.ok(start > 0, job);
    const next = /\n {2}[a-z]+:\n/gu;
    next.lastIndex = start + 1;
    const following = next.exec(workflow);
    return [start, following === null ? workflow.length : following.index];
  };
  const mutate = (job, before, after) => {
    const [start, end] = body(job);
    const section = workflow.slice(start, end);
    assert.ok(section.includes(before), `${job}: ${before}`);
    return workflow.slice(0, start) + section.replace(before, after) + workflow.slice(end);
  };
  const exclusion = "            !/docs/evidence/\n";
  const cone = "          sparse-checkout-cone-mode: false\n";
  const mutants = [
    ...performanceJobs.map(job => [job, "uses: actions/checkout@v6\n", "uses: actions/checkout@v4\n"])
    , ...["build", ...measuringJobs].map(job => [job, filtered, ""])
    , ...measuringJobs.map(job => [job, exclusion, ""])
    , ...measuringJobs.map(job => [job, cone, cone.replace("false", "true")])
    , ...measuringJobs.map(job => [job, "          fetch-depth: 1\n", "          fetch-depth: 0\n"])
    , ["build", "          fetch-depth: 0\n", "          fetch-depth: 1\n"]
    , ["build", "          persist-credentials: false\n", `          persist-credentials: false\n${sparse}`]
    , ["reproducibility", "          fetch-depth: 0\n", "          fetch-depth: 1\n"]
    , ["reproducibility", "          persist-credentials: false\n", `${filtered}          persist-credentials: false\n`]
    , ["reproducibility", exclusion, ""]
  ];
  for(const [job, before, after] of mutants)
  {
    const changed = mutate(job, before, after);
    assert.notEqual(changed, workflow);
    assert.throws(() => assertPerformanceCheckouts(changed), `${job}: ${before.trim()}`);
  }
});
