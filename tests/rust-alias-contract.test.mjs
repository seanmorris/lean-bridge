/**
 * Rust aliases retain public names without replacing borrowed inputs with wrappers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { auditRustPackage } from "../src/backends/rust/package-audit.mjs";
import { aliasPrimitives, nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";

test("Rust alias evidence binds offline crates, compiler rejections, cleanup and source-free executables", async () => {
	const record = JSON.parse(await readFile("docs/evidence/rust-aliases-20260921.json"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeAliasReviewedIr())));
	assert.deepEqual(record.signatures, nativeAliasSignatures);
	assert.deepEqual(record.primitives, aliasPrimitives);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.runs.map(run => `${run.path}/${run.profile}`), ["ordinary-source/rust", "reviewed-ir/rust"]);
	for(const run of record.runs)
	{
		assert.equal(run.checks, 1278); assert.equal(run.faultChecks, 202); assert.equal(run.faultTests, 2);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/alias-consumers/rust.rs")));
		assert.equal(run.faultSourceSha256, sha256(await readFile("tests/fixtures/alias-consumers/rust-faults.rs")));
		assert.equal(run.rejectionSourceSha256, sha256(await readFile("tests/fixtures/alias-consumers/rust-invalid.json")));
		for(const flag of ["offlineInstall", "compilerFreePath"
			, "sourceRemovedBeforeInstallation", "emptyCargoHome", "linkOnly"
			, "relocatedExecutable", "installedSourcesRemoved"
			, "repeatExecution", "normalExitCleanup", "installedFilesUnchanged"])
			assert.equal(run[flag], true, `${run.path}/${flag}`);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256"
			, "modelSha256", "receiptSha256", "installedFilesSha256"
			, "declarationsSha256"
			, "linkerSha256", "executableSha256", "malformedSourceSha256"])
			assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.match(run.version, /^rustc 1\.90\.0 /);
		const negatives = JSON.parse(await readFile("tests/fixtures/alias-consumers/rust-invalid.json"));
		assert.equal(run.rejected.length, 12);
		assert.deepEqual(run.rejected.map(item => ({ name: item.name, code: item.code })), negatives.map(({ name, code }) => ({ name, code })));
		for(const [index, rejected] of run.rejected.entries())
		{
			assert.equal(rejected.diagnostics, 1);
			assert.equal(rejected.sourceSha256, sha256(`use aliases_api as api; fn main() { ${negatives[index].statement} }\n`));
		}
		assert.ok(run.dependencies.packages.some(pkg => pkg.directory === "num-bigint-0.4.6"));
		assert.ok(run.dependencies.packages.some(pkg => pkg.directory === "sha2-0.10.9"));
		for(const dependency of run.dependencies.packages)
		{ assert.match(dependency.checksum, /^[a-f0-9]{64}$/); assert.match(dependency.manifestSha256, /^[a-f0-9]{64}$/); assert.ok(dependency.files > 0); }
		assert.match(run.dependencies.sha256, /^[a-f0-9]{64}$/);
		assert.match(run.dependencies.lockSha256, /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1);
		const [pkg] = run.packages;
		assert.equal(pkg.target, "cargo"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/aliases-api-1.0.0.crate");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.equal(Object.keys(run.nativeLibraries).length, 4);
		for(const file of Object.values(run.nativeLibraries))
		{ assert.ok(file.bytes > 0); assert.match(file.sha256, /^[a-f0-9]{64}$/); }
	}
	assert.deepEqual(record.runs[0].nativeLibraries, record.runs[1].nativeLibraries);
});

test("Rust alias installed evidence promotes only six copied positions and runs in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("rust-aliases-installed"));
	assert.equal(observed.length, 6);
	for(const cell of observed)
	{
		assert.equal(cell.shape, "alias"); assert.equal(cell.profile, "rust");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["rust-aliases-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_RUST_ALIAS_TEST=1 node --test tests\/rust-aliases.test.mjs/);
	assert.match(workflow, /test -s build\/aliases\/rust.json/);
	assert.match(workflow, /path: \|[^]*?build\/aliases\/rust.json/);
});

test("Rust exports aliases in declarations, signatures, nested targets and copied fields", () => {
	const ir = nativeAliasReviewedIr(), files = generateCopiedRustPackage(ir);
	const names = auditRustPackage(ir, files).exports, source = files["src/lib.rs"];
	for(const type of ir.types.filter(type => type.kind === "alias"))
	{
		assert.ok(names.includes(type.name), type.name);
		assert.ok(source.includes(`pub type ${type.name} = `), type.name);
	}
	for(const declaration of ["AUnit = ()", "ANat = BigUint", "AWord = u64"
		, "ASignedWord = i64", "ScalarsView = Scalars", "Count = AU32"
		, "Rows = Vec<Vec<Count>>", "Maybe = Option<Option<AUnit>>"
		, "Outcome = Result<(Count, ABytes), AText>", "Packets = Vec<PacketView>"])
		assert.ok(source.includes(`pub type ${declaration};`), declaration);
	assert.match(source, /pub v_uint32: AU32,/);
	assert.match(source, /pub rows: Rows,/);
	assert.match(source, /pub fn increment\(value0: Count\) -> Result<OtherCount, Error>/);
	assert.match(source, /pub fn echo_nat\(value0: &ANat\) -> Result<ANat, Error>/);
	assert.match(source, /pub fn echo_string\(value0: &str\) -> Result<AText, Error>/);
	assert.match(source, /pub fn echo_bytes\(value0: &\[u8\]\) -> Result<ABytes, Error>/);
	assert.match(source, /pub fn reverse_rows\(value0: &\[Vec<Count>\]\) -> Result<Rows, Error>/);
	assert.match(source, /pub fn reverse_packets\(value0: &\[PacketView\]\) -> Result<Packets, Error>/);
	assert.match(source, /pub fn echo_scalars\(value0: &ScalarsView\) -> Result<ScalarsView, Error>/);
	assert.doesNotMatch(source, /unsafe|extern|c_void|has_value|is_ok/);
	assert.match(files["README.md"], /pub type/);
});

test("Rust aliases reject collisions with language types, generated helpers and public names", () => {
	for(const name of ["Vec", "String", "Box", "bool", "u32", "BigUint", "Option", "Result", "FnMut", "Scalars", "increment", "Native", "LeanClosure", "T0", "B12", "Context4"])
	{
		const ir = nativeAliasReviewedIr(); ir.types.find(type => type.name === "Count").name = name;
		assert.throws(() => compileCopiedRustModel(ir), /colli|reserved/i, name);
	}
});
