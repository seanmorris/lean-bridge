/**
 * Finite Ruby value types for explicit resource ownership graphs.
 *
 * @file
 */
import { generateOwnedCValues } from "../c/owned-values.mjs";
import { cIdentifier } from "../c/generate.mjs";

const constant = name => name.split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("") + (name.match(/_+$/u)?.[0] ?? "");
const reservedConstants = new Set("Native Owned OwnedValues Unit UNIT LeanBridgeError Some Ok Err WithRecovery Object BasicObject String Array Integer Float Fiddle Gem File Digest Thread Mutex Ractor Encoding RangeError TypeError StandardError Exception Kernel Struct Data Module Class Scope Lease Monitor Process ObjectSpace ArgumentError LocalJumpError EncodingError NoMemoryError LoadError NativeCopiedRuntimeV1 RUBY_ENGINE RUBY_VERSION RUBY_PLATFORM".split(" "));
const reservedMembers = new Set("nil true false self super class module def end begin rescue ensure return yield alias and or not if unless while until case when then else elsif for in do break next redo retry undef defined initialize initialize_copy initialize_dup initialize_clone new send public_send method method_missing object_id freeze frozen hash eql equal dup clone tap inspect to_s respond_to const_get const_set module_function private_constant deconstruct deconstruct_keys raise require with_recovery".split(" "));
const primitive = {
	unit: "UNIT", bool: "true | false", char: "single-scalar String"
	, string: "UTF-8 String", bytes: "binary String"
	, nat: "Integer", int: "Integer"
	, usize: "Integer", isize: "Integer", float32: "Float", float64: "Float"
	, uint8: "Integer", uint16: "Integer", uint32: "Integer", uint64: "Integer"
	, int8: "Integer", int16: "Integer", int32: "Integer", int64: "Integer"
};

const valueClass = (name, fields, parent = null) => `    class ${name}${parent ? ` < ${parent}` : ""}
${parent ? "      public_class_method :new\n" : ""}\
${fields.map(field => `      # ${field.publicName}: ${field.contractType}`).join("\n")}
${fields.length ? `      attr_reader ${fields.map(field => `:${field.publicName}`).join(", ")}\n` : ""}\
      def initialize(${fields.map(field => `${field.publicName}:`).join(", ")})
${fields.map(field => `        @${field.publicName} = ${field.publicName}`).join("\n")}
        OwnedValues::FREEZE.bind_call(self)
      end
      def ==(other)
        OwnedValues::EXACT.bind_call(other, OwnedValues::CLASS.bind_call(self))${fields.map(field => ` && @${field.publicName} == OwnedValues::FIELD.bind_call(other, :@${field.publicName})`).join("")}
      end
      def eql?(other)
        OwnedValues::EXACT.bind_call(other, OwnedValues::CLASS.bind_call(self))${fields.map(field => ` && @${field.publicName}.eql?(OwnedValues::FIELD.bind_call(other, :@${field.publicName}))`).join("")}
      end
      def hash
        [OwnedValues::CLASS.bind_call(self)${fields.map(field => `, @${field.publicName}`).join("")}].hash
      end
      def deconstruct_keys(_keys)
        { ${fields.map(field => `${field.publicName}: @${field.publicName}`).join(", ")} }
      end
    end`;

/**
 * Preserve nominal constructors and shared resource wrappers in ordinary Ruby
 * containers. These declarations do not enable transport or package admission.
 *
 * @param ir - Concrete ownership-aware Binding IR.
 * @param options - Explicit C transport capabilities.
 * @param options.transferredInputs - Admit consuming resource-containing inputs.
 * @param options.anchoredResults - Admit original-owner borrowed results.
 */
export const generateOwnedRubyValues = (ir, { transferredInputs = false, anchoredResults = false } = {}) => {
	const c = generateOwnedCValues(ir, { hostCallbacks: true, transferredInputs, anchoredResults });
	const anchored = c.functions.some(fn => fn.anchor !== undefined);
	const componentName = constant(c.prefix), occupied = new Set(reservedConstants), names = new Map();
	if(anchored) occupied.add("Value");
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Z][A-Za-z0-9_]*$/u.test(name) || name.includes("__") || occupied.has(name))
			throw new TypeError(`Owned Ruby name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	claim(componentName);
	const definitions = new Map(ir.types.map(node => [node.id, node]));
	for(const node of c.nodes) if(node.kind !== "primitive" && node.name) names.set(node.id, claim(constant(node.name)));
	for(const alias of c.native.aliases) claim(constant(definitions.get(alias.id).name));
	const contract = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
		? definitions.get(ref.id).name : `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	const members = (fields, original) => {
		const seen = new Set();
		return fields.map((field, index) => {
			const name = cIdentifier(field.sourceName), publicName = reservedMembers.has(name) ? `${name}_` : name;
			if(!/^[a-z][a-z0-9_]*$/u.test(publicName) || seen.has(publicName))
				throw new TypeError(`Owned Ruby field name is invalid or duplicated: ${publicName}`);
			seen.add(publicName);
			return { ...field, publicName, contractType: contract(original[index].type) };
		});
	};
	const types = c.nodes.map((node, index) => {
		const definition = definitions.get(node.id), constructors = new Set();
		const publicType = node.kind === "primitive" ? primitive[node.name] : names.get(node.id)
			?? (node.element || node.kind === "tuple" ? "Array" : node.kind === "option" ? "nil | Some" : "Ok | Err");
		return { ...node, index, publicType
			, fields: node.kind === "record" ? members(node.fields, definition.fields) : node.fields
			, cases: node.cases.map(branch => {
				const name = constant(branch.sourceName);
				if(!/^[A-Z][A-Za-z0-9_]*$/u.test(name) || name === "OwnedValues" || constructors.has(name))
					throw new TypeError(`Owned Ruby constructor name is invalid or duplicated: ${name}`);
				constructors.add(name);
				return { ...branch, publicName: `${publicType}::${name}`
					, fields: members(branch.fields, definition.cases.find(item => item.name === branch.sourceName).fields) };
			})
		};
	});
	const functions = c.functions.map(fn => {
		const publicName = fn.cName.slice(c.prefix.length + 1);
		if(anchored && publicName === "copy_value") throw new TypeError("Owned Ruby function name is reserved: copy_value");
		if(reservedMembers.has(publicName) && !["next", "inspect"].includes(publicName))
			throw new TypeError(`Owned Ruby function name is reserved: ${publicName}`);
		return { ...fn, publicName };
	});
	const table = new Map(types.map(node => [node.id, node]));
	const aliases = c.native.aliases.map(alias => ({ ...alias
		, name: definitions.get(alias.id).name
		, contractType: contract(definitions.get(alias.id).target)
		, rubyType: table.get(alias.target).publicType }));
	const wrappers = [...types.some(node => node.kind === "option") ? ["Some"] : []
		, ...types.some(node => node.kind === "result") ? ["Ok", "Err"] : []];
	const nominal = types.filter(node => names.has(node.id));
	const exports = ["UNIT", "LeanBridgeError", ...wrappers
		, ...anchored ? ["Value", "copy_value"] : []
		, ...nominal.flatMap(node => [node.publicType, ...node.cases.map(branch => branch.publicName)])
		, ...c.callbacks.length ? ["WithRecovery", "with_recovery"] : []
		, ...functions.map(fn => fn.publicName)];
	const declarations = nominal.map(node => {
		if(node.identity)
		{
			const callback = c.callbacks.find(fn => fn.id === node.id);
			const args = callback?.parameters.slice(1).map((_, i) => `arg${i}`) ?? [];
			return `    class ${node.publicType} < Owned::Resource
      def retain; Native.retain${node.index}(self); end
${anchored ? `      def same_identity?(other); Native.same${node.index}(self, other); end
      def ==(other); same_identity?(other); end
      alias eql? ==
` : ""}\
${callback ? `      def call(${args.join(", ")}); Native.invoke${node.index}(${["self", ...args].join(", ")}); end\n` : ""}\
    end`;
		}
		return node.kind === "record" ? valueClass(node.publicType, node.fields)
			: `    class ${node.publicType}\n      private_class_method :new\n    end\n${node.cases.map(branch => valueClass(branch.publicName, branch.fields, node.publicType)).join("\n")}`;
	});
	const methods = functions.map((fn, index) => {
		const args = fn.parameters.map((_, i) => `arg${i}`).join(", ");
		return `${fn.transfers?.length ? `    # Consumes resource leases in ${fn.transfers.map(i => `arg${i}`).join(", ")} at the Lean call boundary.
    # Shared aliases close together; independently retained owners stay usable.
    # Validation failures preserve ownership; post-handoff failures consume it.
` : ""}    def self.${fn.publicName}(${args}); Native.call${index}(${args}); end`;
	});
	const source = `# frozen_string_literal: true
module LeanBridge
  module ${componentName}
    # Value fields validate at the call boundary. Ruby container copies keep
    # their resource wrappers; retain gives a resource an independent owner.
    # Aliases preserve their contract names without creating fake Ruby classes.
${aliases.map(alias => `    # ${alias.name} = ${alias.contractType}; Ruby: ${alias.rubyType}`).join("\n")}
    UNIT = ::Object.new.freeze
    LeanBridgeError = Owned::Error
${anchored ? `    Value = Owned::Value
    def self.copy_value(value, result_of: nil, parameter_of: nil)
      Native.copy_value(value, result_of: result_of, parameter_of: parameter_of)
    end
` : ""}\
${wrappers.map(name => `    ${name} = ::Data.define(:value)`).join("\n")}
${c.callbacks.length ? `    WithRecovery = ::Data.define(:function, :recovery)
    def self.with_recovery(function, recovery)
      WithRecovery.new(function: function, recovery: recovery)
    end` : ""}
    module OwnedValues
      EXACT = ::Object.instance_method(:instance_of?)
      CLASS = ::Object.instance_method(:class)
      FIELD = ::Object.instance_method(:instance_variable_get)
      FREEZE = ::Object.instance_method(:freeze)
    end
${declarations.join("\n")}
${methods.join("\n")}
    private_constant :OwnedValues
  end
end
`;
	return { c, types, functions, aliases, exports, componentName
		, namespace: `LeanBridge::${componentName}`
		, requirePath: `lean_bridge/${c.prefix}`, source };
};
