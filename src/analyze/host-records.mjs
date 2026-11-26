/** @file Admit compiler-inspected records containing actual application-hosted objects. */
import {canonicalJson, sha256} from "../capsule/node.mjs";
import {canonicalizeJsonValue, hashBindingIr, parseBindingIr} from "../binding-ir/canonical.mjs";
import {validateOwnedAggregateBindingIr} from "../binding-ir/contract.mjs";

const qualified = s => typeof s === "string" && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u.test(s);
const doc = summary => ({summary, details: ""});
const snake = s => s.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const invalid = message => { throw new TypeError("Invalid application host record: " + message); };
export const hostRecordPolicy = Object.freeze({ownership: "lease", disposal: "required", fallback: "none", cycles: "reject"});

/**
 * V4 is used only for a host API whose compiled record contains leased fields.
 * It does not change the schema accepted by the ordinary V3 reader.
 *
 * @param document - Public compiler-derived interface or validated review.
 */
export const hostPublicHash = document => document.schemaVersion === 4
	? sha256(canonicalizeJsonValue(validateOwnedAggregateBindingIr(document))) : hashBindingIr(document);

/**
 * Open a reviewed compound host API only when the target supports it.
 *
 * @param source - Original reviewed bytes as text.
 * @param allowRecords - Whether this producer implements leased record fields.
 */
export const parseHostPublic = (source, allowRecords) => {
	if(allowRecords)
	{
		const value = JSON.parse(source);
		if(value.schemaVersion === 4) return validateOwnedAggregateBindingIr(value);
	}
	return parseBindingIr(source);
};

/**
 * Extract the V4 public definitions from private compiler observations.
 * Fields are not reconstructed from the review under any circumstances.
 *
 * @param rows - Inspected Lean entries.
 * @param selection - Actual chosen host, source modules and effect profile.
 * @param imports - Declared host resources from the independent import contract.
 */
export const hostRecordTypes = (rows, selection, imports) => {
	const records = new Map(), names = new Set(imports.map(t => t.name));
	for(const e of rows) for(const t of [e.result, ...e.parameters.map(p => p.type)])
	{
		if(t?.kind !== "host-record") continue;
		const supported = ["LeanBridge.Host.Python", "LeanBridge.Host.Ruby", "LeanBridge.Host.Dotnet", "LeanBridge.Host.Jvm", "LeanBridge.Host.C", "LeanBridge.Host.Cpp"].includes(selection.hostModule)
			|| selection.hostModule === "LeanBridge.Host.Php" && selection.phpNativeFunctions === true
				&& selection.phpWasmSyncObjects === undefined && selection.phpWasmTaskObjects === undefined;
		if(!supported || selection.nativeEffectPolicy !== "native-host-io-v1"
			|| !selection.exportModules.includes(e.module) || !selection.exportModules.includes(t.module) || e.effect !== "IO" || e.delivery
			|| selection.taskExports?.length || selection.iterators?.length || selection.asyncIterators?.length)
			invalid("not a synchronous host-bound export");
		if(!qualified(t.declaration) || !qualified(t.constructor) || !t.constructor.startsWith(t.declaration + ".")
			|| !Array.isArray(t.fields) || !t.fields.length) invalid("constructor or fields");
		const name = t.declaration.split(".").at(-1), id = "lean:" + t.declaration;
		const fields = t.fields.map(f => {
			if(!qualified(f.name) || f.name.includes(".") || f.projection !== t.declaration + "." + f.name
				|| !(f.type?.kind === "primitive" || f.type?.kind === "named" && imports.some(h => h.id === f.type.id))) invalid("unverified field " + f.name);
			return {name: snake(f.name), type: f.type, mutability: "immutable", documentation: doc("Field " + f.projection + ".")};
		});
		if(!fields.some(f => f.type.kind === "named") || new Set(fields.map(f => f.name)).size !== fields.length) invalid("field identities");
		const previous = records.get(id);
		if(previous && canonicalJson(previous.raw) !== canonicalJson(t)) invalid("inconsistent definitions of " + t.declaration);
		if(previous) continue;
		if(names.has(name)) invalid("ambiguous public name " + name);
		names.add(name);
		const definition = {id, name, kind: "record"
			, representation: "owned", mutability: "immutable", fields
			, aggregate: hostRecordPolicy
			, typeParameters: []
			, cases: []
			, assurance: []
			, target: null
			, callable: null
			, host: null
			, resource: null
			, source: {producer: "lean", declaration: t.declaration, extensions: {"lean-bridge.dev/record-constructor": t.constructor}}
			, documentation: doc("A closable record holding the original host objects.")};
		records.set(id, {definition, raw: t});
	}
	return [...records.values()].map(r => r.definition);
};
