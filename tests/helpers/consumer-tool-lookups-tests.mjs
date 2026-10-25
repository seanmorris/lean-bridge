/**
 * Check actual workflow sites and execute discovery failures in real Bash.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consumerToolCommands, consumerToolExportLines } from "./consumer-tool-lookups.mjs";

const sites = [
	["owned-dotnet-callback-results"
		, "Verify .NET callback-result lifetimes"
		, ["DOTNET","RUBY","GEM"]]
	, ["owned-perl-callback-results"
		, "Verify Perl callback-result lifetimes and installed consumers"
		, ["MAVEN","DOTNET","RUBY","GEM"]]
	, ["owned-jvm-callback-results"
		, "Verify JVM callback-result lifetimes and installed consumers"
		, ["MAVEN","DOTNET","RUBY","GEM"]]
	, ["owned-ruby-callback-results"
		, "Verify Ruby callback-result lifetimes"
		, ["RUBY","GEM"]]
	, ["owned-php-callback-results"
		, "Execute ordinary and reviewed native callback-result shapes"
		, ["PHP"]]
	, ["owned-php-callback-results"
		, "Build and install all six native Composer package configurations"
		, ["PHP","COMPOSER"]]
	, ["php-receivers"
		, "Verify receiver lifetimes and installed Composer releases"
		, ["PHP","COMPOSER"]]
	, ["php-consumers"
		, "Compare weak and strict installed Composer callers with fresh Lean"
		, ["PHP","COMPOSER"]]
	, ["php-consumers"
		, "Execute owned native PHP values and source-free Composer releases"
		, ["PHP","COMPOSER"]]
	, ["managed-consumers"
		, "Compare installed NuGet corpus packages with fresh Lean results"
		, ["PYTHON","RUBY","GEM","DOTNET"]]
	, ["managed-consumers"
		, "Compare isolated Java and Kotlin corpus consumers with fresh Lean"
		, ["PYTHON","RUBY","GEM","DOTNET","MAVEN"]]
	, ["managed-consumers"
		, "Build ordinary Lean APIs and install relocated RubyGems releases"
		, ["RUBY","GEM"]]
	, ["managed-consumers"
		, "Compare installed Ruby corpus packages with fresh Lean results"
		, ["PYTHON","RUBY","GEM"]]
	, ["owned-jvm-values"
		, "Verify owned JVM values, transfers, borrows and receivers"
		, ["PYTHON","RUBY","GEM","DOTNET","MAVEN"]]
];
const workflowPath = ".github/workflows/consumer-matrix.yml";
const read = () => readFile(workflowPath, "utf8");
const padded = name => consumerToolExportLines(name).map(line => "          " + line).join("\n");

const assertLookups = workflow => {
	assert.doesNotMatch(workflow, /^\s*export\s+[^\n]*\$\(/mu);
	let job, step, run = false, offset = 0;
	const rows = [], lines = workflow.split("\n");
	for(const [number, line] of lines.entries())
	{
		const selectedJob = /^ {2}([a-z][a-z0-9-]*):$/u.exec(line);
		if(selectedJob) job = selectedJob[1];
		const selectedStep = /^ {6}- name: (.+)$/u.exec(line);
		if(selectedStep) step = selectedStep[1];
		if(/^ {0,9}\S/u.test(line)) run = false;
		if(line === "        run: |") run = true;
		const assignment = /^ {10}LEAN_BRIDGE_([A-Z]+)=.*\$\(command -v /u.exec(line);
		if(assignment)
		{
			assert.ok(run, "Tool lookup must execute in a run block");
			const name = assignment[1];
			assert.equal(line + "\n" + lines[number + 1], padded(name));
			rows.push({ job, step, name, offset });
		}
		offset += line.length + 1;
	}
	assert.deepEqual(rows.map(({ job, step, name }) => [job, step, name])
		, sites.flatMap(([job, step, names]) => names.map(name => [job, step, name])));
	return rows;
};

test("consumer tool lookups require all 41 fail-fast exports in their fourteen run steps", async () => {
	assert.equal(sites.length, 14);
	assert.equal(assertLookups(await read()).length, 41);
});

test("consumer tool lookups reject masking, missing, reordered and substituted setup at every site", async () => {
	const workflow = await read(), rows = assertLookups(workflow);
	let refused = 0;
	for(const { name, offset } of rows)
	{
		const [assignment, exported] = consumerToolExportLines(name);
		const original = padded(name);
		assert.equal(workflow.slice(offset, offset + original.length), original);
		for(const lines of [
			["export " + assignment], [assignment], [exported, assignment]
			, [assignment + " || true", exported]
			, [assignment, "export LEAN_BRIDGE_OTHER"]
			, [assignment.replace("command -v ", "command -v missing_"), exported]
		]) {
			const mutated = workflow.slice(0, offset)
				+ lines.map(line => "          " + line).join("\n")
				+ workflow.slice(offset + original.length);
			assert.notEqual(mutated, workflow);
			assert.throws(() => assertLookups(mutated), undefined, name);
			refused++;
		}
	}
	assert.equal(refused, 246);
});

test("consumer tool lookups export discovered paths and stop real Bash before using a missing tool", async t => {
	const workflow = await read(); assertLookups(workflow);
	const directory = await mkdtemp(join(tmpdir(), "lean-consumer-tool-lookups-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const binaryDirectory = join(directory, "tools with spaces");
	await mkdir(binaryDirectory);
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && !["BASH_ENV", "ENV", "SHELLOPTS"].includes(key)));
	let successful = 0, stopped = 0, legacyMasked = 0;
	for(const [name, executable] of Object.entries(consumerToolCommands))
	{
		const path = join(binaryDirectory, executable);
		await writeFile(path, "#!/bin/sh\nexit 0\n", { mode: 0o755, flag: "wx" });
		const lines = consumerToolExportLines(name);
		assert.ok(workflow.includes(padded(name)));
		const child = JSON.stringify(process.execPath) + " -e 'process.stdout.write(process.env.LEAN_BRIDGE_"
			+ name + " ?? \"not exported\")'";
		const execute = (script, path) => spawnSync("/bin/bash"
			, ["--noprofile", "--norc", "-eo", "pipefail", "-c", script.join("\n") + "\n" + child]
			, { encoding: "utf8", timeout: 10_000, maxBuffer: 4096, env: { ...environment, PATH: path } });
		const good = execute(lines, binaryDirectory);
		assert.equal(good.status, 0, good.stderr); assert.equal(good.signal, null);
		assert.equal(good.stdout, path); successful++;
		const missing = execute(lines, join(directory, "missing"));
		assert.equal(missing.status, 1, missing.stderr); assert.equal(missing.signal, null);
		assert.equal(missing.stdout, ""); stopped++;
		const legacy = execute(consumerToolExportLines(name, true), join(directory, "missing"));
		assert.equal(legacy.status, 0, legacy.stderr); assert.equal(legacy.signal, null);
		assert.equal(legacy.stdout, ""); legacyMasked++;
	}
	assert.deepEqual({ successful, stopped, legacyMasked }, { successful: 7, stopped: 7, legacyMasked: 7 });
});

test("consumer tool lookups limit legacy formatting to an explicit closed tool declaration", () => {
	for(const value of ["OTHER", "PHP; exit 0", "", "constructor", "__proto__"])
		assert.throws(() => consumerToolExportLines(value));
	for(const value of [1, "true", null, {}]) assert.throws(() => consumerToolExportLines("PHP", value));
	assert.deepEqual(consumerToolExportLines("PHP"), ['LEAN_BRIDGE_PHP="$(command -v php)"', "export LEAN_BRIDGE_PHP"]);
	assert.deepEqual(consumerToolExportLines("PHP", true), ['export LEAN_BRIDGE_PHP="$(command -v php)"']);
});
