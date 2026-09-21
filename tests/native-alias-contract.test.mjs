/**
 * Public native alias declarations must survive target normalization and cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { aliasPrimitives, nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { nativeAliasConsumer } from "./helpers/native-alias-consumers.mjs";

test("native alias evidence authenticates installed, relocated packages and independent consumers", async () => {
	const record = JSON.parse(await readFile("docs/evidence/native-aliases-20260921.json"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeAliasReviewedIr())));
	assert.deepEqual(record.signatures, nativeAliasSignatures);
	assert.deepEqual(record.primitives, aliasPrimitives);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.runs.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of record.runs)
	{
		assert.equal(run.checks, run.profile === "c" ? 720 : 366);
		assert.equal(run.consumerSha256, sha256(nativeAliasConsumer(run.profile)));
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"])
			assert.equal(run[flag], true, `${run.profile}/${run.path}/${flag}`);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "executableSha256", "installedFilesSha256"])
			assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1);
		const [pkg] = run.packages;
		assert.equal(pkg.target, run.profile); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, `archives/aliases-1.0.0-${run.profile}.tar.gz`);
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/);
		assert.ok(pkg.artifacts[0].bytes > 0);
		assert.equal(Object.keys(run.nativeLibraries).length, run.profile === "c" ? 6 : 4);
		for(const file of Object.values(run.nativeLibraries))
		{ assert.ok(file.bytes > 0); assert.match(file.sha256, /^[a-f0-9]{64}$/); }
	}
	for(const profile of ["c", "cpp"])
	{
		const [ordinary, reviewed] = record.runs.filter(run => run.profile === profile);
		assert.deepEqual(ordinary.nativeLibraries, reviewed.nativeLibraries);
	}
});

test("native alias evidence promotes only twelve C/C++ copied positions", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("native-aliases-installed"));
	assert.equal(observed.length, 12);
	for(const cell of observed)
	{
		assert.equal(cell.shape, "alias"); assert.ok(["c", "cpp"].includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["native-aliases-installed"]); }
	}
});

test("native headers declare named scalar, record and container aliases without new storage", () => {
	const ir = nativeAliasReviewedIr(), surface = compilePrimitiveCSurface(ir, { compounds: true, lists: true });
	const raw = generateCBindingPackage(ir)["include/aliases.h"];
	const gmp = generateGmpProjection(ir).files["include/aliases.h"];
	const cpp = generateCppBindingPackage(ir)["include/aliases.hpp"];
	assert.equal(ir.types.filter(type => type.kind === "alias").length, 27);
	for(const type of ir.types.filter(type => type.kind === "alias"))
	{
		const name = type.name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
		const target = surface.copy(type.target);
		assert.ok(raw.includes(`typedef ${target.name} aliases_${name}_t;`), type.name);
		assert.ok(gmp.includes(`typedef ${target.name} aliases_${name}_t;`), type.name);
		assert.match(cpp, new RegExp(`using ${type.name} = `));
		if(target.aggregate) for(const header of [raw, gmp]) for(const action of ["init", "clear"])
			assert.ok(header.includes(`aliases_${name}_t_${action}(`), `${type.name}/${action}`);
	}
	assert.match(cpp, /using Count = uint32_t;/);
	assert.match(cpp, /using PacketView = Packet;/);
	assert.match(cpp, /using Rows = std::vector<std::vector<uint32_t>>;/);
	assert.match(cpp, /using ANat = Nat;/);
});

test("alias names cannot collide with native functions, records or generated helpers", () => {
	for(const mutate of [
		ir => { ir.declarations[0].name = "count_t"; }
		, ir => { ir.declarations[0].name = "atext_t_init"; }
		, ir => { ir.declarations[0].name = "atext_t_clear"; }
		, ir => { ir.types.find(type => type.name === "Scalars").name = "CountT"; }
		, ir => { ir.types.find(type => type.name === "Count").name = "Other_Count"; }
	]) {
		const ir = nativeAliasReviewedIr(); mutate(ir);
		assert.throws(() => generateCBindingPackage(ir), /alias.*colli|collision/i);
		assert.throws(() => generateGmpProjection(ir), /alias.*colli|collision/i);
	}
	for(const name of ["Ok", "Err", "Result", "LeanClosure", "std", "boost", "class", "const", "Scalars", "increment"])
	{
		const ir = nativeAliasReviewedIr(); ir.types.find(type => type.name === "Count").name = name;
		assert.throws(() => generateCppBindingPackage(ir), /alias.*colli|collision/i, name);
	}
});
