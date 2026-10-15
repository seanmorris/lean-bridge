/**
 * Prepared recursive callable WIT headers and public ownership instructions.
 *
 * @file
 */
import { compileCallableWitGraphModel } from "./callable-graph-model.mjs";
import { renderWitGraphCallableHostHeader } from "./callable-graph-host.mjs";
import { copiedWitGraphAliases } from "./copied-graph-package.mjs";

const publicCallables = model => {
	const p = model.prefix, headers = [], names = [], values = [];
	const signature = callback => callback.publicName.slice(p.length + 1);
	for(const fn of model.functions)
	{
		const entry = { declaration: fn.declaration.id, helper: `${p}_wasmtime_value_${fn.field}`, callbacks: [] };
		for(const [index, callback] of fn.parameters.entries())
		{
			if(callback.kind !== "callback") continue;
			const base = `${p}_wasmtime_${fn.field}_callback${index}`;
			const canonical = `${p}_wasmtime_callback_${signature(callback)}`;
			names.push(`${base}_fn`, `${base}_create`);
			entry.callbacks.push({ parameter: index, id: callback.id, type: `${base}_fn`, create: `${base}_create` });
			headers.push(`typedef ${canonical}_fn ${base}_fn;
static inline wasmtime_error_t *${base}_create(${p}_wasmtime *session, ${base}_fn callback, void *data, void (*release)(void *), ${p}_wasmtime_function *out) {
  return ${canonical}_create(session, callback, data, release, out);
}`);
		}
		if(fn.result.kind === "callback")
		{
			const callback = fn.result, name = `${p}_wasmtime_${fn.field}_call`;
			const parameters = callback.parameters.map((node, index) => `const ${node.name} *arg${index}`);
			entry.invoke = name; names.push(name);
			headers.push(`static inline wasmtime_error_t *${name}(${p}_wasmtime *session, ${p}_wasmtime_function self, ${parameters.concat(`${callback.result.name} *out`).join(", ")}) {
  return ${p}_wasmtime_function_${signature(callback)}_call(session, self, ${callback.parameters.map((_, index) => `arg${index}`).concat("out").join(", ")});
}`);
		}
		values.push(entry);
	}
	return { headers, names, values };
};

/**
 * Expose stable copied type names beside session-owned function tokens.
 *
 * @param ir - Original compiler-authenticated recursive callable signatures.
 * @param settings - WIT package name and version.
 */
export const compileCallableWitGraphPackageModel = (ir, settings) => {
	const model = compileCallableWitGraphModel(ir, settings), p = model.prefix;
	const publicApi = publicCallables(model);
	const unit = model.nodes.find(node => node.ref.name === "unit").id;
	const payload = node => node.kind === "callback" ? unit : node.id;
	const roots = model.functions.map(fn => ({ name: fn.name
		, bindingId: fn.declaration.id
		, parameters: fn.parameters.map(payload), result: payload(fn.result) }));
	const reservedNames = model.nodes.filter(node => node.aggregate).map(node => `${node.name}_wasmtime_copy`);
	for(const callback of model.callbacks.values())
	{
		roots.push({ name: callback.publicName, bindingId: callback.id
			, parameters: callback.parameters.map(payload)
			, result: payload(callback.result) });
		const field = callback.publicName.slice(p.length + 1);
		reservedNames.push(`${p}_wasmtime_function_${field}_call`
			, `${p}_wasmtime_callback_${field}_fn`
			, `${p}_wasmtime_callback_${field}_create`);
	}
	for(const name of publicApi.names)
	{
		if(reservedNames.includes(name)) throw new TypeError(`WIT callable helper name collision: ${name}`);
		reservedNames.push(name);
	}
	const aliases = copiedWitGraphAliases({ ...model, layout: { ...model.layout, roots } }, { reservedNames });
	const named = model.layout.aliases.map(alias => ({ name: alias.name, type: model.nodes.find(node => node.id === alias.target).name }));
	const guard = `${p.toUpperCase()}_WASMTIME_CALLABLE_GRAPH_PACKAGE_H`;
	const hostHeader = `#ifndef ${guard}\n#define ${guard}\n` + renderWitGraphCallableHostHeader(model) + `
/* Stable names for copied containers in fields and callable signatures. */
${aliases.map(alias => `typedef ${alias.type} ${alias.name};
static inline void ${alias.name}_init(${alias.name} *value) { ${alias.type}_init(value); }
static inline void ${alias.name}_clear(${alias.name} *value) { ${alias.type}_clear(value); }`).join("\n")}
${[...named, ...aliases].map(alias => `static inline wasmtime_error_t *${alias.name}_wasmtime_copy(const ${alias.name} *value, ${alias.name} *out) { return ${alias.type}_wasmtime_copy(value, out); }`).join("\n")}
/* Export-specific names do not expose signature hashes to ordinary callers. */
${publicApi.headers.join("\n")}
#endif /* ${guard} */
`;
	const manifest = { ...model.manifest, cHost: { header: `${p}_wasmtime.h`
		, aliases
		, values: publicApi.values
		, callbacks: [...model.callbacks.values()].map(callback => {
			const field = callback.publicName.slice(p.length + 1);
			return { id: callback.id, create: `${p}_wasmtime_callback_${field}_create`
				, invoke: `${p}_wasmtime_function_${field}_call` };
		})
	}
	};
	return { ...model, manifest, hostHeader, callableGraph: true };
};

/**
 * Describe the prepared typed interface and its separately named WIT transport.
 *
 * @param model - Validated recursive callable package projection.
 * @param glibc - Minimum consumer glibc version.
 */
export const witCallableGraphPackageReadme = (model, glibc) => {
	const { name, version, prefix: p } = model;
	return `# ${name} ${version}

Compiled Lean recursive values, callbacks and returned functions for Linux x86-64, glibc ${glibc} or newer. This archive includes Wasmtime 42.0.1, the Component Model binary, generated headers and the shared native Lean runtime. Consumers do not install Lean. Keep include/ and lib/ together.

## Call the installed package

Compile a C or C++ application with pkg-config ${name}-wit and include ${p}_wasmtime.h. Open a session with ${p}_wasmtime_open. Call the typed ${p}_wasmtime_value_* helpers listed in binding-manifest.json. Each helper crosses the embedded Component Model binary before entering Lean. Typed copied values use the generated graph structs; the helpers create and read WIT's finite node tables internally.

Arguments borrow immutable values for the call. Initialize each result with {0}. A successful copied result owns independent storage and remains valid after closing its session or library handle. Release it with its type's _clear function. Repeated clear is harmless; do not duplicate an owned root and clear both copies. Fresh result slots are required. Failures leave them unchanged. Delete returned errors with wasmtime_error_delete.

## Callbacks and returned functions

Register a typed callback with the export's ${p}_wasmtime_*_callbackN_create helper, where N is its zero-based parameter position. The matching names appear in binding-manifest.json. Registration returns an opaque ${p}_wasmtime_function token. Pass that token to an export expecting the same signature. The callback borrows its arguments. Use the copied type's _wasmtime_copy helper to create an independent reply. The adapter consumes an owned reply on success and on failure. An unowned reply must remain valid until the adapter finishes copying it after the callback returns. Never return pointers to a callback's local stack objects.

Callback data transfers only when registration succeeds. Its optional release function runs once after active calls finish. Finalizers must not reenter the session. Lean borrows a registered host callback only during the exporting call. If Lean retains that borrow, later invocation fails even while its session token remains open.

Returned Lean functions use owned tokens. Invoke them with the returning export's ${p}_wasmtime_*_call helper from binding-manifest.json. Close a token with ${p}_wasmtime_function_close(session, &token). Successful close zeroes that variable. Closing zero is harmless. Closing a token invalidates its aliases immediately and defers cleanup of active uses. Wrong-session, wrong-signature and stale tokens fail before Wasmtime execution.

Close sessions with ${p}_wasmtime_close. Sessions and tokens belong to their creating thread and process. Wrong-thread close does nothing; the owner must still close the session. Closing inside a callback defers destruction until the outer call returns an error. Do not use a closed session. Separate sessions and packages share the native runtime automatically but cannot exchange tokens.

## Values and transport

Arrays and Lists preserve order and duplicates. Options, results and variants retain explicit tags, including nested options and present Unit. Strings use UTF-8 byte lengths and preserve embedded NUL. Nat and Int use least-significant-first uint32 limbs; trailing zero limbs and negative zero are rejected. Float values preserve NaN classification, infinity and signed zero. Binding metadata preserves original aliases and callable identities.

WIT cannot declare recursive types directly. Each copied wire value holds a typed root reference and finite typed node tables. References identify nodes within that value, never persistent resources. All rows must be reachable from the root. The adapter rejects cycles, invalid indices, constructors and noncanonical scalars. A shared acyclic child is copied independently at each occurrence. The manifest separates original Lean declarations and proof metadata from this generated transport.

The raw ${p}_wasmtime_invoke API takes WIT values and function tokens. Delete its copied results with wasmtime_component_val_delete. component/${name}.wasm requires this native host; it is not a standalone WASI command. Callable imports require the owning session. ${p}_wasmtime_link rejects custom linkers without modifying them.

## Limits and failures

Copied values permit 128 nested levels and 262,144 expanded node visits. Input and output conversions have separate 16 MiB copy budgets. The native carrier enforces its own bounded scopes. Canonical scratch memory is capped at 64 MiB. These limits do not bound Lean algorithm or Wasmtime engine working memory. Wasmtime allocation APIs do not expose recoverable out-of-memory errors.

Each session holds at most 1024 callable tokens. Native leases also consume the shared runtime's identity capacity. Synchronous callback reentry is bounded at 64 calls. The first callback error is preserved, with its message limited to 1023 bytes. Traps poison the active chain; after unwinding, the session replaces its store and preserves surviving tokens. Failed calls release temporary storage and unreturned leases. Malformed native outputs retire the shared Lean runtime. Resource-containing aggregates, nested callable payloads and asynchronous calls require separate contracts and are not admitted here.

## Exports

${model.functions.map(fn => `- ${p}_wasmtime_value_${fn.field}: ${fn.declaration.id} (WIT ${fn.wire.witName})`).join("\n")}
`;
};
