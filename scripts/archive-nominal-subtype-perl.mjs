/**
 * Retain four original nominal CPAN runs and the frozen generator source closure.
 * This archive does not promote support or claim constructor/source-entry counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkNominalSubtypePerlReport, nominalSubtypePerlRecords } from "../tests/helpers/nominal-subtype-perl-report.mjs";
import { assertNominalSubtypePerlRun, nominalSubtypePerlSelections } from "../tests/helpers/nominal-subtype-perl-provenance.mjs";
import { nominalSubtypePerlOriginal, nominalSubtypePerlGenerator } from "../tests/helpers/nominal-subtype-perl-generators.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary/full, reviewed/full, ordinary/result-only, reviewed/result-only prefixes");
const destination = "docs/evidence/nominal-subtype-perl-20261012";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/vo1444-nominal-perl-runner.mjs"), files = new Map([["runner.mjs", runner]]), runs = [];
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
for(const [index, [route, mode]] of nominalSubtypePerlSelections.entries())
{
	const prefix = prefixes[index], label = `${route}-${mode}`;
	assert.match(prefix, new RegExp(`^build/vo1444-nominal-perl-${label}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalSubtypePerlRun({ start, end, tap, runner, route, mode, prefix, producerCommit: start.revision, floor });
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(start.started));
	const root = `${prefix}-records/${route}/${mode}`;
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), nominalSubtypePerlRecords(route).sort());
	const checked = await checkNominalSubtypePerlReport(path => readFile(join(root, path)), { route, mode, producerCommit: start.revision, runtime, floor });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of nominalSubtypePerlRecords(route)) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	runs.push({ label, prefix, started: start.started, finished: end.finished
		, ...checked, tapSha256: sha256(tap)
		, reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
const producerCommit = runs[0].producerCommit;
assert.ok(runs.every(run => run.producerCommit === producerCommit));
const closure = (await nominalSubtypePerlGenerator(producerCommit)).paths;
const selectedSources = [...new Set([
	...closure, "src/analyze/NativeExports.lean", "src/build/native-component.mjs"
	, "src/build/cpan-projection.mjs", "src/build/perl-xs.mjs"
	, ...["Build.pm", "Runtime.pm", "Runtime.xs", "runtime.h"].map(path => `src/backends/perl/${path}`)
	, ...["cpan-package.mjs", "cpan-install.mjs", "cpan-install-trace.mjs"].map(path => `src/release/${path}`)
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, ...["fixture.mjs", "install.mjs", "installed-tests.mjs", "tests.mjs", "model.pl"].map(path => `tests/helpers/nominal-subtype-perl-${path}`)
	, "tests/helpers/checked-record-perl-install.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/nominal-subtype-consumers/perl.pl"
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
])].sort();
for(const path of selectedSources) files.set(`sources/${path}`, nominalSubtypePerlOriginal(producerCommit, path));
const checkers = ["report", "model-records", "package-records", "generators", "provenance"];
for(const name of checkers) files.set(`checkers/${name}.mjs`, await readFile(`tests/helpers/nominal-subtype-perl-${name}.mjs`));
const index = {
	schemaVersion: 1, kind: "nominal-subtype-perl-installed-v1"
	, producerCommit, runs, selectedSources, generatorClosure: closure, checkers
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Linux x64/glibc 2.36 acceptance, not hosted release-floor acceptance."
		, "Only the named ordinary/reviewed full/result-only nominal Nat fixture and mixed Fin fields."
		, "No Perl constructor/source entry counts or memory measurement."
		, "Package binaries and full toolchain closures are not retained."
		, "Original receipts, package hashes, execution records and the complete producer JavaScript generator closure are retained."
		, "The process tree uses one CPU and one Lean thread. GMP explicitly uses make -j2 despite MAKEFLAGS=-j1."
		, "This archive does not promote support or establish recurring installed CI gates."]
};
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
