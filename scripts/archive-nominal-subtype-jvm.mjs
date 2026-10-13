/**
 * Archive original nominal JVM acceptance after independent record and refusal checks.
 * This preserves original bytes and adds no installed support claim by itself.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { readClosedPackageZip } from "../tests/helpers/closed-package-zip.mjs";
import { inspectNominalSubtypeJvmPackage } from "../tests/helpers/nominal-subtype-jvm-package.mjs";
import { nominalSubtypeJvmOriginal, nominalSubtypeJvmGenerator } from "../tests/helpers/nominal-subtype-jvm-generators.mjs";
import { checkNominalSubtypeJvmReport } from "../tests/helpers/nominal-subtype-jvm-report.mjs";
import { nominalSubtypeJvmRetainedMembers } from "../tests/helpers/nominal-subtype-jvm-package-records.mjs";
import { assertNominalSubtypeJvmRun, nominalSubtypeJvmSelections } from "../tests/helpers/nominal-subtype-jvm-provenance.mjs";
import { checkNominalSubtypeJvmControls } from "../tests/helpers/nominal-subtype-jvm-controls.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary/full, ordinary/result-only, reviewed/full, reviewed/result-only prefixes");
const destination = "docs/evidence/nominal-subtype-jvm-20261013";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/vo1444-nominal-jvm-installed-runner.mjs");
const files = new Map([["runner.mjs", runner]]), runs = [];
const producerCommit = "70285c8cfc5ae0251adec4ba55a70ea2386a9869";
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const javaVersion = "openjdk 22.0.2 2024-07-16\n"
	+ "OpenJDK Runtime Environment Temurin-22.0.2+9 (build 22.0.2+9)\n"
	+ "OpenJDK 64-Bit Server VM Temurin-22.0.2+9 (build 22.0.2+9, mixed mode, sharing)\n";
for(const [index, [route, mode]] of nominalSubtypeJvmSelections.entries())
{
	await waitNominalSubtypeDotnetResources("build", { notify: console.log });
	const prefix = prefixes[index], label = `${route}-${mode}`;
	const startBytes = await readFile(prefix + "-started.json"), endBytes = await readFile(prefix + ".json");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes), tap = await readFile(prefix + ".tap");
	assertNominalSubtypeJvmRun({ start, end, tap, route, mode, prefix, producerCommit, floor });
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(start.started));
	const root = `${prefix}-output/${route}/${mode}`, raw = path => readFile(join(root, path));
	await verifyPackageSetReceipt({ receiptPath: join(root, "handoff/package-set-receipt.json") });
	const receipt = JSON.parse(await raw("handoff/package-set-receipt.json"));
	const model = JSON.parse(await raw("build-0/model.json")), compiled = JSON.parse(await raw("build-0/native-jvm.json"));
	const archive = await raw("handoff/archives/nominalsubtypes-1.0.0.jar");
	const installation = inspectNominalSubtypeJvmPackage(archive, { pkg: receipt.packages[0], model, compiled, floor, mode });
	const payload = readClosedPackageZip(archive), supplement = new Map();
	for(const path of nominalSubtypeJvmRetainedMembers(installation.receipt))
	{
		assert.ok(payload.has(path), path); supplement.set("package/" + path, payload.get(path));
	}
	payload.clear();
	const read = path => supplement.has(path) ? Promise.resolve(supplement.get(path)) : raw(path);
	const checked = await checkNominalSubtypeJvmReport(read, { route, mode, producerCommit, runtime, floor, javaVersion });
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [
		...checked.records.filter(path => !path.startsWith("package/"))
		, "handoff/archives/nominalsubtypes-1.0.0.jar"
	].sort());
	const controls = await checkNominalSubtypeJvmControls(read, checked);
	for(const [path, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]])
		files.set(`${label}/${path}`, bytes);
	for(const path of checked.records) files.set(`${label}/records/${path}`, await read(path));
	runs.push({ label, prefix, started: start.started, finished: end.finished
		, ...checked, controls, tapSha256: sha256(tap) });
	process.stdout.write(canonicalJson({ label, records: checked.records.length, controls }));
}
const generatorClosure = (await nominalSubtypeJvmGenerator(producerCommit)).paths;
const selectedSources = [...new Set([
	...generatorClosure, "src/analyze/NativeExports.lean"
	, "src/build/native-component.mjs", "src/build/native-jvm-artifacts.mjs"
	, "src/build/compile-jvm-sources.mjs", "src/release/native-maven.mjs"
	, "src/release/deterministic-zip.mjs", "src/analyze/package-metadata.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, ...["fixture", "package", "probe", "nullability", "installed-tests"]
		.map(name => `tests/helpers/nominal-subtype-jvm-${name}.mjs`)
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/fin-container-edge-jvm-closure.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/type-corpus-compiler.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/module-closure.mjs"
	, "tests/fixtures/nominal-subtype-consumers/java.java"
	, "tests/fixtures/nominal-subtype-consumers/kotlin.kt"
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain"
		, "package.json", "LICENSE"]
		.map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
])].sort();
for(const path of selectedSources)
{
	const bytes = nominalSubtypeJvmOriginal(producerCommit, path);
	for(const run of runs)
	{
		const start = JSON.parse(files.get(`${run.label}/start.json`));
		assert.equal(start.sources[path], sha256(bytes), path);
	}
	files.set(`sources/${path}`, bytes);
}
const checkers = ["generators", "report", "model-records", "package-records"
	, "consumer-records", "provenance", "controls"];
for(const name of checkers) files.set(`checkers/${name}.mjs`, await readFile(`tests/helpers/nominal-subtype-jvm-${name}.mjs`));
const index = {
	schemaVersion: 1, kind: "nominal-subtype-jvm-installed-v1", producerCommit
	, runs, generatorClosure, selectedSources, checkers
	, files: [...files].sort(([a], [b]) => a.localeCompare(b))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local JDK 22.0.2 and Kotlin 2.2.0 on Linux x64/glibc 2.36, not hosted release-floor acceptance."
		, "Only the named ordinary/reviewed full/result-only nominal Nat fixture and mixed Fin fields."
		, "No constructor/source entry counts or algorithm-memory measurements."
		, "The JDK and Kotlin distributions are trusted tools, not a complete authenticated toolchain closure."
		, "Complete native binaries remain in the original build handoffs; their receipt identities and the verified original JAR digest are retained here."
		, "Non-native JAR members were extracted from the hash-verified originals after execution; they are original bytes, not new compiler outputs."
		, "The successful producer removed its scratch consumer classes and JARs. Their original identities and execution records remain, but those consumer binaries are not committed here."
		, "Source-free replay removed author and consumer source trees. The installed component JAR retains generated sources and provenance metadata."
		, "The installer retains package/source/output identities, not compiler stdout. Separate API and nullability probes retain their compiler output and emitted classes."
		, "The retained runner source was not hashed in the original launch record. Launch/terminal records instead retain the complete frozen tracked source map."
		, "This archive neither promotes support nor establishes required recurring installed CI gates."]
};
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
