/**
 * Reconstruct the original CPAN-only releases and their installed public runs.
 * These checks do not rerun compilers or authenticate execution independently.
 *
 * @file
 */
import assert from "node:assert/strict";
import { selectCliPackageConfig } from "./cli-package-config-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { callbackCompilerInputAtBaseline } from "./callback-compiler-identity.mjs";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { generateOwnedPerlPackage } from "../../src/backends/perl/owned-package.mjs";
import { renderOwnedPerlCallbackBuild } from "../../src/backends/perl/owned-callback-build.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { compiledPackageMetadata, cpanPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { assertOwnedPerlReceiverMatrix, ownedPerlReceiverVariant, ownedPerlReceiverVariants } from "./owned-perl-receiver-evidence.mjs";

const hash = value => sha256(canonicalJson(value));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const roles = ["runtime", "component"];
const consumer = { checks: 79, phases: { native: 25, host: 23, combined: 29 } };
const supportedGlibcFloor = /^2\.(?:36|38)$/u;
export const ownedPerlCallbackPackageReports = Object.freeze(["ordinary", "reviewed"].map(mode => `${mode}-combined-package.json`));

// Captured compiler-source identities, independent of supplied report labels.
// The authored target configuration differs from the direct-runtime fixtures.
const pins = {
	ordinary: {
		metadata: "3915cd8595efb4ddcda9e8944db8ae59ea45c0baf9c32fb1dbd4948a13e33c13"
		, identity: "d867538bebd2c9148a998f02208b67348a9a21e857490721f49946e0b8b8e85c"
	}
	, reviewed: {
		metadata: "444534c11087d9a5c1b0b85ffdfa19861ba285eb0a256c1aa61b513ece6c5ac3"
		, identity: "c5a600c00b77e718ce1b4bc2811ff1b1595413aafd0885986a9496dfc8477347"
	}
};

/**
 * Reconstruct the pinned four-ABI Perl Config fingerprint.
 *
 * @param variant - Independently selected pinned Perl variant.
 */
const abiFor = variant => {
	assert.ok(ownedPerlReceiverVariants.includes(variant));
	const threaded = !variant.endsWith("unthreaded");
	return {
		api_revision: "5", api_subversion: "0", api_version: variant.split(".")[1]
		, archname: "x86_64-linux" + (threaded ? "-thread-multi" : "")
		, binary_options: [], byteorder: "12345678", ivsize: "8", longsize: "8"
		, nvsize: "8", nvtype: "double", ptrsize: "8", quadkind: "2"
		, use64bitall: "define"
		, use64bitint: "define"
		, useithreads: threaded ? "define" : ""
		, uselongdouble: ""
		, usemultiplicity: threaded ? "define" : ""
		, useperlio: "define"
		, usequadmath: "", uvsize: "8"
	};
};

const packageMetadata = (pkg, sourceIdentity) => {
	const component = pkg.module !== "LeanBridge::Runtime", version = pkg.version;
	const dependency = component ? { "LeanBridge::Runtime": `== ${pkg.runtimeVersion}` } : {};
	return {
		"meta-spec": { version: 2, url: "https://metacpan.org/pod/CPAN::Meta::Spec" }
		, name: pkg.distribution, version, abstract: "Generated native Lean bindings"
		, author: [component ? "Author not declared" : "Lean Bridge contributors"]
		, license: [component ? "unknown" : "mit"]
		, ...cpanPackageMetadata(component ? compiledPackageMetadata(sourceIdentity) : {})
		, dynamic_config: true
		, release_status: version.includes("_") ? "testing" : "stable"
		, generated_by: "lean-bridge cpan-package-v1"
		, prereqs: {
			configure: { requires: {
				"ExtUtils::MakeMaker": "6.64", "ExtUtils::CBuilder": "0"
				, "ExtUtils::ParseXS": "0"
				, "JSON::PP": "0"
				, "Digest::SHA": "0", ...dependency
			} }
			, runtime: { requires: { perl: "5.036", "Math::BigInt": "0", "JSON::PP": "0", "Digest::SHA": "0", ...dependency } }
			, test: { requires: { "Test::More": "0" } }
		}
		, provides: { [pkg.module]: { file: `lib/${pkg.module.replaceAll("::", "/")}.pm`, version } }
		, ...component ? {} : { resources: { repository: { type: "git", url: "https://github.com/seanmorris/lean-bridge.git" } } }
		, no_index: { directory: ["inc", "prebuilt", "notices", "t"], file: ["LeanBridgeBuild.pm"], package: ["LeanBridge::Runtime::Platform"] }
	};
};

const assertSources = async (mode, item, readSource) => {
	keys(item.input, ["metadata", "sourceIdentity", "component"]);
	const { metadata, sourceIdentity: identity } = item.input;
	assert.equal(metadata.producer.invocationIdentitySha256, identity.request.metadata.invocationIdentitySha256);
	const baseline = await callbackCompilerInputAtBaseline(item.input, readSource);
	assert.equal(hash(baseline.metadata), pins[mode].metadata); assert.equal(hash(baseline.sourceIdentity), pins[mode].identity);
	assert.deepEqual(item.input.component, { id: "owned-aggregates@1.0.0", name: "owned-aggregates", version: "1.0.0" });
	assert.equal(identity.leanVersion, "4.32.2");
	assert.equal(identity.leanCommit, "f3b06c705e6c85f5314019d5d3baab0fec5b580c");
	assert.equal(identity.leanCompilerSha256, "e8baaa71855a616dc351028f3ad2200051b0671f423a1696a100e809302d5550");
	assert.equal(identity.extractorSha256, sha256(beforeFinRefinementSource("src/analyze/NativeExports.lean", await readSource("src/analyze/NativeExports.lean"), identity.extractorSha256)));
	const configuration = mode === "ordinary" ? await ownedDotnetCallbackResultCombinedConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { cpan: { module: "LeanBridge::OwnedProbe", version: "0.010" } };
	assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(identity.exportConfigurationSha256, hash(configuration));
	const lean = (await readSource("tests/fixtures/onboarding/owned-aggregates/Owned.lean")).toString() + ownedDotnetCallbackResultCombinedSource;
	assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, "Owned");
	assert.deepEqual(identity.modules[0].source, { path: "Owned.lean", bytes: Buffer.byteLength(lean), sha256: sha256(lean) });
	assert.equal(Boolean(identity.reviewedBindingIr), mode === "reviewed");
	if(mode === "reviewed")
	{
		const ir = ownedDotnetCallbackResultCombinedReviewedIr();
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(ir));
		assert.equal(identity.reviewedBindingIr.sourceSha256, hash(ir));
	}
	const model = createCompiledNativeModel(item.input, { ownedGraphs: true
		, ownedHostCallbacks: true, ownedCallbackResultAnchors: true
		, ownedInputTransfers: true
		, ownedAnchoredResults: true
		, ownedReceiverExports: true });
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.exports.length, 30); assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const [key, count] of [["receiverExports", 5], ["resultAnchors", 1], ["inputTransfers", 2]])
		assert.equal(model.ownedGraph[key].exports.length, count);
	await assertOwnedPerlCallbackPackageArtifacts(item, model, readSource);
	return model;
};

/**
 * Reconstruct CPAN payload contracts from an independently checked native model.
 *
 * @param item - Native input, component receipt and both CPAN manifests.
 * @param model - Independently reconstructed model, including target configuration.
 * @param readSource - Current source or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackPackageArtifacts = async (item, model, readSource = readFile) => {
	const { metadata, sourceIdentity: identity } = item.input;
	assert.deepEqual(identity, model.sourceIdentity);
	const { manifest, runtimeManifest: runtime, componentReceipt: component } = item;
	const glibcMinimumVersion = manifest.glibcMinimumVersion;
	assert.match(glibcMinimumVersion, supportedGlibcFloor);
	assert.equal(runtime.glibcMinimumVersion, glibcMinimumVersion);
	const manifestKeys = [
		"backend", "distribution", "ecosystem", "files", "glibcMinimumVersion"
		, "include"
		, "module"
		, "nativeRuntimeIdentity"
		, "prebuilt"
		, "runtimeIdentity"
		, "runtimeVersion"
		, "schemaVersion", "version", "xs"];
	keys(manifest, [...manifestKeys, "ownedValues"]);
	keys(runtime, [...manifestKeys, "runtimePackageIdentity", "runtimePacking"]);
	keys(component, [
		"adaptersSha256"
		, "allocationGuardSha256"
		, "bindingIrSha256"
		, "callbackResultAnchors"
		, ...model.ownedGraph.hostCallbacks ? ["callbackSourceSha256"] : []
		, "compiler"
		, "exports"
		, "headerSha256"
		, "initializer"
		, ...model.ownedGraph.inputTransfers ? ["inputTransfers"] : []
		, "library"
		, "metadataSha256"
		, "modelSha256"
		, "nativeLibrary"
		, "profile"
		, ...model.ownedGraph.receiverExports ? ["receiverExports"] : []
		, ...model.ownedGraph.resultAnchors ? ["resultAnchors"] : []
		, "runtimeIdentity", "schemaVersion", "sourceIdentity"]);
	keys(component.nativeLibrary, ["bytes", "sha256"]);
	assert.ok(Number.isSafeInteger(component.nativeLibrary.bytes) && component.nativeLibrary.bytes > 0);
	digest(component.nativeLibrary.sha256); digest(component.runtimeIdentity);
	assert.equal(typeof component.compiler, "string"); assert.ok(component.compiler.length > 0);
	assert.match(component.library, /^libcomponent_[a-f0-9]{20}\.so$/u);
	const native = generateCompiledNativeLeanAdapters(model);
	assert.equal(component.schemaVersion, 7); assert.equal(component.profile, "native-library-v1");
	assert.deepEqual(component.sourceIdentity, identity);
	assert.equal(component.modelSha256, hash(model)); assert.equal(component.metadataSha256, hash(metadata));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	if(model.ownedGraph.hostCallbacks) assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	assert.equal(component.allocationGuardSha256, sha256(nativeAllocationGuardHeader));
	assert.equal(component.initializer, `initialize_${native.module}`);
	assert.deepEqual(component.exports, model.exports.map(value => ({ declaration: value.name, symbol: value.symbol })));
	for(const name of ["callbackResultAnchors", "resultAnchors", "inputTransfers", "receiverExports"])
		assert.deepEqual(component[name], model.ownedGraph[name]);
	assert.equal(manifest.module, "LeanBridge::OwnedProbe"); assert.equal(manifest.version, "0.010");
	assert.equal(runtime.module, "LeanBridge::Runtime"); assert.equal(manifest.runtimeVersion, runtime.version);
	assert.equal(manifest.runtimeIdentity, runtime.runtimeIdentity);
	assert.equal(manifest.nativeRuntimeIdentity, component.runtimeIdentity);
	assert.equal(runtime.nativeRuntimeIdentity, component.runtimeIdentity);
	const nativePath = "lib/LeanBridge/OwnedProbe/native/";
	assert.equal(manifest.files[nativePath + component.library], component.nativeLibrary.sha256);
	const generated = generateOwnedPerlPackage({ model, metadata
		, receipt: { ...component, runtimeIdentity: manifest.runtimeIdentity }
		, moduleName: manifest.module
		, gmpSha256: manifest.files[nativePath + "libgmp-lean-bridge.so.10"] });
	assert.deepEqual(manifest.ownedValues, generated.owned); assert.equal(generated.owned.schemaVersion, 5);
	for(const [path, source] of Object.entries(generated.files))
	{
		const expected = path.endsWith(".pm") ? source.replace("our $VERSION = '0.001';", `our $VERSION = '${manifest.version}';`)
			.replace("use LeanBridge::Runtime;", `use LeanBridge::Runtime;\ndie "Incompatible shared Lean runtime package version\\n" unless $LeanBridge::Runtime::VERSION eq '${manifest.runtimeVersion}';`) : source;
		assert.equal(manifest.files[path], sha256(expected), path);
	}
	for(const [path, source] of Object.entries({ "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "native-component.json": canonicalJson(component)
		, "component.h": native.header
		, "generated.lean": native.leanSource
		, ...model.ownedGraph.hostCallbacks ? { "callbacks.c": native.callbackSource } : {}
		, "allocation-guard.h": nativeAllocationGuardHeader
		, "LeanBridgeBuild.pm": renderOwnedPerlCallbackBuild((await readSource("src/backends/perl/Build.pm")).toString()
			, (await readSource("src/backends/perl/BuildCallbackResults.pm")).toString(), { moduleName: manifest.module, model }) }))
		assert.equal(manifest.files[path], sha256(source), path);
	for(const [path, source] of Object.entries({ "Runtime.xs": await readSource("src/backends/perl/Runtime.xs")
		, "LeanBridgeBuild.pm": await readSource("src/backends/perl/Build.pm")
		, "lib/LeanBridge/Runtime.pm": (await readSource("src/backends/perl/Runtime.pm")).toString().replace("our $VERSION = '0.001';", `our $VERSION = '${runtime.version}';`)
		, "lib/LeanBridge/Runtime/Platform.pm": await readSource("src/backends/perl/Platform.pm")
		, "lib/LeanBridge/Runtime/OwnedAssets.pm": await readSource("src/backends/perl/OwnedAssets.pm")
		, "lib/LeanBridge/Runtime/include/runtime.h": await readSource("src/backends/perl/runtime.h") }))
		assert.equal(runtime.files[path], sha256(source), path);
	for(const pkg of [runtime, manifest])
	{
		assert.equal(pkg.schemaVersion, 1); assert.equal(pkg.backend, "perl"); assert.equal(pkg.ecosystem, "cpan");
		assert.equal(pkg.distribution, pkg.module.replaceAll("::", "-"));
		digest(pkg.runtimeIdentity); digest(pkg.nativeRuntimeIdentity);
		for(const [path, value] of Object.entries(pkg.files))
		{
			assert.match(path, /^[A-Za-z0-9_.+/-]+$/u);
			assert.ok(!path.startsWith("/") && !path.split("/").some(part => ["", ".", ".."].includes(part)));
			digest(value);
		}
		assert.equal(pkg.glibcMinimumVersion, glibcMinimumVersion);
		const stem = pkg.module.split("::").at(-1);
		const prebuilt = ownedPerlReceiverVariants.map(variant => {
			const abi = abiFor(variant), abiKey = sha256(compact(abi));
			return { abi, abiKey, path: `prebuilt/${abiKey}/${stem}.so` };
		}).sort((left, right) => left.abiKey.localeCompare(right.abiKey));
		assert.deepEqual(pkg.prebuilt, prebuilt);
		const common = ["LeanBridgeBuild.pm", "MANIFEST", "META.json", "Makefile.PL"
			, "inc/LeanBridge/Runtime/Platform.pm"
			, "notices/lean-bundled.txt"
			, "notices/lean.txt"
			, "t/00-load.t"
			, ...prebuilt.flatMap(value => [value.path, value.path.replace(/[^/]+$/u, "receipt.json")])];
		const componentPaths = [
			...Object.keys(generated.files)
			, "allocation-guard.h"
			, "artifacts.json"
			, "binding-ir.json"
			, ...model.ownedGraph.hostCallbacks ? ["callbacks.c"] : []
			, "component.h"
			, "generated.lean"
			, "metadata.json"
			, "model.json"
			, "native-component.json"
			, nativePath + component.library, nativePath + "libgmp-lean-bridge.so.10"
			, "notices/LeanBridge-LICENSE", "notices/source-notices.json"
			, ...[
				"include/gmp.h"
				, "lib/libgmp-lean-bridge.so.10"
				, "share/lean-bridge/gmp.json"
				, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, ...["GMP-COPYING", "GMP-COPYING.LESSERv3", "GMP-COPYINGv2", "GMP-COPYINGv3"].map(name => "share/lean-bridge/licenses/" + name)]
				.map(path => "owned/gmp/" + path)
		];
		const runtimePaths = [
			"LICENSE", "Runtime.xs", "lib/LeanBridge/Runtime.pm"
			, ...[
				"OwnedAssets.pm"
				, "Platform.pm"
				, "binding.json"
				, "runtime.json"
				, "target.json"
				, "include/lean_bridge_native_runtime.h", "include/runtime.h"
				, "native/liblean_bridge_native.so", "native/libleanshared.so"
				, ...["config.h", "lean.h", "lean_gmp.h", "lean_libuv.h", "mimalloc.h", "version.h"].map(name => "include/lean/" + name)]
				.map(path => "lib/LeanBridge/Runtime/" + path)
		];
		assert.deepEqual(Object.keys(pkg.files).sort(), [...new Set([...common, ...pkg === manifest ? componentPaths : runtimePaths])].sort());
		assert.equal(pkg.files["META.json"], hash(packageMetadata(pkg, identity)));
		assert.equal(pkg.files["Makefile.PL"], sha256("use strict;\nuse warnings;\nuse lib '.';\nuse LeanBridgeBuild;\nLeanBridgeBuild::configure();\n"));
		assert.equal(pkg.files["t/00-load.t"], sha256(`use strict;\nuse warnings;\nuse Test::More tests => 1;\nuse_ok('${pkg.module}');\n`));
		assert.equal(pkg.files["inc/LeanBridge/Runtime/Platform.pm"], sha256(await readSource("src/backends/perl/Platform.pm")));
		assert.equal(pkg.files[pkg === manifest ? "notices/LeanBridge-LICENSE" : "LICENSE"], sha256(await readSource("LICENSE")));
		for(const name of ["lean.txt", "lean-bundled.txt"])
			assert.equal(pkg.files["notices/" + name], sha256(await readSource("notices/runtime/" + name)));
		assert.equal(pkg.files.MANIFEST, sha256([...Object.keys(pkg.files), "lean-bridge-package.json"].sort().join("\n") + "\n"));
	}
	assert.equal(manifest.files["notices/source-notices.json"], identity.sourceNoticesSha256);
	assert.equal(manifest.files[nativePath + "libgmp-lean-bridge.so.10"], manifest.files["owned/gmp/lib/libgmp-lean-bridge.so.10"]);
	assert.equal(runtime.xs, "Runtime.xs"); assert.equal(runtime.include, "lib/LeanBridge/Runtime/include");
	assert.equal(manifest.xs, "Component.xs"); assert.equal(manifest.include, ".");
	digest(runtime.runtimePackageIdentity);
	assert.equal(runtime.version, `0.002${BigInt("0x" + runtime.runtimePackageIdentity).toString().padStart(78, "0")}1`);
	assert.equal(runtime.runtimeVersion, runtime.version);
	await assertOwnedPerlCallbackPacking(runtime.runtimePacking, readSource);
	const marker = "__LEAN_BRIDGE_RUNTIME_VERSION__";
	const normalized = { ...runtime.files };
	normalized["lib/LeanBridge/Runtime.pm"] = sha256((await readSource("src/backends/perl/Runtime.pm")).toString().replace("our $VERSION = '0.001';", `our $VERSION = '${marker}';`));
	const metadataBasis = packageMetadata(runtime, identity);
	metadataBasis.version = marker; metadataBasis.provides["LeanBridge::Runtime"].version = marker;
	normalized["META.json"] = hash(metadataBasis);
	const { files, runtimePackageIdentity, ...basis } = runtime;
	assert.equal(runtimePackageIdentity, hash({
		schemaVersion: 1
		, manifest: { ...basis, version: marker, runtimeVersion: marker }
		, files: Object.entries(normalized).map(([path, sha256]) => ({ path, sha256 })).sort((left, right) => left.path.localeCompare(right.path))
	}));
	assert.equal(Object.keys(files).length, Object.keys(normalized).length);
};

/**
 * Check recorded producer packing facts, not the verifier host's tool versions.
 * Whole-artifact callers also bind this object into runtimePackageIdentity.
 *
 * @param packing - Original archive implementation and producer tool identity.
 * @param readSource - Current source or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackPacking = async (packing, readSource = readFile) => {
	keys(packing, ["sourceDateEpoch", "implementationSha256", "nodeVersion"
		, "zlibVersion", "icuVersion", "platform", "architecture"
		, "collationLocale"]);
	assert.equal(packing.sourceDateEpoch, 1);
	assert.equal(packing.implementationSha256, sha256(await readSource("src/release/deterministic-archive.mjs")));
	assert.match(packing.nodeVersion, /^[1-9][0-9]*\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/u);
	assert.match(packing.zlibVersion, /^[1-9][0-9]*\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/u);
	if(packing.icuVersion !== null) assert.match(packing.icuVersion, /^[1-9][0-9]*(?:\.[0-9]+){1,3}$/u);
	assert.equal(packing.platform, "linux"); assert.equal(packing.architecture, "x64");
	assert.equal(typeof packing.collationLocale, "string");
	assert.deepEqual(Intl.getCanonicalLocales(packing.collationLocale), [packing.collationLocale]);
};

const progress = (command, entries) => ({
	mode: "none"
	, events: entries.map(([phase, state, message], index) => ({
		command, current: null, message, phase, schemaVersion: 1
		, sequence: index + 1, state, total: null, type: "progress"
	}))
});
/**
 * Reconstruct a complete successful noninteractive CLI response.
 *
 * @param command - Build or verification command.
 * @param project - Selected project, or null for receipt verification.
 * @param result - Independently reconstructed command result.
 * @param perls - Ordered pinned producer Perl executable paths.
 */
const response = (command, project, result, perls = []) => ({
	cache: { directory: null, policy: command === "build" ? "use" : "off" }
	, command
	, configuration: {
		path: null
		, sources: {
			cacheDirectory: "default", cachePolicy: "default", format: "cli"
			, progress: "default", project: project ? "cli" : "default"
			, targets: project ? "cli" : "default"
		}
	}
	, diagnostics: []
	, exitCode: 0
	, interactive: false
	, mode: "execute"
	, nextActions: []
	, progress: progress(command, [["command", "started", command + " started"]
		, ...command === "build" ? [
			["build", "started", "Building the canonical artifact and package closure"]
			, ["build", "info", "Compiling checked native Lean exports"]
			, ...perls.map(perl => ["build", "info", "Compiling XS for " + perl])
			, ["build", "completed", "Canonical build completed"]
		] : []
		, ["command", "completed", command + " ok"]])
	, project, prompts: [], result, schemaVersion: 2
	, selection: { allTargets: !project, targets: project ? ["cpan"] : [] }
	, status: "ok"
});

// These two entries are generated by the CLI packager, not copied from the
// checkout's README/package.json. Reconstruct their bytes independently; every
// other allowlisted entry below must match the authenticated source reader.
const cliGeneratedFiles = config => ({
	"README.md": `# Lean Bridge

Compile Lean libraries into packages with generated native-language APIs.

## Use the CLI

Run \`lean-bridge --help\` after installation. Copied-value npm authors need Node 22, Git, and Nix or Docker for isolated compilation. Owned-value npm authors use Lean 4.32.2 and the pinned Emscripten 6.0.6 SDK. Other targets use the tools listed in the author guide.

\`lean-bridge analyze --project . --target npm --check\` inspects an ordinary Lake project.

\`lean-bridge build --project . --target npm --output build/component\` compiles its supported exports.

\`lean-bridge verify --receipt /path/to/package-set-receipt.json\` checks a prepared multi-ecosystem archive set. Existing npm receipts remain supported. Signed archives additionally require the trusted policy, policy hash, archive path, signed subject and expected coordinate listed by \`lean-bridge verify --help\`. Verification requires only Node and the supplied files, without a project or build tools.

This candidate is \`${config.name}@${config.version}\`. It does not include the JavaScript-Wasm runtime.

It does not include the owned JavaScript compiler headers. Supply their prepared bundle through LEAN_BRIDGE_JS_INPUTS when building owned npm exports.

It does not include PHP-Wasm compiler inputs. Supply a prepared bundle through LEAN_BRIDGE_PHP_INPUTS to build that target.

## Documentation

- [Author guide](https://seanmorris.github.io/lean-bridge/docs/lean/)
- [Verify a prepared release](https://seanmorris.github.io/lean-bridge/docs/consume/receive-package/)
- [Repository and issue tracker](https://github.com/seanmorris/lean-bridge)

## Release status

This archive is a local release candidate. Creating it does not publish a package or grant production approval. Registry ownership, bootstrap publication, builder distribution, runtime acceptance, and release approval remain separate checks.

## License

Lean Bridge source is distributed under the MIT license in LICENSE. Upstream runtime licenses and attribution are included in notices/runtime/.
`
	, "package.json": JSON.stringify({
		name: config.name, version: config.version, description: config.description
		, license: "MIT", type: "module"
		, bin: { "lean-bridge": "scripts/lean-bridge.mjs", "lean-bridge-signing-policy": "scripts/create-publication-signer-policy.mjs" }
		, engines: { node: ">=22" }
		, repository: { type: "git", url: "git+https://github.com/seanmorris/lean-bridge.git" }
		, homepage: "https://seanmorris.github.io/lean-bridge/"
		, bugs: { url: "https://github.com/seanmorris/lean-bridge/issues" }
		, files: [...config.files, "README.md", "cli-package-inventory.json"].sort()
		, publishConfig: { access: "public", tag: "next", registry: "https://registry.npmjs.org/" }
	}, null, 2) + "\n"
});

/**
 * Check the CLI inventory and both independently rebuilt package identities.
 *
 * @param item - Original package observations.
 * @param model - Independently reconstructed native model.
 * @param readSource - Current or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackPackageIdentity = async (item, model, readSource = readFile) => {
	keys(item.cli, [
		"schemaVersion", "kind", "package", "sourceDateEpoch", "runtimeIncluded"
		, "phpWasmInputsIncluded"
		, "javascriptWasmInputsIncluded"
		, "productionApproved"
		, "files"
		, "archive", "inventorySha256", "externalRegistryWrites"]);
	const config = await selectCliPackageConfig(item.cli, readSource);
	assert.equal(item.cli.schemaVersion, 1); assert.equal(item.cli.kind, "lean-bridge-cli-package");
	assert.deepEqual(item.cli.package, { name: config.name, version: config.version });
	assert.equal(item.cli.sourceDateEpoch, config.sourceDateEpoch);
	for(const key of ["runtimeIncluded", "phpWasmInputsIncluded", "javascriptWasmInputsIncluded", "productionApproved"])
		assert.equal(item.cli[key], false);
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
	assert.equal(inventorySha256, hash(inventory)); assert.equal(externalRegistryWrites, false);
	keys(archive, ["bytes", "sha256", "path"]);
	assert.ok(Number.isSafeInteger(archive.bytes) && archive.bytes > 0); digest(archive.sha256);
	assert.equal(archive.path, `${config.name}-${config.version}.tgz`);
	assert.deepEqual(item.cli.files.map(file => file.path).sort(), [...config.files, "README.md", "package.json"].sort());
	assert.deepEqual(item.cliInstallation, { filesVerified: config.files.length + 2, offline: true, sourceRemoved: true });
	const generated = cliGeneratedFiles(config);
	assert.ok(!config.files.some(path => Object.hasOwn(generated, path)), "generated CLI entries must not alias copied sources");
	for(const file of item.cli.files)
	{
		keys(file, ["path", "bytes", "sha256", "mode"]); digest(file.sha256);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		assert.equal(file.mode, ["scripts/lean-bridge.mjs", "scripts/create-publication-signer-policy.mjs"].includes(file.path) ? 0o755 : 0o644);
		const source = Object.hasOwn(generated, file.path) ? generated[file.path]
			: beforeFinRefinementSource(file.path, await readSource(file.path), file.sha256);
		assert.equal(file.sha256, sha256(source), file.path); assert.equal(file.bytes, Buffer.byteLength(source), file.path);
	}
	validatePackageSetReceipt(item.packageSetReceipt);
	assert.deepEqual(item.independentPackageSetReceipt, item.packageSetReceipt);
	const { manifest, runtimeManifest: runtime, componentReceipt: component } = item;
	assert.equal(item.packageSetReceipt.packages.length, 2);
	assert.deepEqual(item.packageSetReceipt, {
		schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: model.component
		, source: { treeSha256: model.sourceIdentity.sourceTreeSha256 }
		, profiles: [{ id: "native-library-v1", bindingIrSha256: model.bindingIrSha256, runtimeIdentity: component.runtimeIdentity }]
		, packages: [manifest, runtime].map((pkg, index) => ({
			artifacts: item.packageSetReceipt.packages[index].artifacts
			, ecosystem: "cpan", name: pkg.distribution, profile: "native-library-v1"
			, requires: index ? [] : [{ ecosystem: "cpan", name: runtime.distribution, version: runtime.version }]
			, role: index ? "runtime" : "component"
			, runtimeDelivery: index ? "provided" : "dependency"
			, runtimeIdentity: component.runtimeIdentity
			, target: "cpan"
			, version: pkg.version
		}))
	});
	for(const [index, pkg] of [manifest, runtime].entries())
	{
		const artifacts = item.packageSetReceipt.packages[index].artifacts;
		assert.equal(artifacts.length, 1); keys(artifacts[0], ["bytes", "path", "sha256"]);
		assert.equal(artifacts[0].path, `archives/${pkg.distribution}-${pkg.version}.tar.gz`);
		assert.ok(Number.isSafeInteger(artifacts[0].bytes) && artifacts[0].bytes > 0); digest(artifacts[0].sha256);
	}
	const artifacts = roles.map(role => item.packageSetReceipt.packages.find(pkg => pkg.role === role).artifacts[0]);
	const packages = artifacts.map(artifact => ({
		schemaVersion: 1, backend: "perl", ecosystem: "cpan"
		, runtimeIdentity: manifest.runtimeIdentity, compilerAccess: false
		, abiVariants: manifest.prebuilt.map(value => value.abiKey)
		, archive: basename(artifact.path)
		, sha256: artifact.sha256 }));
	assert.deepEqual(item.reassembly, roles.map((role, index) => ({
		role, receipt: packages[index]
		, original: { bytes: artifacts[index].bytes, sha256: artifacts[index].sha256 }
		, repeated: { bytes: artifacts[index].bytes, sha256: artifacts[index].sha256 } })));
	assert.deepEqual(item.independentArchives, packages.map((pkg, index) => ({ archive: pkg.archive
		, original: { bytes: artifacts[index].bytes, sha256: pkg.sha256 }
		, repeated: { bytes: artifacts[index].bytes, sha256: pkg.sha256 } })));
	return packages;
};

const assertProducer = async (item, model, readSource) => {
	const packages = await assertOwnedPerlCallbackPackageIdentity(item, model, readSource);
	const { manifest, runtimeManifest: runtime, componentReceipt: component } = item;
	const { glibcMinimumVersion } = manifest;
	assert.equal(item.cliBuilds.length, 2); assert.equal(item.cliExecutions.length, 2);
	const root = item.cliExecutions[0].cwd;
	assert.ok(isAbsolute(root) && !root.split("/").includes(".."));
	const node = item.cliExecutions[0].command;
	assert.ok(isAbsolute(node) && ["node", "nodejs"].includes(basename(node)) && !node.includes("\0")
		&& !node.split("/").some(part => part === "." || part === ".."), "recorded absolute Node executable");
	const perls = item.observations.filter(value => value.mode === "prebuilt-only").map(value => value.perl);
	assert.deepEqual(perls.map(ownedPerlReceiverVariant), ownedPerlReceiverVariants);
	for(const [index, output] of ["producer", "independent"].entries())
	{
		const result = {
			backend: "perl"
			, bindingIrSha256: model.bindingIrSha256
			, component: model.component
			, configurationSha256: model.sourceIdentity.exportConfigurationSha256
			, ecosystem: "cpan"
			, glibcMinimumVersion
			, nativeRuntimeIdentity: component.runtimeIdentity
			, output: join(root, output)
			, packages
			, profile: "native-library-v1"
			, project: join(root, "source")
			, runtimeIdentity: manifest.runtimeIdentity
			, ...item.mode === "reviewed" ? { reviewedBindingIrSha256: model.sourceIdentity.reviewedBindingIr.semanticSha256 } : {}
			, schemaVersion: 1, targets: ["cpan"] };
		const expected = response("build", join(root, "source"), result, perls);
		assert.deepEqual(item.cliBuilds[index], expected);
		assert.deepEqual(item.cliExecutions[index], {
			command: node, cwd: root, code: 0, stderr: ""
			, args: [
				join(root, "author/node_modules/.bin/lean-bridge")
				, "build"
				, "--project"
				, join(root, "source")
				, "--target", "cpan", "--output", join(root, output), "--json"]
			, response: expected, stdout: canonicalJson(expected) });
	}
	const verified = response("verify", null, {
		archives: 2, authenticated: false, component: model.component.id
		, packages: [manifest, runtime].map(pkg => ({ ecosystem: "cpan", target: "cpan", name: pkg.distribution, version: pkg.version }))
		, profiles: ["native-library-v1"]
		, receiptSha256: hash(item.packageSetReceipt)
		, verificationType: "local-package-set"
		, verified: true });
	assert.deepEqual(item.cliVerification, verified);
	assert.deepEqual(item.cliVerificationExecution, {
		command: node, cwd: root, code: 0, stderr: ""
		, args: [join(root, "author/node_modules/.bin/lean-bridge"), "verify", "--receipt", join(root, "handoff/package-set-receipt.json"), "--json"]
		, stdout: canonicalJson(verified) });
	assert.ok(isAbsolute(item.savedHandoff));
	assert.match(basename(item.savedHandoff), new RegExp(`^${item.mode}-combined-package-handoff-[A-Za-z0-9]+$`, "u"));
	return { root, packages };
};

const cleanCommand = (item, command, args, cwd) => {
	keys(item, ["command", "args", "cwd", "code", "stdout", "stderr"]);
	assert.equal(item.command, command); assert.deepEqual(item.args, args); assert.equal(item.cwd, cwd);
	assert.equal(item.code, 0); assert.equal(item.stderr, ""); assert.equal(typeof item.stdout, "string");
	assert.doesNotMatch(item.stdout, /segmentation fault|core dumped|double free|unreleased (?:native|Perl) ownership/iu);
};

/**
 * Check generated-XS compiler commands and reconstruct their raw output.
 *
 * @param receipt - Original installed build receipt.
 * @param manifest - Independently checked package manifest.
 * @param configure - Raw Makefile.PL execution.
 * @param packageRoot - Recorded extraction directory.
 * @param consumerRoot - Recorded consumer directory.
 * @param variant - Pinned Perl ABI variant.
 * @param abi - Independently reconstructed ABI fingerprint.
 */
const assertCompileReceipt = (receipt, manifest, configure, packageRoot, consumerRoot, variant, abi) => {
	keys(receipt, [
		"schemaVersion"
		, "operation"
		, "abi"
		, "sourceSha256"
		, "compiler"
		, "compilerFlags"
		, "extraCompilerFlags"
		, "linker"
		, "linkerFlags"
		, "commands"
		, "generatedCSha256"
		, "runtimeIdentity"
		, "outputSha256"]);
	assert.equal(receipt.sourceSha256, manifest.files[manifest.xs]);
	assert.equal(receipt.runtimeIdentity, manifest.runtimeIdentity); digest(receipt.generatedCSha256);
	digest(receipt.outputSha256);
	assert.match(receipt.compiler, /^(?:cc|gcc|clang)$/u); assert.match(receipt.linker, /^(?:cc|gcc|clang)$/u);
	const compilerFlags = receipt.compilerFlags.split(" "), linkerFlags = receipt.linkerFlags.split(" ");
	for(const flag of [...compilerFlags, ...linkerFlags]) assert.match(flag, /^[-A-Za-z0-9_=/.,+]+$/u);
	assert.ok(compilerFlags.includes("-D_FILE_OFFSET_BITS=64")); assert.ok(linkerFlags.includes("-shared"));
	const component = manifest.module !== "LeanBridge::Runtime", stem = manifest.module.split("::").at(-1);
	const core = "\\${PERL_CORE}", runtime = "\\${LEAN_BRIDGE_RUNTIME}", distribution = "\\${DISTRIBUTION}";
	const includes = ["-I.", "-I" + manifest.include
		, ...component ? ["-I" + runtime + "/include", "-Iowned/include", "-Iowned/internal", "-Iowned/gmp/include"] : []
		, "-I" + core];
	const extra = ["-O2", "-g0", "-fvisibility=default"
		, ...component ? ["-ffile-prefix-map=" + distribution + "=/lean-bridge/distribution"
			, "-ffile-prefix-map=" + core + "=/perl/core"
			, "-ffile-prefix-map=" + runtime + "=/lean-bridge/runtime"] : []];
	assert.equal(receipt.extraCompilerFlags, extra.join(" "));
	const commands = [
		["/usr/bin/cc", ...includes, "-fPIC", ...extra, "-c", ...compilerFlags, "-O2", "-g0", "-o", `_xs-build/${stem}.o`, `_xs-build/${stem}.c`]
		, [
			"/usr/bin/cc"
			, ...linkerFlags
			, "-o"
			, `_xs-build/${stem}.so`
			, `_xs-build/${stem}.o`
			, "-Wl,--build-id=none"
			, ...component ? [
				"-L"
				, "lib/LeanBridge/OwnedProbe/native"
				, "-L"
				, runtime + "/native"
				, "-Wl,--no-as-needed"
				, "-l:" + manifest.ownedValues.gmpLibrary
				, "-l:" + manifest.ownedValues.componentLibrary
				, "-llean_bridge_native"
				, "-lleanshared"] : []]
	];
	assert.deepEqual(receipt.commands, commands);
	const corePath = configure.stdout.match(/(?:^| )-I([^ ]+\/CORE)(?: |$)/u)?.[1];
	assert.ok(corePath?.endsWith(`/perl/${variant}/lib/${variant.split("-")[0]}/${abi.archname}/CORE`));
	const quote = value => !variant.startsWith("5.38.") || /^[a-zA-Z0-9,._+@%/-]+$/u.test(value)
		? value : "'" + value.replaceAll("'", "'\\''") + "'";
	const rawCommands = commands.map(command => command.map(argument => quote(argument.replaceAll(core, corePath)
		.replaceAll(runtime, join(consumerRoot, "installed/lib/perl5", abi.archname, "LeanBridge/Runtime"))
		.replaceAll(distribution, packageRoot))).join(" ") + "\n").join("");
	return rawCommands;
};

/**
 * Validate four ABI/two installation-mode matrices after producer removal.
 *
 * @param item - CPAN manifests, component receipt, consumer hash and observations.
 * @param root - Independently established installed-consumer parent directory.
 * @param packages - Runtime then component archive descriptors.
 * @param readSource - Current source or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackInstalled = async (item, root, packages, readSource = readFile) => {
	assertOwnedPerlReceiverMatrix(item.observations, true);
	const source = (await readSource("tests/fixtures/structured-types/owned-perl-callback-results-installed.pl")).toString();
	assert.equal(item.consumerSha256, sha256(source));
	assert.doesNotMatch(source, /\b(?:snapshot|handoffs)\s*\(|::Probe::|_Owned|::_identity\b/u);
	const assetSource = sha256(await readSource("tests/fixtures/structured-types/owned-perl-installed-assets.pl"));
	for(const observation of item.observations)
	{
		keys(observation, ["perl", "mode", "installs", "receipts", "executions", "assets"]);
		const { perl, mode } = observation, variant = ownedPerlReceiverVariant(perl), abi = abiFor(variant);
		const index = ownedPerlReceiverVariants.indexOf(variant), consumerRoot = join(root, `consumer-${index}-${mode}`);
		assert.equal(observation.installs.length, 2); assert.equal(observation.receipts.length, 2);
		for(const [roleIndex, role] of roles.entries())
		{
			const install = observation.installs[roleIndex], pkg = packages[roleIndex];
			keys(install, ["archive", "mode", "commands"]);
			assert.equal(install.archive, pkg.archive); assert.equal(install.mode, mode); assert.equal(install.commands.length, 3);
			const [extract, configure, make] = install.commands;
			const unpack = extract.args[3];
			assert.equal(unpack.slice(0, consumerRoot.length + 15), consumerRoot + "/.cpan-install-");
			assert.match(basename(unpack), /^\.cpan-install-[A-Za-z0-9]+$/u);
			const packageRoot = join(unpack, pkg.archive.slice(0, -7));
			cleanCommand(extract, "tar", ["-xzf", join(consumerRoot, "handoff", pkg.archive), "-C", unpack], consumerRoot);
			assert.equal(extract.stdout, "");
			cleanCommand(configure, perl, ["Makefile.PL", `INSTALL_BASE=${join(consumerRoot, "installed")}`], packageRoot);
			cleanCommand(make, "make", ["test", "install"], packageRoot);
			assert.match(configure.stdout, /Generating a Unix-style Makefile\n/u);
			assert.match(make.stdout, /t\/00-load\.t \.\. ok\nAll tests successful\.\n/u);
			assert.match(make.stdout, /Result: PASS\n/u);
			assert.doesNotMatch(make.stdout, /(?:^|\n)[ \t]*(?:not ok\b|Bail out!|Result: (?:FAIL|NOTESTS)\b|Failed\b|Dubious\b|Test Summary Report\b)/u);
			const recorded = observation.receipts[roleIndex], manifest = role === "runtime" ? item.runtimeManifest : item.manifest;
			keys(recorded, ["role", "receipt", "installed"]); assert.equal(recorded.role, role);
			const { receipt, installed } = recorded;
			assert.deepEqual(receipt.abi, abi); assert.equal(receipt.schemaVersion, 1);
			assert.equal(receipt.operation, mode === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only");
			keys(installed, ["bytes", "sha256"]); digest(installed.sha256);
			assert.ok(Number.isSafeInteger(installed.bytes) && installed.bytes > 0);
			assert.equal(installed.sha256, receipt.outputSha256);
			const selected = manifest.prebuilt.find(value => canonicalJson(value.abi) === canonicalJson(abi));
			assert.ok(selected);
			if(mode === "prebuilt-only")
			{
				keys(receipt, ["schemaVersion", "operation", "abi", "outputSha256"]);
				assert.equal(receipt.outputSha256, manifest.files[selected.path]);
				assert.doesNotMatch(configure.stdout, /_xs-build\//u);
			}
			const compilation = mode === "build-xs"
				? assertCompileReceipt(receipt, manifest, configure, packageRoot, consumerRoot, variant, abi) : "";
			assert.equal(configure.stdout, compilation + "Checking if your kit is complete...\nLooks good\nGenerating a Unix-style Makefile\n"
				+ `Writing Makefile for ${manifest.module}\nWriting MYMETA.yml and MYMETA.json\n`);
		}
		assert.equal(observation.executions.length, 2);
		for(const execution of observation.executions)
		{
			const { observation: actual, ...raw } = execution;
			assert.deepEqual(actual, consumer);
			assert.deepEqual(raw, {
				command: perl, args: ["consumer.pl"], cwd: consumerRoot, code: 0
				, stderr: "", stdout: compact(consumer) + "\n" });
		}
		keys(observation.assets, ["sourceSha256", "observations"]);
		assert.equal(observation.assets.sourceSha256, assetSource);
		const nativeRoot = join(consumerRoot, "relocated/lib/perl5", abi.archname);
		const assetPaths = [join(nativeRoot, "auto/LeanBridge/OwnedProbe/OwnedProbe.so")
			, ...[item.manifest.ownedValues.gmpLibrary, item.manifest.ownedValues.componentLibrary]
				.map(name => join(nativeRoot, "LeanBridge/OwnedProbe/native", name))];
		assert.equal(observation.assets.observations.length, 6);
		for(const [assetIndex, path] of assetPaths.entries()) for(const [modeIndex, assetMode] of ["cold", "warm"].entries())
		{
			const asset = observation.assets.observations[assetIndex * 2 + modeIndex];
			keys(asset, ["asset", "original", "forged", "execution", "observation"]);
			assert.equal(asset.asset, basename(path));
			keys(asset.original, ["bytes", "sha256"]); keys(asset.forged, ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(asset.original.bytes) && asset.original.bytes > 0);
			digest(asset.original.sha256); digest(asset.forged.sha256);
			assert.notEqual(asset.forged.sha256, asset.original.sha256);
			assert.equal(asset.forged.bytes, asset.original.bytes + Buffer.byteLength("\nchanged installed native asset\n"));
			if(assetIndex === 0) assert.deepEqual(asset.original, observation.receipts[1].installed);
			else assert.equal(asset.original.sha256, item.manifest.files["lib/LeanBridge/OwnedProbe/native/" + asset.asset]);
			if(assetIndex === 2) assert.deepEqual(asset.original, item.componentReceipt.nativeLibrary);
			if(modeIndex)
			{
				const cold = observation.assets.observations[assetIndex * 2];
				assert.deepEqual(asset.original, cold.original); assert.deepEqual(asset.forged, cold.forged);
			}
			const expected = { mode: assetMode, checks: 7, brokerIdentities: 0 };
			assert.deepEqual(asset.observation, expected);
			cleanCommand(asset.execution, perl, ["inspect-assets.pl", assetMode, path
				, join(consumerRoot, "changed-native-file"), ...assetPaths], consumerRoot);
			assert.deepEqual(JSON.parse(asset.execution.stdout), expected);
		}
	}
};

/**
 * Require one exact original CPAN-only report, including both independent builds.
 *
 * @param name - Independently selected ordinary/reviewed report basename.
 * @param item - Original producer, archive and installed execution evidence.
 * @param readSource - Current source or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackPackage = async (name, item, readSource = readFile) => {
	assert.ok(ownedPerlCallbackPackageReports.includes(name));
	const mode = name.split("-")[0];
	keys(item, [
		"schemaVersion"
		, "mode"
		, "variant"
		, "cli"
		, "cliInstallation"
		, "cliBuilds"
		, "cliExecutions"
		, "manifest"
		, "runtimeManifest"
		, "componentReceipt"
		, "input"
		, "packageSetReceipt"
		, "independentPackageSetReceipt"
		, "independentArchives"
		, "reassembly"
		, "savedHandoff"
		, "cliVerification"
		, "cliVerificationExecution"
		, "consumerSha256"
		, "observations"
		, "limitations"]);
	assert.equal(item.schemaVersion, 1); assert.equal(item.mode, mode); assert.equal(item.variant, "combined");
	assert.deepEqual(item.limitations, ["no shared cross-language release", "no native adapter owner or allocation counters"]);
	const model = await assertSources(mode, item, readSource);
	const { root, packages } = await assertProducer(item, model, readSource);
	await assertOwnedPerlCallbackInstalled(item, root, packages, readSource);
};

/**
 * Require both complete independently rebuilt CPAN-only producer matrices.
 *
 * @param reports - Original reports keyed by independently selected basenames.
 * @param readSource - Current source or authenticated historical source reader.
 */
export const assertOwnedPerlCallbackPackageMatrix = async (reports, readSource = readFile) => {
	keys(reports, ownedPerlCallbackPackageReports);
	for(const name of ownedPerlCallbackPackageReports) await assertOwnedPerlCallbackPackage(name, reports[name], readSource);
	assert.deepEqual(reports[ownedPerlCallbackPackageReports[0]].cli, reports[ownedPerlCallbackPackageReports[1]].cli);
};

export { abiFor as ownedPerlCallbackPackageAbi
	, response as ownedPerlCallbackCliResponse
	, assertCompileReceipt as assertOwnedPerlCallbackCompileReceipt };
