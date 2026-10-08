/**
 * Native Fin in safe callable directions (VO #1445): a Lean closure leased to the host checks its
 * arguments before it runs, and values Lean produces for the host keep their bounds. A host
 * callback's result stays refused.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finCallbackArities, finCallbackConsumerNames, finCallbackEnvironment, finCallbackExports, finCallbackTargets, installFinCallbackConsumer } from "./helpers/fin-callback-install.mjs";
import { finCallbackDispatchExpected, finCallbackDispatchInterposer, finCallbackDispatchProbe, finCallbackDispatchSymbols } from "./helpers/fin-callback-dispatch.mjs";
import { generateNativeLeanAdapters, nativeTypeKey } from "../src/build/native-model.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateNativeCallables } from "../src/backends/c/native-callables.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { finCallback, finCallbackBound, finCallbackCompilerModel, finCallbackNat, finCallbackSignatures } from "./helpers/fin-callback-model.mjs";

const fin = bound => ({ kind: "fin", bound });
const leased = (parameters, result = null) => ({ parameters: [null], result: { kind: "callback", parameters, result } });
/** Refinement trees the native model must carry for every export of the fixture. */
const expectedTrees = {
	"Sample.branch": leased([{ kind: "result", arguments: [fin("7"), null] }])
	, "Sample.counter": leased([null], fin("10"))
	, "Sample.digits": leased([{ kind: "array", arguments: [fin("3")] }])
	, "Sample.impossible": leased([fin("0")])
	, "Sample.pick": leased([{ kind: "option", arguments: [{ kind: "tuple", arguments: [fin("5"), null] }] }])
	, "Sample.scaler": leased([fin("10")])
	, "Sample.visit": { parameters: [{ kind: "callback", parameters: [fin("5")], result: null }], result: null }
	, "Sample.wide": leased([fin("184467440737095516170")]) };

test("leased closures carry checked argument trees and a distinct native type; Lean-produced bounds are erased", () => {
	const model = finCallbackCompilerModel();
	assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements])), expectedTrees);
	for(const item of model.exports)
	{
		const checked = item.refinements.result?.parameters.some(tree => tree !== null) ?? false;
		assert.deepEqual(item.result.checked, checked ? item.refinements.result.parameters : undefined, item.name);
	}
	// A checked closure never shares a key, lease kind or Lean carrier with an unchecked one of the same shape.
	const scaler = model.exports.find(item => item.name === "Sample.scaler").result, counter = model.exports.find(item => item.name === "Sample.counter").result;
	const visit = model.exports.find(item => item.name === "Sample.visit").parameters[0].type;
	assert.notEqual(nativeTypeKey(scaler), nativeTypeKey(visit));
	assert.equal(nativeTypeKey(counter), nativeTypeKey(visit));
	assert.deepEqual({ ...scaler, checked: undefined, key: undefined }, { ...visit, checked: undefined, key: undefined });
});

test("Lean adapters build each closure argument's Fin from its proof, answer none instead of a value, and erase what Lean gives the host", () => {
	const model = finCallbackCompilerModel(), lean = generateNativeLeanAdapters(model).leanSource;
	const section = name => {
		const symbol = model.exports.find(item => item.name === `Sample.${name}`).symbol, start = lean.indexOf(`@[export ${symbol}]`);
		return lean.slice(start, lean.indexOf("\n\n", start));
	};
	assert.match(section("scaler"), /let _bridgeClosure := _root_\.Sample\.scaler a0; fun _bridgeArg0 =>\n\s+if _bridgeFin0 : \(_bridgeArg0\) < 10 then\n\s+_root_\.Option\.some \(\(_bridgeClosure\) ⟨_bridgeArg0, _bridgeFin0⟩\)\n\s+else\n\s+_root_\.Option\.none/u);
	// Fin 0 rejects every argument by the same decidable check; nothing is manufactured.
	assert.match(section("impossible"), /if _bridgeFin0 : \(_bridgeArg0\) < 0 then/u);
	assert.match(section("digits"), /\.mapM \(fun _bridgeValue0 => \(if proof : \(_bridgeValue0\) < 3 then/u);
	assert.match(section("counter"), /fun _bridgeArg0 =>\n\s+\(\(_bridgeClosure\) _bridgeArg0\)\.val\)⟩/u);
	assert.match(section("visit"), /_root_\.Sample\.visit \(fun _bridgeArg0 => a0 \(_bridgeArg0\)\.val\)/u);
	for(const name of ["scaler", "digits", "impossible", "pick", "branch", "wide"]) assert.doesNotMatch(section(name), /default|sorry|unsafe|panic/u, name);
	// Every checked closure is called through an Option-returning entry; unchecked shapes keep their old entry.
	for(const type of model.types.filter(item => item.kind === "callback"))
	{
		const start = lean.indexOf(`@[export lb_t${type.key}_call]`), entry = lean.slice(start, lean.indexOf("\n\n", start));
		assert.equal(/: \(_root_\.Option [^\n]+\) :=\n {2}closure value0$/u.test(entry), Boolean(type.checked), type.key);
		assert.equal(lean.includes(`@[export lb_t${type.key}_wrap]`), !type.checked, type.key);
	}
});

test("the C lease call compares every bound on caller limbs before borrowing Lean, and each public slot calls only its own closure type", () => {
	const model = finCallbackCompilerModel();
	const surface = compilePrimitiveCSurface(model.bindingIr, { wordBits: model.pointerBits, callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const { source, vtable } = generateNativeCallables(model, surface);
	const lease = name => {
		const key = nativeTypeKey(model.exports.find(item => item.name === `Sample.${name}`).result), start = source.indexOf(`lb_owned_${key}(`);
		return source.slice(start, source.indexOf("\n}\n", start));
	};
	assert.match(lease("scaler"), /if \(!lb_fin_below\(value0->data, value0->length, lb_fin_lease_[0-9a-f]+_0, 1\)\) \{ lb_record\(_lb_frame, FINCALLBACKS_STATUS_INVALID_ARGUMENT, NULL, "arg0 is not below its Fin 10 bound"\); goto done; \}/u);
	assert.match(lease("impossible"), /lb_fin_below\(value0->data, value0->length, NULL, 0\)/u);
	assert.match(lease("wide"), /"arg0 is not below its Fin 184467440737095516170 bound"/u);
	assert.match(lease("digits"), /for \(size_t k2 = 0; k2 < value0->length; \+\+k2\) \{/u);
	assert.match(lease("pick"), /if \(value0->has_value\) \{/u);
	assert.match(lease("branch"), /if \(value0->is_ok\) \{/u);
	for(const name of ["scaler", "impossible", "wide", "digits", "pick", "branch"])
	{
		const body = lease(name);
		// The walk precedes the Lean call; Lean's own refusal is reported, never replaced by a value.
		assert.ok(body.indexOf("lb_fin_below") < body.indexOf("lean_object *_lb_checked ="), name);
		assert.match(body, /if \(lean_is_scalar\(_lb_checked\)\) lb_record\(_lb_frame, FINCALLBACKS_STATUS_INVALID_ARGUMENT, NULL, "Lean rejected an argument outside its Fin bound"\);/u, name);
	}
	assert.doesNotMatch(lease("counter"), /lb_fin_below|_lb_checked/u);
	// Each public closure slot is bound exactly once, to the native type its export leases.
	const slots = [...vtable.matchAll(/\.(callback[0-9a-f]+)_call = lb_owned_([0-9a-f]+)/gu)];
	assert.equal(new Set(slots.map(([, slot]) => slot)).size, slots.length);
	for(const fn of surface.functions.filter(item => item.declaration.result.type.kind === "named" && surface.callbacks.has(item.declaration.result.type.id)))
	{
		const native = model.exports.find(item => `lean:${item.name}` === fn.declaration.id);
		const slot = slots.find(([, name]) => name === surface.callbacks.get(fn.declaration.result.type.id).field);
		assert.equal(slot?.[2], nativeTypeKey(native.result), native.name);
	}
	// The whole translation unit defines the comparison once and every lease bound constant.
	const c = generateNativePrimitiveC(model, { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	assert.equal((c.match(/static inline int lb_fin_below\(/gu) ?? []).length, 1);
	assert.ok(c.indexOf("static inline int lb_fin_below(") < c.indexOf("lb_fin_lease_"));
});

test("the Binding IR that npm reads carries exactly the callback bounds the native model checks", () => {
	// Parity only: npm's own installed acceptance of these shapes is separate evidence, not inherited from C.
	const model = finCallbackCompilerModel(), abi = createComponentPrivateAbi(model.bindingIr);
	const extension = id => model.bindingIr.types.find(type => type.id === id).source.extensions["lean-lang.org/refinements"];
	for(const item of model.exports)
	{
		const declaration = model.bindingIr.declarations.find(entry => entry.id === `lean:${item.name}`);
		const sites = [...declaration.parameters.map((parameter, index) => [parameter.type, item.refinements.parameters[index]]), [declaration.result.type, item.refinements.result]];
		for(const [type, tree] of sites.filter(([, tree]) => tree?.kind === "callback"))
		{
			const { parameters, result } = tree;
			assert.deepEqual(extension(type.id), { parameters, result }, item.name);
			assert.deepEqual(abi.callbacks.find(callback => callback.id === type.id).refinements, { parameters, result }, item.name);
		}
	}
});

test("host replies, nested callbacks, mixed bounds and packages without callback checks stay refused", () => {
	const { nat, scaler } = { nat: finCallbackNat, scaler: finCallbackSignatures.scaler };
	const refused = [
		["a host callback's result", { reply: [finCallback([nat], finCallbackBound("5")), nat] }, true, /Fin refinements require a top-level native parameter or result/u]
		, ["a host callback's result inside a container", { reply: [finCallback([nat], { kind: "array", element: finCallbackBound("5"), abi: nat.abi }), nat] }, true, /Fin refinements require a top-level native parameter or result/u]
		, ["a callback inside a leased closure's argument", { nested: [nat, finCallback([finCallback([finCallbackBound("5")], nat)], nat)] }, true, /Fin refinements require a top-level native parameter or result|callbacks inside copied values/u]
		, ["an ordinary bound beside a callback", { mixed: [finCallbackBound("5"), finCallback([finCallbackBound("10")], nat)] }, true, /checked Fin refinements cannot share a native export with callbacks/u]
		, ["a package set beyond C and C++", { scaler }, false, /checked Fin refinements in callbacks are implemented only for C and C\+\+ packages/u]];
	for(const [label, signatures, callbacks, pattern] of refused)
		assert.throws(() => finCallbackCompilerModel(signatures, callbacks), error => pattern.test(error.message), label);
	// Callback shapes without any bound keep their unchecked representation and entries.
	const plain = finCallbackCompilerModel({ scaler: [nat, finCallback([nat], nat)], visit: [finCallback([nat], nat), nat] });
	assert.ok(plain.exports.every(item => item.refinements === undefined && item.result.checked === undefined));
	assert.doesNotMatch(generateNativeLeanAdapters(plain).leanSource, /_bridgeClosure|_bridgeArg/u);
});

const lean = process.env.LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const fixture = "tests/fixtures/onboarding/native-fin-callbacks";
const leasedArities = Object.fromEntries(["branch", "counter", "digits", "impossible", "pick", "scaler", "wide"].map(name => [`FinCallbacks.${name}`, 1]));
// Fresh extraction and a Lean compile of the generated adapter, stopping before any C or package step.
const elaborate = async (t, configuration, source) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-callbacks-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(fixture, projectRoot, { recursive: true });
	if(source) await writeFile(join(projectRoot, "FinCallbacks.lean"), source);
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: ["FinCallbacks"], targets: { c: { name: "fincallbacks", version: "1.0.0" } }, ...configuration }));
	let captured;
	const createModel = input => createCompiledNativeModel(input, { nativeRefinements: true, nativeCallbackRefinements: true });
	const compileComponent = async ({ model, adapters }) => {
		captured = { model, adapters };
		throw Object.assign(new Error("stopped before C"), { code: "stopped-before-c" });
	};
	const options = { projectRoot, outputRoot: join(directory, "out"), leanPrefix, targets: ["c"], profile: "native-library-v1", receiptName: "native-component.json" };
	await assert.rejects(() => buildElaboratedComponent({ ...options, createModel, createAdapters: generateCompiledNativeLeanAdapters, compileComponent })
		, error => error.code === "stopped-before-c" || assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	return captured;
};

test("fresh Lean admits every safe direction and compiles the generated adapter", { skip: !lean, timeout: 900_000 }, async t => {
	const exports = [...Object.keys(leasedArities), "FinCallbacks.visit"].sort();
	const { model } = await elaborate(t, { exports, arities: leasedArities });
	const trees = Object.fromEntries(model.exports.map(item => [item.name.replace("FinCallbacks.", "Sample."), item.refinements]));
	assert.deepEqual(trees, expectedTrees);
	assert.deepEqual(model.exports.filter(item => item.result.checked).map(item => item.name).sort(), ["branch", "digits", "impossible", "pick", "scaler", "wide"].map(name => `FinCallbacks.${name}`));
});

test("fresh Lean refuses Fin in a host callback's result, alone or inside a container", { skip: !lean, timeout: 900_000 }, async t => {
	const replies = [["reply", "def reply (host : Nat → Fin 5) : Nat := (host 0).val"]
		, ["replies", "def replies (host : Nat → Except String (Array (Fin 5))) : Nat := match host 0 with | .ok values => values.size | .error _ => 0"]];
	for(const [name, definition] of replies)
	{
		const source = `namespace FinCallbacks\n${definition}\nend FinCallbacks\n`;
		await assert.rejects(() => elaborate(t, { exports: [`FinCallbacks.${name}`] }, source)
			, error => /Fin refinements in a host callback result are refused: the host produces the value while Lean runs/u.test(JSON.stringify(error.details ?? error.message)), name);
	}
});

const profiles = process.env.LEAN_BRIDGE_FIN_CALLBACK_PROFILES?.split(",").sort() ?? [];
assert.equal(new Set(profiles).size, profiles.length, "Duplicate Fin callback profile");
assert.ok(profiles.every(profile => Object.hasOwn(finCallbackTargets, profile)), "Fin in callbacks is checked by C and C++ packages only");

/**
 * Count public entry, checked adapter and source-body dispatch in the installed C package with a
 * test-only interposer. Without the interposer the probe refuses to report.
 *
 * @param consumer - Consumer root containing the installed C package.
 * @param packages - Installed C packages.
 * @param model - Compiled native model, for the counted symbols.
 * @param leanPrefix - Pinned Lean installation providing lean.h for raw adapter values.
 */
const observeDispatch = async (consumer, packages, model, leanPrefix) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`), lib = join(installed, "lib");
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(lib, "pkgconfig"), PKG_CONFIG_PATH: "" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	const closure = finCallbackConsumerNames(model.bindingIr).CLOSURE_SCALER, symbols = finCallbackDispatchSymbols(model, closure);
	await saveLakeFile(root, "interposer.c", finCallbackDispatchInterposer(symbols));
	await saveLakeFile(root, "probe.c", finCallbackDispatchProbe(symbols, closure));
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	await assert.rejects(() => runCopied(join(root, "probe"), [], root, copiedCleanEnvironment), /interposer is not loaded/u);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, finCallbackDispatchExpected);
	const columns = ["public lease-call entry", "checked closure-call adapter", "source body"];
	return { columns, symbols, observed, interposer: "LD_PRELOAD", positiveControl: "valid public and raw calls increment the adapter and source counts" };
};

test("relocated source-free C and C++ packages check leased-closure arguments and keep Lean-produced bounds", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => finCallbackTargets[profile]));
	const environment = finCallbackEnvironment(profiles);
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-callbacks-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-fin-callbacks-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinCallbacks"], exports: finCallbackExports, arities: finCallbackArities, targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name.replace("FinCallbacks.", "Sample."), item.refinements])), expectedTrees);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// Install from prepared archives only; no author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		const names = finCallbackConsumerNames(model.bindingIr);
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === finCallbackTargets[profile][0]);
			const observation = await installFinCallbackConsumer({ profile, consumer, handoff, packages, environment }, names);
			delete observation.command;
			const dispatch = profile === "c" ? { dispatch: await observeDispatch(consumer, packages, model, environment.LEAN_BRIDGE_LEAN_PREFIX) } : {};
			const identities = { bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(canonicalJson(model)), receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json"))) };
			reports.push({ profile, path: "ordinary-source", ...observation, ...dispatch, packages, ...identities, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two unrelated author roots produce byte-identical archives.
	assert.deepEqual(archives[1], archives[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_FIN_CALLBACK_REPORT ?? `build/native-fin-callbacks/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
