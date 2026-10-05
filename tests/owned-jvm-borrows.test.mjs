/**
 * Actual Lean borrowed results preserve original Java and Kotlin owners.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmCalls } from "../src/backends/jvm/owned-calls.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr, ownedBorrowSource } from "./helpers/owned-borrow-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources, ownedJvmCallProbeMethods } from "./helpers/owned-jvm-call-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { transferredInputs: true, anchoredResults: true };

test("JVM whole owners require capability and preserve unanchored generated APIs", () => {
	const ir = ownedRustBorrowReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedJvmCalls(ir, { transferredInputs: true }), /explicit output leases/u);
	const model = generateOwnedJvmCalls(ir, options);
	assert.deepEqual(ir, original);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 19);
	const source = Object.values(model.files).join("\n");
	assert.match(source, /public final class Value<T>/u);
	assert.match(source, /leases\[index\]\.slot\.value/u);
	assert.doesNotMatch(source, /moved\d|inputOwner\d/u);
	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.deepEqual(generateOwnedJvmCalls(reordered, options).files, model.files);
	assert.deepEqual(generateOwnedJvmCalls(ownedAggregateReviewedIr(), options).files, generateOwnedJvmCalls(ownedAggregateReviewedIr()).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`Java/Kotlin borrowed results expire with original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustBorrowConfiguration() } : { reviewedIr: ownedRustBorrowReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustBorrowSource
		, evidenceName: `jvm-borrows-${mode}-inputs.json`
	});
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmCalls(compiled.model.bindingIr, options), files = { ...model.files };
	const runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
	assert.equal(files[runtime].split("static void checkpoint() { }").length, 2);
	files[runtime] = files[runtime].replace("static void checkpoint() { }", "static void checkpoint() { OwnedBorrowProbe.allocation(); }");
	assert.equal(files[runtime].split("if (closed.get()) check(4);").length, 2);
	files[runtime] = files[runtime].replace("if (closed.get()) check(4);", "if (closed.get()) check(4); OwnedBorrowProbe.afterWholeReadCheck();");
	for(const [file, kotlin] of [["owned-jvm-borrows.java", false], ["owned-kotlin-borrows.kt", true]])
	{
		const template = await readFile(`tests/fixtures/structured-types/${file}`, "utf8");
		assert.equal(template.split("/* METHODS */").length, 2);
		files[kotlin ? "KotlinBorrowProbe.kt" : "OwnedBorrowProbe.java"] = template.replace("/* METHODS */", () => ownedJvmCallProbeMethods(model, kotlin));
	}
	let observed;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const run = await runCopied(toolchain.java, [
			"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedBorrowProbe"
			, join(compiled.directory, "libprobe.so")
		], compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.ok(observed.javaChecks > 100); assert.ok(observed.kotlinChecks > 100);
	assert.equal(observed.faults.length, 4); assert.ok(observed.faults.every(count => Number.isSafeInteger(count) && count > 0));
	assert.equal(observed.kotlinFaults.length, 4); assert.ok(observed.kotlinFaults.every(count => Number.isSafeInteger(count) && count > 0));
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.equal(observed.threadExits, 2); assert.equal(observed.threadExitErrors, 0);
	const values = Object.keys(files).find(path => path.endsWith("/Ticket.java"));
	const conversions = Object.keys(files).find(path => path.endsWith("/_OwnedConvert.java"));
	const mutations = [
		["unchecked-whole-value", [[runtime, "T get() { T snapshot = value; lease.require(); if", "T get() { T snapshot = value; if"]]]
		, ["unchecked-empty-value", [[runtime, "T get() { T snapshot = value; lease.require(); if", "T get() { T snapshot = value; if (!(value instanceof Object[] array && array.length == 0)) lease.require(); if"]]]
		, ["escaped-callback-frame-and-views", [
			[runtime, "scope.active = false;", "scope.active = true;"]
			, [conversions, "try { handle.close(); }", "try { if (handle.lease.scope == null) handle.close(); }"]
		]]
		, ["wrapper-equality", [[values, "return equal.test(handle, other.handle);", "return this == other;"]]]
		, ["late-whole-value-read", [[runtime, "return snapshot;", "return value;"]]]
	];
	const rejectedMutations = [];
	for(const [name, changes] of mutations)
	{
		const changed = {};
		for(const [path, before, after] of changes)
		{
			assert.equal(files[path].split(before).length, 2, name);
			changed[path] = files[path].replace(before, after);
		}
		t.diagnostic(`${mode}: reject compiled mutant ${name}`);
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, { ...files, ...changed });
		await assert.rejects(runCopied(toolchain.java, [
			"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedBorrowProbe"
			, join(compiled.directory, "libprobe.so")
		], compiled.directory), error => {
			assert.match(error.details.stderr, /Expected org\.leanbridge.*LeanBridgeException|callback borrow expires|canonical whole-value equality|whole read remains a snapshot/u);
			return true;
		}, name);
		rejectedMutations.push({ name, compiled: true, sources: Object.fromEntries(Object.entries(changed).map(([path, source]) => [path, sha256(source)])) });
	}
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile(resolve("build/owned-jvm-borrows"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observed, rejectedMutations
		, input: native.input
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, text]) => [path, sha256(text)]))
		, instrumentedRuntimeSha256: sha256(files[runtime])
		, javaProbeSha256: sha256(files["OwnedBorrowProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinBorrowProbe.kt"])
		, nativeProbeSha256: sha256(native.implementation)
		, guardSha256: sha256(native.cleanup.guardSource)
	}));
});

test("Java/Kotlin borrowed results execute without input transfers", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const observations = [];
	for(const mode of ["ordinary", "reviewed"])
	{
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration: await ownedBorrowConfiguration() } : { reviewedIr: ownedBorrowReviewedIr() }
			, hostCallbacks: true, sourceSuffix: ownedBorrowSource
			, evidenceName: `jvm-borrow-only-${mode}-inputs.json`
		});
		const native = await compileOwnedJvmCallNative(compiled, { anchoredResults: true });
		const model = generateOwnedJvmCalls(compiled.model.bindingIr, { anchoredResults: true });
		const functions = new Map(model.functions.map((fn, i) => [fn.publicName, i]));
		const copy = model.wholeCopies.find(fn => fn.publicName === "copyEchoArrayResult");
		const probe = `package ${model.namespace};
import java.lang.foreign.*;
@SuppressWarnings("try")
public final class BorrowOnlyProbe {
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var bindings = new _OwnedBindings(SymbolLookup.libraryLookup(args[0], library), () -> { });
            try (var original = bindings.${model.methodName(copy.call, "Java")}(new Ticket[0]);
                 var view = bindings.callJava${functions.get("echoArray")}(original); var kept = view.retain()) {
                original.close();
                if (!view.isClosed() || kept.isClosed() || kept.get().length != 0) throw new AssertionError("empty owner");
                try { view.get(); throw new AssertionError("expired empty value exposed"); }
                catch (LeanBridgeException error) { if (error.status() != 4) throw error; }
            }
            try (var original = bindings.${model.methodName(copy.call, "Kotlin")}(new _OwnedKotlinTicket[0]);
                 var view = bindings.callKotlin${functions.get("echoArray")}(original); var kept = view.retain()) {
                original.close();
                if (!view.isClosed() || kept.isClosed() || kept.get().length != 0) throw new AssertionError("Kotlin empty owner");
                try { view.get(); throw new AssertionError("expired Kotlin empty value exposed"); }
                catch (LeanBridgeException error) { if (error.status() != 4) throw error; }
            }
            bindings.runtime.current().close(); System.out.println("borrow-only-ok");
        }
    }
}
`;
		try
		{
			const toolchain = await compileOwnedJvmCallSources(compiled.directory, { ...model.files, "BorrowOnlyProbe.java": probe });
			const run = await runCopied(toolchain.java, [
				"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
				, model.namespace + ".BorrowOnlyProbe"
				, join(compiled.directory, "libprobe.so")
			], compiled.directory);
			assert.equal(run.stderr, ""); assert.equal(run.stdout.trim(), "borrow-only-ok");
			observations.push({ mode, input: native.input, stdout: run.stdout
				, generated: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
				, probeSha256: sha256(probe)
				, nativeProbeSha256: sha256(native.implementation) });
		}
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	}
	await saveLakeFile(resolve("build/owned-jvm-borrows"), "borrow-only.json", canonicalJson({ actualLean: true, inputTransfers: false, observations }));
});
