/**
 * Compare owned layouts with independent C and Java FFM storage measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJvmLayout } from "../src/backends/jvm/owned-layout.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

test("owned JVM layouts preserve finite recursion, scalar widths and opaque identities", () => {
	const ir = ownedCppCompositionReviewedIr(), original = structuredClone(ir);
	const layout = compileOwnedJvmLayout(ir);
	assert.deepEqual(ir, original);
	assert.deepEqual(JSON.parse(JSON.stringify(compileOwnedJvmLayout(ir))), JSON.parse(JSON.stringify(layout)));
	assert.equal(layout.types.length, 41);
	const ticket = layout.types.find(node => node.name === "Ticket");
	const chain = layout.types.find(node => node.name === "Chain");
	assert.equal(ticket.size, 8); assert.equal(ticket.aggregate, false);
	assert.equal(ticket.valueLayout, "java.lang.foreign.ValueLayout.ADDRESS");
	assert.equal(chain.payloadOffset, 8); assert.equal(chain.size, 24);
	assert.ok(chain.cases.find(branch => branch.sourceName === "link").fields[1].pointer);
	assert.ok(layout.types.every(node => node.size > 0 && node.size % node.alignment === 0));
	assert.ok(layout.callbackLayouts.every(node => node.size === 32));
	assert.doesNotMatch(layout.layoutSource, /Linker|SymbolLookup|lean_object|public class|JAVA_BOOLEAN/u);
	const scalar = compileOwnedJvmLayout(ownedPythonScalarsReviewedIr());
	assert.equal(scalar.types.filter(node => node.kind === "primitive").length, 19);
	assert.equal(scalar.types.find(node => node.name === "Scalars").fields.length, 19);
});

for(const scalar of [false, true]) for(const reviewed of [false, true]) test(`C and Java FFM verify owned ${scalar ? "scalar" : "composed"} storage (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: scalar ? "owned-scalars" : "owned-cpp-composition"
		, hostCallbacks: true, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {}
	});
	const layout = compileOwnedJvmLayout(compiled.model.bindingIr), checks = [], managed = [];
	const equal = (expression, expected) => checks.push(`_Static_assert(${expression} == ${expected}, ${JSON.stringify(expression)});`);
	const offset = (name, path, expected) => managed.push(`offset(_OwnedLayouts.${name}, ${expected}, ${path.map(field => JSON.stringify(field)).join(", ")});`);
	const size = node => managed.push(`size(_OwnedLayouts.${node.layoutName}, ${node.size}, ${node.alignment});`);
	for(const node of layout.types)
	{
		equal(`sizeof(${node.cName})`, node.size); equal(`_Alignof(${node.cName})`, node.alignment);
		size(node);
		if(!node.aggregate) continue;
		if(node.element || node.kind === "primitive")
		{
			equal(`offsetof(${node.cName}, data)`, node.dataOffset);
			equal(`offsetof(${node.cName}, length)`, node.lengthOffset);
			offset(node.layoutName, ["data"], node.dataOffset);
			offset(node.layoutName, ["length"], node.lengthOffset);
		}
		if(node.kind === "variant")
		{
			equal(`offsetof(${node.cName}, kind)`, node.kindOffset);
			equal(`offsetof(${node.cName}, cases)`, node.payloadOffset);
			offset(node.layoutName, ["kind"], node.kindOffset);
			offset(node.layoutName, ["cases"], node.payloadOffset);
		}
		if(node.kind === "option")
		{ equal(`offsetof(${node.cName}, has_value)`, node.flagOffset); offset(node.layoutName, ["has_value"], node.flagOffset); }
		if(node.kind === "result")
		{ equal(`offsetof(${node.cName}, is_ok)`, node.flagOffset); offset(node.layoutName, ["is_ok"], node.flagOffset); }
		for(const field of node.fields)
		{
			equal(`offsetof(${node.cName}, ${field.name})`, field.offset);
			offset(node.layoutName, [field.name], field.offset);
		}
		for(const branch of node.cases)
		{
			size(branch);
			for(const field of branch.fields)
			{
				equal(`offsetof(${node.cName}, cases.${branch.name}.${field.name})`, node.payloadOffset + field.offset);
				offset(branch.layoutName, [field.name], field.offset);
				offset(node.layoutName, ["cases", branch.name, field.name], node.payloadOffset + field.offset);
			}
		}
	}
	for(const node of layout.callbackLayouts)
	{
		equal(`sizeof(${node.name})`, node.size); equal(`_Alignof(${node.name})`, node.alignment); size(node);
		for(const field of node.fields)
		{
			equal(`offsetof(${node.name}, ${field.name})`, field.offset);
			offset(node.layoutName, [field.name], field.offset);
		}
	}
	for(const [native, field, at] of [["_mp_alloc", "allocated", layout.mpz.allocated], ["_mp_size", "length", layout.mpz.length], ["_mp_d", "data", layout.mpz.data]])
	{ equal(`offsetof(__mpz_struct, ${native})`, at); offset("MPZ", [field], at); }
	equal("sizeof(__mpz_struct)", layout.mpz.size); equal("_Alignof(__mpz_struct)", layout.mpz.alignment);
	equal("GMP_NAIL_BITS", 0); equal("sizeof(mp_limb_t)", 8);
	equal(`sizeof(${layout.c.prefix}_status)`, 4);
	size({ ...layout.mpz, layoutName: "MPZ" });
	await saveLakeFile(compiled.directory, "owned-jvm.h", layout.c.header);
	const source = `#include "owned-jvm.h"\n#include <stddef.h>\n#include <stdio.h>\n${checks.join("\n")}\nint main(void) { puts("${checks.length}"); return 0; }\n`;
	const execute = await compiled.compile("jvm-layout", source), observed = await execute();
	assert.equal(observed.stderr, ""); assert.equal(Number(observed.stdout.trim()), checks.length);
	const consumer = `package ${layout.namespace};
import java.lang.foreign.MemoryLayout;
import static java.lang.foreign.MemoryLayout.PathElement.groupElement;
public final class OwnedLayoutProbe {
    private static int checks;
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message); ++checks;
    }
    private static void size(MemoryLayout layout, long size, long alignment) {
        check(layout.byteSize() == size, layout + " size");
        check(layout.byteAlignment() == alignment, layout + " alignment");
    }
    private static void offset(MemoryLayout layout, long expected, String... names) {
        var path = new MemoryLayout.PathElement[names.length];
        for (int i = 0; i < names.length; ++i) path[i] = groupElement(names[i]);
        check(layout.byteOffset(path) == expected, layout + " offset " + java.util.Arrays.toString(names));
    }
    public static void main(String[] ignored) {
        ${managed.join("\n        ")}
        System.out.println(checks);
    }
}
`;
	await saveLakeFile(compiled.directory, "_OwnedLayouts.java", layout.layoutSource);
	await saveLakeFile(compiled.directory, "OwnedLayoutProbe.java", consumer);
	const env = nativeFixtureEnvironment(["java"]);
	await runCopied(env.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", "_OwnedLayouts.java", "OwnedLayoutProbe.java"], compiled.directory);
	const result = await runCopied(env.LEAN_BRIDGE_JAVA, ["-cp", "classes", layout.namespace + ".OwnedLayoutProbe"], compiled.directory);
	assert.equal(result.stderr, "");
	const managedChecks = managed.reduce((sum, line) => sum + (line.startsWith("size(") ? 2 : 1), 0);
	assert.equal(Number(result.stdout.trim()), managedChecks);
	await saveLakeFile(resolve("build/owned-jvm-layout"), `${scalar ? "scalars-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		checks: checks.length, managedChecks, compiledLayout: true
		, installedPackage: false
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, hostCallbacks: true }
		, headerSha256: sha256(layout.c.header)
		, layoutSourceSha256: sha256(layout.layoutSource)
		, cProbeSha256: sha256(source), managedProbeSha256: sha256(consumer)
		, layouts: layout.types, callbackLayouts: layout.callbackLayouts
		, mpz: layout.mpz
	}));
	t.diagnostic(`${checks.length} C and ${managedChecks} Java FFM storage assertions passed`);
});
