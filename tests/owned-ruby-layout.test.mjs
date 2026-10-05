/**
 * Compare Ruby's owned storage calculations with freshly compiled C layouts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedRubyLayout } from "../src/backends/ruby/owned-layout.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("Ruby owned graphs keep finite layouts for recursive and identity leaves", () => {
	const values = compileOwnedRubyLayout(ownedCppCompositionReviewedIr());
	assert.equal(values.types.length, 41);
	const ticket = values.types.find(node => node.name === "Ticket"), chain = values.types.find(node => node.name === "Chain");
	assert.equal(ticket.size, 8); assert.equal(ticket.alignment, 8); assert.equal(ticket.aggregate, false);
	assert.equal(chain.payloadOffset, 8); assert.equal(chain.size, 24);
	assert.ok(chain.cases.find(branch => branch.sourceName === "link").fields[1].pointer);
	assert.ok(values.types.every(node => node.size > 0 && node.size % node.alignment === 0));
	assert.ok(values.callbackLayouts.every(node => node.size === 32));
});

for(const scalar of [false, true]) for(const reviewed of [false, true]) test(`C compiler verifies Ruby ${scalar ? "scalar" : "composed"} ownership layouts (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: scalar ? "owned-scalars" : "owned-cpp-composition"
		, hostCallbacks: true
		, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {}
	});
	const values = compileOwnedRubyLayout(compiled.model.bindingIr), checks = [];
	const equal = (expression, expected) => checks.push(`_Static_assert(${expression} == ${expected}, ${JSON.stringify(expression)});`);
	for(const node of values.types)
	{
		equal(`sizeof(${node.cName})`, node.size); equal(`_Alignof(${node.cName})`, node.alignment);
		if(!node.aggregate) continue;
		if(node.element || node.kind === "primitive")
		{ equal(`offsetof(${node.cName}, data)`, node.dataOffset); equal(`offsetof(${node.cName}, length)`, node.lengthOffset); }
		if(node.kind === "variant")
		{ equal(`offsetof(${node.cName}, kind)`, node.kindOffset); equal(`offsetof(${node.cName}, cases)`, node.payloadOffset); }
		if(node.kind === "option") equal(`offsetof(${node.cName}, has_value)`, node.flagOffset);
		if(node.kind === "result") equal(`offsetof(${node.cName}, is_ok)`, node.flagOffset);
		for(const field of node.fields) equal(`offsetof(${node.cName}, ${field.name})`, field.offset);
		for(const branch of node.cases) for(const field of branch.fields)
			equal(`offsetof(${node.cName}, cases.${branch.name}.${field.name})`, node.payloadOffset + field.offset);
	}
	for(const node of values.callbackLayouts)
	{
		equal(`sizeof(${node.name})`, node.size); equal(`_Alignof(${node.name})`, node.alignment);
		for(const field of node.fields) equal(`offsetof(${node.name}, ${field.name})`, field.offset);
	}
	for(const [name, offset] of [["_mp_alloc", values.mpz.allocated], ["_mp_size", values.mpz.length], ["_mp_d", values.mpz.data]])
		equal(`offsetof(__mpz_struct, ${name})`, offset);
	equal("sizeof(__mpz_struct)", values.mpz.size); equal("_Alignof(__mpz_struct)", values.mpz.alignment);
	equal("GMP_NAIL_BITS", 0); equal("sizeof(mp_limb_t)", 8);
	equal(`sizeof(${values.c.prefix}_status)`, 4);
	await saveLakeFile(compiled.directory, "owned-ruby.h", values.c.header);
	const source = `#include "owned-ruby.h"
#include <stddef.h>
#include <stdio.h>
${checks.join("\n")}
int main(void) { puts("${checks.length}"); return 0; }
`;
	const execute = await compiled.compile("ruby-layout", source);
	const result = await execute();
	assert.equal(result.stderr, ""); assert.equal(Number(result.stdout.trim()), checks.length);
	assert.equal(values.types.filter(node => node.kind === "primitive").length, scalar ? 19 : 10);
	if(scalar) assert.equal(values.types.find(node => node.name === "Scalars").fields.length, 19);
	await saveLakeFile(resolve("build/owned-ruby-layout"), `${scalar ? "scalars-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		checks: checks.length, compiledLayout: true, installedPackage: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(values.c.header), probeSha256: sha256(source)
		, layouts: values.types, callbackLayouts: values.callbackLayouts
		, mpz: values.mpz
	}));
	t.diagnostic(`${checks.length} C storage assertions passed`);
});
