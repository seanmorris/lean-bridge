/**
 * Compile Ruby receiver APIs independently of callback and result-anchor support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRubyPackage } from "../src/backends/ruby/owned-package.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedReceiverConfiguration, ownedReceiverSource } from "./helpers/owned-receiver-fixture.mjs";
import { ownedRubyPlainReceiverReviewedIr, ownedRubyPlainReceiverProbe } from "./helpers/owned-ruby-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

for(const consuming of [false, true]) for(const mode of ["ordinary", "reviewed"])
	test(`Ruby ${mode} receivers need no optional capabilities (consuming=${consuming})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_RUBY_RECEIVER_TEST !== "1"
		, timeout: 900000
	}, async t => {
		const names = ["newTicket", "serial", "retainTicket", ...consuming ? ["transferTicket"] : []];
		const configuration = await ownedReceiverConfiguration();
		configuration.exports = names.map(name => "Owned." + name); configuration.arities = {};
		const transfer = configuration.contracts["Owned.transferTicket"];
		configuration.contracts = { "Owned.serial": { receiver: "property" }
			, "Owned.retainTicket": { receiver: "method" }
			, ...consuming ? { "Owned.transferTicket": transfer } : {} };
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration } : { reviewedIr: ownedRubyPlainReceiverReviewedIr(consuming) }
			, sourceSuffix: ownedReceiverSource
			, evidenceName: `ruby-receivers-${mode}-${consuming ? "consuming" : "plain"}-inputs.json`
		});
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, receiverExports: true
			, transferredInputs: consuming };
		const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedReceiverExports: true, ownedInputTransfers: consuming });
		const c = generateOwnedCPackage(input), generated = generateOwnedRubyPackage(model.bindingIr, null, {
			receiverExports: true, transferredInputs: consuming, hostCallbacks: false
		});
		const implementation = c.source + generated.cSource + `
size_t receiver_identity_count(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
		for(const [path, source] of Object.entries(c.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "plain-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-fPIC", "-shared"
			, "-I", join(compiled.directory, "runtime/include")
			, "plain-api.c", "Owned.o", "Carriers.o", "Witness.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", "libplain-ruby-receivers.so"]
		, compiled.directory, { PATH: "/usr/bin:/bin" });
		const probe = ownedRubyPlainReceiverProbe(consuming), runtime = generated.files[`lib/${generated.requirePath}/owned.rb`];
		for(const [path, source] of Object.entries({ "runtime.rb": runtime, "values.rb": generated.valuesSource, "native.rb": generated.source, "consumer.rb": probe }))
			await saveLakeFile(compiled.directory, path, source);
		const result = await runCopied(resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby"), ["--disable-gems", "consumer.rb", join(compiled.directory, "libplain-ruby-receivers.so")], compiled.directory)
			.catch(error => { throw new Error(JSON.stringify(error.details), { cause: error }); });
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.deepEqual(observed, { checks: consuming ? 9 : 8, identities: 0 });
		t.diagnostic(JSON.stringify({ mode, consuming, ...observed }));
		await saveLakeFile("build/owned-ruby-receivers", `${mode}-${consuming ? "consuming" : "plain"}.json`, canonicalJson({
			mode, consuming, input, model, observed, contract: generated.contract
			, nativeSha256: sha256(implementation)
			, publicSha256: sha256(generated.valuesSource)
			, conversionsSha256: sha256(generated.source)
			, runtimeSha256: sha256(runtime)
			, probeSha256: sha256(probe)
		}));
	});
