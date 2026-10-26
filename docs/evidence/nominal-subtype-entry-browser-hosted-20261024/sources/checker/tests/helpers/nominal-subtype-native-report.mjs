/**
 * Reconcile original native nominal packages, source identities and replay records.
 * The checker does not infer entry counters or a runtime floor from its own host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview, nominalSubtypeFixture, nominalSubtypeModule } from "./nominal-subtype-installed-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const profiles = ["c", "cpp"];
const buildPaths = ["model.json", "package-set-receipt.json", "author-inputs.json", `${nominalSubtypeModule}.lean`];
export const nominalSubtypeNativeRecordPaths = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json", "runtime.json"
	, ...[0, 1].flatMap(index => buildPaths.map(path => `build-${index}/${path}`))
	, ...profiles.flatMap(profile => [`consumers/${profile}.${profile}`
		, ...["compiler.json", "lean-bridge-package.json", "installed.json", "relocated.json", "report.json"].map(path => `${profile}/${path}`)])
]);

// Independently translate the author's named trees to the native positional form.
// This does not use the producer's lowering or expansion implementation.
const nativeTree = tree => {
	if(tree === null || ["fin", "subtype"].includes(tree.kind)) return tree;
	if(tree.kind === "record") return { kind: "record", definition: tree.name
		, fields: tree.fields.map(field => field.name)
		, arguments: tree.fields.map(field => nativeTree(field.refinement)) };
	if(tree.kind === "variant") return { kind: "variant", definition: tree.name
		, cases: tree.cases.map(branch => ({ name: branch.name
			, fields: branch.fields.map(field => field.name)
			, arguments: branch.fields.map(field => nativeTree(field.refinement)) })) };
	return { kind: tree.kind, arguments: tree.arguments.map(nativeTree) };
};

/**
 * Validate two independent builds and the unchanged installed/relocated callers.
 *
 * @param read - Original record reader, relative to one route/mode directory.
 * @param options - Independently authenticated producer, runtime and counts.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or standalone result-only API.
 * @param options.producerCommit - Frozen producer revision.
 * @param options.runtime - Observed platform, arch and glibc, not an inferred floor.
 * @param options.counts - Independently fixed C and C++ caller check totals.
 */
export const checkNominalSubtypeNativeReport = async (read, { route, mode, producerCommit, runtime, counts }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(["full", "result-only"].includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.deepEqual(Object.keys(counts).sort(), profiles);
	for(const count of Object.values(counts)) assert.ok(Number.isSafeInteger(count) && count >= 2000);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), path);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const resultOnly = mode === "result-only", expected = nominalSubtypeInstalledReview(resultOnly);
	const configuration = nominalSubtypeInstalledConfiguration(route, profiles, resultOnly);
	const report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.equal(report.producerCommit, producerCommit); assert.deepEqual(report.profiles, profiles);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.reproducible, true); assert.equal(report.authorInputsUnchanged, true);
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]);
	assert.equal(report.declaredGlibcFloor, runtime.glibc);
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(await json("runtime.json"), runtimeRecord); assert.deepEqual(report.runtime, runtimeRecord);
	const inputs = { "lean-bridge.exports.json": Buffer.from(canonicalJson(configuration)) };
	for(const path of [`${nominalSubtypeModule}.lean`, "lakefile.toml", "lean-toolchain", "LICENSE", "package.json"])
		inputs[path] = original(`${nominalSubtypeFixture}/${path}`);
	if(route === "reviewed") inputs["api.binding-ir.json"] = Buffer.from(canonicalJson(expected));
	let receipt, bindingBytesSha256;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		const model = await json(prefix + "model.json");
		receipt = await json(prefix + "package-set-receipt.json");
		assert.equal(build.modelSha256, sha256(await read(prefix + "model.json")));
		assert.equal(build.receiptSha256, sha256(await read(prefix + "package-set-receipt.json")));
		validateBindingIr(model.bindingIr); assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		bindingBytesSha256 = sha256(canonicalJson(model.bindingIr));
		assert.equal(build.bindingIrSha256, hashBindingIr(model.bindingIr)); assert.equal(model.bindingIrSha256, build.bindingIrSha256);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(model.exports.length, resultOnly ? 13 : 26);
		assert.deepEqual(model.exports.map(item => item.name).sort(), expected.declarations.map(item => item.id.slice(5)).sort());
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5));
			const tree = declaration.source.extensions["lean-lang.org/refinements"];
			assert.deepEqual(exported.refinements, { parameters: tree.parameters.map(nativeTree), result: nativeTree(tree.result) });
			assert.doesNotMatch(JSON.stringify(exported.refinements.result), /plusOne|plusTwo/u);
		}
		const source = await read(prefix + `${nominalSubtypeModule}.lean`);
		assert.deepEqual(source, inputs[`${nominalSubtypeModule}.lean`]);
		const identity = model.sourceIdentity;
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].source.sha256, sha256(source));
		assert.equal(identity.modules[0].source.bytes, source.length);
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.equal(identity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		digest(identity.leanCompilerSha256); digest(identity.sourceTreeSha256);
		assert.deepEqual(identity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		assert.equal(identity.request.metadata.toolchain, inputs["lean-toolchain"].toString().trim());
		if(route === "reviewed") assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(identity.reviewedBindingIr, undefined);
		const snapshot = await json(prefix + "author-inputs.json");
		assert.deepEqual(snapshot.map(item => item.path), Object.keys(inputs).sort());
		for(const item of snapshot)
		{
			assert.equal(item.sha256, sha256(inputs[item.path]));
			assert.equal(item.mode & 0o170000, 0o100000);
			assert.ok(Number.isFinite(item.mtime) && item.mtime > 0);
			assert.ok(Number.isFinite(item.ctime) && item.ctime > 0);
		}
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, build.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(item => item.target).sort(), profiles);
		assert.deepEqual(build.archives, Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))));
		for(const value of Object.values(build.archives)) digest(value);
	}
	for(const path of buildPaths.filter(path => path !== "author-inputs.json"))
		assert.deepEqual(await read(`build-0/${path}`), await read(`build-1/${path}`));
	assert.equal(report.reports.length, profiles.length);
	for(const [index, profile] of profiles.entries())
	{
		const item = report.reports[index]; assert.equal(item.profile, profile);
		assert.deepEqual(await json(`${profile}/report.json`), item); assert.equal(item.checks, counts[profile]);
		for(const key of ["compilerFreePath", "compilerFreeReplay", "offlineInstall", "relocatedInstallation", "sourceRemovedBeforeInstallation"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.dispatch, { observed: false, reason: "Separate constructor/source entry probe remains required" });
		digest(item.executableSha256);
		const source = original(`tests/fixtures/nominal-subtype-consumers/${profile}.${profile}`).toString();
		const caller = (resultOnly ? "#define NOMINAL_RESULT_ONLY\n" : "") + (route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1"));
		assert.equal((await read(`consumers/${profile}.${profile}`)).toString(), caller);
		assert.equal(item.consumerSha256, sha256(caller)); assert.equal(item.sourceSha256, sha256(caller));
		assert.deepEqual(item.packages, receipt.packages.filter(pkg => pkg.target === profile));
		assert.equal(item.packages.length, 1); assert.equal(item.packages[0].role, "component");
		assert.equal(item.packages[0].name, "nominalsubtypes"); assert.equal(item.packages[0].version, "1.0.0");
		const compiler = await json(`${profile}/compiler.json`); assert.deepEqual(item.compiler, compiler);
		assert.equal(compiler.code, 0); assert.equal(compiler.stderr, "");
		assert.match(compiler.stdout, profile === "c" ? /^cc \(.+\) [0-9]+\.[0-9]+\.[0-9]+\n/u : /^c\+\+ \(.+\) [0-9]+\.[0-9]+\.[0-9]+\n/u);
		const packageReceipt = await json(`${profile}/lean-bridge-package.json`);
		const receiptSha256 = sha256(await read(`${profile}/lean-bridge-package.json`));
		assert.equal(packageReceipt.schemaVersion, 1); assert.equal(packageReceipt.kind, "lean-bridge-native-c-package");
		assert.equal(packageReceipt.ecosystem, profile); assert.equal(packageReceipt.profile, "native-library-v1");
		assert.equal(packageReceipt.name, "nominalsubtypes"); assert.equal(packageReceipt.version, "1.0.0");
		assert.equal(packageReceipt.bindingIrSha256, report.builds[0].bindingIrSha256);
		assert.equal(packageReceipt.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.equal(packageReceipt.glibcMinimumVersion, runtime.glibc);
		assert.deepEqual(packageReceipt.component, receipt.component);
		if(profile === "c") assert.equal(packageReceipt.exactIntegers, "gmp-6.3.0");
		digest(packageReceipt.adapterReceiptSha256); digest(packageReceipt.componentReceiptSha256);
		const members = packageReceipt.files;
		assert.equal(members["share/lean-bridge/component/model.json"].sha256, report.builds[0].modelSha256);
		assert.equal(members["share/lean-bridge/component/binding-ir.json"].sha256, bindingBytesSha256);
		assert.equal(members["share/lean-bridge/component/native-component.json"].sha256, packageReceipt.componentReceiptSha256);
		assert.equal(members["share/lean-bridge/native-c-adapter.json"].sha256, packageReceipt.adapterReceiptSha256);
		for(const path of ["lib/libleanshared.so", "lib/liblean_bridge_native.so"
			, "lib/libnominalsubtypes.so"
			, profile === "c" ? "lib/libnominalsubtypes_gmp.so" : "include/nominalsubtypes.hpp"])
			digest(members[path].sha256);
		assert.ok(Object.keys(packageReceipt.files).length > 10);
		for(const [path, file] of Object.entries(packageReceipt.files))
		{
			assert.ok(!path.startsWith("/") && !path.split("/").some(part => ["", ".", ".."].includes(part)));
			digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		}
		const fileSetSha256 = sha256(canonicalJson([...Object.keys(packageReceipt.files), "lean-bridge-package.json"].sort()));
		assert.equal(item.runs.length, 2);
		for(const [position, name] of ["installed", "relocated"].entries())
		{
			const run = await json(`${profile}/${name}.json`); assert.deepEqual(run, item.runs[position]);
			assert.deepEqual(run, { code: 0
				, stdout: `nominal-subtype-ok:${counts[profile]}\n`, stderr: ""
				, receiptSha256, packageFileSetSha256: fileSetSha256
				, relocated: position === 1 });
		}
	}
	return { route, mode, producerCommit, profiles, counts, runtime, executions: 4, dispatchObserved: false };
};
