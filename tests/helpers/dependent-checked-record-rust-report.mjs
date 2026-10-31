/**
 * Independently verify dependent checked-record Rust producer records and all executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { dependentCheckedRecordSelection } from "./dependent-checked-record-browser-fixture.mjs";
import {
	checkDependentCheckedRecordRustDependencyRecords
	, dependentCheckedRecordRustConsumerLock
	, dependentCheckedRecordRustDependencyManifests
} from "./dependent-checked-record-rust-dependency-records.mjs";
import {
	dependentCheckedRecordRustCaller, dependentCheckedRecordRustConfiguration
	, dependentCheckedRecordRustCounts, dependentCheckedRecordRustLeanModule
	, dependentCheckedRecordRustRoutes
	, parseDependentCheckedRecordRustResult
} from "./dependent-checked-record-rust-fixture.mjs";
import {
	checkDependentCheckedRecordRustApiProbe, dependentCheckedRecordRustApiProbe
	, dependentCheckedRecordRustLinker, dependentCheckedRecordRustPublicInputs
	, dependentCheckedRecordRustTarget
} from "./dependent-checked-record-rust-install.mjs";
import {
	assertDependentCheckedRecordRustIdentity, dependentCheckedRecordRustNativeEvidence
	, dependentCheckedRecordRustReceipt
} from "./dependent-checked-record-rust-package.mjs";
import {
	assertDependentCheckedRecordRustResources, dependentCheckedRecordRustLoadCeilings
} from "./dependent-checked-record-rust-resources.mjs";
import { moduleAtProducer } from "./producer-module.mjs";
import { readOwnedPerlCallbackVariantTar } from "./owned-perl-callback-result-variant-archives.mjs";

const digest = /^[a-f0-9]{64}$/u;
const absolute = path => assert.ok(typeof path === "string" && path.startsWith("/")
	&& posix.normalize(path) === path && !/[\0\r\n]/u.test(path));
const runKeys = run => assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);

/**
 * Read and require canonical JSON from one retained selection.
 *
 * @param read - Selection-relative original byte reader.
 */
const reader = read => async path => {
	const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
	return value;
};

/**
 * Authenticate both author models and their complete source identities.
 *
 * @param options - Independent model record readers and selection.
 * @param options.report - Original top-level report.
 * @param options.read - Original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.route - Exact author route.
 * @param options.selection - Independently derived route selection.
 */
const checkModels = async options => {
	const { report, read, json, route, selection } = options;
	const expected = selection.expected, configuration = dependentCheckedRecordRustConfiguration(route);
	assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	let model, receipt;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`, build = report.builds[attempt];
		model = await json(prefix + "model.json"); receipt = await json(prefix + "package-set-receipt.json");
		validateBindingIr(model.bindingIr); validatePackageSetReceipt(receipt);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64);
		assert.equal(model.byteOrder, "little"); assert.equal(model.moduleName, undefined);
		assert.equal(model.exports.length, expected.declarations.length);
		assert.deepEqual(model.exports.map(item => item.name).sort()
			, expected.declarations.map(item => item.id.slice(5)).sort());
		const source = await read(prefix + `${dependentCheckedRecordRustLeanModule}.lean`);
		const identity = model.sourceIdentity;
		assert.equal(identity.modules.length, 1);
		assert.equal(identity.modules[0].module, dependentCheckedRecordRustLeanModule);
		assert.deepEqual(identity.modules[0].source, {
			path: `${dependentCheckedRecordRustLeanModule}.lean`
			, bytes: source.length
			, sha256: sha256(source)
		});
		assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(identity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.match(identity.extractorSha256, digest); assert.match(identity.leanCompilerSha256, digest);
		assert.match(identity.sourceTreeSha256, digest); assert.match(identity.sourceNoticesSha256, digest);
		assert.deepEqual(await json(prefix + "lean-bridge.exports.json"), configuration);
		if(selection.reviewed)
		{
			assert.deepEqual(await json(prefix + "api.binding-ir.json"), expected);
			assert.equal(identity.reviewedBindingIr.source, canonicalJson(expected));
			assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(expected)));
			assert.equal(identity.reviewedBindingIr.semanticSha256, hashBindingIr(expected));
		} else assert.equal(identity.reviewedBindingIr, undefined);
		const snapshot = await json(prefix + "author-inputs.json");
		const moduleInput = snapshot.find(item => item.path === `${dependentCheckedRecordRustLeanModule}.lean`);
		assert.equal(moduleInput.sha256, sha256(source));
		assert.equal(moduleInput.mode & 0o170000, 0o100000);
		assert.equal(receipt.source.treeSha256, identity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.deepEqual(model.component, { id: "dependentrecords@1.0.0"
			, name: "dependentrecords", version: "1.0.0" });
		assert.equal(receipt.profiles.length, 1);
		assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["cargo"]);
		assert.deepEqual(receipt, report.receipt);
		assert.deepEqual(build, { bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(await read(prefix + "model.json"))
			, receiptSha256: sha256(await read(prefix + "package-set-receipt.json"))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(item => [item.path, item.sha256]))) });
	}
	for(const path of ["model.json", "package-set-receipt.json"
		, `${dependentCheckedRecordRustLeanModule}.lean`, "lean-bridge.exports.json"
		, ...selection.reviewed ? ["api.binding-ir.json"] : []])
		assert.deepEqual(await read(`build-0/${path}`), await read(`build-1/${path}`), path);
	return { model, receipt, expected, configuration };
};

/**
 * Authenticate the crate archive and every retained generated input.
 *
 * @param options - Independent package record scope.
 * @param options.read - Original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Reproduced compiler model.
 * @param options.receipt - Verified package-set receipt.
 * @param options.floor - Explicit native glibc floor.
 */
const checkPackage = async options => {
	const { read, json, model, receipt, floor, producer } = options;
	const { compiledPackageMetadata, generateCopiedRustPackage } = producer;
	const pkg = receipt.packages[0], crate = await json("crate.json");
	assert.deepEqual(Object.keys(crate).sort()
		, ["archive", "closure", "evidence", "files", "receiptSha256", "retained"]);
	assert.deepEqual(crate.archive, pkg.artifacts[0]);
	const receiptBytes = await read(`package/${dependentCheckedRecordRustReceipt}`);
	const packageReceipt = await json(`package/${dependentCheckedRecordRustReceipt}`);
	assertDependentCheckedRecordRustIdentity(packageReceipt, pkg, model, floor);
	const handoff = await read("handoff/package-set-receipt.json");
	assert.equal(handoff.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, sha256(handoff) + "  package-set-receipt.json\n");
	const archive = await read("handoff/" + crate.archive.path);
	assert.equal(archive.length, pkg.artifacts[0].bytes);
	assert.equal(sha256(archive), pkg.artifacts[0].sha256);
	const members = readOwnedPerlCallbackVariantTar(archive, `${pkg.name}-${pkg.version}`);
	assert.deepEqual([...members.keys()].sort(), Object.keys(crate.files).sort());
	assert.deepEqual(members.get(dependentCheckedRecordRustReceipt), receiptBytes);
	for(const [path, bytes] of members)
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, crate.files[path], path);
	assert.equal(crate.receiptSha256, sha256(receiptBytes));
	const paths = [...Object.keys(packageReceipt.files), dependentCheckedRecordRustReceipt].sort();
	assert.equal(new Set(paths).size, paths.length); assert.deepEqual(Object.keys(crate.files).sort(), paths);
	const binaryPrefix = "native/linux-x64/";
	assert.deepEqual(crate.retained, paths.filter(path => !path.startsWith(binaryPrefix)));
	for(const path of crate.retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual(bytes, members.get(path), path);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
	}
	assert.deepEqual(await json("package/lean-bridge/component/model.json"), model);
	assert.deepEqual(await json("package/lean-bridge/component/binding-ir.json"), model.bindingIr);
	const component = await json("package/lean-bridge/component/native-component.json");
	const adapter = await json("package/lean-bridge/native-c-adapter.json");
	const runtime = await json("package/lean-bridge/runtime.json");
	const evidence = dependentCheckedRecordRustNativeEvidence(packageReceipt, component, adapter, runtime);
	assert.deepEqual(crate.evidence, evidence);
	const generated = generateCopiedRustPackage(model.bindingIr, evidence, {
		name: pkg.name
		, version: pkg.version
		, metadata: compiledPackageMetadata(model.sourceIdentity)
	});
	for(const [path, source] of Object.entries(generated))
		assert.equal((await read(`package/${path}`)).toString(), source, path);
	const compiled = await json("package/lean-bridge/native-rust.json");
	assert.equal(sha256(canonicalJson(compiled)), packageReceipt.compiledProjectionSha256);
	assert.equal(compiled.name, pkg.name); assert.equal(compiled.version, pkg.version);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(compiled.evidence, evidence);
	assert.deepEqual(crate.closure, { receiptSha256: sha256(receiptBytes)
		, packageFileSetSha256: sha256(canonicalJson(paths)) });
	return { pkg, crate };
};

/**
 * Authenticate Cargo, dependency, API-probe, and executable records.
 *
 * @param options - Original installation records and independent scope.
 * @param options.read - Original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.crate - Authenticated crate inventory.
 * @param options.pkg - Verified package-set entry.
 * @param options.selection - Independently derived route selection.
 * @param options.toolchain - Fresh Rust and Cargo identities.
 */
const checkEnvironment = async options => {
	const { read, json, crate, pkg, selection, toolchain } = options;
	const installation = await json("installation.json"), dependencies = await json("dependencies.json");
	assert.deepEqual(Object.keys(installation).sort(), [
		"api"
		, "apiProbe"
		, "build"
		, "crateClosure"
		, "crateReceiptSha256"
		, "dependencyClosure"
		, "emptyCargoHome"
		, "executable"
		, "executableSha256"
		, "linkOnly"
		, "linkerControls"
		, "locked"
		, "offline"
		, "tools"
	]);
	const tools = await json("toolchain.json"); assert.deepEqual(tools, toolchain);
	assert.deepEqual(installation.tools, tools); assert.deepEqual(Object.keys(tools).sort(), ["cargo", "rustc"]);
	for(const [name, tool] of Object.entries(tools))
	{
		assert.deepEqual(Object.keys(tool).sort(), ["bytes", "command", "run", "sha256"]);
		absolute(tool.command); assert.equal(posix.basename(tool.command), name);
		assert.ok(Number.isSafeInteger(tool.bytes) && tool.bytes > 0); assert.match(tool.sha256, digest);
		runKeys(tool.run); assert.equal(tool.run.code, 0); assert.equal(tool.run.stderr, "");
		assert.match(tool.run.stdout, new RegExp(`^${name} 1\\.(?:9\\d|[1-9]\\d{2,})\\.\\d+ `, "u"));
	}
	const environment = await json("consumer-environment.json"), root = posix.dirname(environment.CARGO_HOME);
	absolute(root); assert.equal(posix.basename(root), "consumer");
	assert.match(posix.basename(posix.dirname(root)), /^lean-bridge-dependent-checked-record-rust-[A-Za-z0-9]+$/u);
	assert.equal(environment.PATH, root + "/tools"); assert.equal(environment.RUSTC, tools.rustc.command);
	assert.equal(environment.CARGO_HOME, root + "/cargo-home");
	assert.equal(environment.CARGO_TARGET_DIR, root + "/target");
	assert.equal(environment.CARGO_NET_OFFLINE, "true"); assert.equal(environment.CARGO_BUILD_JOBS, "1");
	assert.equal(environment.CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER, root + "/tools/link-only");
	for(const key of ["emptyCargoHome", "offline", "linkOnly"]) assert.equal(installation[key], true);
	const manifest = `[package]\nname = "dependent-record-consumer"\nversion = "0.0.0"\nedition = "2021"\n[features]\nresult-only = []\nreviewed = []\n[dependencies]\n${pkg.name} = { path = "vendor/${pkg.name}-${pkg.version}" }\n[profile.dev]\ndebug = 0\nincremental = false\n`;
	assert.equal((await read("consumer.Cargo.toml")).toString(), manifest);
	assert.equal((await read("consumer.config.toml")).toString()
		, '[source.crates-io]\nreplace-with = "dependent-record-vendor"\n[source.dependent-record-vendor]\ndirectory = "vendor/dependencies"\n');
	assert.equal((await read("link-only")).toString(), dependentCheckedRecordRustLinker);
	assert.equal((await read("api-probe.rs")).toString(), dependentCheckedRecordRustApiProbe);
	assert.deepEqual(installation.linkerControls, [
		"-c"
		, "-S"
		, "-E"
		, "-xc"
		, "-fsyntax-only"
		, "test.c"
		, "test.C"
		, "test.cc"
		, "test.cpp"
		, "test.cxx"
		, "test.s"
		, "test.S"
		, "@args"
	]);
	assert.deepEqual(dependentCheckedRecordRustPublicInputs, [
		"dependent_total", "dependent_roundtrip"
	]);
	const lock = (await read("package/Cargo.lock")).toString();
	assert.equal((await read("consumer.Cargo.lock")).toString(), dependentCheckedRecordRustConsumerLock(lock));
	const dependencyArchive = await read("dependency-handoff/" + dependencies.archive);
	const manifests = dependentCheckedRecordRustDependencyManifests(dependencyArchive, dependencies);
	for(const [path, bytes] of manifests) assert.deepEqual(await read(path), bytes, path);
	const dependencyClosure = await checkDependentCheckedRecordRustDependencyRecords({
		dependencies, lock, read
	});
	assert.deepEqual(installation.dependencyClosure, dependencyClosure);
	const metadataRun = await json("consumer-metadata.json"); runKeys(metadataRun);
	assert.equal(metadataRun.code, 0); assert.equal(metadataRun.stderr, "");
	const metadata = JSON.parse(metadataRun.stdout);
	assert.equal(metadata.packages.find(item => item.name === pkg.name).version, pkg.version);
	const registryPackages = metadata.packages.filter(item => item.source !== null)
		.map(item => `${item.name}-${item.version}`).sort();
	assert.deepEqual(registryPackages, dependencies.packages.map(item => item.directory).sort());
	const build = await json("consumer-build.json"); runKeys(build);
	assert.deepEqual(installation.build, build); assert.equal(build.code, 0); assert.equal(build.stdout, "");
	const apiProbe = await json("api-probe.json"); assert.deepEqual(installation.apiProbe, apiProbe);
	assert.deepEqual(installation.api
		, checkDependentCheckedRecordRustApiProbe(apiProbe, selection.resultOnly));
	assert.equal(installation.executable
		, `target/${dependentCheckedRecordRustTarget}/debug/dependent-record-consumer`);
	assert.match(installation.executableSha256, digest);
	assert.equal(installation.crateReceiptSha256, crate.receiptSha256);
	assert.deepEqual(installation.crateClosure, crate.closure);
	return { root, installation, dependencies
		, closure: { crate: crate.closure, dependencies: dependencyClosure } };
};

/**
 * Check both author builds, offline installation, and all public results.
 *
 * @param read - Selection-relative original byte reader.
 * @param options - Independently selected run scope.
 * @param options.route - Exact independent author route.
 * @param options.producerCommit - Full immutable source revision.
 * @param options.runtime - Observed host platform and glibc version.
 * @param options.floor - Explicit package glibc floor.
 * @param options.toolchain - Fresh Rust and Cargo identities.
 */
export const checkDependentCheckedRecordRustReport = async (read, options) => {
	const { route, producerCommit, runtime, floor, toolchain } = options;
	assert.ok(dependentCheckedRecordRustRoutes.includes(route)); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const producer = Object.assign({}, ...await Promise.all([
		"src/analyze/package-metadata.mjs"
		, "src/backends/rust/copied-values.mjs"
	].map(path => moduleAtProducer(producerCommit, path))));
	const selection = dependentCheckedRecordSelection(route);
	const mode = selection.resultOnly ? "result-only" : "full", json = reader(read);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged"
		, "builds"
		, "compilerFreeReplay"
		, "declaredGlibcFloor"
		, "dependencies"
		, "dispatch"
		, "expectedBindingIrSha256"
		, "independentBuilds"
		, "installation"
		, "loadCeiling"
		, "mode"
		, "observations"
		, "offlineInstall"
		, "producerCommit"
		, "receipt"
		, "relocatedInstallation"
		, "reproducible"
		, "resourceChecks"
		, "route"
		, "runtime"
		, "schemaVersion"
		, "sourceFreeExecutable"
		, "sourceRemovedBeforeInstallation"
	]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode); assert.equal(report.declaredGlibcFloor, floor);
	assert.equal(report.independentBuilds, 2);
	for(const key of [
		"reproducible"
		, "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation"
		, "offlineInstall"
		, "compilerFreeReplay"
		, "relocatedInstallation"
		, "sourceFreeExecutable"
	])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false
		, reason: "No Rust constructor/source entry counters in this installed acceptance" });
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.ok(dependentCheckedRecordRustLoadCeilings.includes(report.loadCeiling));
	const resources = await json("resources.json"); assert.equal(resources.length, 8);
	assert.deepEqual(report.resourceChecks, resources);
	for(const resource of resources) assertDependentCheckedRecordRustResources(resource, report.loadCeiling);
	const { model, receipt } = await checkModels({ report, read, json, route, selection });
	const { pkg, crate } = await checkPackage({
		read, json, model, receipt, floor, producer
	});
	assert.equal((await read("consumer.rs")).toString(), await dependentCheckedRecordRustCaller());
	const environment = await checkEnvironment({ read, json, crate, pkg, selection, toolchain });
	assert.deepEqual(report.installation, environment.installation);
	assert.deepEqual(report.dependencies, environment.dependencies);
	assert.equal(report.observations.length, 3);
	for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
	{
		const observation = await json(`${stage}.json`);
		assert.deepEqual(observation, report.observations[index]);
		assert.equal(observation.stage, stage); assert.equal(observation.normalExitCleanup, true);
		assert.equal(observation.cwd, index === 2
			? posix.join(posix.dirname(environment.root), "source-free")
			: environment.root + (index ? "-relocated" : ""));
		if(index === 2) assert.equal(observation.sourcesRemoved, true);
		else assert.deepEqual(observation.closure, environment.closure);
		assert.deepEqual(observation.counts, dependentCheckedRecordRustCounts[mode]);
		runKeys(observation.run); assert.equal(observation.run.code, 0);
		assert.equal(observation.run.stderr, "");
		parseDependentCheckedRecordRustResult(observation.run.stdout, mode);
	}
	return { route, mode, producerCommit, runtime, floor, toolchain
		, counts: dependentCheckedRecordRustCounts[mode], executions: 3
		, loadCeiling: report.loadCeiling, dispatchObserved: false };
};
