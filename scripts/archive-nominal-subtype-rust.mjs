/**
 * Archive original nominal Rust acceptance and independently checked source inputs.
 * This does not promote support or claim constructor/source-entry observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { checkNominalSubtypeRustReport, nominalSubtypeRustRecords } from "../tests/helpers/nominal-subtype-rust-report.mjs";
import { assertNominalSubtypeRustRun, nominalSubtypeRustSelections } from "../tests/helpers/nominal-subtype-rust-provenance.mjs";
import { nominalSubtypeRustOriginal, nominalSubtypeRustGenerator } from "../tests/helpers/nominal-subtype-rust-generators.mjs";
import { nominalSubtypeRustDependencyManifests } from "../tests/helpers/nominal-subtype-rust-dependency-records.mjs";
import { readOwnedPerlCallbackVariantTar } from "../tests/helpers/owned-perl-callback-result-variant-archives.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary/full, reviewed/full, ordinary/result-only, reviewed/result-only prefixes");
const destination = "docs/evidence/nominal-subtype-rust-20261012";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/vo1444-nominal-rust-runner.mjs"), files = new Map([["runner.mjs", runner]]), runs = [];
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
for(const [index, [route, mode]] of nominalSubtypeRustSelections.entries())
{
	const prefix = prefixes[index], label = `${route}-${mode}`;
	assert.match(prefix, new RegExp(`^build/vo1444-nominal-rust-${label}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalSubtypeRustRun({ start, end, tap, runner, route, mode, prefix, producerCommit: start.revision, floor });
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(start.started));
	const root = `${prefix}-records/${route}/${mode}`, readOriginal = path => readFile(join(root, path));
	const crate = JSON.parse(await readOriginal("crate.json")), dependencies = JSON.parse(await readOriginal("dependencies.json"));
	const supplement = nominalSubtypeRustDependencyManifests(await readOriginal(`dependency-handoff/${dependencies.archive}`), dependencies);
	const read = path => supplement.has(path) ? Buffer.from(supplement.get(path)) : readOriginal(path);
	const records = nominalSubtypeRustRecords(route, crate, dependencies);
	await verifyPackageSetReceipt({ receiptPath: join(root, "handoff/package-set-receipt.json") });
	const receiptBytes = await readOriginal("handoff/package-set-receipt.json"), receipt = JSON.parse(receiptBytes);
	assert.deepEqual(receiptBytes, await readOriginal("build-0/package-set-receipt.json"));
	const handoff = ["package-set-receipt.json", "package-set-receipt.json.sha256"
		, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(item => item.path))].map(path => `handoff/${path}`);
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...records.filter(path => !supplement.has(path)), ...handoff, `dependency-handoff/${dependencies.archive}`].sort());
	const pkg = receipt.packages[0], artifact = pkg.artifacts[0], archive = await readOriginal(`handoff/${artifact.path}`);
	assert.equal(archive.length, artifact.bytes); assert.equal(sha256(archive), artifact.sha256);
	const payload = readOwnedPerlCallbackVariantTar(archive, `${pkg.name}-${pkg.version}`);
	assert.deepEqual([...payload.keys()].sort(), Object.keys(crate.files).sort());
	for(const [path, bytes] of payload)
	{
		assert.deepEqual(crate.files[path], { bytes: bytes.length, sha256: sha256(bytes) });
		if(crate.retained.includes(path)) assert.deepEqual(await readOriginal(`package/${path}`), bytes);
	}
	const toolchain = JSON.parse(await readOriginal("toolchain.json"));
	const checked = await checkNominalSubtypeRustReport(read, { route, mode, producerCommit: start.revision, runtime, floor, toolchain });
	for(const name of ["rustc", "cargo"]) assert.equal(toolchain[name].command, start.environment[`LEAN_BRIDGE_${name.toUpperCase()}`]);
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of records) files.set(`${label}/records/${path}`, await read(path));
	runs.push({ label, prefix, started: start.started, finished: end.finished
		, ...checked, tapSha256: sha256(tap)
		, reportSha256: sha256(await readOriginal("report.json")) });
}
const producerCommit = runs[0].producerCommit;
assert.ok(runs.every(run => run.producerCommit === producerCommit));
const closure = (await nominalSubtypeRustGenerator(producerCommit)).paths;
const selectedSources = [...new Set([
	...closure, "src/analyze/NativeExports.lean", "src/build/native-component.mjs"
	, "src/build/native-rust-artifacts.mjs", "src/build/native-rust-projection.mjs"
	, "src/build/native-artifacts.mjs", "src/release/native-cargo.mjs"
	, "src/release/deterministic-archive.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, ...["fixture.mjs", "package.mjs", "install.mjs", "installed-tests.mjs", "tests.mjs", "model.rs", "generators.mjs"].map(path => `tests/helpers/nominal-subtype-rust-${path}`)
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/type-corpus-rust.mjs"
	, "tests/helpers/type-corpus-compiler.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/module-closure.mjs"
	, "tests/fixtures/nominal-subtype-consumers/rust.rs"
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
])].sort();
for(const path of selectedSources) files.set(`sources/${path}`, nominalSubtypeRustOriginal(producerCommit, path));
const checkers = ["report", "model-records", "package-records"
	, "environment-records"
	, "dependency-records", "metadata-records", "provenance", "controls"];
for(const name of checkers) files.set(`checkers/${name}.mjs`, await readFile(`tests/helpers/nominal-subtype-rust-${name}.mjs`));
const index = {
	schemaVersion: 1, kind: "nominal-subtype-rust-installed-v1"
	, producerCommit, runs, selectedSources, generatorClosure: closure, checkers
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Rust and Cargo 1.90.0 on Linux x64/glibc 2.36, not hosted release-floor acceptance."
		, "Only the named ordinary/reviewed full/result-only nominal Nat fixture and mixed Fin fields."
		, "No Rust constructor/source entry counts or algorithm-memory measurement."
		, "Native binaries and full compiler/system-library closures are not committed here; original crates and vendored dependency archives remain in build handoffs."
		, "The source-free executable was checked by digest during execution and removed with successful scratch cleanup; its original observations and digest are retained."
		, "Dependency checksum supplements are original members extracted from the hash-verified handoffs after the runs, not new producer output."
		, "Original receipts, all generated text files, process output, compiler diagnostics, and the complete frozen Rust generator and lock resource are retained."
		, "The process tree uses one CPU, one Cargo job and one Lean thread. GMP explicitly uses make -j2 despite MAKEFLAGS=-j1."
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
