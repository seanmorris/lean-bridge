/**
 * Private Fiddle conversions with bounded snapshots and explicit native cleanup.
 *
 * @file
 */
import { compileCopiedRubyGraphLayout } from "./copied-graph-layout.mjs";
import { rubyCopiedGraphSupport } from "./copied-graph-runtime.mjs";

/**
 * Generate scoped typed graph calls. The authenticated adapter supplies a
 * pre-bound C cleanup function, so Ruby need not allocate a release wrapper
 * after receiving an owned native output.
 *
 * @param ir - Compiler-checked, concrete copied Binding IR.
 */
export const generateCopiedRubyGraphConversions = ir => {
	const model = compileCopiedRubyGraphLayout(ir), nodes = new Map(model.types.map(node => [node.id, node]));
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
			const inhabited = node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(!finite.has(node.id) && inhabited)
			{ finite.add(node.id); changed = true; }
		}
	}
	const methods = [];
	for(const node of nodes.values())
	{
		const input = [], output = [], i = node.index;
		const childInput = (field, expression, offset) => {
			const child = nodes.get(field.type), pointer = field.storage === "pointer";
			return [`child = graph_input${child.index}(${expression}, scope, depth + 1, ${pointer})`
				, `${pointer ? `out[${offset}, 8] = [child.to_i].pack("Q<")` : write(child, "out", offset, "child")} unless scope.check_only`];
		};
		const childOutput = (field, offset) => {
			const child = nodes.get(field.type), pointer = field.storage === "pointer";
			return `graph_output${child.index}(${pointer ? `graph_pointer(value[${offset}, 8].unpack1("Q<"), ${child.size}, ${child.alignment})` : read(child, "value", offset)}, scope, depth + 1, ${pointer})`;
		};
		if(!finite.has(node.id))
		{
			input.push('raise ArgumentError, "The declared copied type has no finite value"');
			output.push('raise GraphInvalidNative, "Uninhabited native copied value"');
		} else if(node.kind === "primitive")
		{
			const name = node.ref.name;
			if(name === "unit")
			{
				input.push(`raise TypeError, "Unit requires UNIT" unless SAME.bind_call(value, ${publicName("UNIT")})`, "0");
				output.push('raise GraphInvalidNative, "Invalid native Unit" unless value == 0', publicName("UNIT"));
			} else if(name === "bool")
			{
				input.push('raise TypeError, "Bool requires true or false" unless SAME.bind_call(value, true) || SAME.bind_call(value, false)', "value ? 1 : 0");
				output.push('raise GraphInvalidNative, "Invalid native Bool" unless value == 0 || value == 1', "value == 1");
			} else if(name === "char")
			{
				input.push("snapshot = graph_string(value, scope, 4)", 'raise EncodingError, "Char requires valid UTF-8 or US-ASCII" unless graph_text?(snapshot)'
					, 'raise RangeError, "Char requires one Unicode scalar" unless STRING_LENGTH.bind_call(snapshot) == 1', "STRING_ORD.bind_call(snapshot)");
				output.push('raise GraphInvalidNative, "Invalid native Char" if value > 0x10ffff || value.between?(0xd800, 0xdfff)'
					, "scope.charge(:storage, 128)", "graph_checkpoint", "value.chr(::Encoding::UTF_8)");
			} else if(name === "float32" || name === "float64")
			{
				input.push('raise TypeError, "Expected exact Float" unless graph_exact?(value, ::Float)', name === "float32" ? '[value].pack("e").unpack1("e")' : "value");
				output.push("scope.charge(:storage, 32)", "value");
			} else if(node.aggregate)
			{
				const limbs = ["nat", "int"].includes(name), width = limbs ? 4 : 1;
				if(limbs) input.push(`graph_integer(value${name === "nat" ? ", 0" : ""})`
					, "scope.charge(:storage, (value.bit_length + 31) / 32, 4)", "magnitude = value.abs", "length = (magnitude.bit_length + 31) / 32"
					, "scope.charge(:storage, length, 32)");
				else input.push("snapshot = graph_string(value, scope)"
					, ...name === "string" ? ['raise EncodingError, "String requires valid UTF-8 or US-ASCII" unless graph_text?(snapshot)'] : []
					, "length = STRING_SIZE.bind_call(snapshot)");
				input.push(`scope.charge(:native, length, ${width})`, `out = scope.allocate(${node.size})`, `data = scope.allocate(length * ${width})`
					, "unless scope.check_only"
					, `  data[0, length * ${width}] = ${limbs ? '[magnitude.to_s(16).rjust(length * 8, "0")].pack("H*").reverse' : "snapshot"} unless length == 0`
					, '  out[16, 16] = [length == 0 ? 0 : data.to_i, length].pack("Q<Q<")'
					, ...name === "int" ? ['  out[32, 1] = [value < 0 ? 1 : 0].pack("C")'] : [], "end", "out");
				output.push(...name === "int" ? ['negative = value[32, 1].unpack1("C")', 'raise GraphInvalidNative, "Invalid native integer sign" if negative > 1'] : []
					, 'pointer, length = value[16, 16].unpack("Q<Q<")'
					, `scope.charge(:native, length, ${width})`, `scope.charge(:storage, length, ${limbs ? 32 : 1})`, "scope.charge(:storage, 128)"
					, `graph_span(pointer, length, ${width}, ${width})`, "graph_checkpoint", `bytes = length == 0 ? +"".b : ::Fiddle::Pointer.new(pointer)[0, length * ${width}]`);
				if(limbs) output.push('magnitude = length == 0 ? 0 : bytes.reverse.unpack1("H*").to_i(16)', name === "int" ? "negative == 0 ? magnitude : -magnitude" : "magnitude");
				else if(name === "string") output.push("bytes.force_encoding(::Encoding::UTF_8)", 'raise GraphInvalidNative, "Invalid native UTF-8" unless STRING_VALID.bind_call(bytes)', "bytes");
				else output.push("bytes.force_encoding(::Encoding::BINARY)");
			} else
			{
				const signed = name.startsWith("int") || name === "isize", bits = name.endsWith("size") ? 64 : Number(name.match(/\d+/)[0]);
				input.push(`graph_integer(value, ${signed ? `-(1 << ${bits - 1})` : "0"}, (1 << ${signed ? bits - 1 : bits}) - 1)`);
				output.push("value");
			}
		} else if(node.element)
		{
			const child = nodes.get(node.element);
			input.push("snapshot = graph_array(value, scope)", "length = ARRAY_LENGTH.bind_call(snapshot)", `scope.charge(:native, length, ${child.size})`
				, `out = scope.allocate(${node.size})`, `data = scope.allocate(length * ${child.size})`, "length.times do |index|"
				, `  child = graph_input${child.index}(ARRAY_GET.bind_call(snapshot, index), scope, depth + 1, false)`
				, `  ${write(child, "data", `index * ${child.size}`, "child")} unless scope.check_only`, "end"
				, 'out[16, 16] = [length == 0 ? 0 : data.to_i, length].pack("Q<Q<") unless scope.check_only', "out");
			output.push('pointer, length = value[16, 16].unpack("Q<Q<")', `scope.charge(:native, length, ${child.size})`
				, "scope.charge(:storage, length, 8)", "scope.charge(:storage, 128)"
				, `graph_span(pointer, length, ${child.size}, ${child.alignment})`, "graph_checkpoint", "data = ::Fiddle::Pointer.new(pointer)"
				, `::Array.new(length) { |index| graph_output${child.index}(${read(child, "data", `index * ${child.size}`)}, scope, depth + 1, false) }`);
		} else if(node.kind === "variant")
		{
			node.cases.forEach((branch, index) => {
				input.push(`${index ? "elsif" : "if"} graph_exact?(value, ${publicName(branch.publicName)})`
					, ...branch.fields.map((field, j) => `  field${j} = FIELD.bind_call(value, :@${field.publicName})`)
					, `  out = scope.allocate(${node.size})`, `  out[16, 4] = [${index}].pack("L<") unless scope.check_only`
					, ...branch.fields.flatMap((field, j) => childInput(field, `field${j}`, node.payloadOffset + field.offset)).map(line => `  ${line}`), "  out");
				output.push(`${index ? "elsif" : "if"} value[16, 4].unpack1("L<") == ${index}`, `  scope.charge(:storage, ${128 + branch.fields.length * 16})`
					, "  graph_checkpoint", `  ${publicName(branch.publicName)}.new(${branch.fields.map(field => `${field.publicName}: ${childOutput(field, node.payloadOffset + field.offset)}`).join(", ")})`);
			});
			input.push("else", `  raise TypeError, "Expected exact ${node.publicType} constructor"`, "end");
			output.push("else", `  raise GraphInvalidNative, "Invalid native ${node.publicType} tag"`, "end");
		} else if(["option", "result"].includes(node.kind))
		{
			const option = node.kind === "option";
			if(option)
			{
				input.push("return scope.allocate(" + node.size + ") if SAME.bind_call(value, nil)");
				output.push('return nil if value[16, 1].unpack1("C") == 0');
			}
			node.fields.forEach((field, index) => {
				const wrapper = option ? "Some" : index ? "Err" : "Ok", flag = index ? 0 : 1;
				input.push(`${index ? "elsif" : "if"} graph_exact?(value, ${publicName(wrapper)})`
					, "  payload = ARRAY_GET.bind_call(DATA_FIELDS.bind_call(value), 0)", `  out = scope.allocate(${node.size})`
					, `  out[16, 1] = [${flag}].pack("C") unless scope.check_only`
					, ...childInput(field, "payload", field.offset).map(line => `  ${line}`), "  out");
				output.push(`${index ? "elsif" : "if"} value[16, 1].unpack1("C") == ${flag}`, "  scope.charge(:storage, 128)", "  graph_checkpoint"
					, `  ${publicName(wrapper)}.new(${childOutput(field, field.offset)})`);
			});
			input.push("else", `  raise TypeError, "Expected ${option ? "nil or Some(value)" : "Ok(value) or Err(value)"}"`, "end");
			output.push("else", `  raise GraphInvalidNative, "Invalid native ${node.kind} flag"`, "end");
		} else
		{
			const tuple = node.kind === "tuple";
			input.push(...tuple ? ["snapshot = graph_array(value, scope, true)"]
				: [`raise TypeError, "Expected exact ${node.publicType}" unless graph_exact?(value, ${publicName(node.publicType)})`
					, ...node.fields.map((field, j) => `field${j} = FIELD.bind_call(value, :@${field.publicName})`)]
			, `out = scope.allocate(${node.size})`
			, ...node.fields.flatMap((field, j) => childInput(field, tuple ? `ARRAY_GET.bind_call(snapshot, ${j})` : `field${j}`, field.offset)), "out");
			output.push(`scope.charge(:storage, ${128 + node.fields.length * 16})`, "graph_checkpoint"
				, tuple ? `[${node.fields.map(field => childOutput(field, field.offset)).join(", ")}]`
					: `${publicName(node.publicType)}.new(${node.fields.map(field => `${field.publicName}: ${childOutput(field, field.offset)}`).join(", ")})`);
		}
		const track = node.kind !== "primitive";
		methods.push(`      def graph_input${i}(value, scope, depth = 0, native_storage = true)
        key = ${track ? "IDENTIFY.bind_call(value)" : "nil"}
        scope.enter(key, depth, ${node.size}, native_storage)
        begin
${input.map(line => `          ${line}`).join("\n")}
        ensure
          scope.leave(key)
        end
      end
      def graph_output${i}(value, scope, depth = 0, native_storage = true)
        key = ${track ? `[${i}, value.to_i]` : "nil"}
        scope.enter(key, depth, ${node.size}, native_storage, true)
        begin
${output.map(line => `          ${line}`).join("\n")}
        ensure
          scope.leave(key)
        end
      end`);
	}
	for(const fn of model.functions)
	{
		const parameters = fn.parameters, result = nodes.get(fn.result);
		const root = model.layout.roots.find(root => root.bindingId === fn.bindingId);
		const inputs = root.parameters.map(id => nodes.get(id));
		methods.push(`      def graph_call_${fn.publicName}(invoke${parameters.map(name => `, ${name}`).join("")}, clear: nil, lifecycle: nil)
        ${result.aggregate ? 'raise ArgumentError, "Aggregate calls require pre-bound C cleanup" unless clear' : ""}
        ::Thread.handle_interrupt(::Exception => :never) do
          checked = GraphScope.new(true)
          begin
${inputs.map((node, i) => `            graph_input${node.index}(arg${i}, checked)`).join("\n")}
          ensure
            checked.close
          end
          scope = GraphScope.new
          output = nil
          begin
${inputs.map((node, i) => {
	return node.aggregate ? `            input${i} = graph_input${node.index}(arg${i}, scope)`
		: `            raw${i} = graph_input${node.index}(arg${i}, scope)\n            input${i} = scope.allocate(${node.size})\n            ${write(node, `input${i}`, 0, `raw${i}`)}`;
}).join("\n")}
            output = scope.allocate(${result.size})
            ${result.kind === "variant" ? 'output[16, 4] = [(1 << 32) - 1].pack("L<")' : ""}
            graph_status(lifecycle[0].call) if lifecycle
            graph_status(invoke.call(${parameters.map((_, i) => `input${i}`).concat("output").join(", ")}))
            result = graph_output${result.index}(${read(result, "output")}, scope)
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if lifecycle && lifecycle[1].call == 0
            result
          rescue GraphInvalidNative
            lifecycle[2].call if lifecycle
            raise
          ensure
            begin
              ${result.aggregate ? "clear.call(output) if output" : ""}
            ensure
              scope.close
            end
          end
        end
      end`);
	}
	return { ...model, source: `require "fiddle"\nmodule LeanBridge\n  module ${model.componentName}\n    module Native\n      extend self\n${rubyCopiedGraphSupport}\n${methods.join("\n")}\n    end\n    private_constant :Native\n  end\nend\n` };
};
