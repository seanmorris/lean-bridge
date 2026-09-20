/**
 * JVM List identity, typed arrays and bounded copied conversions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { jvmListConsumer, jvmListPublicChecks, jvmListRejections } from "./helpers/jvm-list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

test("JVM List evidence binds both languages to prepared archives and runtime-only execution", async () => {
	const record = JSON.parse(await readFile("docs/evidence/jvm-lists-20260920.json"));
	assert.equal(record.wordBits, 64); assert.equal(record.jdk, "22.0.2"); assert.equal(record.kotlin, "2.2.0");
	assert.deepEqual(record.signatures, listSignatures);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	for(const run of record.executions)
	{
		assert.equal(run.checks, run.profile === "java" ? 91674 : 91696);
		assert.equal(record.consumerHashes[run.profile], sha256(jvmListConsumer(run.profile)));
		assert.equal(run.jvm.consumerSourceSha256, record.consumerHashes[run.profile]);
		assert.equal(run.jvm.signaturesSha256, sha256(jvmListPublicChecks(run.profile)));
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "observationSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "exactPublicSignatures"]) assert.equal(run.jvm[key], true, key);
		assert.deepEqual(run.jvm.runtimeModules, ["java.base@22.0.2"]);
		assert.equal(run.jvm.deployment["package.jar"].sha256, run.jvm.archiveSha256);
		const shared = record.executions.find(other => other.path === run.path && other.profile !== run.profile);
		assert.deepEqual(run.packages, shared.packages); assert.equal(run.jvm.archiveSha256, shared.jvm.archiveSha256);
		assert.equal(run.faultProbe, run.path);
		const expected = jvmListRejections(run.profile);
		assert.equal(expected.length, 12); assert.deepEqual(run.rejected.map(result => result.id), expected.map(result => result.id));
		for(const [i, result] of run.rejected.entries())
		{
			assert.equal(result.sourceSha256, sha256(expected[i].source));
			assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [expected[i].expectation.diagnostic].flat());
		}
	}
	assert.deepEqual(Object.keys(record.faultProbes), ["ordinary-source", "reviewed-ir"]);
	for(const probe of Object.values(record.faultProbes))
	{
		assert.equal(probe.checks, 263); assert.equal(probe.layoutChecks, 11); assert.equal(probe.partialInputChecks, 16);
		assert.deepEqual(probe.replacements, [156, 27, 104, 1, 27, 27]);
		assert.equal(probe.probeSourceSha256, sha256(await readFile("tests/fixtures/list-consumers/jvm-faults.java")));
		assert.equal(probe.isolatedInstrumentedProjection, true); assert.equal(probe.releaseJarUnchanged, true); assert.equal(probe.normalExitCleanup, true);
		assert.deepEqual(Object.keys(probe.originalSources), Object.keys(probe.instrumentedSources).filter(path => !/\/(?:ListProbe|Faults)\.java$/.test(path)));
		for(const [path, hash] of Object.entries(probe.originalSources))
			if(!/\/(?:Runtime|Scope)\.java$/.test(path)) assert.equal(probe.instrumentedSources[path], hash, path);
	}
});

test("JVM Lists use primitive and reference arrays while retaining separate List/Array identities", () => {
	const ir = listReviewedIr(), model = compileCopiedJvmModel(ir), files = generateCopiedJvmPackage(ir);
	assert.equal(model.surface.functions.length, 27);
	assert.deepEqual(files, generateCopiedJvmPackage(structuredClone(ir)));
	assert.deepEqual(files, generateJvmBindingPackage(ir)); auditManagedBindingPackage(ir, files, "jvm");
	const prefix = "src/main/java/org/leanbridge/lists/";
	const source = files[`${prefix}Api.java`], native = files[`${prefix}Runtime.java`];
	assert.match(source, /long\[\] reverseUint32\(long\[\]/);
	assert.match(source, /long\[\]\[\] mix\(long\[\]\[\]/);
	assert.match(files[`${prefix}Packet.java`], /Option<Result<Pair<java.math.BigInteger, Unit>, String>>\[\] branches/);
	assert.doesNotMatch(source, /MemorySegment|Arena|native |foreign/);
	assert.match(native, /length < 0 \|\| length > \(16 \* 1024 \* 1024\)/);
	assert.match(native, /pointer.address\(\) == 0 \|\| pointer.address\(\) % 4 != 0/);
	assert.match(native, /finally \{ CLEAR\d+\.invokeExact\(output\); \}/);
	const word = { kind: "primitive", name: "uint32" };
	const list = model.surface.copy({ kind: "apply", constructor: "list", arguments: [word] });
	const array = model.surface.copy({ kind: "apply", constructor: "array", arguments: [word] });
	assert.notEqual(list.name, array.name); assert.equal(model.publicType(list), model.publicType(array));
	assert.match(files["README.md"], /Lean Lists use copied Java arrays/);
});

test("JVM Lists reject borrowed identities, compound callbacks and record name collisions", () => {
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		const list = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "uint32" }] };
		if(position === "parameter") callback.callable.parameters[0].type = list;
		else callback.callable.result.type = list;
		assert.throws(() => compileCopiedJvmModel(ir), /callbacks currently require copied primitive/);
	}
	const borrowed = listReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedJvmModel(borrowed), /copy ownership/);
	const collision = listReviewedIr(); collision.types[0].name = "Option";
	assert.throws(() => compileCopiedJvmModel(collision), /record name collides/);
});

test("JVM List output guards use native scalar and compound alignment before allocation", () => {
	const ir = listReviewedIr(), model = compileCopiedJvmModel(ir);
	const native = generateCopiedJvmPackage(ir)["src/main/java/org/leanbridge/lists/Runtime.java"];
	const alignments = {
		unit: 1, bool: 1, uint8: 1, int8: 1, uint16: 2, int16: 2
		, uint32: 4, int32: 4, float32: 4, char: 4
		, uint64: 8, int64: 8, float64: 8, nat: 8, int: 8, string: 8, bytes: 8
	};
	for(const [name, alignment] of Object.entries(alignments))
	{
		const fn = model.surface.functions.find(fn => fn.field === `reverse_${name}`), copy = model.surface.copy(fn.declaration.result.type);
		const body = native.split(` from${copy.index}(`)[1].split("\n    }")[0];
		assert.ok(body.indexOf("length < 0") < body.indexOf("Array.newInstance"));
		assert.ok(body.includes(`pointer.address() % ${alignment} != 0`), name);
	}
	const pairs = model.surface.copies.find(copy => copy.element?.compound === "tuple");
	const body = native.split(` from${pairs.index}(`)[1].split("\n    }")[0];
	assert.ok(body.includes("pointer.address() % 4 != 0"), "a Bool/Char product aligns to four bytes");
});

const environment = nativeFixtureEnvironment(["java", "kotlin"]);
test("all generated JVM List sources compile with warnings treated as errors", { skip: !existsSync(environment.LEAN_BRIDGE_JAVAC) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-list-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedJvmPackage(listReviewedIr()), sources = Object.keys(files).filter(path => path.endsWith(".java"));
	for(const path of sources) await saveLakeFile(root, path, files[path]);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources], root);
});
