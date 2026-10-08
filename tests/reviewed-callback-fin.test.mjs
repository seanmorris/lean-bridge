/**
 * Independently reviewed callback bounds: compiler-identical identities, no bounds in the
 * selection, exact fresh-Lean reconciliation, and target capabilities kept outside the review.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { callbackSemanticSignature } from "../src/analyze/callback-signature.mjs";
import { readReviewedSource, reviewedContractDifference, reviewedSourceSelection, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { reviewedCallbackFinExports, reviewedCallbackFinReview } from "./helpers/reviewed-callback-fin-fixture.mjs";
import { reviewedCallbackMockPackage, reviewedCallbackNodeConsumer, reviewedCallbackNodeExpected, reviewedCallbackTypescript } from "./helpers/reviewed-callback-fin-consumer.mjs";
import "./helpers/reviewed-callback-harness-source-history-tests.mjs";

const key = "lean-lang.org/refinements", nominalKey = "lean-lang.org/nominal-refinements";
const reviewInput = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
const declaration = (ir, name) => ir.declarations.find(item => item.id === `lean:ReviewedCallbacks.${name}`);
// The callback a declaration leases as its result, or borrows as its first parameter.
const callbackOf = (ir, name) => {
	const item = declaration(ir, name), site = item.result.type.kind === "named" && item.result.type.id.startsWith("bridge:") ? item.result : item.parameters[0];
	return ir.types.find(type => type.id === site.type.id);
};
// Restate a callback's identity from its current callable and bounds, everywhere it is named.
const rehash = (ir, definition) => {
	const previous = definition.id, refinements = definition.source.extensions[key];
	definition.name = `Callback${sha256(canonicalJson({ ...callbackSemanticSignature(definition.callable), ...refinements ? { refinements } : {} })).slice(0, 20)}`;
	definition.id = `bridge:${definition.name}`;
	definition.source.declaration = definition.name;
	const visit = value => {
		if(!value || typeof value !== "object") return;
		if(value.kind === "named" && value.id === previous) value.id = definition.id;
		Object.values(value).forEach(visit);
	};
	visit(ir.declarations);
};
const unsupported = path => error => {
	assert.equal(error.code, "reviewed-ir-build-unsupported");
	assert.ok(error.details.path.startsWith(path), error.details.path);
	return true;
};

test("independent reviews admit callback bounds in every safe direction without putting them into the selection", () => {
	for(const [hostReply, bounded] of [[false, ["counter", "digits", "scaler", "visit"]], [true, ["counter", "digits", "scaler", "three", "visit"]]])
	{
		const ir = reviewedCallbackFinReview({ hostReply });
		validateReviewedSource(reviewInput(ir));
		const selection = reviewedSourceSelection(reviewInput(ir));
		assert.deepEqual(Object.keys(selection).sort(), ["arities", "exports"]);
		assert.ok(!canonicalJson(selection).includes("fin"));
		const names = ir.declarations.map(item => item.name).filter(name => Object.hasOwn(callbackOf(ir, name).source.extensions, key)).sort();
		assert.deepEqual(names, bounded);
	}
	// Unrefined callbacks, including those over the nominal Tile in both directions, keep the original signature bytes.
	const ir = reviewedCallbackFinReview();
	for(const name of ["apply", "tiles", "tileMaker"])
	{
		const definition = callbackOf(ir, name);
		assert.deepEqual(definition.source.extensions, {});
		assert.equal(definition.name, `Callback${sha256(canonicalJson(callbackSemanticSignature(definition.callable))).slice(0, 20)}`, name);
	}
	assert.deepEqual(ir.types.find(type => type.id === "lean:ReviewedCallbacks.Tile").source.extensions[nominalKey], { kind: "record", fields: [{ kind: "fin", bound: "5" }, null] });
});

test("forged identities, Subtype, empty or misshapen trees and misplaced bounds are refused before compilation", () => {
	const cases = [
		["bounds hashed out of the identity", ir => { const definition = callbackOf(ir, "digits"); const refinements = definition.source.extensions[key]; delete definition.source.extensions[key]; rehash(ir, definition); definition.source.extensions[key] = refinements; }, () => "bridge:"]
		, ["an identity hashed with dropped bounds", ir => { delete callbackOf(ir, "digits").source.extensions[key]; }, () => "bridge:"]
		, ["a Subtype inside a callback", ir => { const definition = callbackOf(ir, "scaler"); definition.source.extensions[key] = { parameters: [{ kind: "subtype", constructor: "ReviewedCallbacks.checked" }], result: null }; rehash(ir, definition); }, () => "bridge:"]
		, ["an all-null tree", ir => { const definition = callbackOf(ir, "scaler"); definition.source.extensions[key] = { parameters: [null], result: null }; rehash(ir, definition); }, () => "bridge:"]
		, ["a tree of the wrong length", ir => { const definition = callbackOf(ir, "scaler"); definition.source.extensions[key] = { parameters: [{ kind: "fin", bound: "10" }, null], result: null }; rehash(ir, definition); }, () => "bridge:"]
		, ["a tree that does not match its transport", ir => { const definition = callbackOf(ir, "digits"); definition.source.extensions[key] = { parameters: [{ kind: "fin", bound: "3" }], result: null }; rehash(ir, definition); }, () => "bridge:"]
		, ["an unknown callback extension", ir => { const definition = callbackOf(ir, "apply"); definition.source.extensions["lean-lang.org/other"] = {}; }, () => "bridge:"]
		, ["callback bounds on a record", ir => { ir.types.find(type => type.id === "lean:ReviewedCallbacks.Tile").source.extensions[key] = { parameters: [], result: null }; }, () => "lean:ReviewedCallbacks.Tile"]];
	for(const [label, change, path] of cases)
	{
		const ir = reviewedCallbackFinReview();
		change(ir);
		assert.throws(() => validateReviewedSource(reviewInput(ir)), unsupported(path()), label);
	}
});

test("the npm consumer reports its pinned counts on a faithful model and fails on a weaker package", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-callback-consumer-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const run = async (name, hostReply, faults) => {
		const root = join(directory, name);
		for(const [path, contents] of Object.entries({ ...reviewedCallbackMockPackage(faults), "index.mjs": reviewedCallbackNodeConsumer(hostReply) })) await saveLakeFile(root, path, contents);
		return processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: root, timeoutMs: 60_000 });
	};
	for(const [name, hostReply] of [["r1", false], ["r2", true]])
		assert.deepEqual(JSON.parse((await run(name, hostReply, {})).stdout.trim()), reviewedCallbackNodeExpected[name]);
	const faults = [
		["an accepted bound", { acceptBound: true }, "accepted: scaler"]
		, ["a raw rejection at the public layer", { rawLayer: true }, "wrong rejection: raw scaler"]
		, ["a disposed closure that keeps running", { keepAlive: true }, "accepted: disposed closure"]];
	for(const [label, fault, reason] of faults)
		await assert.rejects(() => run(label.replaceAll(" ", "-"), false, fault), error => JSON.stringify(error.details ?? error.message).includes(reason), label);
});

const lean = process.env.LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_LEAN_TEST === "1";
const engineRoot = process.cwd();
const fixture = "tests/fixtures/onboarding/reviewed-callback-fin";
const project = async (t, review) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-callback-fin-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp(fixture, root, { recursive: true });
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["ReviewedCallbacks"] }));
	await saveLakeFile(root, "api.binding-ir.json", canonicalJson(review));
	return { directory, root };
};
// Elaborate the captured project with its review, exactly as compiler analysis and builds do.
const inspect = async root => {
	const intent = await prepareLakeEntryIntent({ projectRoot: root });
	const leanPrefix = (await processBuildRunner.capture({ command: join(engineRoot, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: engineRoot })).stdout.trim();
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(module => module.module), leanPrefix });
	try
	{
		const inventory = await inspectLeanProject(root);
		const reviewedBindingIr = await readReviewedSource(root, inventory) ?? undefined;
		return await elaborateLakeEntryModules({ inventory, reviewedBindingIr, entries: intent.document.modules, workspace, leanPrefix, engineRoot });
	}
	finally
	{ await workspace.dispose(); }
};
// Build the reviewed native model and compile its Lean adapters, stopping before C.
const nativeModel = async (t, review) => {
	const { directory, root } = await project(t, review);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["ReviewedCallbacks"], targets: { c: { name: "reviewedcallbacks", version: "1.0.0" } } }));
	let captured;
	const options = {
		projectRoot: root
		, outputRoot: join(directory, "out")
		, leanPrefix: join(engineRoot, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, targets: ["c"]
		, profile: "native-library-v1"
		, receiptName: "native-component.json"
		, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true, nativeCallbackRefinements: true })
		, createAdapters: generateCompiledNativeLeanAdapters
		, compileComponent: async ({ model }) => { captured = model; throw Object.assign(new Error("stop before C"), { code: "stop-before-c" }); }
	};
	await assert.rejects(() => buildElaboratedComponent(options), error => {
		if(error.code !== "stop-before-c") throw error;
		return true;
	});
	return captured;
};

test("both reviews reconcile with fresh Lean, which never receives a bound", { skip: !lean, timeout: 1_200_000 }, async t => {
	for(const hostReply of [false, true])
	{
		const review = reviewedCallbackFinReview({ hostReply });
		const result = await inspect((await project(t, review)).root);
		assert.deepEqual(result.adapterHints, []);
		assert.deepEqual(result.elaboration.request.exports, [...reviewedCallbackFinExports, ...hostReply ? ["ReviewedCallbacks.three"] : []].sort());
		assert.ok(!/"fin"|refinement/u.test(canonicalJson(result.elaboration.request)));
		assert.equal(reviewedContractDifference(review, result.bindingIr.document), null);
	}
});

test("rehashed bound changes and dropped or changed nominal bounds fail fresh reconciliation at their path", { skip: !lean, timeout: 1_800_000 }, async t => {
	const review = reviewedCallbackFinReview(), byId = (a, b) => a.id.localeCompare(b.id);
	const tile = review.types.toSorted(byId).findIndex(type => type.id === "lean:ReviewedCallbacks.Tile");
	// A rehashed callback is a different type, first seen where its export leases it.
	const leased = name => `bindingIr.declarations[${review.declarations.toSorted(byId).findIndex(item => item.name === name)}].result.type.id`;
	const nominal = `bindingIr.types[${tile}].source.extensions.lean-lang.org/nominal-refinements`;
	const restate = (name, refinements) => ir => { const definition = callbackOf(ir, name); definition.source.extensions[key] = refinements; rehash(ir, definition); };
	const cases = [
		["a scaler bound restated as Fin 11", restate("scaler", { parameters: [{ kind: "fin", bound: "11" }], result: null }), leased("scaler")]
		, ["a counter result bound restated as Fin 9", restate("counter", { parameters: [null], result: { kind: "fin", bound: "9" } }), leased("counter")]
		// Dropping a bound from a callback whose plain signature is unique keeps every identity distinct.
		, ["a container bound dropped", ir => { const definition = callbackOf(ir, "digits"); delete definition.source.extensions[key]; rehash(ir, definition); }, leased("digits")]
		, ["a dropped nominal decision", ir => { delete ir.types.find(type => type.id === "lean:ReviewedCallbacks.Tile").source.extensions[nominalKey]; }, nominal]
		, ["a nominal bound restated as Fin 6", ir => { ir.types.find(type => type.id === "lean:ReviewedCallbacks.Tile").source.extensions[nominalKey].fields[0].bound = "6"; }, `${nominal}.fields[0].bound`]];
	for(const [label, change, field] of cases)
		await t.test(label, async t => {
			const review = reviewedCallbackFinReview();
			change(review);
			validateReviewedSource(reviewInput(review));
			await assert.rejects(async () => inspect((await project(t, review)).root), error => {
				assert.equal(error.code, "reviewed-ir-source-mismatch", label);
				assert.equal(error.details.field, field, label);
				return true;
			});
		});
});

test("a native build admits R1 and refuses R2 at the existing host-reply capability, not at review", { skip: !lean, timeout: 1_800_000 }, async t => {
	const model = await nativeModel(t, reviewedCallbackFinReview());
	assert.deepEqual(model.exports.map(item => item.name).sort(), [...reviewedCallbackFinExports].sort());
	const r2 = reviewedCallbackFinReview({ hostReply: true });
	validateReviewedSource(reviewInput(r2));
	await assert.rejects(() => nativeModel(t, r2), error => {
		// A bare Fin reply has no Fin-free failure value, so the model refuses it after extraction:
		// the declaration in details and the diagnostic in the message.
		assert.equal(error.code, "native-refinements-unsupported");
		assert.deepEqual(error.details, { declaration: "ReviewedCallbacks.three" });
		assert.equal(error.message, "ReviewedCallbacks.three: a host callback result needs a Fin-free failure value: scalar Fin, a Fin in its selected default, Subtype and checked records are refused");
		return true;
	});
});

const npm = process.env.LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_NPM_TEST === "1";
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };

/**
 * Build a review in two roots, hand over only the release, remove every author root and run
 * the Node and strict TypeScript consumers.
 *
 * @param t - Test context.
 * @param hostReply - Install R2 instead of R1.
 */
const checkReviewedNpm = async (t, hostReply) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-callback-fin-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const review = reviewedCallbackFinReview({ hostReply });
	const producers = join(directory, "producers"), releases = [];
	for(const [index, projectRoot] of [join(producers, "project"), join(producers, "relocated")].entries())
	{
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["ReviewedCallbacks"] }));
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const outputRoot = join(producers, `build-${index}`);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
			.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const ir = JSON.parse(await readFile(join(outputRoot, "bundle/binding/binding-ir.json"), "utf8"));
		assert.equal(reviewedContractDifference(review, ir), null);
		const release = await buildComponentNpmPackages({ bundleRoot: join(outputRoot, "bundle"), runtimeRoot, outputRoot: join(producers, `npm-${index}`) });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		releases.push(release);
	}
	assert.deepEqual(releases[1].report, releases[0].report);
	for(const name of ["componentArchive", "runtimeArchive"]) assert.deepEqual(await readFile(releases[1][name]), await readFile(releases[0][name]));
	const receipt = releases[0].report, handoff = join(directory, "handoff");
	await mkdir(handoff);
	for(const name of [receipt.package.archive, receipt.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
		await cp(join(releases[0].output, name), join(handoff, name));
	await rm(producers, { recursive: true, force: true });
	await assert.rejects(lstat(producers), { code: "ENOENT" });
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	const consumer = join(directory, "consumer"), bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm")), env = { ...clean, PATH: bin };
	const run = (args, label) => processBuildRunner.capture({ command: process.execPath, args, cwd: consumer, env, timeoutMs: 300_000 })
		.catch(error => assert.fail(`${label}: ${error.message}: ${JSON.stringify(error.details)}`));
	const configuration = ["--userconfig", join(consumer, "user.npmrc"), "--globalconfig", join(consumer, "global.npmrc"), "--cache", join(consumer, "empty-cache")];
	await run([npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...configuration, join(handoff, receipt.runtime.archive), join(handoff, receipt.package.archive)], "install");
	await saveLakeFile(consumer, "index.mjs", reviewedCallbackNodeConsumer(hostReply));
	const result = await run(["index.mjs"], "node");
	assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout.trim());
	assert.deepEqual(observed, reviewedCallbackNodeExpected[hostReply ? "r2" : "r1"]);
	await saveLakeFile(consumer, "index.mts", reviewedCallbackTypescript);
	await run([join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"], "typescript");
	const reportPath = resolve(process.env[hostReply ? "LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_R2_NPM_REPORT" : "LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_NPM_REPORT"] ?? `build/reviewed-callback-fin/npm-${hostReply ? "r2" : "r1"}.json`);
	const report = {
		schemaVersion: 1
		, profile: "npm"
		, path: "reviewed-source"
		, review: hostReply ? "R2" : "R1"
		, reviewedBindingIrSha256: hashBindingIr(review)
		, receipt
		, receiptSha256: sha256(await readFile(join(handoff, "component-package-receipt.json")))
		, observed
		, typescript: { strict: true, skipLibCheck: false }
		, dispatch: "not measured"
		, reproducible: true
		, sourceRemovedBeforeInstallation: true
	};
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson(report));
};

test("an independently reviewed npm package installs R1 callback bounds for Node and strict TypeScript", { skip: !npm, timeout: 3_600_000 }, t => checkReviewedNpm(t, false));
test("an independently reviewed npm package installs R2 with the npm-only host-reply bound", { skip: !npm, timeout: 3_600_000 }, t => checkReviewedNpm(t, true));

const profiles = process.env.LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Reviewed callback Fin acceptance covers C and C++ first");
const coordinate = { name: "reviewedcallbacks", version: "1.0.0" };
const targets = { c: ["c", coordinate], cpp: ["cpp", coordinate] };

/**
 * Name each generated closure and host-callback type the C consumer uses, from the installed Binding IR.
 *
 * @param ir - Binding IR of the installed package.
 */
const consumerNames = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const names = {};
	for(const item of ir.declarations)
	{
		const name = item.id.split(".").at(-1).toUpperCase(), host = item.parameters.find(site => surface.callbacks.has(site.type.id));
		if(surface.callbacks.has(item.result.type.id)) names[`CLOSURE_${name}`] = `${surface.prefix}_owned_${surface.callbacks.get(item.result.type.id).field}`;
		if(host) names[`HOST_${name}`] = `${surface.prefix}_${surface.callbacks.get(host.type.id).field}`;
	}
	return names;
};

test("independently reviewed C and C++ packages install R1 callback bounds from source-free archives", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const selected = Object.fromEntries(profiles.map(profile => targets[profile]));
	const environment = nativeFixtureEnvironment(profiles);
	const review = reviewedCallbackFinReview();
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-callback-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-callback-fin-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(fixture, projectRoot, { recursive: true });
		// Modules and package targets only: every export decision comes from the review.
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["ReviewedCallbacks"], targets: selected }));
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		t.diagnostic(`reviewed build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(selected), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		const names = consumerNames(model.bindingIr);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking reviewed ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === targets[profile][0]);
			const source = async (name, extension) => {
				const text = await readFile(`tests/fixtures/reviewed-callback-fin-consumers/${name}.${extension}`, "utf8");
				return name === "c" ? `${Object.entries(names).map(([macro, value]) => `#define ${macro} ${value}`).join("\n")}\n${text}` : text;
			};
			const observation = await installCopiedConsumer({ profile, consumer, handoff, packages, environment, fixture: { source, wit: [], success: "reviewed-callback-fin-ok" } });
			delete observation.command;
			const identities = { bindingIrSha256: built.bindingIrSha256, reviewedBindingIrSha256: hashBindingIr(review), modelSha256: sha256(canonicalJson(model)) };
			const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
			reports.push({ profile, path: "reviewed-source", review: "R1", ...observation, packages, ...identities, receiptSha256, dispatch: "not measured", sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_REPORT ?? `build/reviewed-callback-fin/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
