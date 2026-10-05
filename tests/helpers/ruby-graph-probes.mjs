/**
 * Independent C layout probes and Ruby conversion fixtures.
 *
 * @file
 */
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { rubyLiteral } from "../../src/backends/ruby/copied-assets.mjs";

/** Optional and result links check recursive record pointer edges. */
export const rubyConversionIr = () => {
	const ir = nativeRecursiveReviewedIr(), record = ir.types.find(type => type.name === "Scalars");
	for(const [name, constructor] of [["Link", "option"], ["ResultLink", "result"]])
	{
		const root = { kind: "named", id: `lean:Recursive.${name}` };
		const tail = { kind: "apply", constructor
			, arguments: [root, ...constructor === "result" ? [{ kind: "primitive", name: "string" }] : []] };
		ir.types.push({
			...record
			, id: root.id
			, name
			, fields: [{ ...record.fields[0], name: "tail", type: tail }] });
		const template = ir.declarations[0];
		ir.declarations.push({
			...structuredClone(template)
			, id: `lean:Recursive.echo${name}`
			, name: `echo${name}`
			, overloadKey: `echo${name}`
			, parameters: [{ ...template.parameters[0], type: root }]
			, result: { ...template.result, type: root } });
	}
	return ir;
};

/**
 * Compare generated offsets with independently compiled sizeof/alignof/offsetof.
 *
 * @param model - Generated Ruby graph conversion model.
 */
export const rubyGraphLayouts = model => {
	const c = [], ruby = [];
	for(const node of model.types)
	{
		c.push(`sizeof(${node.name})`, `_Alignof(${node.name})`); ruby.push(node.size, node.alignment);
		if(!node.aggregate) continue;
		const fields = [["_bridge_owner", node.ownerOffset], ["_bridge_release", node.releaseOffset]];
		if(node.kind === "primitive" || node.element) fields.push(["data", node.dataOffset], ["length", node.lengthOffset]);
		if(node.ref.name === "int") fields.push(["negative", node.negativeOffset]);
		if(node.kind === "variant") fields.push(["kind", node.kindOffset], ["cases", node.payloadOffset]);
		if(node.kind === "option") fields.push(["has_value", node.flagOffset]);
		if(node.kind === "result") fields.push(["is_ok", node.flagOffset]);
		for(const field of node.fields) fields.push([field.name, field.offset]);
		for(const branch of node.cases) for(const field of branch.fields) fields.push([`cases.${branch.name}.${field.name}`, node.payloadOffset + field.offset]);
		for(const [field, offset] of fields)
		{ c.push(`offsetof(${node.name}, ${field})`); ruby.push(offset); }
	}
	return { count: c.length, expected: ruby
		, c: `static const size_t graph_layout[] = {${c.join(", ")}};
size_t graph_fixture_layout_count(void) { return sizeof(graph_layout) / sizeof(*graph_layout); }
size_t graph_fixture_layout(size_t index) { return graph_layout[index]; }
void graph_fixture_clear(void *value) {
  struct owner { void *pointer; void (*release)(void *); } owner;
  memcpy(&owner, value, sizeof(owner)); memset(value, 0, sizeof(owner));
  if (owner.pointer && owner.release) owner.release(owner.pointer);
}
` };
};

/**
 * Private test module. It exposes instrumentation, never a prepared gem API.
 *
 * @param model - Generated Ruby graph conversions.
 */
export const rubyGraphProbeModule = model => `${model.valuesSource}
module LeanBridge
  module ${model.componentName}
    class LeanBridgeError < ::StandardError
      attr_reader :status
      def initialize(status, message)
        super(message)
        @status = status
      end
    end
  end
end
${model.source}
module LeanBridge
  module ${model.componentName}
    module Native
      TYPES = ::JSON.parse(${rubyLiteral(JSON.stringify(model.types))})
      ROOTS = ::JSON.parse(${rubyLiteral(JSON.stringify(model.layout.roots))})
      LAYOUT = ${JSON.stringify(rubyGraphLayouts(model).expected)}
    end
  end
end
`;
