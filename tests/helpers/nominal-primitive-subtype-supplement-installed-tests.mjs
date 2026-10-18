/**
 * Gated installed replay of the supplemental primitive-base callers on archived full packages.
 * Selected only with LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_SUPPLEMENT_TEST=1.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { nominalPrimitiveSubtypePythonExecutables, nominalPrimitiveSubtypePythonMinors } from "./nominal-primitive-subtype-python-fixture.mjs";
import {
	nominalPrimitiveSupplementCounts
	, nominalPrimitiveSupplementRoutes
	, replayNominalPrimitiveSupplementBrowsers
	, replayNominalPrimitiveSupplementNpm
	, replayNominalPrimitiveSupplementPython
} from "./nominal-primitive-subtype-supplement-installed.mjs";
import { waitNominalSubtypeDotnetResources as waitResources } from "./nominal-subtype-dotnet-resources.mjs";

const enabled = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_SUPPLEMENT_TEST === "1";
const outputRoot = resolve(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_SUPPLEMENT_OUTPUT ?? "build/nominal-primitive-subtype-supplement");
const executables = enabled ? nominalPrimitiveSubtypePythonExecutables(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHONS) : null;

/**
 * Refuse a dirty or unrecorded tree before producing new original records.
 *
 * @param output - New record directory that must not exist yet.
 */
const prepare = async output => {
	const fixtures = "tests/fixtures/nominal-primitive-subtype-consumers/";
	for(const path of [
		fixtures + "javascript-supplement.mjs", fixtures + "python-supplement.py"
		, fixtures + "browser-supplement.mjs"
		, "tests/helpers/nominal-primitive-subtype-supplement-installed.mjs"
	]) execFileSync("git", ["ls-files", "--error-unmatch", path]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	await waitResources(output);
};

for(const route of nominalPrimitiveSupplementRoutes)
	test(`supplemental primitive-base callers replay the archived npm ${route} full package`, { skip: !enabled, timeout: 1_800_000 }, async t => {
		const output = join(outputRoot, "npm", route); await prepare(output);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-supplement-npm-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const report = await replayNominalPrimitiveSupplementNpm({ route, directory, output });
		assert.deepEqual(report.counts, nominalPrimitiveSupplementCounts);
		assert.deepEqual(report.observations.map(item => item.relocated), [false, true]);
	});

for(const route of nominalPrimitiveSupplementRoutes) for(const minor of nominalPrimitiveSubtypePythonMinors)
	test(`supplemental primitive-base callers replay the archived Python ${minor} ${route} full wheel`, { skip: !enabled, timeout: 1_800_000 }, async t => {
		const output = join(outputRoot, "python", minor, route); await prepare(output);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-supplement-python-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const report = await replayNominalPrimitiveSupplementPython({ route, minor, command: executables[minor], root: join(directory, "consumer"), output });
		assert.deepEqual(report.counts, nominalPrimitiveSupplementCounts);
		assert.equal(report.python.split(".").slice(0, 2).join("."), minor);
	});

for(const route of nominalPrimitiveSupplementRoutes)
	test(`supplemental primitive-base callers replay the archived ${route} full package in three browser contexts`, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const output = join(outputRoot, "browser", route); await prepare(output);
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-supplement-browser-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const reports = await replayNominalPrimitiveSupplementBrowsers({ route, directory, output });
		assert.deepEqual(reports.map(item => item.profile), ["browser-javascript", "browser-react", "browser-worker"]);
	});
