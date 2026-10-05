/**
 * Finite Ruby value declarations over the checked copied graph model.
 * Native conversion and prepared gem acceptance are separate stages.
 *
 * @file
 */
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";

const constant = name => name.split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("") + (name.match(/_+$/)?.[0] ?? "");
const reservedConstants = new Set("Native GraphValues Unit UNIT LeanBridgeError LeanClosure Some Ok Err Object BasicObject String Array Integer Float Fiddle Gem File Digest Thread Mutex Ractor Encoding RangeError TypeError StandardError Exception Kernel Struct Module Class Scope Lease Monitor Process ObjectSpace ArgumentError LocalJumpError EncodingError NoMemoryError LoadError NativeCopiedRuntimeV1 RUBY_ENGINE RUBY_VERSION RUBY_PLATFORM".split(" "));
const reservedMembers = new Set("nil true false self super class module def end begin rescue ensure return yield alias and or not if unless while until case when then else elsif for in do break next redo retry undef defined initialize initialize_copy new send public_send method_missing object_id freeze frozen hash eql equal dup clone tap inspect to_s respond_to const_get const_set module_function private_constant deconstruct deconstruct_keys raise".split(" "));
const primitive = {
	unit: "UNIT"
	, bool: "true | false"
	, char: "single-scalar String"
	, string: "UTF-8 String"
	, bytes: "binary String"
	, nat: "Integer"
	, int: "Integer"
	, usize: "Integer"
	, isize: "Integer"
	, float32: "Float"
	, float64: "Float"
	, uint8: "Integer", uint16: "Integer", uint32: "Integer", uint64: "Integer"
	, int8: "Integer", int16: "Integer", int32: "Integer", int64: "Integer"
};

const valueClass = (name, fields, parent = null) => `    class ${name}${parent ? ` < ${parent}` : ""}
${parent ? "      public_class_method :new\n" : ""}\
${fields.map(field => `      # ${field.publicName}: ${field.contractType}`).join("\n")}
${fields.length ? `      attr_reader ${fields.map(field => `:${field.publicName}`).join(", ")}\n` : ""}\
      def initialize(${fields.map(field => `${field.publicName}:`).join(", ")})
${fields.map(field => `        @${field.publicName} = ${field.publicName}`).join("\n")}
        GraphValues::FREEZE.bind_call(self)
      end
      def ==(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self))${fields.map(field => ` && @${field.publicName} == GraphValues::FIELD.bind_call(other, :@${field.publicName})`).join("")}
      end
      def eql?(other)
        GraphValues::EXACT.bind_call(other, GraphValues::CLASS.bind_call(self))${fields.map(field => ` && @${field.publicName}.eql?(GraphValues::FIELD.bind_call(other, :@${field.publicName}))`).join("")}
      end
      def hash
        [GraphValues::CLASS.bind_call(self)${fields.map(field => `, @${field.publicName}`).join("")}].hash
      end
      def deconstruct_keys(_keys)
        { ${fields.map(field => `${field.publicName}: @${field.publicName}`).join(", ")} }
      end
    end`;

/**
 * Keep nominal recursive edges and alias targets finite without exposing C tags
 * or generating aliases as fake Ruby classes. Value payloads validate at calls.
 *
 * @param ir - Concrete, pure copied Binding IR.
 */
export const generateCopiedRubyGraphValues = ir => {
	const layout = compileCopiedCGraphLayout(ir), componentName = constant(layout.prefix);
	if(reservedConstants.has(componentName)) throw new TypeError(`Ruby graph component name is reserved: ${componentName}`);
	const definitions = [...ir.types].sort((a, b) => a.id.localeCompare(b.id));
	const names = new Map(), occupied = new Set([...reservedConstants, componentName]);
	for(const definition of definitions)
	{
		const name = constant(definition.name);
		if(!/^[A-Z][A-Za-z0-9_]*$/.test(name) || occupied.has(name))
			throw new TypeError(`Ruby graph value name is reserved or duplicated: ${name}`);
		occupied.add(name); names.set(definition.id, name);
	}
	const contract = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
		? definitions.find(definition => definition.id === ref.id).name
		: `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	const members = (fields, sourceFields) => {
		const seen = new Set();
		return fields.map((field, index) => {
			const publicName = field.name;
			if(!/^[a-z][a-z0-9_]*$/.test(publicName) || reservedMembers.has(publicName) || seen.has(publicName))
				throw new TypeError(`Ruby graph field name is reserved or duplicated: ${publicName}`);
			seen.add(publicName); return { ...field, publicName, contractType: contract(sourceFields[index].type) };
		});
	};
	const types = layout.nodes.map((node, index) => {
		const definition = node.ref.kind === "named" ? definitions.find(type => type.id === node.ref.id) : null;
		const publicType = definition ? names.get(definition.id) : node.kind === "primitive" ? primitive[node.ref.name]
			: node.element || node.kind === "tuple" ? "Array" : node.kind === "option" ? "nil | Some" : "Ok | Err";
		const constructors = new Set();
		return { ...node, index, publicType
			, fields: node.kind === "record" ? members(node.fields, definition.fields) : node.fields
			, cases: node.cases.map(branch => {
				const name = constant(branch.sourceName);
				if(!/^[A-Z][A-Za-z0-9_]*$/.test(name) || name === "GraphValues" || constructors.has(name))
					throw new TypeError(`Ruby graph constructor name is reserved, invalid or duplicated: ${name}`);
				constructors.add(name);
				const source = definition.cases.find(item => item.name === branch.sourceName);
				return { ...branch, publicName: `${publicType}::${name}`, fields: members(branch.fields, source.fields) };
			})
		};
	});
	const functions = layout.roots.map(root => {
		const publicName = root.name.slice(layout.prefix.length + 1);
		// These are always qualified module methods, never loader/helper calls.
		if(reservedMembers.has(publicName) && !["next", "inspect"].includes(publicName))
			throw new TypeError(`Ruby graph function name is reserved: ${publicName}`);
		const declaration = ir.declarations.find(item => item.id === root.bindingId);
		return { ...root, publicName, declaration, parameters: declaration.parameters.map((_, index) => `arg${index}`) };
	});
	const aliases = definitions.filter(definition => definition.kind === "alias").map(definition => {
		const target = types.find(node => node.id === layout.aliases.find(alias => alias.id === definition.id).target);
		return { id: definition.id, name: definition.name, target: definition.target
			, contractType: contract(definition.target)
			, rubyType: target.ref.kind === "named" || target.ref.name === "unit" ? `LeanBridge::${componentName}::${target.publicType}` : target.publicType };
	});
	const nominal = types.filter(node => ["record", "variant"].includes(node.kind));
	const wrappers = [...types.some(node => node.kind === "option") ? ["Some"] : []
		, ...types.some(node => node.kind === "result") ? ["Ok", "Err"] : []];
	const exports = ["UNIT", ...wrappers, ...nominal.flatMap(node => [node.publicType, ...node.cases.map(branch => branch.publicName)])];
	const source = `# frozen_string_literal: true
module LeanBridge
  module ${componentName}
    # Finite copied Lean values. Payload validation occurs at the call boundary.
    # Aliases retain their contract names and targets, not separate Ruby constants.
${aliases.map(alias => `    # ${alias.name} = ${alias.contractType}; Ruby: ${alias.rubyType}`).join("\n")}
    UNIT = ::Object.new.freeze
${wrappers.map(name => `    ${name} = ::Data.define(:value)`).join("\n")}
    module GraphValues
      EXACT = ::Object.instance_method(:instance_of?)
      CLASS = ::Object.instance_method(:class)
      FIELD = ::Object.instance_method(:instance_variable_get)
      FREEZE = ::Object.instance_method(:freeze)
    end
${nominal.map(node => node.kind === "record" ? valueClass(node.publicType, node.fields)
	: `    class ${node.publicType}\n      private_class_method :new\n    end\n${node.cases.map(branch => valueClass(branch.publicName, branch.fields, node.publicType)).join("\n")}`).join("\n")}
    private_constant :GraphValues
  end
end
`;
	return { layout, types, functions, aliases, exports, componentName
		, namespace: `LeanBridge::${componentName}`
		, requirePath: `lean_bridge/${layout.prefix}`
		, source };
};
