/**
 * Execute public JVM receiver APIs without result anchors or host callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedReceiverConfiguration } from "./helpers/owned-receiver-fixture.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource
	, ownedJvmPlainReceiverProbe, ownedKotlinPlainReceiverProbe } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const consuming of [false, true]) for(const mode of ["ordinary", "reviewed"])
	test(`JVM ${mode} resource members${consuming ? " consume without anchors" : " need no optional capabilities"}`, {
		skip: process.env.LEAN_BRIDGE_OWNED_JVM_RECEIVER_TEST !== "1", timeout: 600000
	}, async t => {
		const names = ["newTicket", "serial", "retainTicket", "pingTicket", ...consuming ? ["transferTicket"] : []];
		const configuration = await ownedReceiverConfiguration();
		configuration.exports = names.map(name => "Owned." + name); configuration.arities = {};
		const transfer = configuration.contracts["Owned.transferTicket"];
		configuration.contracts = { "Owned.serial": { receiver: "property" }
			, "Owned.pingTicket": { receiver: "property" }
			, "Owned.retainTicket": { receiver: "method" }
			, ...consuming ? { "Owned.transferTicket": transfer } : {} };
		const name = `${mode}-${consuming ? "consuming" : "plain"}`;
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration } : { reviewedIr: ownedJvmPlainReceiverReviewedIr(consuming) }
			, hostCallbacks: false, sourceSuffix: ownedJvmPlainReceiverSource
			, evidenceName: `jvm-receiver-${name}-inputs.json`
		});
		const options = { receiverExports: true, hostCallbacks: false, transferredInputs: consuming };
		const native = await compileOwnedJvmCallNative(compiled, options);
		const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options);
		assert.equal(model.c.anchoredResults, undefined); assert.equal(model.c.copies, undefined);
		assert.equal(compiled.callbackSource, undefined);
		assert.equal(model.contract.schemaVersion, 4);
		assert.ok(!JSON.parse(model.files["binding-manifest.json"]).supportedFeatures.includes("callbacks"));
		assert.doesNotMatch(Object.values(model.files).join("\n"), /result_validate/u);
		const files = { ...model.files, "PlainReceiverProbe.java": ownedJvmPlainReceiverProbe(consuming)
			, "KotlinPlainReceiverProbe.kt": ownedKotlinPlainReceiverProbe(consuming) };
		const loader = Object.keys(files).find(path => path.endsWith("/_OwnedLoader.java"));
		files[loader] = `package ${model.namespace};
final class _OwnedLoader {
    static _OwnedBindings loaded;
    static _OwnedBindings bindings() { return loaded; }
}
`;
		let observed;
		try
		{
			const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
			const run = await runCopied(toolchain.java, ["--enable-native-access=ALL-UNNAMED"
				, "-cp", "classes:" + toolchain.stdlib
				, model.namespace + ".PlainReceiverProbe"
				, join(compiled.directory, "libprobe.so")], compiled.directory);
			assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
		}
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.deepEqual(observed, { javaChecks: consuming ? 13 : 11, kotlinChecks: consuming ? 13 : 11, live: 0, identities: 0 });
		await saveLakeFile("build/owned-jvm-receiver-core", `${name}.json`, canonicalJson({
			mode, consuming, actualLean: true, installedPackage: false
			, nominalMembers: true
			, observed, input: native.input
			, generated: Object.fromEntries(Object.entries(model.files).map(([path, text]) => [path, sha256(text)]))
			, nativeProbeSha256: sha256(native.implementation)
			, javaProbeSha256: sha256(files["PlainReceiverProbe.java"])
			, kotlinProbeSha256: sha256(files["KotlinPlainReceiverProbe.kt"])
			, testLoaderSha256: sha256(files[loader])
		}));
		t.diagnostic(JSON.stringify({ mode, consuming, ...observed }));
	});
