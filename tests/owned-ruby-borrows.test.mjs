/**
 * Original-owner Ruby results over both actual Lean authoring paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRubyConversions } from "../src/backends/ruby/owned-conversions.mjs";
import { ownedRubyRuntime } from "../src/backends/ruby/owned-runtime.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedBorrowReviewedIr, ownedBorrowConfiguration } from "./helpers/owned-borrow-fixture.mjs";
import { ownedRustBorrowReviewedIr, ownedRustBorrowConfiguration, ownedRustBorrowSource, ownedRustBorrowNativeSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const options = { transferredInputs: true, anchoredResults: true };

test("Ruby borrowed results require whole owners without changing unanchored APIs", () => {
	const ir = ownedRustBorrowReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedRubyConversions(ir, { transferredInputs: true }), /explicit output leases/u);
	const generated = generateOwnedRubyConversions(ir, options);
	assert.deepEqual(ir, before);
	assert.equal(generated.c.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.match(generated.valuesSource, /Value = Owned::Value/u);
	assert.match(generated.cSource, /owned_aggregates_result \*anchor0/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const reordered = generateOwnedRubyConversions(reversed, options);
	const enabled = generateOwnedRubyConversions(ownedAggregateReviewedIr(), options);
	const baseline = generateOwnedRubyConversions(ownedAggregateReviewedIr());
	for(const key of ["valuesSource", "source", "cSource"])
	{
		assert.equal(reordered[key], generated[key]); assert.equal(enabled[key], baseline[key]);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`Ruby borrowed results expire with original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustBorrowConfiguration() } : { reviewedIr: ownedRustBorrowReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustBorrowSource
		, evidenceName: `ruby-borrows-${mode}-inputs.json`
	});
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component
		, hostCallbacks: true, ...options });
	const generated = generateOwnedRubyConversions(c.values.native.model.bindingIr, options);
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
		, "-o", "libowned-ruby-borrows.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = ownedRubyRuntime(c.values.prefix, options);
	const helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb", "utf8");
	const source = await readFile("tests/fixtures/structured-types/owned-ruby-borrows.rb", "utf8");
	await saveLakeFile(compiled.directory, "runtime.rb", `module LeanBridge\nmodule ${generated.componentName}\n${runtime}\nend\nend\n`);
	await saveLakeFile(compiled.directory, "values.rb", generated.valuesSource);
	await saveLakeFile(compiled.directory, "native.rb", generated.source);
	await saveLakeFile(compiled.directory, "probe.rb", helpers);
	await saveLakeFile(compiled.directory, "consumer.rb", source);
	let executed;
	try
	{ executed = await runCopied(resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby"), ["--disable-gems", "consumer.rb", join(compiled.directory, "libowned-ruby-borrows.so")], compiled.directory, { PATH: "/usr/bin:/bin" }); }
	catch(error)
	{ throw new Error(JSON.stringify(error.details), { cause: error }); }
	assert.equal(executed.stderr, ""); const observed = JSON.parse(executed.stdout);
	assert.ok(observed.checks > 100); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	for(const key of ["rubyBefore", "rubyAfter", "nativeBefore", "nativeAfter"])
		assert.ok(observed[key] > 0, key);
	const runtimePath = source => `module LeanBridge\nmodule ${generated.componentName}\n${source}\nend\nend\n`;
	const mutants = [
		["unchecked-whole-value", "runtime.rb", runtime
			, "      @guard.lease.require_open\n      @guard.payload[0]"
			, "      @guard.payload[0]"]
		, ["unchecked-empty-value", "runtime.rb", runtime
			, "      @guard.lease.require_open\n      @guard.payload[0]"
			, "      @guard.lease.require_open unless @guard.payload[0].nil? || @guard.payload[0] == []\n      @guard.payload[0]"]
		, ["escaped-callback-frame", "runtime.rb", runtime
			, "    def close; @scope.active = false; end"
			, "    def close; @scope.active = true; end"]
		, ["pointer-equality", "values.rb", generated.valuesSource
			, "      def ==(other); same_identity?(other); end"
			, "      def ==(other); equal?(other); end"]
	];
	const rejectedMutations = [], ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	for(const [name, path, source, before, after] of mutants)
	{
		assert.ok(source.includes(before), name);
		const changed = source.replaceAll(before, after), wrap = path === "runtime.rb" ? runtimePath : value => value;
		await saveLakeFile(compiled.directory, path, wrap(changed));
		await runCopied(ruby, ["--disable-gems", "-c", path], compiled.directory);
		await assert.rejects(runCopied(ruby, ["--disable-gems", "consumer.rb", join(compiled.directory, "libowned-ruby-borrows.so")], compiled.directory), error => {
			assert.match(error.details.stderr, /Ruby check \d+ failed|Expected LeanBridge::OwnedAggregates::Owned::Error/u);
			assert.doesNotMatch(error.details.stderr, /SyntaxError|NameError|LoadError/u);
			return true;
		});
		rejectedMutations.push({ name, compiled: true, sourceSha256: sha256(changed) });
		await saveLakeFile(compiled.directory, path, wrap(source));
	}
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile(resolve("build/owned-ruby-borrows"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observed, rejectedMutations
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component }
		, publicSha256: sha256(generated.valuesSource)
		, nativeSha256: sha256(implementation)
		, conversionsSha256: sha256(generated.source)
		, boundarySha256: sha256(generated.cSource), runtimeSha256: sha256(runtime)
		, helpersSha256: sha256(helpers), probeSha256: sha256(source)
	}));
});

test("Ruby borrowed results execute without input-transfer support", {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const probe = `require_relative "runtime"
require_relative "values"
require_relative "native"
api = LeanBridge::OwnedAggregates
native = api.const_get(:Native, false)
owned = api.const_get(:Owned, false)
library = Fiddle.dlopen(ARGV.fetch(0))
runtime = owned::Runtime.new(library)
native.bind(runtime)
root = api.new_ticket(42, "borrow-only")
original = api.copy_value(api::Bundle.new(primary: root.get, spare: nil, peers: [], history: [], payload: api::Payload.new(count: 0, bytes: "".b)))
view = api.echo_record(original)
closure = api.make_record(original)
independent = closure.retain
callback = api.callback_record(original, ->(value) { value })
raise "Wrong callback result" unless api.serial(callback.get.primary) == 42
original.close
[view, closure, callback].each do |value|
  raise "Borrow survived its original owner" unless value.closed?
  begin
    value.get
    raise "Expired whole value was exposed"
  rescue api::LeanBridgeError => error
    raise unless error.status == 4
  end
end
payload = api::Bundle.new(primary: root.get, spare: nil, peers: [], history: [], payload: api::Payload.new(count: 0, bytes: "".b))
received = independent.call(true, payload)
raise "Independent closure was lost" unless api.serial(received.get.primary) == 42
empty = api.copy_value(nil, result_of: :echo_option)
empty_view = api.echo_option(empty)
raise "Option shape changed" unless empty_view.get.nil?
empty.close
raise "Empty borrow survived its owner" unless empty_view.closed?
[root, original, view, closure, independent, callback, received, empty, empty_view].each(&:close)
raise "Leaked original owner slots" unless runtime.current_state.slots.empty?
runtime.current_state.close
identities = Fiddle::Function.new(library["owned_test_identities"], [], Fiddle::TYPE_SIZE_T, need_gvl: true)
raise "Leaked native identities" unless identities.call.zero?
puts "borrow-only-ok"
`;
	const observations = [];
	for(const mode of ["ordinary", "reviewed"])
	{
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration: await ownedBorrowConfiguration() } : { reviewedIr: ownedBorrowReviewedIr() }
			, hostCallbacks: true, evidenceName: `ruby-borrow-only-${mode}-inputs.json`
		});
		const input = { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component };
		const c = generateOwnedCPackage({ ...input, hostCallbacks: true, anchoredResults: true });
		const generated = generateOwnedRubyConversions(c.values.native.model.bindingIr, { anchoredResults: true });
		assert.ok(generated.c.functions.every(fn => !fn.transfers?.length));
		const implementation = c.source + generated.cSource + "\nsize_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }\n";
		for(const [path, source] of Object.entries(c.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra"
			, "-Werror", "-fPIC", "-shared"
			, "-I", join(compiled.directory, "runtime/include")
			, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", "borrow-only.so"], compiled.directory, { PATH: "/usr/bin:/bin" });
		const runtime = ownedRubyRuntime(c.values.prefix, { anchoredResults: true });
		await saveLakeFile(compiled.directory, "runtime.rb", `module LeanBridge\nmodule ${generated.componentName}\n${runtime}\nend\nend\n`);
		await saveLakeFile(compiled.directory, "values.rb", generated.valuesSource);
		await saveLakeFile(compiled.directory, "native.rb", generated.source);
		await saveLakeFile(compiled.directory, "consumer.rb", probe);
		const result = await runCopied(resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby"), ["--disable-gems", "consumer.rb", join(compiled.directory, "borrow-only.so")], compiled.directory);
		assert.equal(result.stderr, ""); assert.equal(result.stdout, "borrow-only-ok\n");
		observations.push({ mode, input, compiledLean: true, installedPackage: false
			, publicSha256: sha256(generated.valuesSource)
			, nativeSha256: sha256(implementation)
			, conversionsSha256: sha256(generated.source)
			, boundarySha256: sha256(generated.cSource), runtimeSha256: sha256(runtime)
			, stdout: result.stdout });
	}
	await saveLakeFile(resolve("build/owned-ruby-borrows"), "borrow-only.json", canonicalJson({ probe, probeSha256: sha256(probe), observations }));
});
