/**
 * Public C/GMP and C++ APIs over the authenticated native copied graph ABI.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateCopiedGmpGraphValues } from "./gmp-graph-values.mjs";
import { generateCopiedGmpGraphConversions } from "./gmp-graph-conversions.mjs";
import { compileCopiedCGraphLayout } from "./copied-graph-layout.mjs";
import { generateCopiedCppGraphValues } from "../cpp/copied-graph-values.mjs";
import { generateCopiedCppGraphConversions } from "../cpp/copied-graph-conversions.mjs";
import { rejectPrimitiveSurface } from "./primitive-surface.mjs";

const statusHeader = p => `#ifndef ${p.toUpperCase()}_COPIED_GRAPH_STATUS_H
#define ${p.toUpperCase()}_COPIED_GRAPH_STATUS_H
#include <stddef.h>
#include <stdint.h>
typedef enum ${p}_status {
  ${p.toUpperCase()}_STATUS_OK = 0, ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT = 1,
  ${p.toUpperCase()}_STATUS_RUNTIME_UNAVAILABLE = 2, ${p.toUpperCase()}_STATUS_RUNTIME_REJECTED = 3,
  ${p.toUpperCase()}_STATUS_DECLARED_ERROR = 4, ${p.toUpperCase()}_STATUS_UNEXPECTED_ERROR = 5
} ${p}_status;
typedef enum ${p}_error_code {
  ${p.toUpperCase()}_ERROR_NONE = 0, ${p.toUpperCase()}_ERROR_INVALID_ARGUMENT = 1,
  ${p.toUpperCase()}_ERROR_RUNTIME_UNAVAILABLE = 2, ${p.toUpperCase()}_ERROR_UNEXPECTED = 65535
} ${p}_error_code;
typedef struct ${p}_error { ${p}_error_code code; const char *message; size_t message_length; } ${p}_error;
static inline ${p}_status ${p}_graph_finish(uint32_t status, ${p}_error *error) {
  static const char *const messages[] = {"", "Invalid copied value", "Copied value limit exceeded", "Copied value allocation failed", "Malformed native result", "Lean runtime initialization failed or runtime retired"};
  const char *message = messages[status <= 5 ? status : 4];
  size_t length = 0; while (message[length]) ++length;
  ${p}_status result = status == 0 ? ${p.toUpperCase()}_STATUS_OK
    : status <= 2 ? ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT : ${p.toUpperCase()}_STATUS_UNEXPECTED_ERROR;
  if (error) { error->code = status == 0 ? ${p.toUpperCase()}_ERROR_NONE
    : status <= 2 ? ${p.toUpperCase()}_ERROR_INVALID_ARGUMENT : ${p.toUpperCase()}_ERROR_UNEXPECTED;
    error->message = message; error->message_length = length; }
  return result;
}
#endif
`;

/**
 * Expose C names for copied roots and anonymous container fields.
 *
 * @param values - Copied GMP values with the public root naming catalog.
 * @param options - Optional public helpers for callback reply ownership.
 * @param options.copies - Expose bounded deep-copy operations.
 * @param options.reservedNames - Additional callable declarations in this C namespace.
 */
export const copiedGraphCAliases = (values, { copies = false, reservedNames = [] } = {}) => {
	const { layout } = values, p = layout.prefix, hosts = new Map(values.types.map(node => [node.id, node]));
	const table = new Map(layout.nodes.map(node => [node.id, node]));
	const entries = new Map(), names = new Map();
	const claim = (name, id) => {
		if(names.has(name)) rejectPrimitiveSurface(null, `C graph public name collision: ${name}`);
		names.set(name, id);
	};
	for(const suffix of ["initialize", "status", "error", "error_code", "graph_finish", "graph_ready", "graph_retire", "graph_initialize", "runtime", "runtime_v1"]) claim(`${p}_${suffix}`, "reserved");
	for(const root of layout.roots) claim(root.name, "function");
	for(const name of reservedNames) claim(name, "callable");
	for(const node of values.types.filter(node => node.aggregate))
		for(const name of [node.name, `${node.name}_init`, `${node.name}_clear`
			, ...copies ? [`${node.name}_copy`] : []
			, ...node.integer ? [] : [`${node.name}_dispose`, `${node.name}_destroy_inline`]
			, ...node.kind === "variant" ? [`${node.name}_select`, `${node.name}_tag`] : []]) claim(name, node.id);
	claim(`${p}_gmp_initialize`, "initialize");
	for(const root of layout.roots) claim(`${p}_gmp_${root.name.slice(p.length + 1)}`, root.bindingId);
	const add = (name, id) => {
		const node = hosts.get(id);
		if(entries.get(name) === id) return;
		claim(name, id); entries.set(name, id);
		if(node.aggregate) for(const suffix of ["init", "clear", ...copies ? ["copy"] : [], ...node.kind === "variant" ? ["tag", "select"] : []]) claim(`${name}_${suffix}`, id);
	};
	const expose = (name, id) => {
		add(name, id);
		const node = table.get(id), base = name.slice(0, -2);
		for(const field of node.fields) if(table.get(field.type).ref.kind === "apply") expose(`${base}_${field.name}_t`, field.type);
		if(node.element && table.get(node.element).ref.kind === "apply") expose(`${base}_element_t`, node.element);
	};
	for(const node of layout.nodes.filter(node => node.aggregate)) add(node.name, node.id);
	for(const alias of layout.aliases) expose(alias.name, alias.target);
	// Give anonymous containers usable names where C callers construct a boxed
	// field or a top-level argument. Their hashed structural names remain valid.
	for(const node of layout.nodes.filter(node => node.ref.kind === "named"))
	{
		for(const field of node.fields) if(table.get(field.type).ref.kind === "apply") expose(`${node.name.slice(0, -2)}_${field.name}_t`, field.type);
		for(const branch of node.cases) for(const field of branch.fields)
			if(table.get(field.type).ref.kind === "apply") expose(`${node.name.slice(0, -2)}_${branch.name}_${field.name}_t`, field.type);
	}
	for(const root of layout.roots)
		for(const [site, id] of [...root.parameters.map((id, i) => [`argument${i}`, id]), ["result", root.result]])
			if(table.get(id).ref.kind === "apply") expose(`${root.name}_${site}_t`, id);
	const lines = [];
	for(const [name, id] of entries)
	{
		const node = hosts.get(id), raw = table.get(id);
		lines.push(`typedef ${node.name} ${name};`);
		if(node.aggregate) for(const action of ["init", "clear"]) lines.push(`static inline void ${name}_${action}(${node.integer ? "mpz_ptr" : `${name} *`} value) { ${node.name}_${action}(value); }`);
		if(copies && node.aggregate) lines.push(`static inline ${p}_status ${name}_copy(${node.integer ? "mpz_srcptr" : `const ${name} *`} value, ${node.integer ? "mpz_ptr" : `${name} *`} out, ${p}_error *error) { return ${node.name}_copy(value, out, error); }`);
		if(node.kind === "variant")
		{
			lines.push(`typedef ${node.name}_tag ${name}_tag;`
				, `static inline ${p}_status ${name}_select(${name} *value, ${name}_tag kind) { return ${p}_graph_finish(${node.name}_select(value, kind) ? 0 : 1, NULL); }`);
			if(name === raw.name) for(const branch of raw.cases) lines.push(`#define ${branch.tag} ${branch.tag.replace(`${p.toUpperCase()}_`, `${p.toUpperCase()}_GMP_`)}`);
		}
	}
	return lines;
};

/**
 * Validate public target names and layouts before any native graph compilation.
 *
 * @param ir - Compiler-checked copied graph Binding IR.
 * @param targets - Exactly the requested C-family targets.
 */
export const compileCopiedGraphPackageModel = (ir, targets) => {
	if(!Array.isArray(targets) || !targets.length || new Set(targets).size !== targets.length || targets.some(target => !["c", "cpp"].includes(target)))
		throw Object.assign(new TypeError("Native copied graphs currently require C/C++ target adapters"), { code: "native-graph-projection-unavailable" });
	const layout = compileCopiedCGraphLayout(ir), p = layout.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(p) || ir.component.id.length >= 160)
		rejectPrimitiveSurface(ir.declarations[0], "C/C++ graph component name collides with a dependency or exceeds its name limit");
	const reserved = new Set(["graph_ready", "graph_retire", "graph_initialize", "graph_finish"]);
	for(const root of layout.roots)
		if(reserved.has(root.name.slice(p.length + 1))) rejectPrimitiveSurface(ir.declarations.find(item => item.id === root.bindingId), "C/C++ export name collides with graph runtime helpers");
	if(targets.includes("c")) copiedGraphCAliases(generateCopiedGmpGraphValues(ir));
	if(targets.includes("cpp")) generateCopiedCppGraphValues(ir);
	return { layout, prefix: p, targets
		, bigint: layout.nodes.some(node => ["nat", "int"].includes(node.ref.name))
		, layoutSha256: sha256(canonicalJson(layout)) };
};

/**
 * Generate a prepared API with ordinary status/error and owned-value semantics.
 * Native carrier calls and runtime initialization are compiled separately.
 *
 * @param ir - Compiler-checked Binding IR.
 * @param targets - Requested C-family packages.
 */
export const generateCopiedGraphPackage = (ir, targets) => {
	const model = compileCopiedGraphPackageModel(ir, targets), { layout, prefix: p } = model;
	const files = { [`include/detail/${p}-status.h`]: statusHeader(p) };
	if(targets.includes("c"))
	{
		const values = generateCopiedGmpGraphConversions(ir, { lifecycle: true });
		const nodes = new Map(values.types.map(node => [node.id, node]));
		const declarations = [], definitions = [], aliases = copiedGraphCAliases(values);
		declarations.push(`${p}_status ${p}_gmp_initialize(${p}_error *error);`);
		definitions.push(`${p}_status ${p}_gmp_initialize(${p}_error *error) { return ${p}_graph_finish(${p}_graph_initialize(), error); }`);
		aliases.push(`static inline ${p}_status ${p}_initialize(${p}_error *error) { return ${p}_gmp_initialize(error); }`);
		for(const root of layout.roots)
		{
			const params = root.parameters.map(id => nodes.get(id)), result = nodes.get(root.result), unit = result.ref.name === "unit";
			const signature = [...params.map((node, i) => `${node.integer ? "mpz_srcptr" : `${node.name}${node.aggregate ? " const *" : ""}`} a${i}`)
				, ...unit ? [] : [`${result.integer ? "mpz_ptr" : `${result.name} *`} out`]
				, `${p}_error *error`].join(", ");
			const field = root.name.slice(p.length + 1), name = `${p}_gmp_${field}`;
			declarations.push(`${p}_status ${name}(${signature});`);
			definitions.push(`${p}_status ${name}(${signature}) {`
				, ...unit ? ["  uint8_t result = 0;"] : []
				, `  uint32_t status = ${root.name}_gmp_graph(${root.name}_graph${params.map((node, i) => `, ${node.aggregate ? "" : "&"}a${i}`).join("")}, ${unit ? "&result" : "out"});`
				, `  return ${p}_graph_finish(status, error);`, "}");
			aliases.push(`static inline ${p}_status ${root.name}(${signature}) { return ${name}(${[...params.map((_, i) => `a${i}`), ...unit ? [] : ["out"], "error"].join(", ")}); }`);
		}
		files[`gmp/include/detail/${p}-status.h`] = files[`include/detail/${p}-status.h`];
		files[`gmp/include/detail/${p}-gmp-graph-values.h`] = values.valuesHeader;
		files[`gmp/include/detail/${p}-gmp-api.h`] = ["#pragma once"
			, `#include "${p}-status.h"`
			, `#include "${p}-gmp-graph-values.h"`
			, "#ifdef __cplusplus", 'extern "C" {', "#endif"
			, ...declarations, "#ifdef __cplusplus", "}", "#endif", ""].join("\n");
		files[`gmp/include/${p}.h`] = ["#pragma once", `#include "detail/${p}-gmp-api.h"`, ...aliases, ""].join("\n");
		files[`gmp/internal/${p}-gmp-conversions.h`] = values.header;
		files[`gmp/src/${p}_gmp.c`] = [`#include "detail/${p}-gmp-api.h"`
			, `#include "${p}-graph.h"`
			, `#include "${p}-gmp-conversions.h"`, ...definitions, ""].join("\n");
	}
	if(targets.includes("cpp"))
	{
		const values = generateCopiedCppGraphConversions(ir), nodes = new Map(values.types.map(node => [node.id, node]));
		files[`include/detail/${p}-values.hpp`] = values.valuesHeader;
		files[`include/detail/${p}-conversions.hpp`] = values.header;
		const wrappers = [];
		for(const root of layout.roots)
		{
			const params = root.parameters.map(id => nodes.get(id)), result = nodes.get(root.result), unit = layout.nodes.find(node => node.id === root.result).ref.name === "unit", field = root.name.slice(p.length + 1);
			wrappers.push(`inline ${unit ? "void" : result.name} ${field}(${params.map((node, i) => `const ${node.name}& a${i}`).join(", ")}) {`
				, "  try {"
				, `    auto result = detail::graph_call_${field}(detail::${root.name}_graph${params.map((_, i) => `, a${i}`).join("")});`
				, `    if (!detail::${p}_graph_ready()) detail::graph_fail(5, "Lean runtime retired during output conversion");`
				, unit ? "    (void)result;" : "    return result;"
				, "  } catch (const detail::GraphConversionError& failure) {"
				, `    if (failure.status == 4) detail::${p}_graph_retire();`
				, `    ${p}_error error{}; auto status = ${p}_graph_finish(failure.status, &error);`
				, "    throw Error(status, error);", "  }", "}");
		}
		files[`include/${p}.hpp`] = ["#pragma once", `#include "detail/${p}-status.h"`
			, "#include <stdbool.h>", "#include <string.h>"
			, `namespace lean_bridge::${p}::detail {`
			, ...layout.nodes.filter(node => node.aggregate).map(node => `struct ${node.name};`)
			, `#include "detail/${p}-graph.h"`, "}"
			, `#include "detail/${p}-conversions.hpp"`
			, `namespace lean_bridge::${p} {`
			, "class Error final : public std::runtime_error {", "public:"
			, `  ${p}_status status; ${p}_error_code code;`
			, `  Error(${p}_status status, const ${p}_error& error) : std::runtime_error(error.message ? std::string(error.message, error.message_length) : "Lean call failed"), status(status), code(error.code) {}`
			, "};", ...wrappers, "}", ""].join("\n");
		files[`src/${p}.cpp`] = `#include "${p}.hpp"\n`;
	}
	return { ...model, files };
};
