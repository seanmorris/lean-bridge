/**
 * Authenticate the shared-object sparse performance checkouts and their pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforePerformanceReproducibilityCheckoutSource
	, performanceReproducibilityCheckoutAddedPaths
	, performanceReproducibilityCheckoutCommits
	, performanceReproducibilityCheckoutHistoryPath
	, performanceReproducibilityCheckoutImplementation
	, performanceReproducibilityCheckoutImplementationPaths
	, performanceReproducibilityCheckoutIntegrationPaths
	, performanceReproducibilityCheckoutPinCount
	, performanceReproducibilityCheckoutPredecessor
	, performanceReproducibilityCheckoutScriptPath
	, performanceReproducibilityCheckoutSourcePaths
	, performanceReproducibilityCheckoutTestPath
	, performanceReproducibilityCheckoutTypeSurfacePath
	, performanceReproducibilityCheckoutWorkflowCommit
	, performanceReproducibilityCheckoutWorkflowPath
	, reversePerformanceReproducibilityCheckoutUpdate
} from "./performance-reproducibility-checkout-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	performanceReproducibilityCheckoutHistoryPath, "utf8"
));
const digestPattern = /[0-9a-f]{64}/gu;
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const workflowAt = commit => sourceAt(commit, performanceReproducibilityCheckoutWorkflowPath);
const scriptAt = commit => sourceAt(commit, performanceReproducibilityCheckoutScriptPath);
const replaceOnce = (source, previous, current) => {
	assert.equal(source.split(previous).length, 2, previous);
	return source.replace(previous, current);
};
const checkoutOptions = /uses: actions\/checkout@v6\n {8}with:\n((?: {10}.*\n)+)/gu;
const diskStep = "      - name: Report disk after the sparse checkout\n        run: df -h / \"$GITHUB_WORKSPACE\"\n";
const sparse = "          sparse-checkout: |\n            /*\n            !/docs/evidence/\n          sparse-checkout-cone-mode: false\n";
const jobs = workflow => workflow.slice(workflow.indexOf("\njobs:\n"))
	.split(/^ {2}(?=[a-z]+:\n)/mu).slice(1)
	.map(body => [body.slice(0, body.indexOf(":")), body]);

test("performance reproducibility checkout records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "performance-reproducibility-checkout-source-v1");
	assert.equal(value.predecessorCommit, performanceReproducibilityCheckoutPredecessor);
	assert.equal(value.implementationCommit, performanceReproducibilityCheckoutImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, performanceReproducibilityCheckoutImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, performanceReproducibilityCheckoutIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, performanceReproducibilityCheckoutAddedPaths);
	const range = `${performanceReproducibilityCheckoutPredecessor}`
		+ `..${performanceReproducibilityCheckoutImplementation}`;
	assert.deepEqual(git(["rev-list", "--reverse", range]).trim().split("\n")
	, performanceReproducibilityCheckoutCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, performanceReproducibilityCheckoutPredecessor
		, performanceReproducibilityCheckoutWorkflowCommit]).trim().split("\n")
	, performanceReproducibilityCheckoutSourcePaths);
	assert.deepEqual(git(["diff", "--name-only"
		, performanceReproducibilityCheckoutWorkflowCommit
		, performanceReproducibilityCheckoutImplementation]).trim().split("\n")
	, [performanceReproducibilityCheckoutTypeSurfacePath]);
});

test("performance reproducibility checkout reverses every source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		if(update.path === performanceReproducibilityCheckoutTypeSurfacePath)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				performanceReproducibilityCheckoutImplementation, update.path), update), true);
			continue;
		}
		const current = sourceAt(performanceReproducibilityCheckoutImplementation, update.path);
		const previous = sourceAt(performanceReproducibilityCheckoutPredecessor, update.path);
		assert.equal(reversePerformanceReproducibilityCheckoutUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePerformanceReproducibilityCheckoutSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(performanceReproducibilityCheckoutImplementation, update.path);
		assert.equal(reversePerformanceReproducibilityCheckoutUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("performance reproducibility checkout refreshes only the workflow pin", async () => {
	const update = (await record()).updates.find(item =>
		item.path === performanceReproducibilityCheckoutTypeSurfacePath);
	const before = sha256(workflowAt(performanceReproducibilityCheckoutPredecessor));
	const after = sha256(workflowAt(performanceReproducibilityCheckoutImplementation));
	assert.notEqual(before, after);
	let pins = 0;
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(digestPattern, "")
			, edit.previous.replace(digestPattern, ""));
		for(const digest of edit.current.match(digestPattern))
		{
			assert.equal(digest, after);
			++pins;
		}
		for(const digest of edit.previous.match(digestPattern)) assert.equal(digest, before);
	}
	assert.equal(pins, performanceReproducibilityCheckoutPinCount);
	for(const commit of performanceReproducibilityCheckoutCommits)
	{
		const surface = sourceAt(commit, performanceReproducibilityCheckoutTypeSurfacePath);
		for(const path of [performanceReproducibilityCheckoutScriptPath
			, performanceReproducibilityCheckoutTestPath])
			assert.equal(surface.includes(`"path": "${path}"`), false, path);
	}
});

test("performance reproducibility checkout shares committed objects and skips retained evidence everywhere", () => {
	const previousScript = scriptAt(performanceReproducibilityCheckoutPredecessor);
	let expectedScript = replaceOnce(previousScript
		, "  git clone --quiet --no-local --no-hardlinks --no-checkout \\\n"
			+ "    \"$PERFORMANCE_PROJECT_ROOT\" \"$checkout\"\n"
			+ "  git -C \"$checkout\" checkout --quiet --detach \"$PERFORMANCE_REVISION\"\n"
		, "  git clone --quiet --shared --no-checkout \\\n"
			+ "    \"$PERFORMANCE_PROJECT_ROOT\" \"$checkout\"\n"
			+ "  git -C \"$checkout\" sparse-checkout set --no-cone '/*' '!/docs/evidence/'\n"
			+ "  git -C \"$checkout\" checkout --quiet --detach \"$PERFORMANCE_REVISION\"\n");
	expectedScript = replaceOnce(expectedScript
		, "PERFORMANCE_REVISION=$(git -C \"$PERFORMANCE_PROJECT_ROOT\" rev-parse HEAD)\n"
		, "PERFORMANCE_REVISION=$(git -C \"$PERFORMANCE_PROJECT_ROOT\" rev-parse HEAD)\n"
			+ "if [[ $(git -C \"$PERFORMANCE_PROJECT_ROOT\" rev-parse --is-shallow-repository) == true ]]; then\n"
			+ "  printf 'Performance reproducibility requires complete committed history to share objects between clean builds.\\n' >&2\n"
			+ "  exit 1\n"
			+ "fi\n");
	expectedScript = replaceOnce(expectedScript
		, "trap cleanup EXIT\n\n"
		, "trap cleanup EXIT\n\n"
			+ "report_disk() {\n"
			+ "  printf 'Performance reproducibility disk %s:\\n' \"$1\" >&2\n"
			+ "  df -h / \"$PERFORMANCE_SCRATCH\" >&2\n"
			+ "}\n\n"
			+ "report_disk \"before the clean builds\"\n\n");
	expectedScript = replaceOnce(expectedScript
		, "done\n\nmkdir -p"
		, "done\n\nreport_disk \"after the clean builds\"\n\nmkdir -p");
	assert.equal(scriptAt(performanceReproducibilityCheckoutImplementation), expectedScript);

	const previousWorkflow = workflowAt(performanceReproducibilityCheckoutPredecessor);
	const currentWorkflow = workflowAt(performanceReproducibilityCheckoutImplementation);
	assert.equal(previousWorkflow.includes(diskStep), false);
	assert.equal(currentWorkflow.split(diskStep).length, 2);
	assert.equal(previousWorkflow.includes("sparse-checkout"), false);
	const previousJobs = jobs(previousWorkflow);
	const currentJobs = jobs(currentWorkflow);
	assert.deepEqual(currentJobs.map(([name]) => name), previousJobs.map(([name]) => name));
	assert.equal(currentJobs.length, 7);
	for(const [index, [name, body]] of currentJobs.entries())
	{
		const previousOptions = [...previousJobs[index][1].matchAll(checkoutOptions)];
		const options = [...body.matchAll(checkoutOptions)];
		assert.equal(previousOptions.length, 1, name);
		assert.equal(options.length, 1, name);
		assert.equal(previousOptions[0][1]
			, "          fetch-depth: 0\n          persist-credentials: false\n", name);
		const depth = name === "reproducibility" ? 0 : 1;
		assert.equal(options[0][1].replaceAll(/^ {10}#.*\n/gmu, "")
			, `          fetch-depth: ${depth}\n          persist-credentials: false\n${sparse}`, name);
		assert.equal(body.includes(diskStep), name === "reproducibility", name);
	}
	const unchanged = workflow => workflow.replace(diskStep, "")
		.replaceAll(checkoutOptions, "uses: actions/checkout@v6\n");
	assert.equal(unchanged(currentWorkflow), unchanged(previousWorkflow));

	const currentTest = sourceAt(performanceReproducibilityCheckoutImplementation
		, performanceReproducibilityCheckoutTestPath);
	assert.ok(currentTest.includes("/git clone --quiet --shared --no-checkout/"));
	assert.ok(currentTest.includes("performance jobs check out live source without the retained evidence tree"));
	assert.equal(currentTest.includes("--no-local --no-hardlinks --no-checkout/"), false);
});

test("performance reproducibility checkout changes no record, support inventory, benchmark or product source", () => {
	for(const path of ["docs/evidence", "src", "poc", "config", "schema"
		, "docs/consumer-support.v1.json", "package.json"])
		assert.equal(git(["rev-parse", `${performanceReproducibilityCheckoutPredecessor}:${path}`])
			, git(["rev-parse", `${performanceReproducibilityCheckoutImplementation}:${path}`]), path);
});

test("performance reproducibility checkout rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === performanceReproducibilityCheckoutWorkflowPath);
	const current = workflowAt(performanceReproducibilityCheckoutImplementation);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reversePerformanceReproducibilityCheckoutUpdate(current, forged));
	assert.equal(beforePerformanceReproducibilityCheckoutSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
