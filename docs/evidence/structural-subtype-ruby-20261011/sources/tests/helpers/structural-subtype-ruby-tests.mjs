/**
 * Independent caller controls and exact Ruby author selections, without installed claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeRubyConfiguration, structuralSubtypeRubyCaller, structuralSubtypeRubyCounts, parseStructuralSubtypeRubyResult } from "./structural-subtype-ruby-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

const ruby = process.env.LEAN_BRIDGE_RUBY ?? resolve(".toolchains/ruby33/bin/ruby");
// Contract-only jobs need no Ruby installation. Explicit toolchain selections must work.
const callerControls = Boolean(process.env.LEAN_BRIDGE_RUBY) || existsSync(ruby);

test("structural Ruby configurations retain independent ordinary and reviewed contracts", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypeRubyConfiguration(route), previous = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: previous.targets }, previous);
		assert.deepEqual(configured.targets, { rubygems: { name: "structuralsubtypes", version: "1.0.0" } });
	}
	assert.equal(await structuralSubtypeRubyCaller("reviewed"), (await structuralSubtypeRubyCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypeRubyConfiguration("unknown"));
	await assert.rejects(structuralSubtypeRubyCaller("unknown"));
	assert.deepEqual(parseStructuralSubtypeRubyResult(JSON.stringify(structuralSubtypeRubyCounts)), structuralSubtypeRubyCounts);
	for(const key of Object.keys(structuralSubtypeRubyCounts))
		assert.throws(() => parseStructuralSubtypeRubyResult(JSON.stringify({ ...structuralSubtypeRubyCounts, [key]: 0 })));
});

test("Ruby caller detects dropped checks, normalization, NUL loss and mutation of either input", { skip: !callerControls && "Select LEAN_BRIDGE_RUBY to execute the Ruby caller controls" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-ruby-controls-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of ["ordinary", "reviewed"])
	{
		await saveLakeFile(root, `${route}.rb`, await structuralSubtypeRubyCaller(route));
		const run = await runCopied(ruby, [
			"--disable-gems"
			, resolve("tests/helpers/structural-subtype-ruby-model.rb")
			, join(root, `${route}.rb`)
			, route === "ordinary" ? "arg" : "value"], root);
		assert.equal(run.stderr, "");
		assert.deepEqual(JSON.parse(run.stdout), { ...structuralSubtypeRubyCounts, callerMutationControls: 8 });
	}
});
