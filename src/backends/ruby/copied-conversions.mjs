/**
 * Generate recursive, scoped Ruby conversions without consumer glue.
 *
 * @file
 */

const read = (copy, value, offset = 0) => copy.aggregate ? `(${value} + ${offset})` : `${value}[${offset}, ${copy.size}].unpack1("${copy.pack}")`;
const write = (copy, target, offset, value) => `${target}[${offset}, ${copy.size}] = ${copy.aggregate ? `${value}[0, ${copy.size}]` : `[${value}].pack("${copy.pack}")`}`;

/**
 * Read the generated result's exact C representation.
 *
 * @param copy - Closed copied type.
 * @param value - Pointer expression.
 */
export const readRubyValue = (copy, value) => read(copy, value);

/**
 * Emit one conversion pair per concrete copied type.
 *
 * @param model - Closed Ruby projection.
 */
export const copiedRubyConversions = model => model.surface.copies.map(copy => {
	let input, output;
	if(copy.variant)
	{
		input = `${copy.cases.map((branch, index) => `${index ? "        elsif" : "if"} exact?(value, ${branch.publicName})
${branch.fields.map((field, fieldIndex) => `          field${fieldIndex} = STORED_FIELD.bind_call(value, :@${field.name})`).join("\n")}
          result = scope.allocate(${copy.size})
          result[0, 4] = [${index}].pack("L<")
${branch.fields.map((field, fieldIndex) => `          ${write(field.type, "result", copy.payloadOffset + field.offset, `to${field.type.index}(field${fieldIndex}${field.type.aggregate ? ", scope" : ""})`)}`).join("\n")}`).join("\n")}
        else
          raise TypeError, "Expected an exact ${copy.publicName} constructor"
        end
        result`;
		output = `case value[0, 4].unpack1("L<")
${copy.cases.map((branch, index) => `        when ${index} then ${branch.publicName}.new(${branch.fields.map(field => `${field.name}: from${field.type.index}(${read(field.type, "value", copy.payloadOffset + field.offset)})`).join(", ")})`).join("\n")}
        else raise RangeError, "Invalid native ${copy.publicName} constructor"
        end`;
	} else if(copy.compound)
	{
		const to = (field, expression) => write(field.type, "result", field.offset, `to${field.type.index}(${expression}${field.type.aggregate ? ", scope" : ""})`);
		const from = field => `from${field.type.index}(${read(field.type, "value", field.offset)})`;
		if(copy.compound === "option")
		{
			input = `raise TypeError, "Option requires nil or Some(value)" unless same?(value, nil) || exact?(value, Some)
        present = !same?(value, nil)
        payload = data_payload(value) if present
        result = scope.allocate(${copy.size})
        if present
          result[0, 1] = [1].pack("C")
          ${to(copy.fields[0], "payload")}
        end
        result`;
			output = `case value[0, 1].unpack1("C")
        when 0 then nil
        when 1 then Some.new(${from(copy.fields[0])})
        else raise RangeError, "Invalid native Option flag"
        end`;
		} else if(copy.compound === "result")
		{
			input = `raise TypeError, "Result requires Ok(value) or Err(error)" unless exact?(value, Ok) || exact?(value, Err)
        success = exact?(value, Ok)
        payload = data_payload(value)
        result = scope.allocate(${copy.size})
        if success
          result[0, 1] = [1].pack("C")
          ${to(copy.fields[0], "payload")}
        else
          ${to(copy.fields[1], "payload")}
        end
        result`;
			output = `case value[0, 1].unpack1("C")
        when 1 then Ok.new(${from(copy.fields[0])})
        when 0 then Err.new(${from(copy.fields[1])})
        else raise RangeError, "Invalid native Except flag"
        end`;
		} else
		{
			input = `raise TypeError, "Prod requires a two-element Array" unless exact?(value, ::Array)
        raise ArgumentError, "Prod requires exactly two elements" unless ARRAY_LENGTH.bind_call(value) == 2
        values = FREEZE.bind_call(ARRAY_GET.bind_call(value, 0, 2))
        raise ArgumentError, "Prod requires exactly two elements" unless ARRAY_LENGTH.bind_call(values) == 2
        result = scope.allocate(${copy.size})
${copy.fields.map((field, index) => `        ${to(field, `ARRAY_GET.bind_call(values, ${index})`)}`).join("\n")}
        result`;
			output = `[${copy.fields.map(from).join(", ")}]`;
		}
	} else if(copy.record)
	{
		input = `raise TypeError, "Expected ${copy.publicName}" unless exact?(value, ${copy.publicName})
${copy.fields.map((field, index) => `        field${index} = STORED_FIELD.bind_call(value, :@${field.name})`).join("\n")}
        result = scope.allocate(${copy.size})
${copy.fields.map((field, index) => `        ${write(field.type, "result", field.offset, `to${field.type.index}(field${index}${field.type.aggregate ? ", scope" : ""})`)}`).join("\n")}
        result`;
		output = `${copy.publicName}.new(${copy.fields.map(field => `${field.name}: from${field.type.index}(${read(field.type, "value", field.offset)})`).join(", ")})`;
	} else if(copy.element)
	{
		const e = copy.element;
		input = `values = array_input(value, scope, ${Math.max(e.size, 8)})
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * ${e.size}, charged: true)
        length.times do |index|
          ${write(e, "data", `index * ${e.size}`, `to${e.index}(ARRAY_GET.bind_call(values, index)${e.aggregate ? ", scope" : ""})`)}
        end
        span(scope, data, length, 32)`;
		output = `data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / ${Math.max(e.size, 8)}
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % ${e.alignment} != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from${e.index}(${read(e, "pointer", `index * ${e.size}`)}) }`;
	} else switch(copy.scalarName)
	{
		case "unit": input = 'raise TypeError, "Expected UNIT" unless same?(value, UNIT)\n        0'; output = "UNIT"; break;
		case "bool": input = 'raise TypeError, "Expected true or false" unless same?(value, true) || same?(value, false)\n        value ? 1 : 0'; output = "value != 0"; break;
		case "uint8": case "uint16": case "uint32": case "uint64":
		{
			const bits = Number(copy.scalarName.slice(4));
			input = `integer(value, 0, (1 << ${bits}) - 1)\n        value >= (1 << ${bits - 1}) ? value - (1 << ${bits}) : value`;
			output = `value & ((1 << ${bits}) - 1)`; break;
		}
		case "int8": case "int16": case "int32": case "int64":
		{
			const bits = Number(copy.scalarName.slice(3));
			input = `integer(value, -(1 << ${bits - 1}), (1 << ${bits - 1}) - 1)`; output = "value"; break;
		}
		case "float32": case "float64": input = 'raise TypeError, "Expected Float" unless exact?(value, ::Float)\n        value'; output = "value"; break;
		case "char":
			input = 'value = string_input(value, nil, 4)\n        raise EncodingError, "Char requires valid UTF-8 or US-ASCII" unless text?(value)\n        raise RangeError, "Char requires one Unicode scalar" unless STRING_LENGTH.bind_call(value) == 1\n        STRING_ORD.bind_call(value)';
			output = 'raise RangeError, "Invalid native Unicode scalar" unless value.between?(0, 0x10ffff) && !value.between?(0xd800, 0xdfff)\n        value.chr(Encoding::UTF_8)'; break;
		case "string": case "bytes":
			input = `value = string_input(value, scope)
        ${copy.scalarName === "string" ? 'raise EncodingError, "Expected valid UTF-8 or US-ASCII" unless text?(value)' : ""}
        length = STRING_BYTESIZE.bind_call(value)
        data = scope.allocate(length, charged: true)
        data[0, length] = value
        span(scope, data, length, 32)`;
			output = `data, length = value[0, 16].unpack("Q<Q<")
        result = length.zero? ? +"".b : ::Fiddle::Pointer.new(data)[0, length]
        ${copy.scalarName === "string" ? 'result.force_encoding(Encoding::UTF_8)\n        raise EncodingError, "Invalid native UTF-8" unless result.valid_encoding?' : "result.force_encoding(Encoding::BINARY)"}
        result`; break;
		case "nat": case "int":
			input = `raise TypeError, "Expected Integer" unless exact?(value, ::Integer)
        ${copy.scalarName === "nat" ? 'raise RangeError, "Nat cannot be negative" if value < 0' : ""}
        magnitude = value.abs
        count = (magnitude.bit_length + 31) / 32
        data = scope.allocate(count * 4)
        data[0, count * 4] = [magnitude.to_s(16).rjust(count * 8, "0")].pack("H*").reverse unless count.zero?
        result = span(scope, data, count, ${copy.size})
        ${copy.scalarName === "int" ? 'result[32, 1] = [value < 0 ? 1 : 0].pack("C")' : ""}
        result`;
			output = `data, count = value[0, 16].unpack("Q<Q<")
        result = count.zero? ? 0 : ::Fiddle::Pointer.new(data)[0, count * 4].reverse.unpack1("H*").to_i(16)
        ${copy.scalarName === "int" ? 'value[32, 1].unpack1("C").zero? ? result : -result' : "result"}`; break;
		default: throw new TypeError(`Unsupported Ruby conversion: ${copy.scalarName}`);
	}
	return `      def to${copy.index}(value${copy.aggregate ? ", scope" : ""})
        ${input}
      end
      def from${copy.index}(value)
        ${output}
      end`;
}).join("\n");

/** Scoped native allocations and exact-value helpers. */
export const copiedRubyHelpers = `      EXACT_TYPE = ::Object.instance_method(:instance_of?)
      SAME_OBJECT = ::BasicObject.instance_method(:equal?)
      FREEZE = ::Object.instance_method(:freeze)
      STORED_FIELD = ::Object.instance_method(:instance_variable_get)
      ARRAY_LENGTH = ::Array.instance_method(:length)
      ARRAY_GET = ::Array.instance_method(:[])
      STRING_BYTESIZE = ::String.instance_method(:bytesize)
      STRING_SLICE = ::String.instance_method(:byteslice)
      STRING_ENCODING = ::String.instance_method(:encoding)
      STRING_VALID = ::String.instance_method(:valid_encoding?)
      STRING_LENGTH = ::String.instance_method(:length)
      STRING_ORD = ::String.instance_method(:ord)
      DATA_FIELDS = ::Data.instance_method(:deconstruct)
      def exact?(value, type)
        EXACT_TYPE.bind_call(value, type)
      end
      def same?(left, right)
        SAME_OBJECT.bind_call(left, right)
      end
      def array_input(value, scope, element_bytes)
        raise TypeError, "Expected Array" unless exact?(value, ::Array)
        length = ARRAY_LENGTH.bind_call(value)
        scope.charge(length * element_bytes)
        FREEZE.bind_call(ARRAY_GET.bind_call(value, 0, length))
      end
      def string_input(value, scope = nil, limit = 16 * 1024 * 1024)
        raise TypeError, "Expected String" unless exact?(value, ::String)
        length = STRING_BYTESIZE.bind_call(value)
        raise RangeError, "String exceeds the copy limit" if length > limit
        scope.charge(length) if scope
        FREEZE.bind_call(STRING_SLICE.bind_call(value, 0, length))
      end
      def text?(value)
        encoding = STRING_ENCODING.bind_call(value)
        (encoding == Encoding::UTF_8 || encoding == Encoding::US_ASCII) && STRING_VALID.bind_call(value)
      end
      def data_payload(value)
        ARRAY_GET.bind_call(DATA_FIELDS.bind_call(value), 0)
      end
      class Scope
        attr_accessor :failure
        def initialize
          @buffers = []
          @callbacks = []
          @remaining = 16 * 1024 * 1024
        end
        def retain_callback(function)
          begin
            @callbacks << function
          rescue Exception
            function.free
            raise
          end
        end
        def charge(bytes)
          raise RangeError, "Lean Bridge copy budget exceeded (16 MiB)" if bytes < 0 || bytes > @remaining
          @remaining -= bytes
        end
        def allocate(bytes, charged: false)
          charge(bytes) unless charged
          pointer = ::Fiddle::Pointer.malloc([bytes, 1].max, ::Fiddle::RUBY_FREE)
          begin
            @buffers << pointer
            pointer[0, [bytes, 1].max] = "\\0" * [bytes, 1].max
          rescue Exception
            pointer.call_free
            raise
          end
          pointer
        end
        def close
          @callbacks.reverse_each(&:free)
          @callbacks.clear
          @buffers.reverse_each { |pointer| pointer.call_free unless pointer.freed? }
          @buffers.clear
        end
      end
      def integer(value, low, high)
        raise TypeError, "Expected Integer" unless exact?(value, ::Integer)
        raise RangeError, "Integer out of range" unless value.between?(low, high)
        value
      end
      def span(scope, data, length, size)
        result = scope.allocate(size)
        result[0, 16] = [data.to_i, length].pack("Q<Q<")
        result
      end
      def check(status, error, scope = nil)
        raise scope.failure if scope && scope.failure
        return if status.zero?
        data, length = error[8, 16].unpack("Q<Q<")
        message = data.zero? ? "Lean call failed" : ::Fiddle::Pointer.new(data)[0, length].force_encoding(Encoding::UTF_8)
        raise(status == 1 ? RangeError : LeanBridgeError, message)
      end`;
