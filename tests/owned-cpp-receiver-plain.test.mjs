/**
 * Resource-only C++ receiver APIs work without anchors, aggregates or callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedReceiverConfiguration, ownedReceiverReviewedIr, ownedReceiverSource } from "./helpers/owned-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedCppPlainReceiverProbe } from "./helpers/owned-cpp-receiver-fixture.mjs";


for(const consuming of [false, true]) for(const mode of ["ordinary", "reviewed"])
	test(`C++ ${mode} resource-only receivers${consuming ? " consume without anchors" : " need no optional capabilities"}`, {
		skip: process.env.LEAN_BRIDGE_OWNED_CPP_RECEIVER_TEST !== "1", timeout: 600000
	}, async t => {
		const names = ["newTicket", "serial", "retainTicket", ...consuming ? ["transferTicket"] : []];
		const configuration = await ownedReceiverConfiguration();
		configuration.exports = names.map(name => "Owned." + name); configuration.arities = {};
		const transfer = configuration.contracts["Owned.transferTicket"];
		configuration.contracts = { "Owned.serial": { receiver: "property" }
			, "Owned.retainTicket": { receiver: "method" }
			, ...consuming ? { "Owned.transferTicket": transfer } : {} };
		const ir = ownedReceiverReviewedIr();
		ir.declarations = ir.declarations.filter(item => names.includes(item.name));
		ir.types = ir.types.filter(item => item.id === "lean:Owned.Ticket"); ir.errors = [];
		for(const item of ir.declarations) if(item.result.ownership === "borrow")
			Object.assign(item.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
		const name = `${mode}-${consuming ? "consuming" : "plain"}`;
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration } : { reviewedIr: ir }
			, sourceSuffix: ownedReceiverSource
			, evidenceName: `cpp-receivers-${name}-inputs.json` });
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, receiverExports: true
			, transferredInputs: consuming };
		const model = createCompiledNativeModel(input, { ownedGraphs: true
			, ownedReceiverExports: true, ownedInputTransfers: consuming });
		const c = generateOwnedCPackage(input);
		const cpp = generateOwnedCppPackage(c.layout.model.bindingIr, { receiverExports: true
			, transferredInputs: consuming, hostCallbacks: false });
		assert.equal(model.ownedGraph.resultAnchors, undefined);
		assert.equal(model.ownedGraph.hostCallbacks, undefined);
		if(!consuming) assert.equal(model.ownedGraph.inputTransfers, undefined);
		for(const [path, source] of Object.entries(c.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), source + (path.startsWith("src/") ? `
size_t receiver_identity_count(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
` : ""));
		for(const [path, source] of Object.entries({ ...cpp.files, [`include/${cpp.c.prefix}.h`]: cpp.c.header }))
			await saveLakeFile(compiled.directory, path, source);
		const source = ownedCppPlainReceiverProbe(consuming); await saveLakeFile(compiled.directory, "consumer.cpp", source);
		const env = { PATH: "/usr/bin:/bin" };
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra"
			, "-Werror", "-fPIC", "-shared"
			, "-I", join(compiled.directory, "runtime/include")
			, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", "libplain.so"], compiled.directory, env);
		await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-pthread", "-I", "include", "consumer.cpp"
			, "-L", compiled.directory, "-l:libplain.so", "-lgmp"
			, "-Wl,-rpath," + compiled.directory, "-o", "consumer"]
		, compiled.directory, env);
		const executed = await runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "cpp-plain-receivers", join(compiled.directory, "consumer")], compiled.directory, env);
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.deepEqual(result, { checks: consuming ? 9 : 8, identities: 0 });
		await saveLakeFile("build/owned-cpp-receivers", name + ".json", canonicalJson({
			mode, consuming, input, model, result, contract: cpp.contract
			, sourceSha256: sha256(c.source), probeSha256: sha256(source) }));
		t.diagnostic(JSON.stringify({ mode, consuming, ...result }));
	});
