/**
 * Native Fin in safe callable directions (VO #1445): a Lean closure leased to the host checks its
 * arguments before it runs, and values Lean produces for the host keep their bounds. A host
 * callback's Fin reply is checked when its type has a Fin-free failure value (VO #1453).
 *
 * @file
 */
import assert from "node:assert/strict";
import "./helpers/native-fin-callback-evidence-tests.mjs";
import "./helpers/native-fin-callback-archive-source-history-tests.mjs";
import "./helpers/callback-code-ci-repair-source-history-tests.mjs";
import "./helpers/native-fin-callback-admission-source-history-tests.mjs";
import "./helpers/fin-reply-compiled-tests.mjs";
import "./helpers/fin-reply-installed-tests.mjs";
import "./helpers/native-fin-reply-evidence-tests.mjs";
import "./helpers/native-fin-reply-archive-source-history-tests.mjs";
import "./helpers/native-fin-reply-promotion-tests.mjs";
import "./helpers/native-fin-reply-promotion-source-history-tests.mjs";
import "./helpers/native-fin-reply-ci-tests.mjs";
import "./helpers/native-fin-reply-source-history-tests.mjs";
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
import { generateNativeLeanAdapters, nativeReplyRejectedSymbol, nativeTypeKey } from "../src/build/native-model.mjs";
import { generateCompiledCallbacks } from "../src/build/native-component.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateNativeCallables } from "../src/backends/c/native-callables.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { nativeCallbackFinGuide } from "../src/release/native-c-family.mjs";
import { finReplyCompilerModel, finReplyHostShape, finReplyOptionDigit } from "./helpers/fin-reply-model.mjs";
import { finCallback, finCallbackBound, finCallbackCompilerModel, finCallbackNat, finCallbackSignatures, finCallbackTile } from "./helpers/fin-callback-model.mjs";

const fin = bound => ({ kind: "fin", bound });
const leased = (parameters, result = null) => ({ parameters: [null], result: { kind: "callback", parameters, result } });
const tile = { kind: "record", definition: "FinCallbacks.Tile", fields: ["digit", "count"], arguments: [fin("5"), null] };
const shape = { kind: "variant", definition: "FinCallbacks.Shape", cases: [{ name: "circle", fields: ["radius"], arguments: [fin("10")] }, { name: "label", fields: ["text"], arguments: [null] }] };
/** Refinement trees the native model must carry for every export of the fixture. */
const expectedTrees = {
	"Sample.branch": leased([{ kind: "result", arguments: [fin("7"), null] }])
	, "Sample.counter": leased([null], fin("10"))
	, "Sample.digits": leased([{ kind: "array", arguments: [fin("3")] }])
	, "Sample.impossible": leased([fin("0")])
	, "Sample.pick": leased([{ kind: "option", arguments: [{ kind: "tuple", arguments: [fin("5"), null] }] }])
	, "Sample.scaler": leased([fin("10")])
	, "Sample.visit": { parameters: [{ kind: "callback", parameters: [fin("5")], result: null }], result: null }
	, "Sample.wide": leased([fin("184467440737095516170")])
	, "Sample.maybeTiles": leased([{ kind: "option", arguments: [{ kind: "list", arguments: [tile] }] }])
	, "Sample.shaped": leased([shape])
	, "Sample.tileMaker": leased([null], tile)
	, "Sample.tiles": leased([{ kind: "list", arguments: [tile] }])
	, "Sample.visitShapes": { parameters: [{ kind: "callback", parameters: [shape], result: null }], result: null }
	, "Sample.visitTiles": { parameters: [{ kind: "callback", parameters: [tile], result: null }], result: null } };

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
	// Records and variants inside callbacks cross as erased mirrors, built through check and returned through erase.
	assert.match(lean, /structure LbErased\.FinCallbacks\.Tile where/u);
	assert.match(lean, /inductive LbErased\.FinCallbacks\.Shape where/u);
	assert.match(section("tiles"), /\.mapM \(fun _bridgeValue0 => \(LbErased\.FinCallbacks\.Tile\.check \(_bridgeValue0\)\)\)/u);
	assert.match(section("shaped"), /LbErased\.FinCallbacks\.Shape\.check \(_bridgeArg0\)/u);
	assert.match(section("tileMaker"), /let _bridgeResult := \(_bridgeClosure\) _bridgeArg0; \(LbErased\.FinCallbacks\.Tile\.erase \(_bridgeResult\)\)/u);
	assert.match(section("visitTiles"), /_root_\.Sample\.visitTiles \(fun _bridgeArg0 => a0 \(LbErased\.FinCallbacks\.Tile\.erase \(_bridgeArg0\)\)\)/u);
	assert.match(section("visitShapes"), /a0 \(LbErased\.FinCallbacks\.Shape\.erase \(_bridgeArg0\)\)/u);
	for(const name of ["scaler", "digits", "impossible", "pick", "branch", "wide", "tiles", "shaped", "maybeTiles"]) assert.doesNotMatch(section(name), /default|sorry|unsafe|panic/u, name);
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

test("the generated frame reports a Fin rejection as an invalid argument and keeps host codes, bounded text and the first error", async t => {
	const model = finCallbackCompilerModel(), c = generateNativePrimitiveC(model, { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const header = generateCBindingPackage(model.bindingIr)["include/fincallbacks.h"];
	const extract = (start, end) => c.slice(c.indexOf(start), c.indexOf(end, c.indexOf(start)) + end.length);
	// The exact generated frame and recorder, without the runtime they are linked against.
	const harness = `#include <stdio.h>
#include <string.h>
${header}
${extract("typedef struct lb_frame {", "} lb_frame;")}
${extract("static void lb_record(", "\n}\n")}
static char long_text[2048];
int main(void) {
  lb_frame frame = {0};
  lb_record(&frame, FINCALLBACKS_STATUS_INVALID_ARGUMENT, NULL, "arg0 is not below its Fin 10 bound");
  lb_record(&frame, FINCALLBACKS_STATUS_UNEXPECTED_ERROR, NULL, "second");
  printf("%d %d %s\\n", frame.status, frame.code, frame.message);
  lb_frame host = {0};
  fincallbacks_error supplied = {FINCALLBACKS_ERROR_NATIVE_CALLBACK_FAILURE, "host failure", 12};
  lb_record(&host, FINCALLBACKS_STATUS_INVALID_ARGUMENT, &supplied, "fallback");
  printf("%d %d %s\\n", host.status, host.code, host.message);
  lb_frame unexpected = {0};
  memset(long_text, 'x', sizeof(long_text) - 1);
  lb_record(&unexpected, FINCALLBACKS_STATUS_UNEXPECTED_ERROR, NULL, long_text);
  printf("%d %d %zu\\n", unexpected.status, unexpected.code, unexpected.message_length);
  return 0;
}
`;
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-callback-frame-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "frame.c"), harness);
	await processBuildRunner.capture({ command: process.env.CC ?? "cc", args: ["-std=c11", "-Wall", "-Werror", "-Wno-unused-function", "frame.c", "-o", "frame"], cwd: directory });
	const { stdout } = await processBuildRunner.capture({ command: join(directory, "frame"), args: [], cwd: directory });
	assert.deepEqual(stdout.trim().split("\n"), ["1 1 arg0 is not below its Fin 10 bound", "1 100 host failure", "5 65535 1023"]);
});

test("the Binding IR that npm reads carries exactly the callback bounds the native model checks", () => {
	// Parity only: npm's own installed acceptance of these shapes is separate evidence, not inherited from C.
	const model = finCallbackCompilerModel(), abi = createComponentPrivateAbi(model.bindingIr);
	const definition = id => model.bindingIr.types.find(type => type.id === id);
	// The IR keeps a record's or variant's bounds on its own definition, so a callback tree names it as null there.
	const nominal = new Map();
	const project = tree => {
		if(tree === null || tree.kind === "fin") return tree;
		if(["record", "variant"].includes(tree.kind))
		{
			nominal.set(tree.definition, tree.kind === "record" ? { kind: "record", fields: tree.arguments } : { kind: "variant", cases: tree.cases.map(branch => branch.arguments) });
			return null;
		}
		const children = tree.arguments.map(project);
		return children.every(child => child === null) ? null : { ...tree, arguments: children };
	};
	for(const item of model.exports)
	{
		const declaration = model.bindingIr.declarations.find(entry => entry.id === `lean:${item.name}`);
		const sites = [...declaration.parameters.map((parameter, index) => [parameter.type, item.refinements.parameters[index]]), [declaration.result.type, item.refinements.result]];
		for(const [type, tree] of sites.filter(([, tree]) => tree?.kind === "callback"))
		{
			const parameters = tree.parameters.map(project), result = project(tree.result);
			const expected = parameters.every(child => child === null) && result === null ? undefined : { parameters, result };
			assert.deepEqual(definition(type.id).source.extensions["lean-lang.org/refinements"], expected, item.name);
			assert.deepEqual(abi.callbacks.find(callback => callback.id === type.id).refinements, expected, item.name);
		}
	}
	assert.deepEqual([...nominal.keys()].sort(), ["FinCallbacks.Shape", "FinCallbacks.Tile"]);
	for(const [name, value] of nominal) assert.deepEqual(definition(`lean:${name}`).source.extensions["lean-lang.org/nominal-refinements"], value, name);
});

test("C and C++ READMEs document only the callable bounds a package admits, and other packages keep their text", async () => {
	const model = finCallbackCompilerModel();
	const c = nativeCallbackFinGuide(model, "c"), cpp = nativeCallbackFinGuide(model, "cpp");
	for(const text of [c, cpp])
	{
		assert.match(text, /^\n\nLean Fin n values cross as Nat values below n, including bounds wider than 64 bits\./u);
		assert.match(text, /A closure returned by Lean compares every Fin in its arguments with its bound before it runs: each element of an array or list, a present option value, both product components, only the active Except branch, each record field and only the active variant case's fields\./u);
		assert.match(text, /the closure is not invoked, the caller's values are unchanged/u);
		assert.match(text, /Fin 0 has no values, so every call to a closure taking one is refused\./u);
		assert.match(text, /Values Lean produces for the host, the arguments it passes to a host callback and the results of a returned closure, are already below their bounds\./u);
		assert.match(text, /The host callbacks of this package return no Fin bounds\./u);
		assert.doesNotMatch(text, /installed|tested|verified/u);
	}
	assert.match(c, /returns INVALID_ARGUMENT with a message naming the argument and its bound; .* until its dispose function releases it, exactly once\./u);
	assert.match(cpp, /throws Error with status INVALID_ARGUMENT whose message names the argument and its bound; .* until close\(\) or destruction releases it\./u);
	// Only Lean-produced bounds: no sentence about checked closure arguments.
	const produced = nativeCallbackFinGuide(finCallbackCompilerModel({ visit: finCallbackSignatures.visit, counter: finCallbackSignatures.counter }), "c");
	assert.doesNotMatch(produced, /A closure returned by Lean compares/u);
	assert.match(produced, /are already below their bounds/u);
	// Packages without callback bounds, including ordinary top-level Fin, keep their README text unchanged.
	const nat = finCallbackNat, plain = finCallbackCompilerModel({ scaler: [nat, finCallback([nat], nat)], visit: [finCallback([nat], nat), nat] });
	assert.equal(nativeCallbackFinGuide(plain, "c"), "");
	assert.equal(nativeCallbackFinGuide(finCallbackCompilerModel({ top: [finCallbackBound("5"), nat] }), "cpp"), "");
	// The README appends the guide once, after the copied-value and callable guides, and never for graph packages.
	const source = await readFile("src/release/native-c-family.mjs", "utf8");
	assert.equal(source.split("${copiedGuide}${graph ? \"\" : nativeCallbackFinGuide(model, target)}\\n\\n${exports.join").length, 2);
});

test("host replies without a Fin-free failure value, nested callbacks, mixed bounds and packages without callback checks stay refused", () => {
	const { nat, scaler } = { nat: finCallbackNat, scaler: finCallbackSignatures.scaler };
	const refused = [
		["a host callback's result", { reply: [finCallback([nat], finCallbackBound("5")), nat] }, true, /a host callback result needs a Fin-free failure value/u]
		, ["a package set beyond C and C++ with a contained reply", { reply: [finCallback([nat], { kind: "option", element: finCallbackBound("5"), abi: nat.abi }), nat] }, false, /checked Fin refinements in callbacks are implemented only for C and C\+\+ packages/u]
		, ["a callback inside a leased closure's argument", { nested: [nat, finCallback([finCallback([finCallbackBound("5")], nat)], nat)] }, true, /Fin refinements require a top-level native parameter or result|callbacks inside copied values/u]
		, ["an ordinary bound beside a callback", { mixed: [finCallbackBound("5"), finCallback([finCallbackBound("10")], nat)] }, true, /checked Fin refinements cannot share a native export with callbacks/u]
		, ["a package set beyond C and C++", { scaler }, false, /checked Fin refinements in callbacks are implemented only for C and C\+\+ packages/u]
		// A record's field is structural wherever the record appears, so the host-reply rule is the model's.
		, ["a host callback's record result", { reply: [finCallback([nat], finCallbackTile), nat] }, true, /a host callback result needs a Fin-free failure value/u]];
	for(const [label, signatures, callbacks, pattern] of refused)
		assert.throws(() => finCallbackCompilerModel(signatures, callbacks), error => pattern.test(error.message), label);
	// Callback shapes without any bound keep their unchecked representation and entries.
	const plain = finCallbackCompilerModel({ scaler: [nat, finCallback([nat], nat)], visit: [finCallback([nat], nat), nat] });
	assert.ok(plain.exports.every(item => item.refinements === undefined && item.result.checked === undefined));
	assert.doesNotMatch(generateNativeLeanAdapters(plain).leanSource, /_bridgeClosure|_bridgeArg/u);
});

// Host replies, each alone in an export taking the host callback, as the extractor reports them.
const replyShapes = () => {
	const nat = finCallbackNat, fin = finCallbackBound, heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const option = element => ({ kind: "option", element, abi: heap }), array = element => ({ kind: "array", element, abi: heap });
	const text = { kind: "primitive", name: "string", lean: "String", abi: heap };
	const cases = [{ name: "label", constructor: "FinCallbacks.Late.label", fields: [{ name: "text", type: text }] }
		, { name: "digit", constructor: "FinCallbacks.Late.digit", fields: [{ name: "value", type: fin("10") }] }];
	const late = { kind: "variant", name: "FinCallbacks.Late", lean: "FinCallbacks.Late", cases, abi: heap };
	const alias = { kind: "alias", name: "FinCallbacks.MaybeDigit", lean: "FinCallbacks.MaybeDigit", target: option(fin("5")), abi: heap };
	const slotFields = [{ name: "digit", projection: "FinCallbacks.Slot.digit", type: option(fin("5")) }
		, { name: "count", projection: "FinCallbacks.Slot.count", type: nat }];
	const slot = { kind: "record", name: "FinCallbacks.Slot", lean: "FinCallbacks.Slot", constructor: "FinCallbacks.Slot.mk", fields: slotFields, abi: heap };
	return {
		// None, an empty collection, the ok branch and the first case: none of these failure values holds a Fin.
		admitted: {
			maybe: option(fin("5"))
			, digits: array(fin("3"))
			, none0: option(fin("0"))
			, empty0: { kind: "list", element: fin("0"), abi: heap }
			, wide: option(fin("184467440737095516170"))
			, failure: { kind: "result", arguments: [nat, fin("7")], abi: heap }
			, trailing: late
			, maybeTile: option(finCallbackTile)
			, aliased: alias
			, nested: option(array(fin("3")))
			// A record, product or ok branch qualifies when its own stand-in holds no Fin.
			, slotted: slot
			, product: { kind: "tuple", arguments: [option(fin("5")), nat], abi: heap }
			, success: { kind: "result", arguments: [array(fin("3")), nat], abi: heap }
		}
		, refused: {
			scalar: fin("5")
			, zero: fin("0")
			, tile: finCallbackTile
			, pair: { kind: "tuple", arguments: [fin("5"), nat], abi: heap }
			, okDigit: { kind: "result", arguments: [fin("7"), nat], abi: heap }
			, first: { ...late, cases: [...cases].reverse() }
			, aliasedScalar: { ...alias, target: fin("5"), abi: nat.abi }
		}
	};
};
const replyModel = signatures => finCallbackCompilerModel(Object.fromEntries(Object.entries(signatures)
	.map(([name, type]) => [name, [finCallback([finCallbackNat], type), finCallbackNat]])));
const replySurface = model => compilePrimitiveCSurface(model.bindingIr, { wordBits: model.pointerBits, callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
const section = (text, start, end = "\n}\n") => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));

test("host replies are admitted only when their failure value holds no Fin, and Lean rebuilds each Fin from its decidable proof", () => {
	for(const [name, type] of Object.entries(replyShapes().admitted))
	{
		const model = replyModel({ [name]: type }), item = model.exports[0], host = item.parameters[0].type, key = nativeTypeKey(host);
		assert.deepEqual(host.reply, item.refinements.parameters[0].result, name);
		const lean = generateNativeLeanAdapters(model).leanSource;
		const reject = lean.indexOf(`@[extern "lb_t${key}_reply_reject"]\nopaque reply_reject_${key} (reply : `);
		assert.ok(reject >= 0 && reject < lean.indexOf(`def f_${item.symbol}`), name);
		assert.match(lean, new RegExp(`let _bridgeReply := a0 \\(_bridgeArg0\\); match .*(?:if proof : |LbErased\\.[\\w.]+\\.check ).* \\| \\.some _bridgeChecked => _bridgeChecked \\| \\.none => reply_reject_${key} _bridgeReply\\)`, "u"), name);
		// Records and variants convert through their mirror's check, which holds the decidable test.
		assert.match(lean, /if proof : /u, name);
		assert.doesNotMatch(lean, /\b(?:panic!|sorry|default|Fin\.ofNat|unsafeCast)\b/u, name);
		// The C walk compares the reply on host limbs after its shape check and before any Lean value exists.
		const source = generateNativeCallables(model, replySurface(model)).source, trampoline = section(source, `lb_invoke_${key}(`);
		const walk = trampoline.indexOf("lb_fin_below(");
		assert.ok(trampoline.indexOf("_check(&returned") < walk && walk < trampoline.indexOf("_in(&returned)"), name);
		assert.match(trampoline, /lb_record\(frame, FINCALLBACKS_STATUS_INVALID_ARGUMENT, NULL, "callback result is not below its Fin \d+ bound"\); goto done; \}/u, name);
		// A reply Lean rejected suppresses later host callbacks and reaches the frame at reentry and leave.
		const flag = `if (${nativeReplyRejectedSymbol(model)}()) lb_record(`;
		assert.ok(trampoline.indexOf(flag) >= 0 && trampoline.indexOf(flag) < trampoline.indexOf("if (frame->status != FINCALLBACKS_STATUS_OK) goto done;"), name);
		assert.ok(section(source, "static void lb_observe(").includes(flag), name);
		const component = generateCompiledCallbacks(model);
		assert.ok(component.includes(`lean_object *lb_t${key}_reply_reject(lean_object *reply) {\n  lean_dec(reply);\n  lb_reply_rejected = 1;\n  return lb_t${key}_reply_fallback(lean_box(0));\n}\n`), name);
		// The fallback is a Lean definition over source constructors, exported beside its prototype.
		const fallback = lean.indexOf(`@[export lb_t${key}_reply_fallback]\ndef reply_fallback_${key} (_unit : _root_.Unit) : `);
		assert.ok(fallback >= 0 && fallback < reject, name);
		assert.ok(generateNativeLeanAdapters(model).header.includes(`lean_object * lb_t${key}_reply_fallback(lean_object * unit);`), name);
		assert.doesNotMatch(lean.slice(fallback, lean.indexOf("\n\n", fallback)), /LbErased/u, name);
		assert.ok(component.includes(`int ${nativeReplyRejectedSymbol(model)}(void) { int value = lb_reply_rejected; lb_reply_rejected = 0; return value; }`), name);
	}
	for(const [name, type] of Object.entries(replyShapes().refused))
		assert.throws(() => replyModel({ [name]: type }), /a host callback result needs a Fin-free failure value/u, name);
});

test("checked host replies keep distinct identities in either declaration order", () => {
	const { maybe } = replyShapes().admitted, five = maybe, three = { ...maybe, element: finCallbackBound("3") };
	const plain = { ...maybe, element: finCallbackNat };
	const keys = order => {
		const model = replyModel(Object.fromEntries(order.map(([name, type]) => [name, type])));
		return Object.fromEntries(model.exports.map(item => [item.name, nativeTypeKey(item.parameters[0].type)]));
	};
	const forward = keys([["a", three], ["b", five], ["c", plain]]), reverse = keys([["a", plain], ["b", five], ["c", three]]);
	assert.equal(new Set(Object.values(forward)).size, 3);
	assert.deepEqual([forward["Sample.a"], forward["Sample.b"], forward["Sample.c"]], [reverse["Sample.c"], reverse["Sample.b"], reverse["Sample.a"]]);
	// The unchecked callback with the same representation keeps no reply and no reject.
	const model = replyModel({ a: three, b: five, c: plain }), lean = generateNativeLeanAdapters(model).leanSource;
	const unchecked = model.types.find(type => type.kind === "callback" && nativeTypeKey(type) === forward["Sample.c"]);
	assert.equal(unchecked.reply, undefined);
	assert.ok(!lean.includes(`reply_reject_${unchecked.key}`));
	// Each checked trampoline compares its own bound.
	const source = generateNativeCallables(model, replySurface(model)).source;
	assert.match(section(source, `lb_invoke_${forward["Sample.a"]}(`), /"callback result is not below its Fin 3 bound"/u);
	assert.match(section(source, `lb_invoke_${forward["Sample.b"]}(`), /"callback result is not below its Fin 5 bound"/u);
	assert.doesNotMatch(section(source, `lb_invoke_${forward["Sample.c"]}(`), /lb_fin_below/u);
});

test("checked host replies never assign a public closure slot twice, in either declaration order and beside a returned closure", () => {
	const { maybe } = replyShapes().admitted, three = { ...maybe, element: finCallbackBound("3") }, plain = { ...maybe, element: finCallbackNat };
	const slots = signatures => {
		const model = finCallbackCompilerModel(signatures), surface = replySurface(model), { vtable } = generateNativeCallables(model, surface);
		const calls = [...vtable.matchAll(/\.(callback[0-9a-f]+)_call = lb_owned_([0-9a-f]+), \.\1_dispose = lb_dispose_\2,/gu)].map(([, slot, key]) => [slot, key]);
		// Every public closure type has exactly one call and one dispose assignment, together.
		assert.equal(calls.length, surface.callbacks.size);
		assert.equal(new Set(calls.map(([slot]) => slot)).size, calls.length);
		assert.equal((vtable.match(/_call = /gu) ?? []).length, calls.length);
		const key = name => nativeTypeKey(model.exports.find(item => item.name === `Sample.${name}`).parameters[0].type);
		return { calls: Object.fromEntries(calls), key, model, surface };
	};
	const host = type => [finCallback([finCallbackNat], type), finCallbackNat];
	// Beside an unchecked callback of the same representation, that callback keeps every borrowed-only slot.
	for(const order of [["a", "b", "c"], ["c", "b", "a"]])
	{
		const { calls, key } = slots({ [order[0]]: host(three), [order[1]]: host(maybe), [order[2]]: host(plain) });
		assert.deepEqual(new Set(Object.values(calls)), new Set([key(order[2])]), order.join(""));
	}
	// With only checked replies, the first reply type by key fills each slot once, whatever the order.
	const first = [slots({ a: host(three), b: host(maybe) }), slots({ a: host(maybe), b: host(three) })];
	const owner = first.map(({ key }) => [key("a"), key("b")].sort()[0]);
	assert.equal(owner[0], owner[1]);
	for(const [index, { calls }] of first.entries()) assert.deepEqual(new Set(Object.values(calls)), new Set([owner[index]]));
	// A returned closure of the same representation is leased by exactly its own native type.
	const { calls, model, surface } = slots({ a: host(three), b: host(maybe), lease: [finCallbackNat, finCallback([finCallbackNat], plain)] });
	const leasedType = model.exports.find(item => item.name === "Sample.lease").result, leasedId = surface.functions.find(fn => fn.declaration.id === "lean:Sample.lease").declaration.result.type.id;
	assert.equal(calls[surface.callbacks.get(leasedId).field], nativeTypeKey(leasedType));
});

test("the C reply walk and Lean's reconstruction are independent, and packages without replies keep their sources", () => {
	const model = replyModel({ maybe: replyShapes().admitted.maybe }), host = model.exports[0].parameters[0].type, key = nativeTypeKey(host);
	const source = generateNativeCallables(model, replySurface(model)).source;
	assert.ok(source.includes(`static const uint32_t lb_fin_reply_${key}_0[1] = {0x5u};`));
	// Weakening the bound changes the compared constant and the identity, so a pinned constant detects it.
	const weakened = replyModel({ maybe: { ...replyShapes().admitted.maybe, element: finCallbackBound("6") } });
	const loose = nativeTypeKey(weakened.exports[0].parameters[0].type), looseSource = generateNativeCallables(weakened, replySurface(weakened)).source;
	assert.notEqual(loose, key);
	assert.ok(looseSource.includes(`static const uint32_t lb_fin_reply_${loose}_0[1] = {0x6u};`) && !looseSource.includes("= {0x5u};"));
	// Without the C walk the Lean reconstruction still refuses through its decidable check.
	const unwalked = structuredClone(model);
	for(const type of [...unwalked.types, ...unwalked.exports.flatMap(item => item.parameters.map(parameter => parameter.type))]) delete type.reply;
	for(const type of unwalked.types) type.key = nativeTypeKey(type);
	assert.doesNotMatch(generateNativeCallables(unwalked, replySurface(unwalked)).source, /lb_fin_reply_|_reply_take_rejected/u);
	assert.match(generateNativeLeanAdapters(model).leanSource, /if proof : .* < 5 then .* \| \.none => reply_reject_/u);
	// Packages without checked replies emit no reply walk, flag or reject.
	const fixture = finCallbackCompilerModel();
	assert.doesNotMatch(generateNativeCallables(fixture, replySurface(fixture)).source, /lb_fin_reply_|_reply_take_rejected|Lean rejected a host callback result/u);
	assert.doesNotMatch(generateCompiledCallbacks(fixture), /reply_reject|lb_reply_rejected/u);
	assert.doesNotMatch(generateNativeLeanAdapters(fixture).leanSource, /reply_reject_|_bridgeReply/u);
	// The README describes checked replies only where a package has them.
	for(const target of ["c", "cpp"])
	{
		const guide = nativeCallbackFinGuide(model, target);
		assert.match(guide, /A host callback's result is compared with its Fin bounds before Lean uses it\./u);
		assert.match(guide, /a record, product, ok branch or first case qualifies when its own stand-in holds no Fin, for example a field holding an option of Fin\./u);
		assert.doesNotMatch(guide, /return no Fin bounds|rolled back|no Lean code runs/u);
	}
});

const lean = process.env.LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const fixture = "tests/fixtures/onboarding/native-fin-callbacks";
const leasedArities = Object.fromEntries(["branch", "counter", "digits", "impossible", "maybeTiles", "pick", "scaler", "shaped", "tileMaker", "tiles", "wide"].map(name => [`FinCallbacks.${name}`, 1]));
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
	const exports = [...Object.keys(leasedArities), "FinCallbacks.visit", "FinCallbacks.visitShapes", "FinCallbacks.visitTiles"].sort();
	const { model } = await elaborate(t, { exports, arities: leasedArities });
	const trees = Object.fromEntries(model.exports.map(item => [item.name.replace("FinCallbacks.", "Sample."), item.refinements]));
	assert.deepEqual(trees, expectedTrees);
	assert.deepEqual(model.exports.filter(item => item.result.checked).map(item => item.name).sort(), ["branch", "digits", "impossible", "maybeTiles", "pick", "scaler", "shaped", "tiles", "wide"].map(name => `FinCallbacks.${name}`));
});

test("fresh Lean refuses a host callback's result without a Fin-free failure value and admits one with it", { skip: !lean, timeout: 900_000 }, async t => {
	const refused = [["reply", "def reply (host : Nat → Fin 5) : Nat := (host 0).val"]
		, ["replyTile", "structure Tile where\n  digit : Fin 5\n  count : Nat\ndef replyTile (host : Nat → Tile) : Nat := (host 0).count"]
		, ["replyOk", "def replyOk (host : Nat → Except String (Fin 5)) : Nat := match host 0 with | .ok value => value.val | .error _ => 0"]];
	for(const [name, definition] of refused)
	{
		const source = `namespace FinCallbacks\n${definition}\nend FinCallbacks\n`;
		await assert.rejects(() => elaborate(t, { exports: [`FinCallbacks.${name}`] }, source)
			, error => /a host callback result needs a Fin-free failure value: scalar Fin, a Fin in its selected default, Subtype and checked records are refused/u.test(JSON.stringify(error.details ?? error.message)), name);
	}
	// The ok branch's empty array stands in for a refused reply, so extraction and the model admit it.
	const source = "namespace FinCallbacks\ndef replies (host : Nat → Except String (Array (Fin 5))) : Nat := match host 0 with | .ok values => values.size | .error _ => 0\nend FinCallbacks\n";
	const { model } = await elaborate(t, { exports: ["FinCallbacks.replies"] }, source);
	assert.deepEqual(model.exports[0].parameters[0].type.reply, { kind: "result", arguments: [{ kind: "array", arguments: [{ kind: "fin", bound: "5" }] }, null] });
});

// Every admitted reply family is in the FinReplies fixture, including the composite families whose
// stand-in holds no Fin.

test("fresh Lean admits every checked host reply family and compiles each typed reconstruction", { skip: !lean, timeout: 1_800_000 }, async t => {
	const fixtureSource = await readFile("tests/fixtures/onboarding/native-fin-replies/FinReplies.lean", "utf8");
	const body = fixtureSource.replace("namespace FinReplies\n", "").replace("end FinReplies\n", "");
	const source = `namespace FinCallbacks\n${body}end FinCallbacks\n`;
	const names = ["aliased", "digits", "empty0", "failure", "late", "listed", "maybe", "maybeTile", "nested", "none0", "plain", "product", "slotted", "success", "twice", "wide"];
	const { model, adapters } = await elaborate(t, { exports: names.map(name => `FinCallbacks.${name}`) }, source);
	const reply = name => model.exports.find(item => item.name === `FinCallbacks.${name}`).parameters[0].type.reply;
	const fin = bound => ({ kind: "fin", bound });
	assert.deepEqual(reply("maybe"), { kind: "option", arguments: [fin("5")] });
	assert.deepEqual(reply("aliased"), { kind: "option", arguments: [fin("5")] });
	assert.deepEqual(reply("empty0"), { kind: "list", arguments: [fin("0")] });
	assert.deepEqual(reply("listed"), { kind: "list", arguments: [fin("3")] });
	assert.deepEqual(reply("none0"), { kind: "option", arguments: [fin("0")] });
	assert.deepEqual(reply("wide"), { kind: "option", arguments: [fin("184467440737095516170")] });
	assert.deepEqual(reply("failure"), { kind: "result", arguments: [null, fin("7")] });
	assert.deepEqual(reply("success"), { kind: "result", arguments: [{ kind: "array", arguments: [fin("3")] }, null] });
	assert.deepEqual(reply("product"), { kind: "tuple", arguments: [{ kind: "option", arguments: [fin("5")] }, null] });
	for(const name of ["digits", "late", "maybeTile", "nested", "slotted"]) assert.ok(reply(name), name);
	assert.equal(model.exports.find(item => item.name === "FinCallbacks.plain").refinements, undefined);
	// The compiler-shaped model behind the header controls declares every reply as extraction does, so a
	// fictitious nominal alias cannot pass those controls.
	const synthetic = finReplyCompilerModel("FinCallbacks").bindingIr;
	for(const name of names.filter(item => item !== "plain"))
		assert.deepEqual(finReplyHostShape(model.bindingIr, name), finReplyHostShape(synthetic, name), name);
	assert.deepEqual(finReplyHostShape(model.bindingIr, "aliased"), finReplyOptionDigit);
	// The compiled adapter rebuilds each reply through its decidable check and the source-typed fallback.
	for(const name of names.filter(item => item !== "plain"))
		assert.match(adapters.leanSource, new RegExp(`reply_reject_${nativeTypeKey(model.exports.find(item => item.name === `FinCallbacks.${name}`).parameters[0].type)} _bridgeReply`, "u"), name);
	// Families whose selected stand-in needs a Fin stay refused after fresh extraction.
	const refused = [["pairDigit", "def pairDigit (host : Nat → Fin 5 × Nat) : Nat := (host 0).2"]
		, ["firstCase", "inductive Early where\n  | digit (value : Fin 5)\n  | label (text : String)\ndef firstCase (host : Nat → Early) : Nat := match host 0 with | .digit d => d.val | .label _ => 0"]
		, ["aliasedScalar", "abbrev Digit := Fin 5\ndef aliasedScalar (host : Nat → Digit) : Nat := (host 0).val"]
		, ["zero", "def zero (host : Nat → Fin 0) : Nat := (host 0).elim0"]];
	for(const [name, definition] of refused)
		await assert.rejects(() => elaborate(t, { exports: [`FinCallbacks.${name}`] }, `namespace FinCallbacks\n${definition}\nend FinCallbacks\n`)
			, error => /a host callback result needs a Fin-free failure value/u.test(JSON.stringify(error.details ?? error.message)), name);
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
