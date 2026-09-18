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
	if(copy.record)
	{
		input = `raise TypeError, "Expected ${copy.publicName}" unless value.instance_of?(${copy.publicName})
        result = scope.allocate(${copy.size})
${copy.fields.map(field => `        ${write(field.type, "result", field.offset, `to${field.type.index}(value.${field.name}${field.type.aggregate ? ", scope" : ""})`)}`).join("\n")}
        result`;
		output = `${copy.publicName}.new(${copy.fields.map(field => `${field.name}: from${field.type.index}(${read(field.type, "value", field.offset)})`).join(", ")})`;
	} else if(copy.element)
	{
		const e = copy.element;
		input = `raise TypeError, "Expected Array" unless value.instance_of?(::Array)
        length = value.length
        scope.charge(length * ${Math.max(e.size, 8)})
        data = scope.allocate(length * ${e.size}, charged: true)
        length.times do |index|
          ${write(e, "data", `index * ${e.size}`, `to${e.index}(value[index]${e.aggregate ? ", scope" : ""})`)}
        end
        span(scope, data, length, 32)`;
		output = `data, count = value[0, 16].unpack("Q<Q<")
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from${e.index}(${read(e, "pointer", `index * ${e.size}`)}) }`;
	} else switch(copy.ref.name)
	{
		case "unit": input = 'raise TypeError, "Expected UNIT" unless value.equal?(UNIT)\n        0'; output = "UNIT"; break;
		case "bool": input = 'raise TypeError, "Expected true or false" unless value.equal?(true) || value.equal?(false)\n        value ? 1 : 0'; output = "value != 0"; break;
		case "uint8": case "uint16": case "uint32": case "uint64":
		{
			const bits = Number(copy.ref.name.slice(4));
			input = `integer(value, 0, (1 << ${bits}) - 1)\n        value >= (1 << ${bits - 1}) ? value - (1 << ${bits}) : value`;
			output = `value & ((1 << ${bits}) - 1)`; break;
		}
		case "int8": case "int16": case "int32": case "int64":
		{
			const bits = Number(copy.ref.name.slice(3));
			input = `integer(value, -(1 << ${bits - 1}), (1 << ${bits - 1}) - 1)`; output = "value"; break;
		}
		case "float32": case "float64": input = 'raise TypeError, "Expected Float" unless value.instance_of?(::Float)\n        value'; output = "value"; break;
		case "char":
			input = 'raise TypeError, "Char requires String" unless value.instance_of?(::String)\n        raise EncodingError, "Char requires valid UTF-8 or US-ASCII" unless [Encoding::UTF_8, Encoding::US_ASCII].include?(value.encoding) && value.valid_encoding?\n        raise RangeError, "Char requires one Unicode scalar" unless value.length == 1\n        value.ord';
			output = 'raise RangeError, "Invalid native Unicode scalar" unless value.between?(0, 0x10ffff) && !value.between?(0xd800, 0xdfff)\n        value.chr(Encoding::UTF_8)'; break;
		case "string": case "bytes":
			input = `raise TypeError, "Expected String" unless value.instance_of?(::String)
        ${copy.ref.name === "string" ? 'raise EncodingError, "Expected valid UTF-8 or US-ASCII" unless [Encoding::UTF_8, Encoding::US_ASCII].include?(value.encoding) && value.valid_encoding?' : ""}
        data = scope.allocate(value.bytesize)
        data[0, value.bytesize] = value
        span(scope, data, value.bytesize, 32)`;
			output = `data, length = value[0, 16].unpack("Q<Q<")
        result = length.zero? ? +"".b : ::Fiddle::Pointer.new(data)[0, length]
        ${copy.ref.name === "string" ? 'result.force_encoding(Encoding::UTF_8)\n        raise EncodingError, "Invalid native UTF-8" unless result.valid_encoding?' : "result.force_encoding(Encoding::BINARY)"}
        result`; break;
		case "nat": case "int":
			input = `raise TypeError, "Expected Integer" unless value.instance_of?(::Integer)
        ${copy.ref.name === "nat" ? 'raise RangeError, "Nat cannot be negative" if value < 0' : ""}
        magnitude = value.abs
        count = (magnitude.bit_length + 31) / 32
        data = scope.allocate(count * 4)
        data[0, count * 4] = [magnitude.to_s(16).rjust(count * 8, "0")].pack("H*").reverse unless count.zero?
        result = span(scope, data, count, ${copy.size})
        ${copy.ref.name === "int" ? 'result[32, 1] = [value < 0 ? 1 : 0].pack("C")' : ""}
        result`;
			output = `data, count = value[0, 16].unpack("Q<Q<")
        result = count.zero? ? 0 : ::Fiddle::Pointer.new(data)[0, count * 4].reverse.unpack1("H*").to_i(16)
        ${copy.ref.name === "int" ? 'value[32, 1].unpack1("C").zero? ? result : -result' : "result"}`; break;
		default: throw new TypeError(`Unsupported Ruby conversion: ${copy.ref.name}`);
	}
	return `      def to${copy.index}(value${copy.aggregate ? ", scope" : ""})
        ${input}
      end
      def from${copy.index}(value)
        ${output}
      end`;
}).join("\n");

/** Scoped native allocations and exact-value helpers. */
export const copiedRubyHelpers = `      class Scope
        def initialize
          @buffers = []
          @remaining = 16 * 1024 * 1024
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
          @buffers.reverse_each { |pointer| pointer.call_free unless pointer.freed? }
          @buffers.clear
        end
      end
      def integer(value, low, high)
        raise TypeError, "Expected Integer" unless value.instance_of?(::Integer)
        raise RangeError, "Integer out of range" unless value.between?(low, high)
        value
      end
      def span(scope, data, length, size)
        result = scope.allocate(size)
        result[0, 16] = [data.to_i, length].pack("Q<Q<")
        result
      end
      def check(status, error)
        return if status.zero?
        data, length = error[8, 16].unpack("Q<Q<")
        message = data.zero? ? "Lean call failed" : ::Fiddle::Pointer.new(data)[0, length].force_encoding(Encoding::UTF_8)
        raise(status == 1 ? RangeError : LeanBridgeError, message)
      end`;
