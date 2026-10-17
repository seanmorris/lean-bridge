/**
 * Inherited checked records retain Lean's parent subobjects while erasing proofs.
 * Installed host acceptance is split into child tasks of VO #1479.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import {
	createCompiledNativeModel, generateCompiledNativeLeanAdapters
} from "../src/build/native-graph-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordFixture
	, inheritedCheckedRecordModule
	, inheritedCheckedRecordRefinements
	, inheritedCheckedRecordReview
} from "./helpers/inherited-checked-record-fixture.mjs";

const sourceFlag = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_SOURCE_TEST";
if(process.env[sourceFlag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[sourceFlag]), `Invalid ${sourceFlag}`);
const enabled = process.env[sourceFlag] === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
	?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");

const compile = async (t, route, options = {}) => {
	const { evaluate = false, expectedFailure = false
		, review = inheritedCheckedRecordReview() } = options;
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-inherited-checked-${route}-`));
	let complete = false;
	t.after(async () => {
		if(complete || expectedFailure) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Retained inherited checked-record compiler probe: ${directory}`);
	});
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
	await cp(inheritedCheckedRecordFixture, projectRoot, { recursive: true });
	await writeFile(join(projectRoot, "lean-bridge.exports.json")
		, canonicalJson(inheritedCheckedRecordConfiguration(route, ["c"])));
	if(route === "reviewed") await writeFile(join(projectRoot, "api.binding-ir.json")
		, canonicalJson(review));
	let captured;
	const stopped = new Error("Inherited checked-record adapters compiled; stop before C");
	let halted = false;
	try
	{
		await buildElaboratedComponent({
			projectRoot, outputRoot, leanPrefix, targets: ["c"]
			, profile: "native-library-v1", receiptName: "native-component.json"
			, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
			, createAdapters: generateCompiledNativeLeanAdapters
			, compileComponent: async ({ model, adapters, metadata }) => {
				captured = { model, adapters, metadata };
				throw stopped;
			}
		});
	}
	catch(error)
	{
		if(error === stopped) halted = true;
		else
		{
			t.diagnostic(JSON.stringify({
				code: error?.code, message: error?.message, details: error?.details
			}, null, 2));
			throw error;
		}
	}
	assert.equal(halted, true);
	assert.ok(captured);
	if(evaluate)
	{
		const source = await readFile(join(projectRoot, `${inheritedCheckedRecordModule}.lean`)
			, "utf8");
		const exported = name => captured.model.exports.find(item => item.name
			=== `${inheritedCheckedRecordModule}.${name}`);
		const call = name => `${captured.adapters.module}.f_${exported(name).symbol}`;
		const evaluations = [
			[`[${call("first")} { toSpan := { lo := 2, hi := 3 }, word := 4 }, ${call("first")} { toSpan := { lo := 3, hi := 2 }, word := 4 }, ${call("first")} { toSpan := { lo := 1, hi := 2 }, word := 0 }, ${call("first")} { toSpan := { lo := 1, hi := 5 }, word := 3 }]`
				, "[some 9, none, none, none]"]
			, [`[${call("normalized")} { toSpan := { lo := 4, hi := 1 }, word := 0 }, ${call("aliased")} { toSpan := { lo := 4, hi := 1 }, word := 4 }, ${call("aliased")} { toSpan := { lo := 4, hi := 1 }, word := 0 }]`
				, "[some 11, some 5, none]"]
			, [`[${call("nested")} { toTicket := { toSpan := { lo := 1, hi := 2 }, word := 4 }, mark := 3 }, ${call("nested")} { toTicket := { toSpan := { lo := 1, hi := 2 }, word := 4 }, mark := 8 }, ${call("nested")} { toTicket := { toSpan := { lo := 1, hi := 2 }, word := 4 }, mark := 5 }]`
				, "[some 7, none, none]"]
			, [`let value := ${call("produce")} 4; (value.toSpan.lo, value.toSpan.hi, value.word)`
				, "(4, 4, 5)"]
			, [`let value := ${call("produceStamped")} 4; (value.toTicket.toSpan.lo, value.toTicket.word, value.mark)`
				, "(4, 5, 0)"]
		];
		const runtime = join(directory, "Runtime.lean");
		await writeFile(runtime, [source
			, captured.adapters.leanSource.replace(new RegExp(
				`^import ${inheritedCheckedRecordModule}$`, "mu"), "")
			, ...evaluations.map(([expression]) => `#eval ${expression}`)].join("\n"));
		const checked = await processBuildRunner.capture({
			command: join(leanPrefix, "bin/lean"), args: [runtime]
			, cwd: directory, timeoutMs: 600_000
		});
		assert.equal(checked.stderr, "");
		assert.deepEqual(checked.stdout.trim().split("\n")
			, evaluations.map(([, expected]) => expected));
	}
	complete = true;
	return captured;
};

test("the independent inherited checked-record review preserves subobjects, aliases and proof boundaries", async () => {
	const review = inheritedCheckedRecordReview();
	validateBindingIr(review);
	for(const route of ["ordinary", "reviewed"])
	{
		const configuration = inheritedCheckedRecordConfiguration(route, ["c", "cpp", "npm"]);
		validateExportConfiguration(configuration);
		await assertJsonSchema("lean-export-configuration", configuration);
	}
	assert.deepEqual(review.types.map(type => [type.kind, type.name]), [
		["record", "Span"], ["record", "Stamped"]
		, ["record", "Ticket"], ["alias", "TicketAlias"]
	]);
	const definitions = Object.fromEntries(review.types.map(type => [type.name, type]));
	assert.deepEqual(definitions.Span.fields.map(field => field.name), ["lo", "hi"]);
	assert.deepEqual(definitions.Ticket.fields.map(field => field.name), ["toSpan", "word"]);
	assert.deepEqual(definitions.Stamped.fields.map(field => field.name), ["toTicket", "mark"]);
	assert.deepEqual(definitions.TicketAlias.target
		, { kind: "named", id: `lean:${inheritedCheckedRecordModule}.Ticket` });
	assert.deepEqual(Object.fromEntries(["Span", "Ticket", "Stamped"].map(name => [
		name
		, definitions[name].source.extensions["lean-lang.org/erased-proofs"].fields
	])), { Span: ["ordered"], Ticket: ["linked"], Stamped: ["stamped"] });
	const aliased = review.declarations.find(item => item.name === "aliased");
	assert.equal(aliased.parameters[0].type.id
		, `lean:${inheritedCheckedRecordModule}.TicketAlias`);
	const nested = inheritedCheckedRecordRefinements[`${inheritedCheckedRecordModule}.nested`]
		.parameters[0];
	assert.deepEqual(nested.fields.map(item => item.name), ["toTicket", "mark"]);
	assert.equal(nested.fields[0].refinement.fields[0].refinement.constructor
		, `${inheritedCheckedRecordModule}.mkSpan`);
	assert.deepEqual(nested.fields[1].refinement, { kind: "fin", bound: "8" });
});

test("review reconciliation locates inherited layout, proof, alias and constructor drift", () => {
	const expected = inheritedCheckedRecordReview();
	const changed = mutate => {
		const actual = structuredClone(expected);
		mutate(actual);
		return reviewedContractDifference(expected, actual);
	};
	assert.equal(changed(actual => actual.types.find(type => type.name === "Ticket")
		.fields.reverse()), "bindingIr.types[2].fields[0].name");
	assert.equal(changed(actual => {
		actual.types.find(type => type.name === "Ticket").source
			.extensions["lean-lang.org/erased-proofs"].fields[0] = "other";
	}), "bindingIr.types[2].source.extensions.lean-lang.org/erased-proofs.fields[0]");
	assert.equal(changed(actual => {
		actual.types.find(type => type.name === "TicketAlias").target.id
			= `lean:${inheritedCheckedRecordModule}.Span`;
	}), "bindingIr.types[3].target.id");
	assert.equal(changed(actual => {
		actual.declarations.find(item => item.name === "nested").source
			.extensions["lean-lang.org/refinements"].parameters[0]
			.fields[0].refinement.constructor = `${inheritedCheckedRecordModule}.normalizeTicket`;
	}), "bindingIr.declarations[3].source.extensions.lean-lang.org/refinements.parameters[0].fields[0].refinement.constructor");
});

test("fresh Lean rejects an independently reviewed inherited layout mismatch at its first use", {
	skip: !enabled, timeout: 900_000
}, async t => {
	const altered = inheritedCheckedRecordReview();
	altered.types.find(type => type.name === "Ticket").fields.reverse();
	await assert.rejects(() => compile(t, "reviewed", {
		expectedFailure: true, review: altered
	}), error => {
		assert.equal(error?.code, "reviewed-ir-build-unsupported");
		assert.deepEqual(error?.details, {
			path: `lean:${inheritedCheckedRecordModule}.first.parameters[0]`
		});
		return true;
	});
});

for(const route of ["ordinary", "reviewed"])
	test(`fresh Lean compiles the ${route} inherited checked-record adapters`, {
		skip: !enabled, timeout: 900_000
	}, async t => {
		const { model, adapters, metadata } = await compile(t, route
			, { evaluate: route === "ordinary" });
		await assertJsonSchema("elaborated-export-metadata", metadata);
		assert.equal(reviewedContractDifference(inheritedCheckedRecordReview()
			, model.bindingIr), null);
		const refinements = Object.fromEntries(model.exports.map(item => [
			item.name.split(".").at(-1), item.refinements
		]));
		const first = refinements.first.parameters[0];
		assert.deepEqual([first.definition, first.fields, first.constructor], [
			`${inheritedCheckedRecordModule}.Ticket`, ["toSpan", "word"]
			, `${inheritedCheckedRecordModule}.mkTicket`
		]);
		assert.deepEqual(first.arguments.map(item => item.constructor), [
			`${inheritedCheckedRecordModule}.mkSpan`
			, `${inheritedCheckedRecordModule}.mkWord`
		]);
		assert.deepEqual(refinements.pair.parameters.map(item => item.constructor), [
			`${inheritedCheckedRecordModule}.mkTicket`
			, `${inheritedCheckedRecordModule}.normalizeTicket`
		]);
		const inherited = refinements.nested.parameters[0];
		assert.deepEqual([inherited.definition, inherited.fields], [
			`${inheritedCheckedRecordModule}.Stamped`, ["toTicket", "mark"]
		]);
		assert.equal(inherited.arguments[0].arguments[0].constructor
			, `${inheritedCheckedRecordModule}.mkSpan`);
		assert.deepEqual(inherited.arguments[1], { kind: "fin", bound: "8" });
		const produced = refinements.produceStamped.result;
		assert.equal(produced.constructor, null);
		assert.equal(produced.arguments[0].constructor, null);
		assert.equal(produced.arguments[0].arguments[0].constructor, null);
		assert.equal(produced.arguments[0].arguments[1].constructor, null);
		const types = Object.fromEntries(model.bindingIr.types.map(type => [type.name, type]));
		assert.deepEqual(types.Ticket.fields.map(field => field.name), ["toSpan", "word"]);
		assert.deepEqual(types.Stamped.fields.map(field => field.name), ["toTicket", "mark"]);
		assert.deepEqual(types.TicketAlias.target
			, { kind: "named", id: `lean:${inheritedCheckedRecordModule}.Ticket` });
		const source = adapters.leanSource;
		for(const name of ["Span", "Ticket", "Stamped"])
		{
			assert.match(source, new RegExp(`def LbErased\\.${inheritedCheckedRecordModule}\\.${name}\\.via_`, "u"));
			assert.match(source, new RegExp(`def LbErased\\.${inheritedCheckedRecordModule}\\.${name}\\.erase`, "u"));
		}
		for(const name of ["mkSpan", "normalizeSpan", "mkWord", "normalizeWord"
			, "mkTicket", "normalizeTicket", "mkStamped"])
			assert.match(source, new RegExp(`_root_\\.${inheritedCheckedRecordModule}\\.${name}`, "u"));
		assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast)\b/u);
	});
