/**
 * Prepared WIT package coordinates and ownership guidance for copied graphs.
 *
 * @file
 */
import { compileCopiedWitGraphModel } from "./copied-graph-model.mjs";
import { renderWitGraphHostHeader } from "./copied-graph-host.mjs";

/**
 * Name copied containers in public fields, arguments and results.
 *
 * @param model - Checked graph layout and its public call roots.
 * @param options - Additional callable helper names that aliases cannot replace.
 * @param options.reservedNames - Reserved C identifiers.
 */
export const copiedWitGraphAliases = (model, { reservedNames = [] } = {}) => {
	const nodes = new Map(model.nodes.map(node => [node.id, node]));
	const occupied = new Map(), aliases = new Map();
	const claim = (name, id) => {
		if(occupied.has(name) && occupied.get(name) !== id) throw new TypeError(`WIT graph C name collision: ${name}`);
		occupied.set(name, id);
	};
	for(const name of reservedNames) claim(name, "function");
	for(const node of model.nodes.filter(node => node.aggregate))
		for(const name of [node.name, `${node.name}_init`, `${node.name}_clear`, ...node.kind === "variant" ? [`${node.name}_tag`, ...node.cases.map(branch => branch.tag)] : []]) claim(name, node.id);
	for(const alias of model.layout.aliases)
		for(const name of [alias.name, `${alias.name}_init`, `${alias.name}_clear`]) claim(name, alias.target);
	for(const root of model.layout.roots) claim(`${model.layout.prefix}_wasmtime_value_${root.name.slice(model.layout.prefix.length + 1)}`, "function");
	const expose = (name, id) => {
		if(aliases.get(name) === id) return;
		claim(name, id); claim(`${name}_init`, id); claim(`${name}_clear`, id);
		aliases.set(name, id);
		const node = nodes.get(id), base = name.slice(0, -2);
		for(const field of node.fields) if(nodes.get(field.type).ref.kind === "apply") expose(`${base}_${field.name}_t`, field.type);
		if(node.element && nodes.get(node.element).ref.kind === "apply") expose(`${base}_element_t`, node.element);
	};
	for(const alias of model.layout.aliases) if(nodes.get(alias.target).ref.kind === "apply") expose(alias.name, alias.target);
	for(const node of model.nodes.filter(node => node.ref.kind === "named"))
	{
		for(const field of node.fields) if(nodes.get(field.type).ref.kind === "apply") expose(`${node.name.slice(0, -2)}_${field.name}_t`, field.type);
		for(const branch of node.cases) for(const field of branch.fields)
			if(nodes.get(field.type).ref.kind === "apply") expose(`${node.name.slice(0, -2)}_${branch.name}_${field.name}_t`, field.type);
	}
	for(const root of model.layout.roots)
		for(const [site, id] of [...root.parameters.map((id, index) => [`argument${index}`, id]), ["result", root.result]])
			if(nodes.get(id).ref.kind === "apply") expose(`${root.name}_${site}_t`, id);
	return [...aliases].filter(([name]) => !model.layout.aliases.some(alias => alias.name === name))
		.map(([name, id]) => ({ name, type: nodes.get(id).name }));
};

/**
 * Validate a graph projection using the shared native carrier's exact layout.
 *
 * @param ir - Original compiler-checked Binding IR.
 * @param settings - Optional WIT name and version.
 */
export const compileCopiedWitGraphPackageModel = (ir, settings) => {
	const model = compileCopiedWitGraphModel(ir, settings);
	const aliases = copiedWitGraphAliases(model);
	const guard = `${model.layout.prefix.toUpperCase()}_WASMTIME_GRAPH_PACKAGE_H`;
	const hostHeader = `#ifndef ${guard}\n#define ${guard}\n` + renderWitGraphHostHeader(model) + `
/* Stable names for containers in public arguments, results and fields. */
${aliases.map(alias => `typedef ${alias.type} ${alias.name};
static inline void ${alias.name}_init(${alias.name} *value) { ${alias.type}_init(value); }
static inline void ${alias.name}_clear(${alias.name} *value) { ${alias.type}_clear(value); }`).join("\n")}
#endif /* ${guard} */
`;
	const manifest = { ...model.manifest, cHost: { header: `${model.layout.prefix}_wasmtime.h`, aliases } };
	return { ...model, manifest, hostHeader, prefix: model.layout.prefix, layoutSha256: model.manifest.graph.layoutSha256 };
};

/**
 * Describe the actual installed graph helpers and the separately named wire API.
 *
 * @param model - Validated graph package model.
 * @param glibc - Minimum consumer glibc version.
 */
export const witGraphPackageReadme = (model, glibc) => {
	const { name, version, prefix: p } = model;
	return `# ${name} ${version}

Compiled Lean recursive values for Linux x86-64, glibc ${glibc} or newer. This archive includes Wasmtime 42.0.1, the Component Model binary, generated headers and the shared native Lean runtime. Consumers do not install Lean. Keep include/ and lib/ together.

## Call the installed package

Compile your C application with pkg-config ${name}-wit and include ${p}_wasmtime.h. Open a session with ${p}_wasmtime_open. The typed ${p}_wasmtime_value_* functions accept the generated graph types and cross the compiled Component Model component before calling Lean. Native string lengths count UTF-8 bytes, including embedded NUL. Sequences retain order and duplicates. Option, result and variant tags remain explicit, including nested options and present Unit. Aliases retain their Lean identity in binding-manifest.json.

Arguments borrow caller-owned graphs for the duration of the call. Initialize each output with {0}. Results own independent storage and remain valid after the session closes. Call the generated type's _clear function exactly once on each owned result; clearing an already cleared value is harmless. Do not copy an owned result and then clear both copies. Errors leave outputs unchanged. Delete errors with wasmtime_error_delete. Close the session with ${p}_wasmtime_close. Do not call the same session concurrently. Separate sessions and packages share the Lean runtime automatically. The graph host and native libraries remain mapped so that owned results can be cleared after a consumer closes its library handle.

## Component Model API

component/${name}.wasm imports native Lean functions through ${p}_wasmtime_link. It requires the supplied host and is not a standalone WASI command. The session helper embeds the same component bytes. ${p}_wasmtime_call accepts Wasmtime values by WIT export name; delete its owned results with wasmtime_component_val_delete.

WIT cannot declare recursive types directly. Each copied wire value contains a typed root reference and finite, typed node tables. The typed C helpers build and read those tables for you. binding-manifest.json distinguishes the original Lean declarations and proofs from the generated wire schema. References are indices within one copied value, never persistent handles or resources. Every table row must be reachable from the root. The adapter rejects invalid indices, cycles, unknown constructors, malformed fields and noncanonical scalar values. A shared acyclic child is copied independently at each occurrence.

## Limits and failures

Values permit 128 nested levels and 262,144 expanded node visits. Input and output conversions have separate 16 MiB copy budgets; the native carrier also checks its own bounded conversion scopes. Shared subgraphs count once per visit, not once per address. Canonical scratch memory is capped at 64 MiB. These limits do not bound Lean algorithm or Wasmtime engine working memory. Wasmtime's allocation API does not expose recoverable out-of-memory errors.

Conversion limits and native scratch allocation failures return errors and free temporary storage. A trapped component store is replaced before the next session call. Custom Wasmtime embeddings must discard a trapped instance. Malformed native outputs retire the shared Lean runtime; subsequent native calls fail. Callbacks, closures and resource-containing aggregates require separate ownership contracts and are not admitted by this copied-graph package.

## Exports

${model.layout.roots.map((root, index) => `- ${p}_wasmtime_value_${root.name.slice(p.length + 1)}: ${root.bindingId} (WIT ${model.wire.functions[index].witName})`).join("\n")}
`;
};
