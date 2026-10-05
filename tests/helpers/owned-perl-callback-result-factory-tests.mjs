/**
 * Callback instances select anonymous owned values without private type IDs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";
import { ownedDotnetCallbackResultReviewedIr } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverReviewedIr } from "./owned-rust-receiver-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";

const namespace = "LeanBridge::Factory";
const options = { callbackResultAnchors: true, hostCallbacks: false };

/** No exported container sites can provide a copy_value selector here. */
const factoryIr = () => {
	const ir = ownedDotnetCallbackResultReviewedIr();
	const template = ir.types.find(type => type.kind === "callback");
	const original = ir.declarations.find(fn => fn.name === "makeRecordCallback");
	const ticket = { kind: "named", id: "lean:Owned.Ticket" };
	const bool = { kind: "primitive", name: "bool" };
	const array = { kind: "apply", constructor: "array", arguments: [ticket] };
	const list = { kind: "apply", constructor: "list", arguments: [ticket] };
	const optional = { kind: "apply", constructor: "option", arguments: [ticket] };
	const tuple = { kind: "apply", constructor: "tuple", arguments: [array, list] };
	ir.types = [ir.types.find(type => type.id === ticket.id)]; ir.declarations = [];
	const add = (name, parameters, result, anchor) => {
		const type = structuredClone(template), id = "bridge:" + name;
		type.id = id; type.name = name; type.source.declaration = name;
		type.callable.parameters = parameters.map((ref, index) => ({ ...structuredClone(template.callable.parameters[0])
			, name: "arg" + index
			, type: ref
			, ownership: ref.kind === "primitive" ? "copy" : "borrow"
			, lifetime: ref.kind === "primitive" ? null : { scope: "call", anchor: null } }));
		type.callable.result = { type: result
			, ownership: anchor !== undefined ? "borrow" : result.kind === "primitive" ? "copy" : "lease"
			, lifetime: anchor !== undefined ? { scope: "parameter", anchor: "arg" + anchor }
				: result.kind === "primitive" ? null : { scope: "explicit", anchor: null } };
		ir.types.push(type);
		const fn = structuredClone(original), publicName = "make" + name;
		fn.id = "lean:Owned." + publicName; fn.name = publicName;
		fn.overloadKey = "Owned." + publicName; fn.source.declaration = "Owned." + publicName;
		fn.parameters = []; fn.result.type = { kind: "named", id };
		ir.declarations.push(fn);
		return { kind: "named", id };
	};
	const containers = add("ContainerCallback", [bool, array, list, optional, tuple], list, 1);
	add("HigherCallback", [containers], containers);
	add("ScalarCallback", [bool], bool);
	return ir;
};

const factories = model => [...model.xs.matchAll(/MODULE = ([^\n]+) PACKAGE = ([^\n]+)\n\nvoid\n(copy_(?:arg\d+|result))\(self, value\)\n([\s\S]*?)(?=\nMODULE =|$)/gu)]
	.map(([, moduleName, packageName, name, source]) => ({ moduleName, packageName, name, source }));

test("Perl callback copy factories distinguish callback-only containers and higher-order sites", () => {
	const ir = factoryIr(), original = structuredClone(ir);
	const model = generateOwnedPerlXs(ir, namespace, options);
	assert.deepEqual(ir, original);
	assert.equal(model.c.callbacks.filter(fn => fn.anchor !== undefined).length, 1);
	assert.ok(model.functions.every(fn => !fn.parameters.length));
	assert.ok(model.functions.every(fn => model.types.find(node => node.id === fn.result).kind === "callback"));
	const methods = factories(model), callback = model.types.find(node => node.name === "ContainerCallback");
	const containerMethods = methods.filter(fn => fn.packageName === callback.publicType);
	assert.deepEqual(containerMethods.map(fn => fn.name), ["copy_arg1", "copy_arg2", "copy_arg3", "copy_arg4", "copy_result"]);
	const signature = model.c.callbacks.find(fn => fn.id === callback.id);
	const owned = signature.parameters.slice(2).map(id => model.types.find(node => node.id === id));
	assert.deepEqual(owned.map(node => node.kind), ["array", "list", "option", "tuple"]);
	assert.equal(owned[0].publicType, owned[1].publicType);
	assert.notEqual(owned[0].index, owned[1].index);
	for(const [index, node] of owned.entries())
		assert.ok(containerMethods[index].source.includes(`lpo_copy_value${node.index}(aTHX_ scope, value)`));
	assert.ok(containerMethods.at(-1).source.includes(`lpo_copy_value${owned[1].index}(aTHX_ scope, value)`));
	const higher = model.types.find(node => node.name === "HigherCallback");
	const higherMethods = methods.filter(fn => fn.packageName === higher.publicType);
	assert.deepEqual(higherMethods.map(fn => fn.name), ["copy_arg0", "copy_result"]);
	for(const method of higherMethods) assert.ok(method.source.includes(`lpo_copy_value${callback.index}(aTHX_ scope, value)`));
	assert.equal(methods.length, 7);
	assert.ok(methods.every(fn => !fn.packageName.endsWith("::Value") && !fn.packageName.endsWith("::ScalarCallback")));
	const reversed = structuredClone(ir); reversed.types.reverse();
	const repeated = generateOwnedPerlXs(reversed, namespace, options);
	for(const field of ["declarations", "xs", "valuesSource"]) assert.equal(repeated[field], model[field]);
	reversed.declarations.reverse();
	assert.deepEqual(factories(generateOwnedPerlXs(reversed, namespace, options)), methods);
});

test("Perl callback copy factories check authentic self before reading or copying a supplied value", () => {
	const model = generateOwnedPerlXs(factoryIr(), namespace, options);
	for(const method of factories(model))
	{
		const callback = model.types.find(node => node.publicType === method.packageName);
		const guard = `(void)lpo_borrow(aTHX_ self, ${callback.index});`;
		const positions = ["ENTER;", "lpo_enter_call(aTHX);", guard, "lpg_begin(aTHX_ NULL)", "lpo_copy_value", "LEAVE;"]
			.map(part => method.source.indexOf(part));
		assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
		assert.equal(method.source.split(guard).length, 2);
		assert.doesNotMatch(method.source.slice(0, method.source.indexOf(guard)), /lpo_read|lpo_copy|SvGETMAGIC\(value\)|_call\(lpo_state/u);
		assert.match(method.source, /SV \*self\n {4}SV \*value/u);
	}
	assert.match(model.declarations, /mg_findext\(SvRV\(value\), PERL_MAGIC_ext, &lpo_wrapper_magic\)/u);
	assert.match(model.declarations, /wrapper->type != type/u);
	assert.match(model.declarations, /strcmp\(name, wrapper->package\)/u);
	assert.match(model.declarations, /if \(!lpo_origin\(aTHX\)\)/u);
	assert.match(model.declarations, /if \(lpo_closed\(wrapper\)\) croak\("Lean identity is closed or its callback borrow has expired"\);/u);
	assert.match(model.declarations, /lpo_pin_owner\(aTHX_ wrapper->owner\);/u);
});

test("Perl callback copy factories leave supported legacy capability combinations byte-identical", () => {
	for(const [fixture, enabled] of [
		[ownedAggregateReviewedIr, { hostCallbacks: false }]
		, [ownedAggregateReviewedIr, { hostCallbacks: true }]
		, [ownedRustBorrowReviewedIr, { transferredInputs: true, anchoredResults: true }]
		, [ownedRustReceiverReviewedIr, { transferredInputs: true, anchoredResults: true, receiverExports: true }]
	]) {
		const baseline = generateOwnedPerlXs(fixture(), namespace, enabled);
		const widened = generateOwnedPerlXs(fixture(), namespace, { ...enabled, callbackResultAnchors: true });
		for(const field of ["declarations", "xs", "valuesSource"]) assert.equal(widened[field], baseline[field]);
		assert.equal(factories(widened).length, 0);
	}
});

test("Perl callback copy factories compile on each selected XS ABI without a Lean build", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST !== "1"
	, timeout: 180000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-callback-factories-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const model = generateOwnedPerlXs(factoryIr(), namespace, options);
	await saveLakeFile(directory, model.c.prefix + ".h", model.c.header);
	await saveLakeFile(directory, "Probe.xs", model.declarations + "\n" + model.xs);
	for(const perl of perlGraphCommands())
	{
		const environment = { PATH: "/usr/bin:/bin" };
		const config = JSON.parse((await runCopied(perl, [
			"-MConfig", "-MText::ParseWords", "-MJSON::PP", "-e"
			, 'print encode_json({include => "$Config{archlibexp}/CORE", flags => [Text::ParseWords::shellwords($Config{ccflags} . " " . $Config{cccdlflags})]})'], directory, environment)).stdout);
		await runCopied(perl, ["-MExtUtils::ParseXS", "-e"
			, 'ExtUtils::ParseXS::process_file(filename => "Probe.xs", output => "Probe.c", prototypes => 0)'], directory, environment);
		await runCopied("/usr/bin/cc", [
			"-std=gnu11", "-Wall", "-Wextra", "-Werror"
			, "-Wno-unused-function", "-fsyntax-only"
			, ...config.flags
			, "-I"
			, config.include
			, "-I"
			, directory
			, "Probe.c"], directory, environment);
	}
	t.diagnostic("Compiled generated factory methods only; no native Lean invocation or installed-package execution.");
});

/* Planned actual-Lean integration, not claimed by these source/XS checks:
 * - Invoke each callback-only container factory with empty and nonempty values
 *   before the first closure call, then pass its whole owner to the closure.
 * - Close the original closure and anchor, retaining the copied owner separately.
 * - Call a captured method with forged, foreign, wrong-type, expired and closed
 *   self values while a tied supplied value records any premature FETCH.
 * - Attempt the same call from another interpreter/thread and a forked process.
 * - Assert native live-result/identity and managed allocation counters restore.
 */
