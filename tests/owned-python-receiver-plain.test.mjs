/**
 * Execute receiver-only Python APIs without callback or result-anchor helpers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedReceiverConfiguration, ownedReceiverSource } from "./helpers/owned-receiver-fixture.mjs";
import { ownedPythonPlainReceiverReviewedIr, ownedPythonPlainReceiverProbe } from "./helpers/owned-python-receiver-fixture.mjs";
import { pythonGraphInterpreters } from "./helpers/python-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

for(const consuming of [false, true]) for(const mode of ["ordinary", "reviewed"])
	test(`Python ${mode} receivers need no optional capabilities (consuming=${consuming})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_RECEIVER_TEST !== "1"
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
			...mode === "ordinary" ? { configuration } : { reviewedIr: ownedPythonPlainReceiverReviewedIr(consuming) }
			, sourceSuffix: ownedReceiverSource
			, evidenceName: `python-receivers-${mode}-${consuming ? "consuming" : "plain"}-inputs.json`
		});
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, receiverExports: true
			, transferredInputs: consuming };
		const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedReceiverExports: true, ownedInputTransfers: consuming });
		const native = generateOwnedCPackage(input);
		const generated = generateOwnedPythonPackage(model.bindingIr, null, { receiverExports: true, transferredInputs: consuming, hostCallbacks: false });
		for(const [path, source] of Object.entries(native.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "plain-api.c" : path.split("/").at(-1), source + (path.startsWith("src/") ? `
size_t receiver_identity_count(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
` : ""));
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
			, "-Wextra", "-Werror", "-fPIC", "-shared"
			, "-I", join(compiled.directory, "runtime/include")
			, "plain-api.c", "Owned.o", "Carriers.o", "Witness.o"
			, "-L", join(compiled.directory, "runtime/lib")
			, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
			, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
			, "-o", "libplain-python-receivers.so"]
		, compiled.directory, { PATH: "/usr/bin:/bin" });
		const probe = ownedPythonPlainReceiverProbe(consuming);
		const observations = [];
		for(const interpreter of await pythonGraphInterpreters(compiled.directory))
		{
			const root = join(interpreter.site, generated.packageDir);
			for(const [path, source] of Object.entries({ "__init__.py": generated.valuesSource
				, "__init__.pyi": generated.stub, "_native.py": generated.source
				, "_owned.py": generated.files[`${generated.packageDir}/_owned.py`] }))
				await saveLakeFile(root, path, source);
			await saveLakeFile(interpreter.directory, "probe.py", probe);
			const result = await runCopied(interpreter.command, ["-I", "-B", "probe.py", join(compiled.directory, "libplain-python-receivers.so")], interpreter.directory)
				.catch(error => { throw new Error(JSON.stringify(error.details), { cause: error }); });
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			assert.deepEqual(observed, { checks: consuming ? 8 : 7, identities: 0 });
			observations.push({ name: interpreter.name, typing: interpreter.typing, ...observed });
		}
		await saveLakeFile("build/owned-python-receivers", `${mode}-${consuming ? "consuming" : "plain"}.json`, canonicalJson({
			mode, consuming, input, model, observations, contract: generated.contract
			, sourceSha256: sha256(native.source), probe, probeSha256: sha256(probe)
		}));
		t.diagnostic(JSON.stringify({ mode, consuming, observations }));
	});
