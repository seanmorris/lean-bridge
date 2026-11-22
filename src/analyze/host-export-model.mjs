/**
 * Reconcile application-owned IO exports with independently declared host imports.
 *
 * @file
 */
import { canonicalJson } from "../capsule/node.mjs";
import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { hostDeclarationName } from "../backends/lean/host-object.mjs";

const doc = summary => ({ summary, details: "" });
const hostModule = "LeanBridge.Host.Python";
const fail = message => { throw Object.assign(new TypeError(message), { code: "host-export-contract-mismatch" }); };
const resources = ir => ir?.types.filter(t => t.kind === "resource" && t.host?.targets.includes("python")) ?? [];
const importedMembers = (ir, types) => new Map(types.flatMap(t =>
	ir.declarations.filter(d => d.owner === t.id).map(d => [`${hostModule}.${t.name}.${hostDeclarationName(d)}`, d])));
const snake = value => value.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const signature = type => type.kind !== "named"
	? { type, ownership: "copy", lifetime: null }
	: { type, ownership: "lease", lifetime: { scope: "explicit", anchor: null } };

/**
 * Select only generated foreign names and concrete nominal identities.
 *
 * @param ir - Validated import contract.
 */
export const pythonHostSelection = ir => {
	const types = resources(ir);
	return {
		resources: types.map(t => ({ lean: `${hostModule}.${t.name}`, id: t.id }))
		, members: [...importedMembers(ir, types).keys()].sort()
	};
};

/**
 * Generate the public application Binding IR from actual checked signatures.
 * Reviewed prose may vary; identities, shapes, effects and lifetime claims may not.
 *
 * @param options - Application identity, imported resource contract, compiler metadata and optional reviewed exports.
 */
export const reconcileHostExports = options => {
	const { component, ir, metadata, selection, review } = options;
	if(metadata?.kind !== "lean-bridge-host-export-metadata" || metadata.schemaVersion !== 1
		|| canonicalJson(metadata.entries.map(e => e.declaration)) !== canonicalJson(selection.exports)) fail("Fresh Lean metadata did not cover the complete export selection");
	const imports = ir ? hashBindingIr(ir) : null, types = resources(ir), members = importedMembers(ir, types);
	const errors = [];
	if(metadata.entries.some(e => e.effect === "IO")) errors.push({ id: "error:IO.Error"
		, name: "IOError"
		, category: "domain"
		, payload: null
		, documentation: doc("A synchronous Lean IO failure.") });
	const hostError = "error:PythonHostException";
	if(metadata.entries.some(e => e.effect === "IO" && e.hostMembers.length)) errors.push({ id: hostError
		, name: "PythonHostException"
		, category: "domain"
		, payload: null
		, documentation: doc("The bound Python object raised an exception that escaped the Lean call.") });
	const errorIds = e => e.effect === "EIO" ? [`error:EIO.${e.declaration}`] : ["pure", "BaseIO"].includes(e.effect) ? []
		: ["error:IO.Error", ...(e.hostMembers.length ? [hostError] : [])];
	const entries = metadata.entries.map(e => {
		const task = e.delivery === "task";
		if(!["IO", "EIO", "pure", ...(task ? ["BaseIO"] : [])].includes(e.effect) || !selection.exportModules.includes(e.module)
			|| Boolean(selection.taskExports?.includes(e.declaration)) !== task || (task && e.hostMembers.length)
			|| (!task && e.effect === "pure" && (e.result?.constructor !== "result" || e.hostMembers.length))
			|| e.hostMembers.some(n => !selection.members.includes(n))) fail(`Unauthenticated effect or host member for ${e.declaration}`);
		if(e.effect === "EIO") errors.push({
			id: errorIds(e)[0], name: `EIO_${e.declaration.replaceAll(".", "_")}`
			, category: "domain", payload: e.error
			, documentation: doc(`Typed synchronous failure of ${e.declaration}.`)
		});
		return { name: snake(e.declaration.split(".").at(-1))
			, declaration: e.declaration
			, effect: e.effect
			, ...(task ? { delivery: "task" } : {})
			, ...(e.effect === "EIO" ? { error: e.error } : {})
			, parameters: e.parameters.map(p => ({ name: snake(p.name), type: p.type }))
			, result: e.result };
	});
	const api = {
		schemaVersion: 3, component
		, producers: [{ id: "lean", adapter: "lean-bridge-host-exports", adapterVersion: 1, tool: "Lean", toolVersion: metadata.leanVersion, extensions: {} }]
		, types: types.map(t => ({ ...t, assurance: []
			, host: { ...t.host, targets: ["python"] }
			, source: { producer: "lean", declaration: `${hostModule}.${t.name}`, extensions: {} } }))
		, declarations: metadata.entries.map((e, i) => ({
			id: `lean:${e.declaration}`, name: entries[i].name, kind: "function"
			, owner: null, overloadKey: e.declaration, typeParameters: [], receiver: null
			, parameters: e.parameters.map((p, j) => ({ ...signature(p.type), name: entries[i].parameters[j].name
				, mutability: p.type.kind === "named" ? types.find(t => t.id === p.type.id).mutability : "immutable"
				, optional: false, default: null }))
			, result: signature(e.result), mutability: "immutable"
			, effects: [...new Set([...(e.delivery === "task" ? ["async"] : []), ...(e.effect === "pure" ? [] : ["nondeterministic"]), ...(errorIds(e).length ? ["fails"] : []), ...e.hostMembers.flatMap(n => members.get(n).effects)])].sort()
			, failure: { mode: errorIds(e).length ? "declared" : "none", errors: errorIds(e), unexpected: "poison-runtime" }
			, resultMode: e.delivery === "task" ? "promise" : "value"
			, capabilities: [], assurance: []
			, documentation: doc(e.delivery === "task" ? `Await the Lean task returned by ${e.declaration}.` : `${e.effect === "pure" ? "Pure" : `Synchronous ${e.effect}`} entry ${e.declaration}.`)
			, source: { producer: "lean", declaration: e.declaration
				, extensions: {
					"lean-lang.org/effect": e.effect
					, ...(e.delivery === "task" ? { "lean-lang.org/delivery": "Task" } : {})
					, ...(imports ? { "lean-bridge.dev/host-imports-sha256": imports } : {})
					, "lean-bridge.dev/host-members": e.hostMembers
				}
			}
		}))
		, errors, capabilities: [], assurance: []
		, documentation: doc(`Compiled ${ir ? "host-object" : "task"} API for ${component.name}.`)
	};
	validateBindingIr(api);
	if(review)
	{
		const reviewed = parseBindingIr(review.source);
		const ignoreProse = item => ({ ...item, documentation: doc("Public API.") });
		const identity = value => hashBindingIr({ ...ignoreProse(value), types: value.types.map(ignoreProse)
			, declarations: value.declarations.map(ignoreProse)
			, errors: value.errors.map(ignoreProse) });
		if(identity(api) !== identity(reviewed)) fail("Reviewed API differs from compiled host exports, effects, ownership, or import identity");
		return { entries, api: reviewed };
	}
	return { entries, api };
};
