/**
 * Retain original nominal Ruby acceptance, receipts and frozen generator sources.
 * This archive does not promote support or claim constructor/source-entry counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { checkNominalSubtypeRubyReport, nominalSubtypeRubyRecords } from "../tests/helpers/nominal-subtype-ruby-report.mjs";
import { assertNominalSubtypeRubyRun, nominalSubtypeRubySelections } from "../tests/helpers/nominal-subtype-ruby-provenance.mjs";
import { nominalSubtypeRubyOriginal, nominalSubtypeRubyGenerator } from "../tests/helpers/nominal-subtype-ruby-generators.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary/full, reviewed/full, ordinary/result-only, reviewed/result-only prefixes");
const destination = "docs/evidence/nominal-subtype-ruby-20261012";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/vo1444-nominal-ruby-runner.mjs"), files = new Map([["runner.mjs", runner]]), runs = [];
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36", rubyVersion = "3.3.12";
for(const [index, [route, mode]] of nominalSubtypeRubySelections.entries())
{
	const prefix = prefixes[index], label = `${route}-${mode}`;
	assert.match(prefix, new RegExp(`^build/vo1444-nominal-ruby-${label}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalSubtypeRubyRun({ start, end, tap, runner, route, mode, prefix, producerCommit: start.revision, floor });
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(start.started));
	const root = `${prefix}-records/${route}/${mode}`, gem = JSON.parse(await readFile(join(root, "gem.json")));
	const records = nominalSubtypeRubyRecords(route, gem);
	await verifyPackageSetReceipt({ receiptPath: join(root, "handoff/package-set-receipt.json") });
	const receiptBytes = await readFile(join(root, "handoff/package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
	assert.deepEqual(receiptBytes, await readFile(join(root, "build-0/package-set-receipt.json")));
	const handoff = ["package-set-receipt.json", "package-set-receipt.json.sha256"
		, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(item => item.path))].map(path => `handoff/${path}`);
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...records, ...handoff].sort());
	const checked = await checkNominalSubtypeRubyReport(path => readFile(join(root, path)), { route, mode, producerCommit: start.revision, runtime, floor, rubyVersion });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of records) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	runs.push({ label, prefix, started: start.started, finished: end.finished
		, ...checked, tapSha256: sha256(tap)
		, reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
const producerCommit = runs[0].producerCommit;
assert.ok(runs.every(run => run.producerCommit === producerCommit));
const closure = (await nominalSubtypeRubyGenerator(producerCommit)).paths;
const selectedSources = [...new Set([
	...closure, "src/analyze/NativeExports.lean", "src/build/native-component.mjs"
	, "src/build/native-ruby-artifacts.mjs", "src/build/native-artifacts.mjs"
	, "src/release/native-rubygems.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, ...["fixture.mjs", "package.mjs", "installed-tests.mjs", "tests.mjs", "model.rb", "generators.mjs"].map(path => `tests/helpers/nominal-subtype-ruby-${path}`)
	, "tests/helpers/fin-container-edge-ruby-closure.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/module-closure.mjs"
	, "tests/fixtures/nominal-subtype-consumers/ruby.rb"
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
])].sort();
for(const path of selectedSources) files.set(`sources/${path}`, nominalSubtypeRubyOriginal(producerCommit, path));
const checkers = ["report", "model-records", "package-records", "environment-records", "provenance", "controls"];
for(const name of checkers) files.set(`checkers/${name}.mjs`, await readFile(`tests/helpers/nominal-subtype-ruby-${name}.mjs`));
const index = {
	schemaVersion: 1, kind: "nominal-subtype-ruby-installed-v1"
	, producerCommit, runs, selectedSources, generatorClosure: closure, checkers
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local MRI Ruby 3.3.12 on Linux x64/glibc 2.36, not hosted release-floor acceptance."
		, "Only the named ordinary/reviewed full/result-only nominal Nat fixture and mixed Fin fields."
		, "No Ruby constructor/source entry counts or algorithm-memory measurement."
		, "Gem binaries and full trusted MRI/RubyGems/standard-library closures are not committed here; original gems remain in their build handoffs."
		, "Original receipts, archive-derived environment inventories, installed specifications, process output and the complete frozen Ruby generator closure are retained."
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
