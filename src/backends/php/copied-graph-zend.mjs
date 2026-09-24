/**
 * Recursive PHP-Wasm Zend sources over the finite, root-owned wasm32 C graph.
 * Source generation does not admit a compiled or installed package.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateCopiedCGraphTypes } from "../c/copied-graph-layout.mjs";
import { generateCopiedPhpGraphValues } from "./copied-graph-values.mjs";
import { phpGraphWire } from "./copied-graph-wire.mjs";
import { copiedZendConversions } from "./copied-zend-conversions.mjs";
import { graphZendSupport, graphZendDescriptors, graphZendWalk } from "./copied-graph-zend-runtime.mjs";
import { copiedPhpWasmLoader } from "./php-wasm-copied-loader.mjs";

/**
 * Retain nominal identities and compute inhabitedness without unfolding cycles.
 *
 * @param ir - Validated copied graph contract.
 */
export const compileCopiedPhpGraphZendModel = ir => {
	const values = generateCopiedPhpGraphValues(ir, { integerBits: 32, wordBits: 32 });
	const { layout, header } = generateCopiedCGraphTypes(ir, { wordBits: 32 });
	const types = values.types.map((node, index) => {
		if(node.id !== layout.nodes[index].id) throw new TypeError("PHP and wasm32 graph identities differ");
		return { ...node, name: layout.nodes[index].name };
	});
	const nodes = new Map(types.map(node => [node.id, node]));
	const inhabited = new Set(types.filter(node => node.kind === "primitive" || node.element || node.kind === "option").map(node => node.id));
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of types)
		{
			const branches = node.kind === "variant" ? node.cases.map(branch => branch.fields)
				: node.kind === "result" ? node.fields.map(field => [field]) : [node.fields];
			if(!inhabited.has(node.id) && branches.some(branch => branch.every(field => inhabited.has(field.type))))
			{ inhabited.add(node.id); changed = true; }
		}
	}
	const descriptors = types.map(node => {
		const fields = (values, path = "") => values.map(field => ({ type: nodes.get(field.type).index, pointer: field.storage === "pointer", path: path + field.name }));
		const branches = node.kind === "variant" ? node.cases.map(branch => fields(branch.fields, `cases.${branch.name}.`))
			: node.kind === "option" ? [[], fields(node.fields)]
				: node.kind === "result" ? [fields([node.fields[1]]), fields([node.fields[0]])]
					: node.kind === "primitive" || node.element ? [] : [fields(node.fields)];
		return { ...node, inhabited: inhabited.has(node.id), branches, elementIndex: node.element ? nodes.get(node.element).index : null };
	});
	const identity = hashBindingIr(ir), stem = `lb_${layout.prefix}_graph_${identity.slice(0, 16)}`;
	return { ...values, layout, types, descriptors, typesHeader: header
		, identity, stem, library: `php8.4-${stem}.so`
		, transport: `${values.namespace}\\Internal\\GraphZend${identity.slice(0, 16)}` };
};

const descriptorSource = model => {
	const primitive = model.types.filter(node => node.kind === "primitive");
	const scalars = copiedZendConversions({ surface: { copies: primitive.map(node => ({ index: node.index
		, scalarName: { usize: "uint32", isize: "int32" }[node.ref.name] ?? node.ref.name
		, ctype: node.name, publicType: node.publicType })) } });
	const thunks = primitive.map(node => `static int lg_to_${node.index}(zval *value, void *out, lb_scope *s) { return lb_to${node.index}(value, (${node.name} *)out, s); }
static int lg_from_${node.index}(const void *value, zval *out, lb_scope *s) { return lb_from${node.index}((const ${node.name} *)value, out, s); }`);
	const fields = model.descriptors.flatMap(node => [
		...node.branches.flatMap((branch, index) => branch.length ? [`static const lg_field lg_fields_${node.index}_${index}[] = {
${branch.map(field => `  { ${field.type}, offsetof(${node.name}, ${field.path}), ${field.pointer} },`).join("\n")}
};`] : [])
		, ...node.branches.length ? [`static const lg_branch lg_branches_${node.index}[] = { ${node.branches.map((branch, index) => `{ ${branch.length}, ${branch.length ? `lg_fields_${node.index}_${index}` : "NULL"} }`).join(", ")} };`] : []
	]);
	const nodes = model.descriptors.map(node => {
		const scalar = node.kind === "primitive", sequence = node.element !== null;
		const tag = { variant: "kind", option: "has_value", result: "is_ok" }[node.kind];
		return `  { ${scalar ? "LG_SCALAR" : sequence ? "LG_SEQUENCE" : ({ variant: "LG_VARIANT", option: "LG_OPTION", result: "LG_RESULT" }[node.kind] ?? "LG_FIELDS")}, ${node.inhabited}, sizeof(${node.name}), _Alignof(${node.name}), ${node.elementIndex ?? 0}, ${tag ? `offsetof(${node.name}, ${tag})` : 0}, ${sequence ? `offsetof(${node.name}, data), offsetof(${node.name}, length)` : "0, 0"}, ${node.branches.length}, ${node.branches.length ? `lg_branches_${node.index}` : "NULL"}, ${scalar ? `lg_to_${node.index}, lg_from_${node.index}` : "NULL, NULL"} },`;
	});
	return [graphZendDescriptors, scalars, ...thunks, ...fields
		, `static const lg_node lg_nodes[] = {\n${nodes.join("\n")}\n};`
		, graphZendWalk].join("\n\n");
};

const zendCalls = model => {
	const nodes = new Map(model.types.map(node => [node.id, node])), prefix = model.layout.prefix;
	return model.layout.roots.map((fn, index) => {
		const args = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		return `typedef struct {
  lg_walk walk;
  ${args.map((type, index) => `${type.name} input${index};`).join("\n  ")}
  ${result.name} output;
  zval wire;
  uint32_t status;
} lg_context${index};
static void lg_cleanup${index}(lg_context${index} *ctx) {
  ${result.aggregate ? `${result.name}_clear(&ctx->output);` : "/* No native root owner. */"}
  lb_scope_clear(&ctx->walk.scope);
  zval_ptr_dtor(&ctx->wire); LB_ZEND_FREE(ctx);
}
static void lg_execute${index}(lg_context${index} *ctx, zval *args) {
  (void)args;
${args.map((type, i) => `  if (!lg_to(&ctx->walk, ${type.index}, &args[${i}], &ctx->input${i})) return;`).join("\n")}
  ctx->status = ${prefix}_graph_initialize();
  if (!ctx->status) ctx->status = ${fn.name}_graph(${[...args.map((_, i) => `&ctx->input${i}`), "&ctx->output"].join(", ")});
  if (ctx->status) {
    if (ctx->status == 4 || ctx->status > 5) { ${prefix}_graph_retire(); ctx->status = 4; }
    return;
  }
  ctx->walk.visits = 262144;
  if (!lg_from(&ctx->walk, ${result.index}, &ctx->output, &ctx->wire)) {
    if (ctx->walk.scope.failure == 4) { ${prefix}_graph_retire(); ctx->status = 4; }
    return;
  }
  if (!${prefix}_graph_ready()) ctx->status = 5;
}
ZEND_BEGIN_ARG_INFO_EX(lg_args${index}, 0, 0, ${args.length})
${args.map((_, i) => `  ZEND_ARG_INFO(0, arg${i})`).join("\n")}
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_call${index}) {
  if (ZEND_NUM_ARGS() != ${args.length}) { zend_argument_count_error("Expected exactly ${args.length} arguments"); RETURN_THROWS(); }
  zval args[${Math.max(1, args.length)}];
  ${args.length ? `if (zend_get_parameters_array_ex(${args.length}, args) != SUCCESS) RETURN_THROWS();` : ""}
  if (sizeof(lg_context${index}) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lg_context${index} *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->walk.scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx); ctx->walk.visits = 262144;
  ZVAL_NULL(&ctx->wire); ZVAL_NULL(return_value);
  ${result.aggregate ? `${result.name}_init(&ctx->output);` : ""}
  zend_try { lg_execute${index}(ctx, args); }
  zend_catch { lg_cleanup${index}(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->walk.scope.error; int type_error = ctx->walk.scope.type_error;
  uint32_t status = ctx->status;
  if (!message && !status) { ZVAL_COPY_VALUE(return_value, &ctx->wire); ZVAL_UNDEF(&ctx->wire); }
  lg_cleanup${index}(ctx);
  if (status) { zend_throw_exception(zend_ce_exception, message ? message : "Compiled Lean graph call failed", status); RETURN_THROWS(); }
  if (message) {
    if (type_error) zend_type_error("%s", message); else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}`;
	}).join("\n\n");
};

const nativePhp = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	return `<?php
declare(strict_types=1);
${copiedPhpWasmLoader}
namespace ${model.namespace}\\Internal {
require_once __DIR__ . '/Wire.php';
final class Native
{
    private const TRANSPORT = '${model.transport.replaceAll("\\", "\\\\")}';
    private const FUNCTIONS = [
${model.layout.roots.map(root => `        ['parameters' => [${root.parameters.map(id => nodes.get(id).index).join(", ")}], 'result' => ${nodes.get(root.result).index}],`).join("\n")}
    ];
    public static function call(int $function, array $arguments): mixed {
        $fn = self::FUNCTIONS[$function] ?? throw new \\TypeError('Unknown copied function');
        $inputs = GraphWire::arguments($fn['parameters'], $arguments);
        $symbol = self::TRANSPORT . '\\\\call' . $function;
        if (!function_exists($symbol)) {
            try { \\LeanBridge\\CopiedPhpWasmV1\\Loader::load('${model.library}', $symbol); }
            catch (\\Throwable $error) { throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), 0, $error); }
        }
        try { $wire = $symbol(...$inputs); }
        catch (\\Exception $error) { throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), $error->getCode(), $error); }
        try { return GraphWire::fromWire($fn['result'], $wire); }
        catch (GraphInvalidWire $error) {
            $retire = self::TRANSPORT . '\\\\retire'; $retire();
            throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), 4, $error);
        }
    }
}
}
`;
};

/**
 * Emit private Zend source and public PHP values. Package admission is separate.
 *
 * @param ir - Pure copied graph contract.
 */
export const generateCopiedPhpGraphZendAdapter = ir => {
	const model = compileCopiedPhpGraphZendModel(ir), prefix = model.layout.prefix;
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const files = { ...model.files };
	files["src/Api.php"] += `\nrequire_once __DIR__ . '/Internal/Native.php';\n\n${model.functions.map((fn, index) => {
		const root = model.layout.roots[index], result = nodes.get(root.result);
		return `/**
${root.parameters.map((id, n) => ` * @param ${nodes.get(id).docType} $${fn.parameters[n]}`).join("\n")}
 * @return ${result.docType}
 */
function ${fn.publicName}(${fn.parameters.map(name => `mixed $${name}`).join(", ")}): ${result.publicType} {
    if (\\func_num_args() !== ${fn.parameters.length}) throw new \\ArgumentCountError('${fn.publicName} requires exactly ${fn.parameters.length} arguments');
    return Internal\\Native::call(${index}, [${fn.parameters.map(name => `$${name}`).join(", ")}]);
}`;
	}).join("\n\n")}\n`;
	files["src/Internal/Wire.php"] = `<?php\ndeclare(strict_types=1);\nnamespace ${model.namespace}\\Internal;\nrequire_once __DIR__ . '/Values.php';\n${phpGraphWire.replaceAll("GRAPH_NAMESPACE", `\\${model.namespace}`)}\n`;
	files["src/Internal/Native.php"] = nativePhp(model);
	files[`include/${prefix}-graph-types.h`] = model.typesHeader;
	files[`include/${prefix}-graph.h`] = `#include "${prefix}-graph-types.h"\n${model.layout.roots.map(root => `uint32_t ${root.name}_graph(${[...root.parameters.map(id => `const ${nodes.get(id).name} *`), `${nodes.get(root.result).name} *`].join(", ")});`).join("\n")}\nuint32_t ${prefix}_graph_initialize(void);\nint ${prefix}_graph_ready(void);\nvoid ${prefix}_graph_retire(void);\n`;
	files[`extension/${model.stem}.c`] = `#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "${prefix}-graph.h"
_Static_assert(sizeof(zend_long) == 4 && sizeof(size_t) == 4 && sizeof(void *) == 4, "Recursive PHP-Wasm requires a 32-bit host and graph ABI");
_Static_assert(sizeof(bool) == 1, "Bool markers require one byte");
#if PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000
#error This adapter requires PHP 8.2 through 8.x
#endif
#ifdef ZTS
#error This adapter requires a non-thread-safe PHP runtime
#endif
${graphZendSupport}
${descriptorSource(model)}
${zendCalls(model)}
ZEND_BEGIN_ARG_INFO_EX(lg_retire_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lg_retire) {
  if (ZEND_NUM_ARGS()) { zend_argument_count_error("Expected no arguments"); RETURN_THROWS(); }
  ${prefix}_graph_retire(); RETURN_NULL();
}
static const zend_function_entry lg_functions[] = {
${model.functions.map((_, index) => `  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, call${index}, zif_lg_call${index}, lg_args${index})`).join("\n")}
  ZEND_NS_NAMED_FE(${JSON.stringify(model.transport)}, retire, zif_lg_retire, lg_retire_args)
  PHP_FE_END
};
zend_module_entry ${model.stem}_module_entry = {
  STANDARD_MODULE_HEADER, "${model.stem}", lg_functions, NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(${model.stem})
`;
	files["graph-zend-manifest.json"] = canonicalJson({ schemaVersion: 1
		, kind: "lean-bridge-graph-zend-source"
		, component: ir.component.id, bindingIrSha256: model.identity
		, integerBits: 32, wordBits: 32
		, extension: model.stem, library: model.library
		, transport: model.transport, namespace: model.namespace
		, layoutSha256: sha256(canonicalJson(model.layout)), aliases: model.aliases
		, exports: model.functions.map((fn, index) => ({ declaration: fn.bindingId, function: `${model.namespace}\\${fn.publicName}`, transport: `${model.transport}\\call${index}`, cSymbol: `${fn.name}_graph` }))
		, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, { sha256: sha256(source), bytes: Buffer.byteLength(source) }])) });
	return Object.freeze(files);
};
