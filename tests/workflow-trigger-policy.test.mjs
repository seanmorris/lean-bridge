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
	, ["dependent-signature-complete.yml", ["pull_request", "push"]]
	, ["direct-proof-erasure-complete.yml", ["pull_request", "push"]]
	, ["host-null-complete.yml", ["pull_request", "push"]]
	, ["optional-parameter-complete.yml", ["pull_request", "push"]]
	, ["performance.yml", ["push"]]
	, ["quality.yml", ["pull_request", "push"]]
	, ["reproducible-release.yml", ["pull_request"]]
	, ["reviewed-fin-wasm-entry.yml", ["push"]]
]);

const pathScopedAutomaticWorkflows = new Set([
	"checked-record-value-index-matrix.yml"
	, "dependent-checked-record-matrix.yml"
	, "dependent-signature-complete.yml"
	, "direct-proof-erasure-complete.yml"
	, "host-null-complete.yml"
	, "optional-parameter-complete.yml"
	, "reviewed-fin-wasm-entry.yml"
]);

const nonSweepWorkflows = new Set([
	"checked-record-value-index-matrix.yml"
	, "consumer-matrix.yml"
	, "demos-pages.yml"
	, "dependent-checked-record-matrix.yml"
	, "dependent-signature-complete.yml"
	, "direct-proof-erasure-complete.yml"
	, "host-null-complete.yml"
	, "optional-parameter-complete.yml"
	, "owned-checked-record-npm-browser.yml"
	, "performance.yml"
	, "perl-consumer.yml"
	, "php-wasm-refinement-entry-promotion.yml"
	, "quality.yml"
	, "reproducible-release.yml"
	, "reviewed-fin-wasm-entry.yml"
]);

const sweepCron = index => {
	assert.ok(Number.isSafeInteger(index) && index >= 0 && index < 112);
	const day = Math.floor(index / 16);
	const minutes = index % 16 * 90 + 17;
	return `${minutes % 60} ${Math.floor(minutes / 60)} * * ${day}`;
};

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

const scheduleCrons = source => {
	const { block, events } = workflowEvents(source);
	if(!events.includes("schedule")) return [];
	return [...eventBody(block, "schedule").matchAll(
		/^ {4}- cron: ["']([^"']+)["']\s*$/gmu
	)].map(match => match[1]);
};

const assertSweepSlot = (name, source, index) => {
	assert.ok(source.includes(
		"# One lane in the bounded weekly default-branch acceptance sweep."
	), `${name} documents its recurring sweep role`);
	const actual = scheduleCrons(source);
	assert.deepEqual(actual, [sweepCron(index)]
		, `${name} has its unique bounded weekly sweep slot`);
	return actual[0];
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
	assert.equal(names.length, 127, "review every workflow added to the repository");
	const sources = new Map();

	for(const name of names)
	{
		const source = await readFile(`${workflowDirectory}/${name}`, "utf8");
		sources.set(name, source);
		assertWorkflowTriggerPolicy(name, source);
	}
	const sweep = names.filter(name => !nonSweepWorkflows.has(name));
	assert.equal(sweep.length, 112);
	const crons = sweep.map((name, index) =>
		assertSweepSlot(name, sources.get(name), index));
	assert.equal(new Set(crons).size, sweep.length
		, "weekly sweep slots do not overlap");

	assert.equal(approvedAutomaticEvents.size, 12);
	assert.equal(pathScopedAutomaticWorkflows.size, 7);
	assert.equal(nonSweepWorkflows.size, 15);
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

test("the recurring sweep fails closed on a removed or duplicate slot", async () => {
	const names = (await readdir(workflowDirectory))
		.filter(name => name.endsWith(".yml") && !nonSweepWorkflows.has(name))
		.sort();
	assert.equal(names.length, 112);
	const first = await readFile(`${workflowDirectory}/${names[0]}`, "utf8");
	const second = await readFile(`${workflowDirectory}/${names[1]}`, "utf8");
	const removed = first.replace(
		/ {2}# One lane in the bounded weekly default-branch acceptance sweep\.\n {2}schedule:\n {4}- cron: [^\n]+\n/u, "");
	assert.throws(() => assertSweepSlot(names[0], removed, 0));
	const duplicate = second.replace(`"${sweepCron(1)}"`
		, `"${sweepCron(0)}"`);
	assert.notEqual(duplicate, second);
	assert.throws(() => assertSweepSlot(names[1], duplicate, 1));
});
