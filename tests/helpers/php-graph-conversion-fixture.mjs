/**
 * Independent recursive PHP conversion shapes, native layouts and call bindings.
 *
 * @file
 */
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";

/** Add optional and result-bearing recursive records to the shared native corpus. */
export const phpGraphConversionIr = () => {
	const ir = nativeRecursiveReviewedIr(), record = ir.types.find(type => type.name === "Scalars");
	for(const [name, constructor] of [["Link", "option"], ["ResultLink", "result"]])
	{
		const type = { kind: "named", id: `lean:Recursive.${name}` }, fn = ir.declarations[0];
		ir.types.push({ ...structuredClone(record), id: type.id, name
			, fields: [{ ...record.fields[0], name: "next", type: { kind: "apply", constructor, arguments: [type, ...constructor === "result" ? [{ kind: "primitive", name: "string" }] : []] } }] });
		ir.declarations.push({ ...structuredClone(fn)
			, id: `lean:Recursive.echo${name}`, name: `echo${name}`
			, overloadKey: `echo${name}`
			, parameters: [{ ...fn.parameters[0], type }]
			, result: { ...fn.result, type } });
	}
	return ir;
};

/**
 * Compiler observations are compared against PHP's independent FFI parser.
 *
 * @param model - Generated finite descriptors.
 */
export const phpGraphLayoutProbe = model => {
	const expressions = [], php = [];
	for(const node of model.types)
	{
		expressions.push(`sizeof(${node.name})`, `_Alignof(${node.name})`);
		php.push(`$schema->nodes[${node.index}]['size']`, `$schema->nodes[${node.index}]['alignment']`);
		if(!node.aggregate) continue;
		const names = ["_bridge_owner", "_bridge_release"
			, ...node.element || node.kind === "primitive" ? ["data", "length"] : []
			, ...node.ref.name === "int" ? ["negative"] : []
			, ...node.kind === "variant" ? ["kind", "cases"] : []
			, ...node.kind === "option" ? ["has_value"] : []
			, ...node.kind === "result" ? ["is_ok"] : []];
		for(const name of names)
		{
			expressions.push(`offsetof(${node.name}, ${name})`);
			php.push(`$schema->ffi->type('${node.name}')->getStructFieldOffset('${name}')`);
		}
		model.descriptors[node.index].branches.forEach((branch, index) => branch.fields.forEach((field, offset) => {
			expressions.push(`offsetof(${node.name}, ${field.path.join(".")})`);
			php.push(`$schema->nodes[${node.index}]['branches'][${index}]['fields'][${offset}]['offset']`);
		}));
	}
	return { count: expressions.length
		, c: `static const size_t graph_layout[] = { ${expressions.join(", ")} };\nsize_t graph_fixture_layout_count(void) { return sizeof(graph_layout)/sizeof(*graph_layout); }\nsize_t graph_fixture_layout(size_t index) { return graph_layout[index]; }\n`
		, php: `$layouts = [${php.join(", ")}];\ncheck(count($layouts) === $ffi->graph_fixture_layout_count());\nforeach ($layouts as $index => $value) check($value === $ffi->graph_fixture_layout($index), 'layout ' . $index);\n` };
};

/**
 * Test-only symbol binding leaves every production conversion body intact.
 *
 * @param model - Generated finite PHP model.
 */
export const phpGraphProbe = model => {
	const symbols = Object.fromEntries(model.functions.map(fn => [fn.publicName, { echo_link: "link", echo_result_link: "result_link" }[fn.publicName] ?? fn.publicName.replace(/_$/, "")]));
	const definitions = [...model.functions.map(fn => `uint32_t graph_fixture_${symbols[fn.publicName]}(${[...fn.parameters.map(() => "void*"), "void*"].join(",")});`)
		, ...["bad_tree", "cycle_tree", "scalar_more", "echo_scalars", "during"].map(name => `uint32_t graph_fixture_${name}(void*,void*);`)
		, "void graph_fixture_reset(uint32_t); void graph_fixture_reset_lifecycle(void);"
		, "uint32_t graph_fixture_initialize(void); int graph_fixture_ready(void); void graph_fixture_retire(void);"
		, ...["calls", "live", "clears", "initialized", "retired"].map(name => `uint32_t graph_fixture_${name}(void);`)
		, "size_t graph_fixture_layout_count(void); size_t graph_fixture_layout(size_t);"
		, `void ${model.layout.prefix}_php_graph_clear(void*);`].join("\n");
	return `<?php\ndeclare(strict_types=1);\nuse ${model.namespace}\\Internal\\{GraphTarget, GraphRuntime};
$ffi = FFI::cdef(<<<'CDEF'
${definitions}
CDEF, $argv[1]);
$functions = json_decode('${JSON.stringify(Object.fromEntries(model.functions.map((fn, index) => [fn.publicName, index])))}', true, 512, JSON_THROW_ON_ERROR);
$symbols = json_decode('${JSON.stringify(symbols)}', true, 512, JSON_THROW_ON_ERROR);
$loads = 0;
function graph(string $name, array $arguments, ?string $symbol = null): mixed {
    global $ffi, $functions, $symbols, $loads;
    return GraphRuntime::call($functions[$name], function() use ($name, $symbol, $ffi, $symbols, &$loads) {
        ++$loads;
        return new GraphTarget($ffi, 'graph_fixture_' . ($symbol ?? $symbols[$name]), '${model.layout.prefix}_php_graph_clear',
            'graph_fixture_initialize', 'graph_fixture_ready', 'graph_fixture_retire');
    }, $arguments);
}
$schema = GraphRuntime::schema();
${phpGraphLayoutProbe(model).php}
`;
};

/**
 * Supplemental native echo and malformed-output producers, independent of PHP.
 *
 * @param model - Finite graph names for structural Array types.
 */
export const phpGraphNativeExtras = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const units = nodes.get(model.layout.roots.find(root => root.name.endsWith("_units")).result).name;
	return `ECHO(wide, recursive_wide_t)
ECHO(empty_record, recursive_empty_record_t)
ECHO(echo_scalars, recursive_scalars_t)
ECHO(left, recursive_left_tree_t)
ECHO(right, recursive_right_tree_t)
ECHO(forest, recursive_forest_t)
ECHO(never, recursive_never_t)
ECHO(grow, recursive_spine_t)
ECHO(units, ${units})
uint32_t graph_fixture_empty(recursive_tree_t *out) { recursive_tree_t input = {0}; return graph_fixture_tree(&input, out); }
uint32_t graph_fixture_join_trees(const recursive_tree_t *a, const recursive_tree_t *b, recursive_tree_t *out) { assert(a && b); return graph_fixture_tree(a, out); }
uint32_t graph_fixture_inspect(const recursive_scalars_t *input, bool *out) { ++calls; *out = input->u64 == UINT64_MAX && input->i64 == INT64_MIN; return 0; }
uint32_t graph_fixture_word_max(const uint64_t *input, bool *out) { ++calls; *out = *input == UINT64_MAX; return 0; }
uint32_t graph_fixture_signed_min(const int64_t *input, bool *out) { ++calls; *out = *input == INT64_MIN; return 0; }
static uint32_t initialized, retired;
void graph_fixture_reset_lifecycle(void) { initialized = retired = 0; }
uint32_t graph_fixture_initialize(void) { ++initialized; return retired ? 5 : 0; }
int graph_fixture_ready(void) { return !retired; }
void graph_fixture_retire(void) { retired = 1; }
uint32_t graph_fixture_initialized(void) { return initialized; }
uint32_t graph_fixture_retired(void) { return retired; }
uint32_t graph_fixture_during(const recursive_tree_t *input, recursive_tree_t *out) { uint32_t status = graph_fixture_tree(input, out); retired = 1; return status; }
uint32_t graph_fixture_cycle_tree(const recursive_tree_t *input, recursive_tree_t *out) {
  uint32_t status = graph_fixture_tree(input, out); if (status) return status;
  out->kind = RECURSIVE_TREE_T_KIND_BRANCH;
  out->cases.branch.children.data = out; out->cases.branch.children.length = 1; return 0;
}
uint32_t graph_fixture_scalar_more(const recursive_scalars_t *input, recursive_scalars_t *out) {
  uint32_t status = graph_fixture_scalars(input, out); if (status) return status;
  static const uint32_t zero = 0;
  if (mode == 20) { out->natural.data = &zero; out->natural.length = 1; }
  if (mode == 21) { out->integer.negative = true; out->integer.length = 0; out->integer.data = NULL; }
  if (mode == 22) { out->text.data = "\\xed\\xa0\\x80"; out->text.length = 3; }
  if (mode == 23) { out->text.data = "\\xf4\\x90\\x80\\x80"; out->text.length = 4; }
  if (mode == 24) { out->text.data = "\\xe2\\x82"; out->text.length = 2; }
  if (mode == 25) { out->text.data = "\\x80"; out->text.length = 1; }
  if (mode == 26) { out->bytes.data = (const uint8_t *)(UINTPTR_MAX - 1); out->bytes.length = 4; }
  return 0;
}
`;
};

/**
 * Bind freshly compiled Lean exports through the same production call boundary.
 *
 * @param model - Compiler-derived graph projection, with eighteen real exports.
 */
export const phpLeanGraphProbe = model => {
	const definitions = [...model.layout.roots.map(fn => `uint32_t ${fn.name}_graph(${[...fn.parameters.map(() => "void*"), "void*"].join(",")});`)
		, "uint32_t graph_fixture_tree(void*,void*);"
		, "void graph_fixture_reset(size_t,size_t,uint32_t);"
		, "uint32_t graph_fixture_initialize(void); int graph_fixture_ready(void); void graph_fixture_retire(void);"
		, ...["live", "attempts", "decodes", "hold"].map(name => `uint32_t graph_fixture_${name}(void);`)
		, "void graph_fixture_release(void); void graph_fixture_detach(void);"
		, "size_t graph_fixture_layout_count(void); size_t graph_fixture_layout(size_t);"
		, `void ${model.layout.prefix}_php_graph_clear(void*);`].join("\n");
	return `<?php\ndeclare(strict_types=1);\nuse ${model.namespace}\\Internal\\{GraphTarget, GraphRuntime};
$ffi = FFI::cdef(<<<'CDEF'
${definitions}
CDEF, $argv[1]);
$functions = json_decode('${JSON.stringify(Object.fromEntries(model.functions.map((fn, index) => [fn.publicName, index])))}', true, 512, JSON_THROW_ON_ERROR);
$symbols = json_decode('${JSON.stringify(Object.fromEntries(model.functions.map(fn => [fn.publicName, fn.publicName === "tree" ? "graph_fixture_tree" : `${fn.name}_graph`])))}', true, 512, JSON_THROW_ON_ERROR);
$loads = 0;
function graph(string $name, array $arguments): mixed {
    global $ffi, $functions, $symbols, $loads;
    return GraphRuntime::call($functions[$name], function() use ($name, $ffi, $symbols, &$loads) {
        ++$loads;
        return new GraphTarget($ffi, $symbols[$name], '${model.layout.prefix}_php_graph_clear',
            'graph_fixture_initialize', 'graph_fixture_ready', 'graph_fixture_retire');
    }, $arguments);
}
$schema = GraphRuntime::schema();
${phpGraphLayoutProbe(model).php}
`;
};
