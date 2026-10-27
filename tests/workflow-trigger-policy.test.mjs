/**
 * Keep dedicated acceptance producers available without turning every push or
 * pull request into a repository-wide hosted-run stampede.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const workflowDirectory = ".github/workflows";

const automaticEvents = new Set(["pull_request", "push"]);

const approvedAutomaticEvents = new Map([
	["checked-record-value-index-matrix.yml", ["pull_request", "push"]]
	, ["consumer-matrix.yml", ["pull_request", "push"]]
	, ["demos-pages.yml", ["pull_request", "push"]]
	, ["dependent-checked-record-matrix.yml", ["pull_request", "push"]]
	, ["performance.yml", ["push"]]
	, ["quality.yml", ["pull_request", "push"]]
	, ["reproducible-release.yml", ["pull_request"]]
]);

const pathScopedAutomaticWorkflows = new Set([
	"checked-record-value-index-matrix.yml"
	, "dependent-checked-record-matrix.yml"
]);

const workflowEvents = source => {
	const start = source.indexOf("on:\n");
	assert.notEqual(start, -1, "workflow has an on block");
	const following = source.slice(start + "on:\n".length);
	const end = following.search(/^[a-z][a-z0-9_-]*:\s*$/mu);
	assert.notEqual(end, -1, "workflow has a top-level key after on");
	const block = following.slice(0, end);
	const events = [...block.matchAll(/^ {2}([a-z][a-z0-9_-]*):\s*$/gmu)]
		.map(match => match[1]);
	return { block, events };
};

const eventBody = (block, event) => {
	const startPattern = new RegExp(`^  ${event}:\\s*$`, "mu");
	const start = block.search(startPattern);
	assert.notEqual(start, -1, `${event} event exists`);
	const following = block.slice(start).replace(/^.*\n/u, "");
	const end = following.search(/^ {2}[a-z][a-z0-9_-]*:\s*$/mu);
	return end === -1 ? following : following.slice(0, end);
};

const assertWorkflowTriggerPolicy = (name, source) => {
	const { block, events } = workflowEvents(source);
	assert.equal(new Set(events).size, events.length, `${name} has unique events`);
	assert.ok(events.includes("workflow_dispatch"), `${name} remains explicitly runnable`);

	const actualAutomatic = events.filter(event => automaticEvents.has(event)).sort();
	const expectedAutomatic = [...(approvedAutomaticEvents.get(name) ?? [])].sort();
	assert.deepEqual(actualAutomatic, expectedAutomatic
		, `${name} has only reviewed push and pull-request activation`);

	if(pathScopedAutomaticWorkflows.has(name))
	{
		for(const event of expectedAutomatic)
		{
			const body = eventBody(block, event);
			assert.match(body, /^ {4}paths:\s*$/mu, `${name} ${event} is path scoped`);
			assert.match(body, /^ {6}- /mu, `${name} ${event} has at least one path`);
		}
	}
};

test("all workflows obey the reviewed automatic-trigger budget", async () => {
	const names = (await readdir(workflowDirectory))
		.filter(name => name.endsWith(".yml"))
		.sort();
	assert.equal(names.length, 122, "review every workflow added to the repository");

	for(const name of names)
	{
		const source = await readFile(`${workflowDirectory}/${name}`, "utf8");
		assertWorkflowTriggerPolicy(name, source);
	}

	assert.equal(approvedAutomaticEvents.size, 7);
	assert.equal(pathScopedAutomaticWorkflows.size, 2);
});

test("the trigger policy fails closed on accidental dedicated-workflow fan-out", async () => {
	const name = "nominal-primitive-subtype-npm.yml";
	const source = await readFile(`${workflowDirectory}/${name}`, "utf8");
	for(const event of ["push", "pull_request"])
	{
		const altered = source.replace("  workflow_dispatch:\n"
			, `  ${event}:\n  workflow_dispatch:\n`);
		assert.notEqual(altered, source);
		assert.throws(() => assertWorkflowTriggerPolicy(name, altered));
	}
});
