/**
 * Exact bounded Ruby conversions over the ownership-aware public C ABI.
 *
 * @file
 */
import { compileOwnedRubyLayout } from "./owned-layout.mjs";
import { ownedRubyConversionSupport } from "./owned-conversion-runtime.mjs";
import { ownedRubyCallBoundary } from "./owned-call-boundary.mjs";
import { ownedRubyCallbacks } from "./owned-callables.mjs";

/**
 * Generate resource-aware snapshots, typed function wrappers and callback frames.
 * Installed admission additionally requires authenticated native assets.
 *
 * @param ir - Concrete ownership-aware Binding IR.
 */
export const generateOwnedRubyConversions = ir => {
	const model = compileOwnedRubyLayout(ir), boundary = ownedRubyCallBoundary(model);
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const publicName = name => `::${model.namespace}::${name}`;
	const read = (node, value, offset = 0) => node.aggregate ? `(${value} + ${offset})` : `${value}[${offset}, ${node.size}].unpack1("${node.pack}")`;
	const write = (node, value, offset, input) => `${value}[${offset}, ${node.size}] = ${node.aggregate ? `${input}[0, ${node.size}]` : `[${input}].pack("${node.pack}")`}`;
	const finite = new Set(); let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.leaf || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(!finite.has(node.id) && inhabited)
			{ finite.add(node.id); changed = true; }
		}
	}
	const methods = [];
	for(const node of nodes.values())
	{
		const input = [], output = [], i = node.index;
		const childInput = (field, expression, offset) => {
			const child = nodes.get(field.type);
			return [`child = input${child.index}(${expression}, scope, depth + 1)`
				, `${field.pointer ? `out[${offset}, 8] = [child.to_i].pack("Q<")` : write(child, "out", offset, "child")} unless scope.check_only`];
		};
		const childOutput = (field, offset) => {
			const child = nodes.get(field.type);
			return `output${child.index}(${field.pointer ? `pointer(value[${offset}, 8].unpack1("Q<"), ${child.size}, ${child.alignment})` : read(child, "value", offset)}, scope, output, depth + 1)`;
		};
		if(!finite.has(node.id))
		{ input.push('raise ArgumentError, "The declared type has no finite value"'); output.push('raise Invalid, "Uninhabited native value"'); }
		else if(node.identity)
		{
			input.push(`raise TypeError, "Expected exact ${node.publicType}" unless exact?(value, ${publicName(node.publicType)})`
				, "handle = RESOURCE_RAW.bind_call(value, scope.state)", "scope.pin_lease(FIELD.bind_call(value, :@guard).lease)", "handle");
			output.push('raise Invalid, "Missing native resource" if value.zero?', "scope.charge(:storage, 256)"
				, `${publicName(node.publicType)}.from_lease(output.hold, value)`);
		}
		else if(node.kind === "primitive")
		{
			const { name } = node;
			if(name === "unit")
			{
				input.push(`raise TypeError, "Unit requires UNIT" unless SAME.bind_call(value, ${publicName("UNIT")})`, "0");
				output.push('raise Invalid, "Invalid native Unit" unless value.zero?', publicName("UNIT"));
			}
			else if(name === "bool")
			{
				input.push('raise TypeError, "Bool requires true or false" unless SAME.bind_call(value, true) || SAME.bind_call(value, false)', "value ? 1 : 0");
				output.push('raise Invalid, "Invalid native Bool" unless value == 0 || value == 1', "value == 1");
			}
			else if(name === "char")
			{
				input.push("snapshot = string(value, scope, 4)", 'raise EncodingError, "Char requires valid UTF-8 or US-ASCII" unless text?(snapshot)'
					, 'raise RangeError, "Char requires one Unicode scalar" unless STRING_LENGTH.bind_call(snapshot) == 1', "STRING_ORD.bind_call(snapshot)");
				output.push('raise Invalid, "Invalid native Char" if value > 0x10ffff || value.between?(0xd800, 0xdfff)'
					, "scope.charge(:storage, 128)", "Owned.checkpoint", "value.chr(::Encoding::UTF_8)");
			}
			else if(node.integer)
			{
				input.push(`integer(value${name === "nat" ? ", 0" : ""})`, "length = (value.abs.bit_length + 63) / 64"
					, "scope.charge(:native, 16)", "scope.charge(:native, length, 8)", "scope.charge(:storage, length, 32)"
					, "out = scope.allocate(16)", "data = scope.allocate(length * 8)", "unless scope.check_only"
					, '  data[0, length * 8] = [value.abs.to_s(16).rjust(length * 16, "0")].pack("H*").reverse unless length.zero?'
					, '  out[0, 16] = [0, value < 0 ? -length : length, length.zero? ? 0 : data.to_i].pack("l<l<Q<")'
					, "end", "scope.check_only ? nil : out.to_i");
				output.push("scope.charge(:native, 16)", "raw = pointer(value, 16, 8)", 'allocated, size, address = raw[0, 16].unpack("l<l<Q<")', "length = size.abs"
					, ...name === "nat" ? ['raise Invalid, "Negative native Nat" if size < 0'] : []
					, 'raise Invalid, "Invalid native GMP capacity" if allocated < 0 || allocated != 0 && allocated < length'
					, "scope.charge(:native, length, 8)", "scope.charge(:storage, length, 32)", "span(address, length, 8, 8)", "Owned.checkpoint"
					, 'bytes = length.zero? ? +"".b : ::Fiddle::Pointer.new(address)[0, length * 8]'
					, 'raise Invalid, "Noncanonical native GMP integer" if length > 0 && bytes[-8, 8].unpack1("Q<").zero?'
					, 'magnitude = length.zero? ? 0 : bytes.reverse.unpack1("H*").to_i(16)', "size < 0 ? -magnitude : magnitude");
			}
			else if(name === "string" || name === "bytes")
			{
				input.push("snapshot = string(value, scope)"
					, ...name === "string" ? ['raise EncodingError, "String requires valid UTF-8 or US-ASCII" unless text?(snapshot)'] : []
					, "length = STRING_SIZE.bind_call(snapshot)", "scope.charge(:native, length)", "out = scope.allocate(16)", "data = scope.allocate(length)"
					, "unless scope.check_only", "  data[0, length] = snapshot unless length.zero?"
					, '  out[0, 16] = [length.zero? ? 0 : data.to_i, length].pack("Q<Q<")', "end", "out");
				output.push('address, length = value[0, 16].unpack("Q<Q<")', "scope.charge(:native, length)", "scope.charge(:storage, length)", "scope.charge(:storage, 128)"
					, "span(address, length, 1, 1)", "Owned.checkpoint", 'bytes = length.zero? ? +"".b : ::Fiddle::Pointer.new(address)[0, length]');
				if(name === "string") output.push("bytes.force_encoding(::Encoding::UTF_8)", 'raise Invalid, "Invalid native UTF-8" unless STRING_VALID.bind_call(bytes)', "bytes");
				else output.push("bytes.force_encoding(::Encoding::BINARY)");
			}
			else if(name.startsWith("float"))
			{
				input.push('raise TypeError, "Expected exact Float" unless exact?(value, ::Float)', name === "float32" ? '[value].pack("e").unpack1("e")' : "value");
				output.push("scope.charge(:storage, 32)", "value");
			}
			else
			{
				const signed = name.startsWith("int") || name === "isize", bits = name.endsWith("size") ? 64 : Number(name.match(/\d+/u)[0]);
				input.push(`integer(value, ${signed ? `-(1 << ${bits - 1})` : "0"}, (1 << ${signed ? bits - 1 : bits}) - 1)`);
				output.push("scope.charge(:storage, 40)", "value");
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			input.push("snapshot = array(value, scope)", "length = ARRAY_LENGTH.bind_call(snapshot)", `out = scope.allocate(${node.size})`, `data = scope.allocate(length * ${child.size})`
				, "length.times do |index|", `  child = input${child.index}(ARRAY_GET.bind_call(snapshot, index), scope, depth + 1)`
				, `  ${write(child, "data", `index * ${child.size}`, "child")} unless scope.check_only`, "end"
				, 'out[0, 16] = [length.zero? ? 0 : data.to_i, length].pack("Q<Q<") unless scope.check_only', "out");
			output.push('address, length = value[0, 16].unpack("Q<Q<")', 'raise Limit, "Array exceeds the visit limit" if length > scope.nodes'
				, "scope.charge(:storage, length, 8)", "scope.charge(:storage, 128)", `span(address, length, ${child.size}, ${child.alignment})`
				, "Owned.checkpoint", "data = ::Fiddle::Pointer.new(address)"
				, `::Array.new(length) { |index| output${child.index}(${read(child, "data", `index * ${child.size}`)}, scope, output, depth + 1) }`);
		}
		else if(node.kind === "variant")
		{
			node.cases.forEach((branch, index) => {
				input.push(`${index ? "elsif" : "if"} exact?(value, ${publicName(branch.publicName)})`
					, ...branch.fields.map((field, j) => `  field${j} = FIELD.bind_call(value, :@${field.publicName})`)
					, `  out = scope.allocate(${node.size})`, `  out[0, 4] = [${index}].pack("L<") unless scope.check_only`
					, ...branch.fields.flatMap((field, j) => childInput(field, `field${j}`, node.payloadOffset + field.offset)).map(line => `  ${line}`), "  out");
				output.push(`${index ? "elsif" : "if"} value[0, 4].unpack1("L<") == ${index}`, `  scope.charge(:storage, ${256 + branch.fields.length * 16})`
					, "  Owned.checkpoint", `  ${publicName(branch.publicName)}.new(${branch.fields.map(field => `${field.publicName}: ${childOutput(field, node.payloadOffset + field.offset)}`).join(", ")})`);
			});
			input.push("else", `  raise TypeError, "Expected exact ${node.publicType} constructor"`, "end");
			output.push("else", `  raise Invalid, "Invalid native ${node.publicType} tag"`, "end");
		}
		else if(["option", "result"].includes(node.kind))
		{
			const option = node.kind === "option";
			if(option)
			{
				input.push(`return scope.allocate(${node.size}) if SAME.bind_call(value, nil)`);
				output.push('return nil if value[0, 1].unpack1("C").zero?');
			}
			node.fields.forEach((field, index) => {
				const wrapper = option ? "Some" : index ? "Err" : "Ok", flag = index ? 0 : 1;
				input.push(`${index ? "elsif" : "if"} exact?(value, ${publicName(wrapper)})`, "  payload = ARRAY_GET.bind_call(DATA_FIELDS.bind_call(value), 0)"
					, `  out = scope.allocate(${node.size})`, `  out[0, 1] = [${flag}].pack("C") unless scope.check_only`
					, ...childInput(field, "payload", field.offset).map(line => `  ${line}`), "  out");
				output.push(`${index ? "elsif" : "if"} value[0, 1].unpack1("C") == ${flag}`, "  scope.charge(:storage, 272)", "  Owned.checkpoint"
					, `  ${publicName(wrapper)}.new(${childOutput(field, field.offset)})`);
			});
			input.push("else", `  raise TypeError, "Expected ${option ? "nil or Some(value)" : "Ok(value) or Err(value)"}"`, "end");
			output.push("else", '  raise Invalid, "Invalid native constructor flag"', "end");
		}
		else
		{
			const tuple = node.kind === "tuple";
			input.push(...tuple ? ["snapshot = array(value, scope, true)"] : [`raise TypeError, "Expected exact ${node.publicType}" unless exact?(value, ${publicName(node.publicType)})`
				, ...node.fields.map((field, j) => `field${j} = FIELD.bind_call(value, :@${field.publicName})`)]
			, `out = scope.allocate(${node.size})`
			, ...node.fields.flatMap((field, j) => childInput(field, tuple ? `ARRAY_GET.bind_call(snapshot, ${j})` : `field${j}`, field.offset)), "out");
			output.push(`scope.charge(:storage, ${256 + node.fields.length * 16})`, "Owned.checkpoint"
				, tuple ? `[${node.fields.map(field => childOutput(field, field.offset)).join(", ")}]`
					: `${publicName(node.publicType)}.new(${node.fields.map(field => `${field.publicName}: ${childOutput(field, field.offset)}`).join(", ")})`);
		}
		methods.push(`      def input${i}(value, scope, depth = 0)
        key = ${node.leaf ? "nil" : "IDENTIFY.bind_call(value)"}
        scope.enter(key, depth, ${node.size})
        begin
${input.map(line => `          ${line}`).join("\n")}
        ensure
          scope.leave(key)
        end
      end
      def output${i}(value, scope, output, depth = 0)
        key = ${node.leaf ? "nil" : `[${i}, value.to_i]`}
        scope.enter(key, depth, ${node.size}, true)
        begin
${output.map(line => `          ${line}`).join("\n")}
        ensure
          scope.leave(key)
        end
      end`);
	}
	const bindings = [];
	for(const fn of boundary.calls)
	{
		const { parameters, result, hosts } = fn, args = parameters.map((_, i) => `arg${i}`);
		const input = (node, i, checking) => hosts[i] ? `host${node.index}(arg${i}, ${checking ? "checked" : "scope, frame"})` : `input${node.index}(arg${i}, ${checking ? "checked" : "scope"})`;
		bindings.push(`        functions[:${fn.name}] = ::Fiddle::Function.new(runtime.library[${JSON.stringify(fn.symbol)}], [${Array(parameters.length + 3).fill("::Fiddle::TYPE_VOIDP").join(", ")}], ::Fiddle::TYPE_INT, need_gvl: true)`);
		const inputs = parameters.flatMap((node, i) => hosts[i] || node.aggregate
			? [`            input${i} = ${input(node, i, false)}`]
			: [`            raw${i} = ${input(node, i, false)}`, `            input${i} = scope.allocate(${node.size})`, `            ${write(node, `input${i}`, 0, `raw${i}`)}`]);
		methods.push(`      def ${fn.name}(${args.join(", ")})
        raise RuntimeError, "Build the native adapter before calling this API" unless @runtime
        Owned.atomic do
          state = @runtime.current_state
          checked = ValueScope.new(state, true)
          begin
${parameters.map((node, i) => `            ${input(node, i, true)}`).join("\n")}
          ensure
            checked.close
          end
          scope, frame = nil, nil
          begin
            scope = ValueScope.new(state)
            frame = CallFrame.new(state, scope)
${inputs.join("\n")}
            raw = scope.allocate(${result.size})
            state.with_result do |owner|
              status = @functions[:${fn.name}].call(${["state.require_open", ...args.map((_, i) => `input${i}`), "raw", "owner.pointer"].join(", ")})
              frame.finish(status)
              output${result.index}(${read(result, "raw")}, scope, Output.new(owner))
            end
          rescue Invalid
            @runtime.retire
            raise
          ensure
            begin
              frame&.close
            ensure
              scope&.close
            end
          end
        end
      end`);
	}
	const callbacks = ownedRubyCallbacks(model, boundary, { read, write });
	const source = `require "fiddle"
module LeanBridge
  module ${model.componentName}
    module Native
      extend self
${ownedRubyConversionSupport(model.c.native.model.limits)}
${callbacks}
${methods.join("\n")}
      def bind(runtime)
        raise RuntimeError, "Native adapter is already bound" if @runtime
        runtime.ensure_process
        functions = {}
${bindings.join("\n")}
        @functions = functions.freeze
        @runtime = runtime
      end
    end
    private_constant :Native
  end
end
`;
	return { ...model, callModels: boundary.calls
		, callbackModels: boundary.callbacks
		, cSource: boundary.source, source };
};
