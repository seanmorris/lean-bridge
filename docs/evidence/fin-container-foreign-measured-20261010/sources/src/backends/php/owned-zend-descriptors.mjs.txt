/**
 * Checked wasm32 value walkers with opaque Zend-resource identity hooks.
 *
 * @file
 */
import { copiedZendConversions } from "./copied-zend-conversions.mjs";
import { graphZendCheckedWalk, graphZendDescriptors } from "./copied-graph-zend-runtime.mjs";

/**
 * The ownership runtime defines lgo_identity_input/output. They validate the
 * nominal kind and live lease; uint64 tokens never become PHP numeric values.
 * Scalar and aggregate checks reuse the existing iterative Zend walker.
 *
 * @param model - Exact public PHP names and private wasm32 layout.
 */
export const ownedZendDescriptorSource = model => {
	const scalar = model.descriptors.filter(node => node.kind === "primitive");
	const conversions = copiedZendConversions({ surface: { copies: scalar.map(node => ({
		index: node.index
		, scalarName: { usize: "uint32", isize: "int32" }[node.scalar] ?? node.scalar
		, ctype: node.cName, publicType: node.publicType
	})) } });
	const hooks = model.descriptors.filter(node => node.identity || node.kind === "primitive").map(node => `
static int lg_to_${node.index}(zval *value, void *out, lb_scope *scope) {
  ${node.identity ? `return lgo_identity_input(scope, ${node.index}, value, &((${node.cName} *)out)->token);`
		: `return lb_to${node.index}(value, (${node.cName} *)out, scope);`}
}
static int lg_from_${node.index}(const void *value, zval *out, lb_scope *scope) {
  ${node.identity ? `return lgo_identity_output(scope, ${node.index}, ((const ${node.cName} *)value)->token, out);`
		: `return lb_from${node.index}((const ${node.cName} *)value, out, scope);`}
}`);
	const branches = model.descriptors.flatMap(node => [
		...node.branches.flatMap((branch, index) => branch.fields.length ? [`static const lg_field lg_fields_${node.index}_${index}[] = {
${branch.fields.map(field => `  { ${field.type}, offsetof(${node.cName}, ${field.path}), ${field.pointer} },`).join("\n")}
};`] : [])
		, ...node.branches.length ? [`static const lg_branch lg_branches_${node.index}[] = { ${node.branches.map((branch, index) => `{ ${branch.fields.length}, ${branch.fields.length ? `lg_fields_${node.index}_${index}` : "NULL"} }`).join(", ")} };`] : []
	]);
	const nodes = model.descriptors.map(node => {
		const leaf = node.identity || node.kind === "primitive", sequence = node.element !== null;
		const kind = leaf ? "LG_SCALAR" : sequence ? "LG_SEQUENCE"
			: { variant: "LG_VARIANT", option: "LG_OPTION", result: "LG_RESULT" }[node.kind] ?? "LG_FIELDS";
		return `  { ${kind}, ${node.inhabited}, sizeof(${node.cName}), _Alignof(${node.cName}), ${node.element ?? 0}, ${node.tag ? `offsetof(${node.cName}, ${node.tag})` : 0}, ${sequence ? `offsetof(${node.cName}, data), offsetof(${node.cName}, length)` : "0, 0"}, ${node.branches.length}, ${node.branches.length ? `lg_branches_${node.index}` : "NULL"}, ${leaf ? `lg_to_${node.index}, lg_from_${node.index}` : "NULL, NULL"} },`;
	});
	return [graphZendDescriptors, conversions, ...hooks, ...branches
		, `static const lg_node lg_nodes[] = {\n${nodes.join("\n")}\n};`
		, graphZendCheckedWalk].join("\n\n");
};
