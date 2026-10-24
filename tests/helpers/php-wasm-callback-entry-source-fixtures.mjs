/**
 * Reversible authored source and closure-body markers for callback entry probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { validatePhpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-c.mjs";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";

export const phpWasmCallbackEntryFamilies = Object.freeze([
	"callback-fin", "callback-checked-record"
]);
export const phpWasmCallbackEntryRoutes = Object.freeze(["ordinary", "reviewed"]);

const definitions = Object.freeze({
	"callback-fin": Object.freeze({
		path: "tests/fixtures/onboarding/reviewed-callback-fin/ReviewedCallbacks.lean"
		, namespace: "ReviewedCallbacks", prefix: "lb_callback_fin_probe"
		, constructors: Object.freeze([])
		, sources: Object.freeze(["scaler", "counter", "visit", "three"])
		, closures: Object.freeze([
			Object.freeze({
				name: "scaler", body: "scalerProbeBody"
				, previous: "def scaler (factor : Nat) : Fin 10 → Nat := fun digit => digit.val * factor"
				, current: `@[noinline, export lb_callback_fin_closure_scaler]
def scalerProbeBody (factor : Nat) (digit : Fin 10) : Nat := digit.val * factor

def scaler (factor : Nat) : Fin 10 → Nat := scalerProbeBody factor`
			})
			, Object.freeze({
				name: "counter", body: "counterProbeBody"
				, previous: "def counter (start : Nat) : Nat → Fin 10 := fun step => ⟨(start + step) % 10, Nat.mod_lt _ (by decide)⟩"
				, current: `@[noinline, export lb_callback_fin_closure_counter]
def counterProbeBody (start step : Nat) : Fin 10 :=
  ⟨(start + step) % 10, Nat.mod_lt _ (by decide)⟩

def counter (start : Nat) : Nat → Fin 10 := counterProbeBody start`
			})
		])
	})
	, "callback-checked-record": Object.freeze({
		path: "tests/fixtures/onboarding/callback-checked-records/CallbackCheckedRecords.lean"
		, namespace: "CallbackCheckedRecords", prefix: "lb_callback_record_probe"
		, constructors: Object.freeze(["mkInterval", "checkedPositive", "mkWeighted"])
		, sources: Object.freeze([
			"callHost", "callHostMixed", "callHostNested"
			, "makeClosure", "makeMixedClosure", "makeNestedClosure"
		])
		, closures: Object.freeze([
			Object.freeze({
				name: "makeClosure", body: "makeClosureProbeBody"
				, previous: `def makeClosure (_seed : Nat) : Interval → Nat :=
  fun value => value.hi - value.lo`
				, current: `@[noinline, export lb_callback_record_closure_makeClosure]
def makeClosureProbeBody (value : Interval) : Nat := value.hi - value.lo

def makeClosure (_seed : Nat) : Interval → Nat := makeClosureProbeBody`
			})
			, Object.freeze({
				name: "makeMixedClosure", body: "makeMixedClosureProbeBody"
				, previous: `def makeMixedClosure (_seed : Nat) : Nat → Interval → Interval :=
  fun _marker value => value`
				, current: `@[noinline, export lb_callback_record_closure_makeMixedClosure]
def makeMixedClosureProbeBody (_marker : Nat) (value : Interval) : Interval := value

def makeMixedClosure (_seed : Nat) : Nat → Interval → Interval := makeMixedClosureProbeBody`
			})
			, Object.freeze({
				name: "makeNestedClosure", body: "makeNestedClosureProbeBody"
				, previous: `def makeNestedClosure (_seed : Nat) : Weighted → Nat :=
  fun value => value.limit - value.weight.val`
				, current: `@[noinline, export lb_callback_record_closure_makeNestedClosure]
def makeNestedClosureProbeBody (value : Weighted) : Nat := value.limit - value.weight.val

def makeNestedClosure (_seed : Nat) : Weighted → Nat := makeNestedClosureProbeBody`
			})
		])
	})
});

const replaceOnce = (source, previous, current, label) => {
	assert.equal(source.split(previous).length, 2, `one authored closure definition: ${label}`);
	const offset = source.indexOf(previous);
	return { source: source.slice(0, offset) + current + source.slice(offset + previous.length)
		, edit: { offset, previous, current } };
};

/**
 * Return immutable source selection metadata for one callback family.
 *
 * @param family - Fin or checked-record callback family.
 */
export const phpWasmCallbackEntrySourceDefinition = family => {
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	return structuredClone(definitions[family]);
};

/**
 * Mark source declarations and give selected closure bodies their own exact C entry.
 *
 * @param family - Fin or checked-record callback family.
 * @param originalSource - Optional immutable source bytes from a producer revision.
 */
export const phpWasmCallbackEntrySourceFixture = async (family, originalSource = null) => {
	const definition = phpWasmCallbackEntrySourceDefinition(family);
	const original = originalSource === null
		? await readFile(definition.path, "utf8") : originalSource.toString();
	assert.equal(typeof original, "string");
	let transformed = original;
	const closureEdits = [];
	for(const closure of definition.closures)
	{
		const replaced = replaceOnce(transformed, closure.previous, closure.current, closure.name);
		transformed = replaced.source; closureEdits.push(replaced.edit);
	}
	const marked = phpWasmRefinementEntrySource(transformed, definition);
	const closureEntries = definition.closures.map(closure => ({
		symbol: `${definition.prefix.replace(/_probe$/u, "")}_closure_${closure.name}`
		, kind: "closure", label: `${definition.namespace}.${closure.name}:body`
	}));
	const entries = [...marked.entries, ...closureEntries];
	const entryForms = { ...marked.entryForms };
	for(const item of closureEntries) entryForms[item.symbol] = "function";
	assert.deepEqual(Object.keys(entryForms).sort()
		, entries.map(item => item.symbol).sort());
	validatePhpWasmCallbackEntrySelection(entries);
	const value = { family, path: definition.path, source: marked.source
		, entries, entryForms
		, sourceEdits: marked.edits, closureEdits
		, originalSha256: sha256(original), probeSha256: sha256(marked.source) };
	assert.equal(restorePhpWasmCallbackEntrySource(value), original);
	return value;
};

/**
 * Reverse source annotations and closure-body extraction exactly.
 *
 * @param fixture - Complete callback source probe record.
 */
export const restorePhpWasmCallbackEntrySource = fixture => {
	assert.equal(sha256(fixture.source), fixture.probeSha256);
	let source = fixture.source;
	for(const edit of [...fixture.sourceEdits].reverse())
	{
		assert.equal(source.slice(edit.offset, edit.offset + edit.current.length), edit.current);
		source = source.slice(0, edit.offset) + edit.previous
			+ source.slice(edit.offset + edit.current.length);
	}
	for(const edit of [...fixture.closureEdits].reverse())
	{
		assert.equal(source.slice(edit.offset, edit.offset + edit.current.length), edit.current);
		source = source.slice(0, edit.offset) + edit.previous
			+ source.slice(edit.offset + edit.current.length);
	}
	assert.equal(sha256(source), fixture.originalSha256);
	return source;
};

/**
 * Require explicit producer selection for the closed hosted callback matrix.
 *
 * @param environment - Explicit hosted-test environment selection.
 */
export const phpWasmCallbackEntryHostedSelection = environment => {
	const prefix = "LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag));
	const choose = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined) assert.equal(flag, "1", `Explicit callback entry ${name} requires TEST=1`);
		const values = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(values.length && values.every(value => allowed.includes(value)));
		assert.equal(new Set(values).size, values.length);
		return values;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1", "Explicit callback entry OUTPUT requires TEST=1");
	return { enabled: flag === "1"
		, families: choose("FAMILIES", phpWasmCallbackEntryFamilies)
		, routes: choose("ROUTES", phpWasmCallbackEntryRoutes) };
};
