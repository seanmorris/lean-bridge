/**
 * Preserve original nominal PHP evidence after independent semantic refusal checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { inspectFinContainerEdgePhpArchive } from "../tests/helpers/fin-container-edge-php-closure.mjs";
import { nominalSubtypePhpOriginal, nominalSubtypePhpGenerator } from "../tests/helpers/nominal-subtype-php-generators.mjs";
import { checkNominalSubtypePhpReport } from "../tests/helpers/nominal-subtype-php-report.mjs";
import { assertNominalSubtypePhpRun, nominalSubtypePhpSelections } from "../tests/helpers/nominal-subtype-php-provenance.mjs";
import { checkNominalSubtypePhpControls } from "../tests/helpers/nominal-subtype-php-controls.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary/full, ordinary/result-only, reviewed/full, reviewed/result-only prefixes");
const destination = "docs/evidence/nominal-subtype-php-20261013";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/vo1466-php-produce.mjs");
const files = new Map([["runner.mjs", runner]]), runs = [];
const producerCommit = "39f7f06e3db8f47b554ef039dc71c4bbc42ed98b";
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const phpVersion = "8.2.33", composerVersion = "2.5.5";
for(const [index, [route, mode]] of nominalSubtypePhpSelections.entries())
{
	await waitNominalSubtypeDotnetResources("build", { notify: console.log });
	const prefix = prefixes[index], label = `${route}-${mode}`;
	const startBytes = await readFile(prefix + "-start.json"), endBytes = await readFile(prefix + "-end.json");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes), tap = await readFile(prefix + ".tap");
	assertNominalSubtypePhpRun({ start, end, tap, runner, route, mode, prefix, producerCommit, floor, phpVersion, composerVersion });
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(start.started));
	const root = `${prefix}-output/${route}/${mode}`, read = path => readFile(join(root, path));
	await verifyPackageSetReceipt({ receiptPath: join(root, "handoff/package-set-receipt.json") });
	const receipt = JSON.parse(await read("handoff/package-set-receipt.json"));
	const packaged = JSON.parse(await read("package.json")), artifact = receipt.packages[0].artifacts[0];
	const archive = await read("handoff/" + artifact.path);
	assert.equal(archive.length, artifact.bytes);
	const { members } = inspectFinContainerEdgePhpArchive(archive, artifact.sha256);
	assert.deepEqual(Object.fromEntries([...members].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])), packaged.files);
	for(const path of packaged.retained) assert.deepEqual(await read("package/" + path), members.get(path), path);
	members.clear();
	const checked = await checkNominalSubtypePhpReport(read, { route, mode, producerCommit, runtime, floor, phpVersion, composerVersion });
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...checked.records, "handoff/" + artifact.path].sort());
	const controls = await checkNominalSubtypePhpControls(read, checked);
	for(const [path, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${path}`, bytes);
	for(const path of checked.records) files.set(`${label}/records/${path}`, await read(path));
	runs.push({ label, prefix, started: start.started, finished: end.finished, ...checked, controls, tapSha256: sha256(tap) });
	process.stdout.write(canonicalJson({ label, records: checked.records.length, controls }));
}
const failurePrefix = "build/vo1466-nominal-php-installed-reviewed-full-r1";
const failureLabel = "failed-reviewed-full-r1";
const failedStart = await readFile(failurePrefix + "-start.json"), failedEnd = await readFile(failurePrefix + "-end.json");
const failedTap = await readFile(failurePrefix + ".tap"), failed = JSON.parse(failedEnd);
assert.equal(failed.code, 1); assert.equal(failed.signal, null); assert.equal(failed.producerCommit, producerCommit);
assert.equal(failed.tapSha256, sha256(failedTap)); assert.equal(failed.tapBytes, failedTap.length);
assert.match(failedTap.toString(), /host load remained at or above 6 for five minutes/u);
assert.match(failedTap.toString(), /# pass 0\n# fail 1/u);
for(const [path, bytes] of [["start.json", failedStart], ["end.json", failedEnd], ["run.tap", failedTap]])
	files.set(`${failureLabel}/${path}`, bytes);
const generatorClosure = (await nominalSubtypePhpGenerator(producerCommit)).paths;
const selectedSources = [...new Set([
	...generatorClosure, "src/analyze/NativeExports.lean"
	, "src/build/native-component.mjs", "src/build/native-php-artifacts.mjs"
	, "src/release/native-composer.mjs", "src/release/deterministic-zip.mjs"
	, "src/analyze/package-metadata.mjs", "src/backends/php/brick-math.mjs"
	, "src/backends/php/brick-math.source.json"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, ...["fixture", "package", "tools", "installed-tests"].map(name => `tests/helpers/nominal-subtype-php-${name}.mjs`)
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/fin-container-edge-php-closure.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/brick-math.mjs", "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/type-corpus-compiler.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/module-closure.mjs"
	, "tests/fixtures/nominal-subtype-consumers/php-native.php"
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"]
		.map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
])].sort();
for(const path of selectedSources)
{
	const bytes = nominalSubtypePhpOriginal(producerCommit, path);
	for(const run of runs)
	{
		const start = JSON.parse(files.get(`${run.label}/start.json`));
		assert.equal(start.sources[path], sha256(bytes), path);
	}
	files.set(`sources/${path}`, bytes);
}
const checkers = ["generators", "report", "model-records", "package-records"
	, "tool-records", "environment-records", "provenance", "controls"];
for(const name of checkers) files.set(`checkers/${name}.mjs`, await readFile(`tests/helpers/nominal-subtype-php-${name}.mjs`));
const index = {
	schemaVersion: 1, kind: "nominal-subtype-php-installed-v1", producerCommit
	, runs, generatorClosure, selectedSources, checkers
	, failedAttempts: [{ label: failureLabel, prefix: failurePrefix
		, route: "reviewed", mode: "full", code: 1, tapSha256: sha256(failedTap)
		, reason: "Host load remained at or above six for five minutes before installation; no installed acceptance claimed." }]
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local PHP 8.2.33 and Composer 2.5.5 on Linux x64/glibc 2.36; no inference of hosted release-floor acceptance."
		, "The named ordinary/reviewed full/result-only nominal Nat fixture includes mixed Fin fields. Other primitive bases and transports remain separate work."
		, "No constructor/source entry counters or algorithm-memory measurements."
		, "The explicitly selected PHP and Composer distributions remain trusted tools. Command and loaded-extension identities are recorded, not a complete operating-system toolchain closure."
		, "Complete native binaries remain in the original retained build handoffs. This archive retains verified original ZIP digests and member identities, not those binaries."
		, "Original non-native package members, Composer discovery inputs and generated autoload records are retained unchanged."
		, "Author/build directories were removed before installation. PHP consumer source remains present because PHP executes it at runtime."
		, "The closed Composer installer authenticates inputs and outputs but does not retain Composer install/dump-autoload stdout."
		, "The original launch record hashes the retained runner and snapshots all 5,491 source inputs; terminal records report no changes."
		, "This archive alone neither promotes support nor establishes required recurring installed CI."]
};
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
