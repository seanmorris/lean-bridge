/**
 * Public immutable C views for explicitly owned values. Resource identities and
 * result owners are opaque; callers never construct native tokens or Lean tags.
 *
 * @file
 */
import { compileOwnedNativeValueLayout } from "../native/owned-value-layout.mjs";
import { cIdentifier, cRecordIdentifier, cVariantIdentifier, cVariantTag, cKeywords } from "./generate.mjs";
import { sha256 } from "../../capsule/node.mjs";
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

const fail = message => { throw new TypeError(`Owned C values: ${message}`); };
const safe = name => /^[a-z][a-z0-9_]*$/.test(name) && !name.includes("__") && !cKeywords.has(name);
const nominal = name => {
	if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || !safe(cIdentifier(name))) fail(`invalid nominal name: ${name}`);
	return cIdentifier(name);
};

/**
 * Preserve source names and container semantics while keeping recursive layout
 * finite. Input pointers borrow their children. Returned views borrow one opaque
 * result owner, so copying or modifying a view cannot corrupt its cleanup ledger.
 *
 * @param ir - Explicit v4 ownership contract.
 * @param options - Explicit transport capabilities.
 * @param options.hostCallbacks - Admit call-scoped host descriptors and copies.
 * @param options.publicPrefix - Internal backend namespace, independent of Lean identity.
 * @param options.transferredInputs - Admit explicit consumption of input owners.
 * @param options.anchoredResults - Preserve owner-scoped result views.
 */
export const generateOwnedCValues = (ir, { hostCallbacks = false, publicPrefix, transferredInputs = false, anchoredResults = false } = {}) => {
	const native = compileOwnedNativeValueLayout(ir, { transferredInputs, anchoredResults });
	const hasAnchors = native.functions.some(item => item.anchor !== undefined);
	const p = publicPrefix ?? cIdentifier(ir.component.id.slice(0, ir.component.id.lastIndexOf("@")).split("/").at(-1));
	if(!safe(p) || ["gmp", "lean_bridge_native", "leanshared"].includes(p)) fail("invalid package name");
	const names = new Map();
	const claim = (name, id) => {
		if(names.has(name) && names.get(name) !== id) fail(`identifier collision: ${name}`);
		names.set(name, id);
	};
	for(const suffix of ["status", "session", "result", "session_open", "session_close", "result_release"])
		claim(`${p}_${suffix}`, "runtime");
	if(hasAnchors) claim(`${p}_result_validate`, "runtime");
	const callableNames = new Map();
	for(const item of [...native.functions].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		for(const [site, id] of [...item.parameters.map((id, i) => [`argument${i}`, id]), ["result", item.result]])
			if(!callableNames.has(id)) callableNames.set(id, `${p}_${nominal(item.name)}_${site}_t`);
	const nodes = native.nodes.map(node => {
		const integer = node.kind === "primitive" && ["nat", "int"].includes(node.name);
		const identity = ["resource", "callback"].includes(node.kind);
		const scalar = node.kind === "primitive" && !["nat", "int", "string", "bytes"].includes(node.name);
		const name = integer ? "mpz_srcptr" : scalar ? node.name === "bool" ? "bool" : node.cName
			: node.kind === "callback" && callableNames.has(node.id) ? callableNames.get(node.id)
				: node.name ? `${p}_${node.kind === "primitive" ? "scalar_" : ""}${nominal(node.name)}_t`
				: `${p}_value_${sha256(node.id).slice(0, 20)}_t`;
		if(!integer && !scalar) claim(name, node.id);
		if(identity) for(const suffix of ["handle", "retain", ...hasAnchors ? ["equal"] : [], ...node.kind === "callback" ? ["call"] : []]) claim(`${name}_${suffix}`, node.id);
		if(hostCallbacks && node.kind === "callback")
		{
			claim(`${name}_host`, node.id);
			claim(`${name.toUpperCase()}_REQUIRES_RECOVERY`, node.id);
		}
		if(hostCallbacks && !identity) claim(node.kind === "primitive" ? `${p}_scalar_${node.name}_copy` : `${name}_copy`, node.id);
		const fields = items => {
			const members = new Set();
			return items.map(field => {
				const name = ["tuple", "option", "result"].includes(node.kind)
					? { tuple: ["fst", "snd"], option: ["value"], result: ["ok", "error"] }[node.kind][Number(field.sourceName)]
					: cRecordIdentifier(field.sourceName);
				if(!safe(name) || members.has(name)) fail(`invalid or duplicate field: ${field.sourceName}`);
				members.add(name); return { ...field, nativeName: field.name, name };
			});
		};
		const cases = node.cases.map(branch => ({ ...branch
			, nativeName: branch.name, name: cVariantIdentifier(branch.sourceName)
			, tag: cVariantTag(name, branch.sourceName)
			, fields: fields(branch.fields) }));
		if(cases.length)
		{
			claim(`${name}_kind`, node.id);
			const seen = new Set();
			for(const branch of cases)
			{
				if(!safe(branch.name) || seen.has(branch.name)) fail(`invalid or duplicate constructor: ${branch.sourceName}`);
				seen.add(branch.name); claim(branch.tag, `${node.id}:${branch.sourceName}`);
			}
		}
		return { ...node, nativeName: node.cName, cName: name, integer, identity, scalar, fields: fields(node.fields), cases };
	});
	const table = new Map(nodes.map(node => [node.id, node]));
	const aliases = new Map(), expandedAliases = new Set();
	const expose = (name, id) => {
		if(aliases.get(name) === id) return;
		claim(name, id); aliases.set(name, id);
		// Shared anonymous shapes get aliases at every use, but expand their
		// children once. Alias diamonds must not generate exponentially many names.
		if(expandedAliases.has(id)) return;
		expandedAliases.add(id);
		const node = table.get(id), base = name.slice(0, -2);
		// Only anonymous container edges recurse. Nominal cycles stay finite.
		for(const field of node.fields) if(!table.get(field.type).name)
			expose(`${base}_${field.name}_t`, field.type);
		if(node.element && !table.get(node.element).name) expose(`${base}_element_t`, node.element);
	};
	const definitions = new Map(native.model.types.map(type => [type.id, type]));
	for(const alias of native.aliases) expose(`${p}_${nominal(definitions.get(alias.id).name)}_t`, alias.target);
	for(const node of nodes.filter(node => node.name && !node.scalar && !node.integer))
	{
		for(const field of node.fields) if(!table.get(field.type).name) expose(`${node.cName.slice(0, -2)}_${field.name}_t`, field.type);
		for(const branch of node.cases) for(const field of branch.fields)
			if(!table.get(field.type).name) expose(`${node.cName.slice(0, -2)}_${branch.name}_${field.name}_t`, field.type);
	}
	const functions = native.functions.map(item => {
		const name = `${p}_${nominal(item.name)}`; claim(name, item.id);
		for(const [site, id] of [...item.parameters.map((id, i) => [`argument${i}`, id]), ["result", item.result]])
			if(!table.get(id).name) expose(`${name}_${site}_t`, id);
		return { ...item, cName: name };
	});
	const callbacks = native.callbacks.map(item => ({ ...item, cName: `${table.get(item.id).cName}_call` }));
	const statuses = ["OK", "INVALID_ARGUMENT", "LIMIT", "ALLOCATION_FAILED", "CLOSED", "WRONG_THREAD", "WRONG_PROCESS", "RUNTIME_UNAVAILABLE", "CALL_ORDER", "MALFORMED_RESULT"];
	if(hostCallbacks) statuses.push("CALLBACK_FAILED");
	const header = ["#pragma once", "#include <stdbool.h>", "#include <stddef.h>"
		, "#include <stdint.h>", "#include <gmp.h>"
		, "#ifdef __cplusplus", 'extern "C" {', "#endif"
		, `typedef enum ${p}_status { ${statuses.map((value, i) => `${p.toUpperCase()}_${value} = ${i}`).join(", ")} } ${p}_status;`
		, `typedef struct ${p}_session ${p}_session;`
		, `typedef struct ${p}_result ${p}_result;`
		, "/* Immutable views: input children borrow caller storage for one call."
		, hasAnchors ? "   Output storage lives until result_release; borrowed views also need a live anchor."
			: "   Output children, including GMP integers, remain valid until result_release."
		, "   Never free a child or mutate a returned GMP integer. Retain an identity"
		, "   before releasing its last owning result. Sessions are thread/process bound."
		, "   Close invalidates resource use; result_release still frees copied storage."
		, "   Output/result slots must not overlap and *owner must initially be NULL."
		, "   GMP retains its normal fatal out-of-memory policy. */"
		, `${p}_status ${p}_session_open(${p}_session **out);`
		, `${p}_status ${p}_session_close(${p}_session **value);`
		, `${p}_status ${p}_result_release(${p}_result **value);`];
	if(functions.some(item => item.transfers?.length)) header.push(
		"/* Transferred arguments take an additional input-owner slot. All arguments"
		, "   and owners are validated before consumption. Each owner must be distinct"
		, "   and belong to this session; owner slots must not overlap output slots."
		, "   Immediately before Lean runs, each entire input owner is consumed and"
		, "   its slot becomes NULL. A later failure does not restore consumed owners."
		, "   Old views expire when this call returns. Independently retained owners"
		, "   remain valid. Failure before consumption leaves input owners unchanged. */"
	);
	if(hasAnchors) header.push(
		"/* Borrowed results take their anchor parameter's result owner as an extra"
		, "   argument. Release or transfer of that owner expires the borrowed view."
		, "   result_validate checks its lifetime, including empty values. Keep a view's"
		, "   result storage until finished reading its copied fields, then release it."
		, "   Retain/copy creates independent ownership. Use the typed equal function"
		, "   to compare resource identity across views with different lifetimes. */"
		, `${p}_status ${p}_result_validate(${p}_session *session, ${p}_result *owner);`
	);
	for(const node of nodes)
	{
		if(node.identity) header.push(`typedef struct ${node.cName}_handle *${node.cName};`);
		else if(!node.scalar && !node.integer) header.push(`typedef struct ${node.cName} ${node.cName};`);
	}
	const emitField = (field, indent = "  ") => `${indent}${table.get(field.type).cName}${field.pointer ? " const *" : " "}${field.name};`;
	for(const node of nodes.filter(node => !node.scalar && !node.integer && !node.identity).sort((a, b) => Number(b.leaf) - Number(a.leaf)))
	{
		if(node.kind === "variant") header.push(`typedef enum ${node.cName}_kind { ${node.cases.map((branch, i) => `${branch.tag} = ${i}`).join(", ")} } ${node.cName}_kind;`);
		header.push(`struct ${node.cName} {`);
		if(node.kind === "primitive") header.push(`  const ${node.name === "string" ? "char" : "uint8_t"} *data;`, "  size_t length;");
		else if(node.element) header.push(`  ${table.get(node.element).cName} const *data;`, "  size_t length;");
		else if(node.kind === "variant")
		{
			header.push(`  ${node.cName}_kind kind;`, "  union {");
			for(const branch of node.cases) header.push("    struct {", ...branch.fields.length
				? branch.fields.map(field => emitField(field, "      ")) : ["      uint8_t empty;"]
			, `    } ${branch.name};`);
			header.push("  } cases;");
		}
		else
		{
			if(node.kind === "option") header.push("  bool has_value;");
			if(node.kind === "result") header.push("  bool is_ok;");
			if(node.kind === "record" && !node.fields.length) header.push("  uint8_t empty;");
			header.push(...node.fields.map(field => emitField(field)));
		}
		header.push("};");
	}
	for(const [name, id] of aliases) header.push(`typedef ${table.get(id).cName} ${name};`);
	const input = id => { const node = table.get(id); return `${node.cName}${node.leaf ? "" : " const *"}`; };
	if(hostCallbacks)
	{
		header.push("/* Host callbacks borrow their context for the enclosing call only."
			, "   Set exactly one of call or closure. recovery is an optional typed value;"
			, "   it is required if the signature has no finite recovery from its inputs."
			, "   Failure never publishes recovery as a successful result."
			, "   Callback arguments expire on return. Replies may borrow those arguments"
			, "   or context storage, or transfer an owning result (also released on error)."
			, "   Use a generated copy function to snapshot callback-local storage."
			, "   Do not let C++ exceptions or longjmp cross a callback boundary. */");
		for(const node of nodes.filter(node => node.kind === "callback"))
		{
			const callback = callbacks.find(item => item.id === node.id), result = table.get(callback.result);
			const automatic = ownedCallbackRecovery(native.model, node, id => id) !== null;
			header.push(`#define ${node.cName.toUpperCase()}_REQUIRES_RECOVERY ${automatic ? 0 : 1}`
				, `typedef struct ${node.cName}_host {`
				, `  ${p}_status (*call)(void *context, ${p}_session *session, ${[
					...callback.parameters.slice(1).map((id, i) => `${input(id)} a${i}`)
					, `${result.cName} *out`, `${p}_result **owner`
				].join(", ")});`
				, "  void *context;", `  ${node.cName} closure;`, `  ${result.cName} const *recovery;`
				, `} ${node.cName}_host;`);
		}
	}
	const hostArgument = (item, index) => hostCallbacks && !item.retain && !item.copy
		&& !item.transfers?.includes(index)
		&& item.anchor !== index
		&& table.get(item.parameters[index]).kind === "callback"
		&& !(callbacks.some(callback => callback.id === item.id) && index === 0);
	const signature = item => `${p}_status ${item.cName}(${p}_session *session, ${[
		...item.parameters.flatMap((id, i) => [
			`${hostArgument(item, i) ? `${table.get(id).cName}_host const *` : input(id)} a${i}`
			, ...item.transfers?.includes(i) ? [`${p}_result **a${i}_owner`] : []
			, ...item.anchor === i ? [`${p}_result *a${i}_owner`] : []
		])
		, `${table.get(item.result).cName} *out`, `${p}_result **owner`
	].join(", ")})`;
	for(const item of [...functions, ...callbacks]) header.push(signature(item) + ";");
	const retains = nodes.filter(node => node.identity).map(node => ({
		id: node.id, cName: `${node.cName}_retain`
		, parameters: [node.id], result: node.id, retain: true
	}));
	for(const item of retains) header.push(signature(item) + ";");
	if(hasAnchors) for(const node of nodes.filter(node => node.identity))
		header.push(`${p}_status ${node.cName}_equal(${p}_session *session, ${node.cName} left, ${node.cName} right, bool *out);`);
	const copies = hostCallbacks ? nodes.filter(node => !node.identity).map(node => ({
		id: node.id
		, cName: node.kind === "primitive" ? `${p}_scalar_${node.name}_copy` : `${node.cName}_copy`
		, parameters: [node.id], result: node.id, copy: true
	})) : [];
	for(const item of copies) header.push(signature(item) + ";");
	header.push("#ifdef __cplusplus", "}", "#endif", "");
	return { native, prefix: p, nodes, functions, callbacks, retains
		, ...hasAnchors ? { anchoredResults: true } : {}
		, ...(hostCallbacks ? { copies, hostArgument } : {})
		, aliases: [...aliases].map(([name, id]) => ({ name, id }))
		, signature, header: header.join("\n") };
};
