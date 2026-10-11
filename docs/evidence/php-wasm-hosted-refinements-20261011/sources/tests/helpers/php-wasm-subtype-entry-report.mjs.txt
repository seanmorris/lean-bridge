/**
 * Authenticate separate instrumented PHP-Wasm reports, compiler inputs and installed callers.
 * These observations never stand for entry measurements of unmodified release packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { compilerExportSelection } from "../../src/analyze/export-configuration.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { phpWasmSubtypeReportInput } from "./php-wasm-subtype-report.mjs";
import { subtypeEntryProbeReview, subtypeEntryProbeSelection, subtypeEntryProbeSource } from "./php-wasm-subtype-entry-build.mjs";
import { instrumentSubtypeCEntries, restoreSubtypeCEntries } from "./php-wasm-subtype-entry-c.mjs";
import { parseSubtypeEntryTrace } from "./php-wasm-subtype-entry-trace.mjs";
import { subtypeEntryCall, subtypeEntryCorpusCalls } from "./php-wasm-subtype-entry-cases.mjs";
import { phpWasmExecutionTuples, phpWasmFinConsumer } from "./php-wasm-fin-fixtures.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const closed = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const subset = (files, prefix) => Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));
const runtimeName = "@lean-bridge/php-wasm-copied-runtime";

/** Read independent original inputs and the exact probe driver/parser/call-expectation sources. */
export const phpWasmSubtypeEntryReportInput = async () => {
	const input = await phpWasmSubtypeReportInput();
	const paths = { "driver.mjs": "../fixtures/php-wasm-subtype-entry/driver.mjs"
		, "entry-trace.mjs": "./php-wasm-subtype-entry-trace.mjs"
		, "entry-cases.mjs": "./php-wasm-subtype-entry-cases.mjs" };
	const drivers = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, identity(await readFile(new URL(path, import.meta.url)))])));
	return { ...input, drivers, probe: subtypeEntryProbeSource(input.lean), review: subtypeEntryProbeReview() };
};

/**
 * Validate one original report and both retained build records without consulting deleted author paths.
 *
 * @param report - Complete producer report, including installed transcripts.
 * @param route - Explicit ordinary or independently reviewed route.
 * @param input - Independently authored fixture, expected probe and drivers.
 * @param builds - Two original build records and retained C inputs, loaded by the caller.
 */
export const assertPhpWasmSubtypeEntryReport = (report, route, input, builds) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	closed(report, ["schemaVersion", "scope", "route", "source", "reproducible", "sourceRemovedBeforeInstallation", "receipt", "builds", "phpWasm", "observation"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.scope, "separate-instrumented-probe"); assert.equal(report.route, route);
	assert.equal(report.reproducible, true); assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.deepEqual(report.source, { originalSha256: sha256(input.lean), probeSha256: input.probe.probeSha256 });
	assert.equal(builds.length, 2); assert.equal(report.builds.length, 2);
	const receipt = report.receipt, evidence = report.phpWasm, component = evidence.component, runtime = evidence.runtime;
	validatePackageSetReceipt(receipt);
	assert.deepEqual(receipt.profiles, [{ id: "php-wasm-copied-v1", bindingIrSha256: component.bindingIrSha256, runtimeIdentity: component.runtimeIdentity }]);
	assert.deepEqual(receipt.source, { treeSha256: component.sourceIdentity.sourceTreeSha256 });
	assert.deepEqual(receipt.component, { id: "subtypes@1.0.0", name: "subtypes", version: "1.0.0" });
	assert.deepEqual(receipt.packages.map(item => item.role).sort(), ["api", "component", "runtime"]);
	for(const [index, build] of builds.entries())
	{
		assert.deepEqual(report.builds[index], build.observation);
		assertProbeBuild(build, route, input, receipt, component);
	}
	assert.notEqual(builds[0].observation.compiled[0].originalPath, builds[1].observation.compiled[0].originalPath);
	assert.notEqual(builds[0].observation.compiled[0].probePath, builds[1].observation.compiled[0].probePath);
	for(const flag of phpWasmIsolationFlags) assert.equal(evidence[flag], true, flag);
	assert.equal(component.schemaVersion, 1); assert.equal(component.profile, "php-wasm-copied-v1"); assert.equal(component.pointerBits, 32);
	assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "php-wasm-copied-v1"); assert.equal(runtime.pointerBits, 32);
	assert.deepEqual(runtime.pins, phpWasmCopiedPins); assert.deepEqual(component.compiler, runtime.compiler);
	assert.equal(component.compiler.emsdkCommit, phpWasmCopiedPins.emsdkCommit);
	assert.ok(component.compiler.version.endsWith(` ${phpWasmCopiedPins.emscriptenVersion} (${phpWasmCopiedPins.emscriptenCommit})`));
	assert.equal(component.runtimeIdentity, sha256(canonicalJson(runtime)));
	const set = evidence.packageSet, { settings } = input.fixture, deployed = evidence.deployment;
	assert.equal(set.schemaVersion, 1); assert.equal(set.kind, "lean-bridge-php-wasm-copied-package-set");
	assert.equal(set.profile, "php-wasm-copied-loading-v1");
	assert.deepEqual(set.component, receipt.component); assert.equal(set.runtimeIdentity, component.runtimeIdentity);
	assert.equal(set.componentIdentity, sha256(canonicalJson(component))); digest(set.loaderIdentity);
	assert.deepEqual(set.npmSettings, settings.npm); assert.deepEqual(set.composerSettings, settings.composer);
	assert.equal(set.archives.length, 3);
	for(const pkg of receipt.packages)
	{
		assert.equal(pkg.target, "php-wasm"); assert.equal(pkg.profile, "php-wasm-copied-v1"); assert.equal(pkg.runtimeIdentity, component.runtimeIdentity);
		const expected = pkg.role === "api" ? settings.composer : pkg.role === "component" ? settings.npm : { name: runtimeName, version: `0.0.0-copied1.${set.loaderIdentity}` };
		assert.equal(pkg.name, expected.name); assert.equal(pkg.version, expected.version);
		assert.equal(pkg.ecosystem, pkg.role === "api" ? "composer" : "npm"); assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0], packed = set.archives.find(item => item.role === pkg.role);
		for(const key of ["name", "version", "ecosystem"]) assert.equal(packed[key], pkg[key]);
		for(const key of ["sha256", "bytes"]) assert.equal(packed[key], artifact[key]);
		assert.equal(packed.archive, basename(artifact.path));
		assert.deepEqual(set.files[`archives/${packed.archive}`], { bytes: artifact.bytes, sha256: artifact.sha256 });
		assert.deepEqual(subset(deployed, `${pkg.role === "api" ? "vendor" : "node_modules"}/${pkg.name}/`), subset(set.files, `${packed.directory}/`));
	}
	const componentRoot = `node_modules/${settings.npm.name}/compiled/`, runtimeRoot = `node_modules/${runtimeName}/compiled/`;
	assert.deepEqual(deployed[componentRoot + "php-wasm-component.json"], identity(canonicalJson(component)));
	assert.equal(deployed[componentRoot + "model.json"].sha256, component.modelSha256);
	assert.deepEqual(deployed[runtimeRoot + "runtime.json"], identity(canonicalJson(runtime)));
	const libraries = [componentRoot + component.library, runtimeRoot + runtime.library];
	assert.deepEqual(deployed[libraries[0]], component.wasmLibrary); assert.deepEqual(deployed[libraries[1]], runtime.files[runtime.library]);
	assert.deepEqual(subset(deployed, "node_modules/php-wasm/"), evidence.host.files); assert.equal(evidence.host.version, "0.1.0"); digest(evidence.host.archiveSha256);
	assert.equal(evidence.driverSha256, input.drivers["driver.mjs"].sha256);
	for(const [path, expected] of Object.entries(input.drivers)) assert.deepEqual(deployed[path], expected);
	for(const path of ["node.mjs", "browser.mjs"]) assert.equal(deployed[path].sha256, phpWasmDriverHashes[path]);
	for(const mode of ["weak", "strict"])
	{
		const expected = identity(phpWasmFinConsumer(input.caller, mode));
		assert.deepEqual(deployed[mode + ".php"], expected); assert.equal(evidence.consumerSources[mode], expected.sha256);
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.stringify({ module: input.fixture.namespace
			, operations: { probe: input.fixture.operation }
			, autoload: arrangement === "composer" ? "vendor/autoload.php" : `vendor/${settings.composer.name}/bootstrap.php` }) + "\n";
		assert.deepEqual(deployed[`request-${arrangement}.json`], identity(request)); assert.equal(evidence.requests[arrangement], sha256(request));
	}
	assertInstallLocks(evidence, settings);
	assert.deepEqual(evidence.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	const expected = subtypeEntryCorpusCalls(), control = subtypeEntryCall("unrestricted");
	for(const execution of evidence.executions)
	{
		assert.deepEqual(execution.observation, { checks: 2024, php: "8.4.1", word_bits: 32 });
		assert.deepEqual(execution.phases.map(item => ({ ...item, libraries: [...item.libraries].sort() })), ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage
			, libraries: execution.loading === "startup" || stage === "complete" ? libraries.map(path => basename(path)).sort() : [] })));
		closed(execution.entryProbe, ["scope", "trace", "controlTrace", "calls", "counts"]);
		assert.equal(execution.entryProbe.scope, "separate-instrumented-probe"); assert.equal(execution.entryProbe.calls, 2030);
		assert.deepEqual(execution.entryProbe.counts, { validator: 2029, constructor: 3045, adapter: 1017, source: 1016 });
		assert.ok(isDeepStrictEqual(parseSubtypeEntryTrace(execution.entryProbe.trace, builds[0].observation.selected), expected), "Full public-call entry sequence differs");
		assert.ok(isDeepStrictEqual(parseSubtypeEntryTrace(execution.entryProbe.controlTrace, builds[0].observation.selected), [control]), "Unrefined control entry sequence differs");
		if(execution.realm !== "chromium") continue;
		for(const request of execution.requests) assert.deepEqual({ bytes: request.bytes, sha256: request.sha256 }, deployed[request.path]);
		for(const path of libraries) assert.equal(execution.requests.filter(item => item.sha256 === deployed[path].sha256).length, 1);
		for(const path of ["driver.mjs", "entry-trace.mjs", "entry-cases.mjs", "bundled/consumer.mjs", "node_modules/php-wasm/PhpWeb.mjs", `${execution.mode}.php`])
			assert.ok(execution.requests.some(item => item.path === path), path);
	}
	assert.deepEqual(report.observation, evidence.executions[0].observation);
	return true;
};

/**
 * Bind the recorded compiler inputs and exact markers to the model and installed module.
 *
 * @param build - Original retained observation, model, source probe, commands and C bytes.
 * @param route - Explicit source authority.
 * @param input - Independent fixture and probe contract.
 * @param receipt - Actual handoff receipt.
 * @param component - Installed component manifest.
 */
const assertProbeBuild = (build, route, input, receipt, component) => {
	const { observation: observed, model, sourceProbe, commands, units } = build;
	assert.deepEqual(sourceProbe, input.probe); assert.equal(observed.schemaVersion, 1); assert.equal(observed.scope, "separate-instrumented-probe");
	assert.equal(model.schemaVersion, route === "reviewed" ? 3 : 2); assert.equal(model.pointerBits, 32);
	assert.deepEqual(Object.fromEntries(model.exports.filter(item => item.name !== "Subtypes.unrestricted").map(item => [item.name, item.refinements])), input.fixture.refinements);
	const unrestricted = model.exports.find(item => item.name === "Subtypes.unrestricted");
	assert.ok(unrestricted); assert.equal(unrestricted.refinements, undefined);
	assert.equal(unrestricted.parameters[0].type.name, "nat"); assert.equal(unrestricted.result.name, "nat");
	assert.equal(observed.modelSha256, sha256(canonicalJson(model))); assert.equal(observed.modelSha256, component.modelSha256);
	assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr)); assert.equal(model.bindingIrSha256, component.bindingIrSha256);
	assert.deepEqual(model.sourceIdentity, component.sourceIdentity);
	assert.deepEqual(observed.component, component); assert.deepEqual(observed.library, component.wasmLibrary);
	assert.equal(observed.packageSetSha256, sha256(canonicalJson(receipt)));
	assert.deepEqual(observed.selected, subtypeEntryProbeSelection(model, input.probe.entries));
	const counts = Object.fromEntries(observed.selected.map(item => [item.symbol, 0]));
	assert.equal(units.length, 7); assert.equal(observed.compiled.length, 7); assert.equal(observed.commands.length, 8);
	assert.deepEqual(commands, { commands: observed.commands, compiled: observed.compiled });
	const link = observed.commands.at(-1); assert.deepEqual(link.originalArgs, link.probeArgs); assert.ok(link.probeArgs.includes("-sSIDE_MODULE=2"));
	assert.equal(basename(link.command), "emcc"); assert.ok(link.probeArgs.includes("-sEXPORTED_FUNCTIONS=['_get_module']"));
	assert.equal(new Set(observed.compiled.map(item => item.name)).size, 7);
	assert.equal(new Set(observed.compiled.map(item => item.objectPath)).size, 7);
	for(const [index, item] of observed.compiled.entries())
	{
		const { original, probe } = units[index];
		assert.equal(sha256(original), item.originalSha256); assert.equal(sha256(probe), item.probeSha256);
		assert.equal(restoreSubtypeCEntries(probe, item), original);
		const expected = instrumentSubtypeCEntries(original, observed.selected);
		assert.equal(expected.source, probe); assert.deepEqual(item.insertions, expected.receipt.insertions);
		for(const insertion of item.insertions.filter(value => value.kind !== "preamble")) counts[insertion.symbol]++;
		assert.ok(Number.isSafeInteger(item.object.bytes) && item.object.bytes > 0); digest(item.object.sha256);
		const command = observed.commands[index], args = [...command.originalArgs];
		assert.equal(basename(command.command), "emcc"); assert.equal(args[args.indexOf("-c") + 1], item.originalPath);
		assert.equal(args[args.indexOf("-o") + 1], item.objectPath); assert.ok(link.probeArgs.includes(item.objectPath));
		args[args.indexOf("-c") + 1] = item.probePath;
		args.push("-iquote", dirname(item.originalPath), `-ffile-prefix-map=${dirname(dirname(item.probePath))}=/build/php-wasm-subtype-entry-probe`);
		assert.deepEqual(command.probeArgs, args); assert.doesNotMatch(args.join(" "), /-finstrument-functions/u);
	}
	assert.deepEqual(counts, Object.fromEntries(observed.selected.map(item => [item.symbol, 1]))); assert.deepEqual(observed.definitionCounts, counts);
	const source = component.sourceIdentity, configuration = JSON.parse(source.exportConfigurationSource);
	const selection = route === "reviewed" ? reviewedSourceSelection(source.reviewedBindingIr)
		: compilerExportSelection({ ...input.fixture, exports: [...input.fixture.exports, "Subtypes.unrestricted"] });
	assert.equal(source.exportConfigurationSha256, sha256(source.exportConfigurationSource));
	assert.deepEqual(configuration, { schemaVersion: 1
		, modules: [input.fixture.module]
		, targets: { "php-wasm": input.fixture.settings }
		, ...route === "reviewed" ? {} : { exports: [...input.fixture.exports, "Subtypes.unrestricted"], contracts: input.fixture.contracts, specializations: input.fixture.specializations } });
	if(route === "reviewed") assert.deepEqual(source.reviewedBindingIr, {
		path: "api.binding-ir.json", schemaVersion: 1
		, semanticSha256: hashBindingIr(input.review)
		, source: canonicalJson(input.review)
		, sourceSha256: sha256(canonicalJson(input.review)) });
	else assert.equal(source.reviewedBindingIr, undefined);
	for(const key of ["contracts", "specializations"]) assert.deepEqual(source.request[key], selection[key]);
	assert.deepEqual(source.request.exports, route === "reviewed" ? selection.exports : [...input.fixture.exports, "Subtypes.unrestricted"]);
	assert.deepEqual(source.request.modules, [input.fixture.module]); assert.deepEqual(source.request.exportModules, [input.fixture.module]);
	assert.deepEqual(source.request.arities, []); assert.deepEqual(source.request.resources, []); assert.equal(source.request.profile, "native-library-v1");
	assert.equal(source.leanCommit, phpWasmCopiedPins.leanCommit);
	assert.deepEqual(source.modules.map(item => item.module), [input.fixture.module]); assert.deepEqual(source.modules[0].source, { ...source.modules[0].source, ...identity(input.probe.source) });
};

/**
 * Authenticate offline npm and Composer lock records and the exact relocated manifests.
 *
 * @param evidence - Installed producer observation.
 * @param settings - Independently chosen package coordinates.
 */
const assertInstallLocks = (evidence, settings) => {
	const { npm, composer, deployment } = evidence;
	for(const field of ["nodeSha256", "browserSha256", "driverSha256"]) digest(evidence[field]);
	assert.match(evidence.nodeVersion, /^v\d+\.\d+\.\d+$/u); assert.match(evidence.browserVersion, /^\d+\.\d+\.\d+\.\d+$/u);
	digest(npm.toolSha256); assert.equal(npm.lockSha256, sha256(npm.lockText)); assert.deepEqual(JSON.parse(npm.lockText), npm.lock);
	assert.deepEqual(npm.manifest, { private: true, type: "module"
		, dependencies: { "php-wasm": "file:./feed/host.tgz"
			, [settings.npm.name]: "file:./feed/component.tgz"
			, [runtimeName]: "file:./feed/runtime.tgz" } });
	assert.deepEqual(deployment["package.json"], identity(canonicalJson(npm.manifest))); assert.deepEqual(deployment["package-lock.json"], identity(npm.lockText));
	assert.deepEqual(npm.lock.packages[""].dependencies, npm.manifest.dependencies);
	closed(npm.lock.packages, ["", "node_modules/php-wasm", `node_modules/${settings.npm.name}`, `node_modules/${runtimeName}`]);
	for(const pkg of evidence.packageSet.archives.filter(item => item.ecosystem === "npm")) assert.equal(npm.lock.packages[`node_modules/${pkg.name}`].version, pkg.version);
	assert.equal(npm.lock.packages["node_modules/php-wasm"].version, "0.1.0");
	for(const field of ["hostSha256", "composerSha256", "probeSha256"]) digest(composer[field]);
	for(const [field, file] of [["lock", "composer.lock"], ["installed", "vendor/composer/installed.json"]])
	{
		assert.equal(composer[`${field}Sha256`], sha256(composer[`${field}Text`]));
		assert.deepEqual(JSON.parse(composer[`${field}Text`]), composer[field]); assert.deepEqual(deployment[file], identity(composer[`${field}Text`]));
	}
	assert.equal(composer.manifestSha256, sha256(canonicalJson(composer.manifest))); assert.deepEqual(deployment["composer.json"], identity(canonicalJson(composer.manifest)));
	assert.deepEqual(composer.manifest.require, { [settings.composer.name]: settings.composer.version });
	assert.deepEqual(composer.manifest.config, { "allow-plugins": false, platform: { php: "8.4.1" } }); assert.deepEqual(composer.manifest.repositories[0], { "packagist.org": false });
	for(const packages of [composer.lock.packages, composer.installed.packages])
	{
		assert.deepEqual(packages.map(pkg => pkg.name).sort(), ["brick/math", settings.composer.name].sort());
		assert.equal(packages.find(pkg => pkg.name === settings.composer.name).version, settings.composer.version);
	}
};

/**
 * Load retained inputs using fixed relative paths, never producer-supplied absolute paths.
 *
 * @param root - Ordinary or reviewed report directory with build-0 and build-1 records.
 */
export const readPhpWasmSubtypeEntryBuilds = async root => Promise.all([0, 1].map(async index => {
	const path = join(root, `build-${index}`), json = async name => JSON.parse(await readFile(join(path, name + ".json"), "utf8"));
	const observation = await json("observation");
	const units = await Promise.all(observation.compiled.map(async item => {
		assert.equal(basename(item.name), item.name); assert.match(item.name, /^[1-7]-[A-Za-z0-9_.]+\.c$/u);
		return { original: await readFile(join(path, "c-inputs", item.name), "utf8"), probe: await readFile(join(path, "c-probes", item.name), "utf8") };
	}));
	return { observation, units, model: await json("model"), sourceProbe: await json("source-probe"), commands: await json("commands") };
}));
