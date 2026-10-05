/**
 * Execute nominal Ruby receiver members over independently compiled Lean inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRubyPackage } from "../src/backends/ruby/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustBorrowNativeSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRubyReceiverConfiguration, ownedRubyReceiverReviewedIr
	, ownedRubyPlainReceiverReviewedIr, ownedRubyReceiverSource, ownedRubyReceiverProbe } from "./helpers/owned-ruby-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const enabled = process.env.LEAN_BRIDGE_OWNED_RUBY_RECEIVER_TEST === "1";

test("Ruby receivers preserve nominal members and unchanged free function APIs", () => {
	const ir = ownedRubyReceiverReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedRubyPackage(ir, null, { ...options, receiverExports: false }), /only synchronous function/u);
	const generated = generateOwnedRubyPackage(ir, null, options);
	assert.deepEqual(ir, before); assert.equal(generated.functions.length, 27);
	assert.equal(generated.contract.schemaVersion, 4); assert.equal(generated.contract.receiverExports.exports.length, 16);
	assert.equal(generated.contract.receiverExports.properties, "zero-argument-methods");
	assert.match(generated.valuesSource, /def serial\(\)/u);
	assert.match(generated.valuesSource, /def choose_ticket\(arg1\)/u);
	for(const name of ["get", "close", "retain", "closed", "call", "with", "lease", "checked_payload", "same_identity", "inspect"])
	{
		const changed = structuredClone(ir); changed.declarations.find(item => item.name === "serial").name = name;
		assert.throws(() => generateOwnedRubyPackage(changed, null, options), /reserved/u);
	}
	const previous = ownedAggregateReviewedIr();
	assert.deepEqual(generateOwnedRubyPackage(previous, null, { receiverExports: true }).files, generateOwnedRubyPackage(previous).files);
	const reverse = structuredClone(ir); reverse.types.reverse();
	const reordered = generateOwnedRubyPackage(reverse, null, options);
	for(const field of ["valuesSource", "source", "cSource", "abiHeader", "contract"])
		assert.deepEqual(reordered[field], generated[field]);
	assert.notEqual(JSON.parse(reordered.files["binding-manifest.json"]).bindingIrSha256,
		JSON.parse(generated.files["binding-manifest.json"]).bindingIrSha256);
});

test("Ruby resource-only receivers need no optional callback or result-anchor capability", () => {
	for(const consuming of [false, true])
	{
		const generated = generateOwnedRubyPackage(ownedRubyPlainReceiverReviewedIr(consuming), null, {
			receiverExports: true, transferredInputs: consuming, hostCallbacks: false
		});
		assert.equal(generated.contract.receiverExports.exports.length, consuming ? 3 : 2);
		assert.equal(generated.contract.resultAnchors, undefined); assert.equal(generated.c.copies, undefined);
		assert.deepEqual(generated.callbackModels, []); assert.deepEqual(generated.callbackLayouts, []);
		assert.doesNotMatch(generated.files[`lib/${generated.requirePath}/owned.rb`], /result_validate/u);
		assert.doesNotMatch(generated.valuesSource, /WithRecovery|with_recovery/u);
		assert.doesNotMatch(generated.files["README.md"], /with_recovery|Pass synchronous Ruby callables/u);
		if(consuming) assert.equal(generated.contract.inputTransfers.arguments, "whole-values");
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`Ruby receiver members preserve their original lifetime (${mode})`, { skip: !enabled, timeout: 900000 }, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRubyReceiverConfiguration() } : { reviewedIr: ownedRubyReceiverReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRubyReceiverSource
		, evidenceName: `ruby-receivers-${mode}-inputs.json`
	});
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true, ...options };
	const c = generateOwnedCPackage(input), generated = generateOwnedRubyPackage(c.layout.model.bindingIr, null, options);
	const implementation = ownedRustBorrowNativeSource(c) + generated.cSource;
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-ruby-receivers.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = generated.files[`lib/${generated.requirePath}/owned.rb`];
	const helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb", "utf8"), probe = await ownedRubyReceiverProbe();
	for(const [path, source] of Object.entries({ "runtime.rb": runtime, "values.rb": generated.valuesSource, "native.rb": generated.source, "probe.rb": helpers, "consumer.rb": probe }))
		await saveLakeFile(compiled.directory, path, source);
	const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const run = () => runCopied(ruby, ["--disable-gems", "consumer.rb", join(compiled.directory, "libowned-ruby-receivers.so")], compiled.directory, { PATH: "/usr/bin:/bin" });
	const executed = await run().catch(error => { throw new Error(JSON.stringify(error.details), { cause: error }); });
	assert.equal(executed.stderr, ""); const observed = JSON.parse(executed.stdout);
	assert.ok(observed.checks > 100); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.deepEqual(observed.foreignCloseSchedules, ["array", "option", "nested"].flatMap(shape => ["get", "retain", "dup", "clone"].map(operation => `${shape}/${operation}`)));
	for(const key of ["rubyBefore", "rubyAfter", "nativeBefore", "nativeAfter"]) assert.ok(observed[key] > 0);
	const choose = generated.functions.findIndex(fn => fn.name === "chooseTicket");
	const mutations = [
		["receiver-used-as-other-argument-anchor", "values.rb", generated.valuesSource, `Native.call${choose}(receiver, arg1)`, `Native.call${choose}(receiver, self)`]
		, ["unchecked-whole-value", "runtime.rb", runtime, "      guard.lease.require_open\n      payload", "      payload"]
		, ["escaped-callback-frame", "runtime.rb", runtime, "    def close; @scope.active = false; end", "    def close; @scope.active = true; end"]
	];
	const rejectedMutations = [];
	for(const [name, path, source, before, after] of mutations)
	{
		assert.equal(source.split(before).length, 2, name);
		const changed = source.replace(before, after); await saveLakeFile(compiled.directory, path, changed);
		await runCopied(ruby, ["--disable-gems", "-c", path], compiled.directory);
		await assert.rejects(run(), error => {
			assert.match(error.details.stderr, /Ruby check \d+ failed|Expected LeanBridge::OwnedAggregates::Owned::Error/u);
			assert.doesNotMatch(error.details.stderr, /SyntaxError|NameError|LoadError/u); return true;
		});
		rejectedMutations.push({ name, compiled: true, sourceSha256: sha256(changed) });
		await saveLakeFile(compiled.directory, path, source);
	}
	const restored = await run(); assert.equal(restored.stderr, ""); assert.deepEqual(JSON.parse(restored.stdout), observed);
	t.diagnostic(JSON.stringify({ mode, ...observed }));
		await saveLakeFile("build/owned-ruby-receivers", mode + ".json", canonicalJson({
			mode, input
		, actualLean: true, installedPackage: false, observed
		, rejectedMutations, restored: true
		, publicSha256: sha256(generated.valuesSource)
		, conversionsSha256: sha256(generated.source)
		, boundarySha256: sha256(generated.cSource)
		, runtimeSha256: sha256(runtime), nativeSha256: sha256(implementation)
		, helpersSha256: sha256(helpers), probeSha256: sha256(probe) }));
});
