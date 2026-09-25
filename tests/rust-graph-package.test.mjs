/**
 * Prepared recursive Cargo APIs, private loaders and installed-consumer checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedRustGraphPackage, compileCopiedRustGraphPackageModel } from "../src/backends/rust/copied-graph-package.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { generateCopiedGraphPackage } from "../src/backends/c/graph-package.mjs";
import { auditRustPackage } from "../src/backends/rust/package-audit.mjs";
import { copiedRustLock } from "../src/backends/rust/copied-values.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { assertPythonGraphSourceUpdate } from "./helpers/native-python-graph-regression.mjs";
import { assertCargoGraphRegressions } from "./helpers/native-cargo-graph-regression.mjs";

test("recursive Cargo APIs borrow containers, preserve aliases and hide native loading", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir);
	const files = generateCopiedRustGraphPackage(ir), model = compileCopiedRustGraphPackageModel(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedRustGraphPackage(ir), files);
	const audit = auditRustPackage(ir, files);
	assert.ok(audit.exports.includes("Forest")); assert.ok(audit.exports.includes("word_max"));
	assert.match(files["src/lib.rs"], /pub fn forest\(arg0: &\[Tree\]\) -> Result<Forest, Error>/);
	assert.match(files["src/lib.rs"], /pub fn word_max\(arg0: u64\) -> Result<bool, Error>/);
	assert.match(files["src/lib.rs"], /pub fn units\(arg0: &\[\(\)\]\)/);
	assert.match(files["src/lib.rs"], /pub fn envelope\(arg0: &Envelope\)/);
	assert.doesNotMatch(files["src/lib.rs"], /unsafe|extern|c_void|GraphRaw|graph_call/);
	assert.match(files["src/__runtime.rs"], /Some\(&runtime.lifecycle\)/);
	assert.match(files["src/__runtime.rs"], /Start a fresh process after fork/);
	assert.ok(files["src/__runtime.rs"].includes('symbol!("recursive_graph_retire"'));
	const call = files["src/__runtime.rs"].slice(files["src/__runtime.rs"].indexOf("pub(super) fn call0"));
	assert.ok(call.indexOf("graph_check") < call.indexOf("graph_runtime()?"));
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).copiedGraph, { schemaVersion: 1, layoutSha256: model.layoutSha256 });
	assert.match(files["README.md"], /262,144 nodes/); assert.doesNotMatch(files["README.md"], /32 levels|acyclic/);
});

test("recursive Cargo admission validates every requested target without requiring GMP or Boost", () => {
	const ir = nativeRecursiveReviewedIr(), model = compileNativeGraphProjection(ir, ["cargo"]);
	assert.equal(model.prefix, "recursive");
	assert.equal(compileNativeGraphProjection(ir, ["c", "cpp", "cargo"]).layoutSha256, model.layoutSha256);
	assert.equal(compileNativeGraphProjection(ir, ["cargo", "pypi"]).layoutSha256, model.layoutSha256);
	assert.equal(generateCopiedGraphPackage(ir, ["c", "cpp"]).layoutSha256, model.layoutSha256);
	for(const host of ["maven", "php-native", "wit-wasi"])
		assert.equal(compileNativeGraphProjection(ir, ["cargo", host]).layoutSha256, model.layoutSha256);
	for(const targets of [[], ["cargo", "cargo"], ["cargo", "cpan"], ["unknown"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
	for(const name of ["dispatch", "assets", "graphRuntime", "graphReady", "call0"])
	{
		const invalid = structuredClone(ir); invalid.declarations[0].name = name;
		assert.throws(() => compileCopiedRustGraphPackageModel(invalid), /reserved/);
	}
	for(const name of ["GraphNative", "sha2", "assets"])
	{
		const invalid = structuredClone(ir); invalid.types[0].name = name;
		assert.throws(() => compileCopiedRustGraphPackageModel(invalid), /reserved/);
	}
});

test("recursive Cargo source compiles and validates before automatic loading", { skip: process.env.LEAN_BRIDGE_RUST_GRAPH_TEST !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-graph-package-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedRustGraphPackage(nativeRecursiveReviewedIr());
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "Cargo.lock", await copiedRustLock("lean_bridge_recursive", "1.0.0"));
	await saveLakeFile(root, "src/__runtime.rs", files["src/__runtime.rs"] + `
#[cfg(test)] mod package_tests {
    use super::*;
    #[test] fn invalid_inputs_do_not_load_native_assets() {
        let mut value = Spine::Leaf { value: 1 };
        for _ in 0..130 { value = Spine::Next { value: Box::new(value) }; }
        assert_eq!(crate::spine(&value), Err(Error::Limit));
        assert!(GRAPH_NATIVE.get().is_none());
        assert_eq!(GRAPH_FAULT.with(|state| state.get().1), 0);
        assert_eq!(GRAPH_LIVE.with(|state| state.get()), 0);
        assert!(matches!(crate::empty(), Err(Error::Load(message)) if message.contains("Build a compiled Cargo release")));
    }
    #[test] fn graph_errors_keep_public_error_variants() {
        assert_eq!(graph_error(GraphError::Limit), Error::Limit);
        assert_eq!(graph_error(GraphError::Allocation), Error::Allocation);
        assert_eq!(graph_error(GraphError::InvalidNative), Error::InvalidNative);
        assert!(matches!(graph_error(GraphError::InvalidInput), Error::Native { code: 1, .. }));
        assert!(matches!(graph_error(GraphError::Unavailable), Error::Native { code: 5, .. }));
        assert!(!Error::Limit.to_string().is_empty());
    }
}
`);
	const environment = nativeFixtureEnvironment(["rust"]), env = { ...environment
		, RUSTC: environment.LEAN_BRIDGE_RUSTC, RUSTFLAGS: "-Dwarnings"
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_TARGET_DIR: join(root, "target") };
	const result = await runCopied(environment.LEAN_BRIDGE_CARGO, ["test", "--locked", "--offline", "--lib"], root, env);
	assert.match(result.stdout, /2 passed; 0 failed/);
});

test("prepared recursive Cargo crates install offline and run without producer or installed sources", {
	skip: process.env.LEAN_BRIDGE_RUST_GRAPH_PACKAGE_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-rust-graph-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkInstalledRustGraphs } = await import("./helpers/rust-graph-packages.mjs");
	const report = await checkInstalledRustGraphs(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	for(const item of report.observations) assert.ok(item.checks > 100);
	await saveLakeFile("build/recursive", "rust-packages.json", canonicalJson(report));
});

test("recursive Cargo evidence binds installed archives, typed callers and unchanged shared-build behavior", async () => {
	const record = JSON.parse(await readFile("docs/evidence/rust-recursive-packages-20260923.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.wordBits, 64); assert.equal(record.installedPackage, true);
	assert.equal(record.reportSha256, sha256(canonicalJson(record.report)));
	assert.equal(record.log.sha256, sha256(record.log.text));
	assert.match(record.log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertPythonGraphSourceUpdate(path, hash);
	const ir = nativeRecursiveReviewedIr();
	ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const generated = generateCopiedRustGraphPackage(ir, null, { name: "recursive-api", version: "1.0.0" });
	assert.deepEqual(record.report.observations.map(run => run.reviewed), [false, true]);
	for(const run of record.report.observations)
	{
		assert.equal(run.exports, 18); assert.equal(run.checks, 365); assert.equal(run.checkpoints, 28);
		assert.equal(run.rejected.length, 6);
		assert.equal(run.publicSourceSha256, sha256(generated["src/lib.rs"]));
		assert.equal(run.conversionSourceSha256, sha256(generated["src/__runtime.rs"]));
		for(const key of ["offline", "emptyCargoHome", "linkOnly", "installedSourcesRemoved", "authorSourcesRemoved", "handoffRemoved", "compilerFreeExecution", "normalExitCleanup", "sharedRuntime", "forkRejection", "crossCrateRetirement", "rejectsTamperedAssets", "rejectsRegeneratedSourceDrift", "deterministicReassembly", "checkedSourceUnchanged", "cargoOnly"])
			assert.equal(run[key], true, key);
		assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.composition.componentCount, 2);
		assert.equal(run.package.name, "recursive-api"); assert.equal(run.package.target, "cargo");
		assert.equal(run.package.runtimeDelivery, "embedded"); assert.deepEqual(run.package.requires, []);
		assert.equal(run.package.runtimeIdentity, run.composition.package.runtimeIdentity);
		const guide = (await readFile("docs/consume/rust.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
		assert.equal(run.documentation.sourceSha256, sha256(guide.match(/```rust\n([^]*?)\n```/)[1] + "\n"));
		const previous = record.reproduction.runs.find(item => item.reviewed === run.reviewed);
		for(const key of ["package", "binarySha256", "layoutSha256", "publicSourceSha256", "conversionSourceSha256", "loaderSourceSha256", "compiledProjectionSha256"])
			assert.deepEqual(run[key], previous[key], key);
	}
	assert.equal(record.reproduction.log.sha256, sha256(record.reproduction.log.text));
	assert.match(record.reproduction.log.text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/);
	assert.equal(record.regressions.sha256, sha256(await readFile(record.regressions.path)));
	await assertCargoGraphRegressions();
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const installed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("rust-recursive-installed"));
	assert.equal(installed.length, 6);
	for(const cell of installed)
	{
		assert.equal(cell.profile, "rust"); assert.equal(cell.shape, "recursive");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed");
	}
	for(const cell of cells.filter(cell => cell.profile === "rust" && cell.shape === "recursive" && cell.position.startsWith("callback-")))
	{
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.deepEqual(cell.stages.installedExecution.evidence, ["rust-recursive-callables-installed"]);
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_RUST_GRAPH_PACKAGE_TEST=1 node --test tests/rust-graph-package.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/rust-packages.json"));
	assert.ok(workflow.includes("            build/recursive/rust-packages.json\n"));
});
