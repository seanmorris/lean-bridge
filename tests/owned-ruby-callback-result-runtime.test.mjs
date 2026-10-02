/**
 * Execute Ruby callback-local owners through freshly compiled Lean adapters.
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
import { ownedRubyCallbackResultConfiguration, ownedRubyCallbackResultCombinedConfiguration
	, ownedRubyCallbackResultReviewedIr, ownedRubyCallbackResultCombinedReviewedIr
	, ownedRubyCallbackResultSource, ownedRubyCallbackResultCombinedSource } from "./helpers/owned-ruby-callback-result-fixture.mjs";
import { ownedRubyCallbackNativeSource } from "./helpers/owned-ruby-callback-result-native.mjs";
import { ownedRubyCallbackMutations } from "./helpers/owned-ruby-callback-result-mutations.mjs";
import { ownedRubyCallbackInstalledProbe } from "./helpers/owned-ruby-callback-result-installed.mjs";
import { runOwnedRubyCallbackSanitizers } from "./helpers/owned-ruby-callback-result-sanitizers.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const variants = [
	{ name: "no-host", hostCallbacks: false, combined: false }
	, { name: "host", hostCallbacks: true, combined: false }
	, { name: "combined", hostCallbacks: true, combined: true }
];
for(const mode of ["ordinary", "reviewed"]) for(const { name, hostCallbacks, combined } of variants)
test(`Ruby callback-result owners execute ${mode}-${name}`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const configuration = combined ? ownedRubyCallbackResultCombinedConfiguration : ownedRubyCallbackResultConfiguration;
	const reviewed = combined ? ownedRubyCallbackResultCombinedReviewedIr : ownedRubyCallbackResultReviewedIr;
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewed() }
		, hostCallbacks
		, sourceSuffix: combined ? ownedRubyCallbackResultCombinedSource : ownedRubyCallbackResultSource
		, evidenceName: `ruby-callback-result-${mode}-${name}-inputs.json`
	});
	const options = { hostCallbacks, callbackResultAnchors: true, valueCopies: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, ...options };
	const native = generateOwnedCPackage(input);
	const generated = generateOwnedRubyPackage(native.layout.model.bindingIr, null, options);
	assert.equal(generated.c.header, native.publicHeader);
	const implementation = ownedRubyCallbackNativeSource(native, combined) + generated.cSource;
	for(const [path, source] of Object.entries(native.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
		, ...hostCallbacks ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-ruby-callback-results.so"]
	, compiled.directory, { PATH: "/usr/bin:/bin" });
	const runtime = generated.files[`lib/${generated.requirePath}/owned.rb`];
	const helpers = await readFile("tests/fixtures/structured-types/owned-ruby-probe.rb", "utf8");
	const probe = `HOST_CALLBACKS = ${hostCallbacks}\nCOMBINED = ${combined}\n`
		+ await readFile("tests/fixtures/structured-types/owned-ruby-callback-results.rb", "utf8");
	for(const [path, source] of Object.entries({
		"runtime.rb": runtime, "values.rb": generated.valuesSource
		, "native.rb": generated.source, "probe.rb": helpers, "consumer.rb": probe }))
		await saveLakeFile(compiled.directory, path, source);
	const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const run = () => runCopied(ruby, ["--disable-gems", "consumer.rb", join(compiled.directory, "libowned-ruby-callback-results.so")]
		, compiled.directory, { PATH: "/usr/bin:/bin" });
	const executed = await run();
	assert.equal(executed.stderr, "");
	const observed = JSON.parse(executed.stdout);
	assert.ok(observed.checks > 500); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.equal(observed.hostCallbacks, hostCallbacks); assert.equal(observed.combined, combined);
	assert.deepEqual(observed.foreignCloseSchedules, ["get", "retain", "dup", "clone"]);
	for(const key of ["boundedAncestry", "garbageCollection", "threadExit", "forkRejection", "exitedThreadCollected"])
		assert.equal(observed[key], true, key);
	assert.equal(observed.nonlocalExits, hostCallbacks);
	assert.equal(observed.asynchronousInterruptions, hostCallbacks ? 2 : 0);
	assert.deepEqual(Object.keys(observed.faults).sort(), [
		"nativeRecord", "nativeArgument", "nativePassback", "nativeRawPassback"
		, "recursive", "recursivePassback"
		, ...hostCallbacks ? ["hostRaw", "hostWhole", "recoveryRaw", "recoveryWhole", "recursiveWhole"] : []
	].sort());
	for(const fault of Object.values(observed.faults))
	{
		assert.ok(fault.nativeFaults > 0); assert.ok(fault.rubyCheckpoints > 0);
		assert.equal(fault.rubyFaults, fault.rubyCheckpoints);
	}
	assert.deepEqual(observed.transfers.map(({ reply, allocator }) => ({ reply, allocator })), combined
		? ["raw", "whole", "native"].flatMap(reply => ["ruby", "native"].map(allocator => ({ reply, allocator }))) : []);
	for(const fault of observed.transfers)
	{ assert.ok(fault.before > 0); assert.ok(fault.after > 0); }
	const mutations = [];
	for(const mutation of ownedRubyCallbackMutations(generated, hostCallbacks))
	{
		await saveLakeFile(compiled.directory, mutation.path, mutation.source);
		try
		{
			await runCopied(ruby, ["--disable-gems", "-c", mutation.path], compiled.directory, { PATH: "/usr/bin:/bin" });
			await assert.rejects(run, error => {
				assert.equal(error.code, "build-command-failed");
				assert.ok(error.details.stderr.includes(mutation.diagnostic), mutation.name + ": " + error.details.stderr);
				assert.doesNotMatch(error.details.stderr, /SyntaxError|NameError|LoadError|Segmentation fault/u);
				mutations.push({ name: mutation.name, path: mutation.path
					, occurrences: mutation.occurrences, sourceSha256: sha256(mutation.source)
					, compiled: true, semanticRejection: true
					, diagnostic: mutation.diagnostic });
				return true;
			}, mutation.name);
		}
		finally
		{ await saveLakeFile(compiled.directory, mutation.path, mutation.original); }
	}
	const restored = await run();
	assert.equal(restored.stderr, ""); assert.deepEqual(JSON.parse(restored.stdout), observed);
	// Run the public consumer against this compiled fixture too. The separate
	// installed-gem gate supplies the real loader and verifies original archives.
	const publicSource = await ownedRubyCallbackInstalledProbe(hostCallbacks, combined);
	await saveLakeFile(compiled.directory, "public-consumer.rb", publicSource);
	await saveLakeFile(compiled.directory, "public-api/lean_bridge/owned_aggregates.rb", `require_relative "../../probe"
at_exit do
  Probe.state.close
  raise "Public consumer leaked native owners" unless Probe.counts == [0, 0]
end
`);
	const publicExecution = await runCopied(ruby, [
		"--disable-gems", "-Ipublic-api", "public-consumer.rb"
		, join(compiled.directory, "libowned-ruby-callback-results.so")], compiled.directory, { PATH: "/usr/bin:/bin" });
	assert.equal(publicExecution.stderr, "");
	const publicObservation = JSON.parse(publicExecution.stdout);
	assert.equal(publicObservation.ordinaryRequire, true); assert.ok(publicObservation.checks > 150);
	assert.deepEqual(publicObservation.scenarios, [
		"original_owners", "independent_closures", "native_passback"
		, "recursive_owners", "affinity", ...hostCallbacks ? ["host_replies"] : []
		, ...combined ? ["combined_transfers"] : []]);
	const sanitized = await runOwnedRubyCallbackSanitizers(compiled, hostCallbacks, ruby, observed);
	t.diagnostic(`${mode}-${name}: ${observed.checks} checks, ${mutations.length} semantic mutants rejected`);
	await saveLakeFile("build/owned-ruby-callback-results", `runtime-${mode}-${name}.json`, canonicalJson({
		mode, name, hostCallbacks, combined, input
		, contract: generated.contract, observed, mutations, restored: true
		, actualLean: true, installedPackage: false
		, publicSha256: sha256(generated.valuesSource)
		, conversionsSha256: sha256(generated.source)
		, boundarySha256: sha256(generated.cSource), runtimeSha256: sha256(runtime)
		, nativeSha256: sha256(implementation), helpersSha256: sha256(helpers)
		, probeSha256: sha256(probe)
		, publicObservation, publicProbeSha256: sha256(publicSource)
		, ...sanitized
	}));
});
