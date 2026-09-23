/**
 * Scoped storage and captured Ruby operations for private graph conversions.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";

export const rubyCopiedGraphSupport = `      raise LoadError, "Copied graphs require MRI Ruby 3.3, 64-bit little-endian Linux" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.") && RUBY_PLATFORM.include?("x86_64-linux") && ::Fiddle::SIZEOF_VOIDP == 8 && [1].pack("I") == [1].pack("L<")
      EXACT = ::Object.instance_method(:instance_of?)
      SAME = ::BasicObject.instance_method(:equal?)
      IDENTIFY = ::BasicObject.instance_method(:__id__)
      FIELD = ::Object.instance_method(:instance_variable_get)
      FREEZE = ::Object.instance_method(:freeze)
      ARRAY_LENGTH = ::Array.instance_method(:length)
      ARRAY_GET = ::Array.instance_method(:[])
      STRING_SIZE = ::String.instance_method(:bytesize)
      STRING_SLICE = ::String.instance_method(:byteslice)
      STRING_ENCODING = ::String.instance_method(:encoding)
      STRING_VALID = ::String.instance_method(:valid_encoding?)
      STRING_LENGTH = ::String.instance_method(:length)
      STRING_ORD = ::String.instance_method(:ord)
      DATA_FIELDS = ::Data.instance_method(:deconstruct)
      class GraphInvalidNative < LeanBridgeError
        def initialize(message = "Invalid native copied value")
          super(4, message)
        end
      end
      class GraphLimit < ::RangeError; end
      def graph_checkpoint; end
      class GraphScope
        attr_reader :check_only
        def initialize(check_only = false)
          @check_only = check_only
          @nodes = ${componentRecursiveLimits.valueNodes}
          @native = 16 * 1024 * 1024
          @storage = 16 * 1024 * 1024
          @active = {}
          @buffers = []
        end
        def charge(field, count, width = 1)
          remaining = field == :native ? @native : @storage
          raise GraphLimit, "16 MiB copied graph conversion limit exceeded" if count < 0 || width < 1 || count > remaining / width
          if field == :native
            @native -= count * width
          else
            @storage -= count * width
          end
        end
        def enter(key, depth, size, native_storage, output = false)
          raise GraphLimit, "Copied graph depth or node limit exceeded" if depth > ${componentRecursiveLimits.valueDepth} || @nodes == 0
          @nodes -= 1
          charge(:native, size) if native_storage
          if key
            if @active.key?(key)
              raise(output ? GraphInvalidNative : ::ArgumentError, "Cyclic copied value")
            end
            @active[key] = true
          end
        end
        def leave(key)
          @active.delete(key) if key
        end
        def allocate(size)
          charge(:storage, size + 128)
          return nil if @check_only
          Native.graph_checkpoint
          pointer = ::Fiddle::Pointer.malloc([size, 1].max, ::Fiddle::RUBY_FREE)
          begin
            @buffers << pointer
            pointer[0, [size, 1].max] = "\\0" * [size, 1].max
          rescue ::Exception
            pointer.call_free
            raise
          end
          pointer
        end
        def close
          @buffers.reverse_each { |pointer| pointer.call_free unless pointer.freed? }
          @buffers.clear
          @active.clear
        end
      end
      def graph_exact?(value, type)
        EXACT.bind_call(value, type)
      end
      def graph_integer(value, minimum = nil, maximum = nil)
        raise TypeError, "Expected exact Integer" unless graph_exact?(value, ::Integer)
        raise RangeError, "Integer outside the Lean range" if minimum && value < minimum || maximum && value > maximum
        value
      end
      def graph_text?(value)
        encoding = STRING_ENCODING.bind_call(value)
        (encoding == ::Encoding::UTF_8 || encoding == ::Encoding::US_ASCII) && STRING_VALID.bind_call(value)
      end
      def graph_string(value, scope, limit = 16 * 1024 * 1024)
        raise TypeError, "Expected exact String" unless graph_exact?(value, ::String)
        length = STRING_SIZE.bind_call(value)
        raise GraphLimit, "Copied String exceeds its limit" if length > limit
        scope.charge(:storage, length + 128)
        snapshot = FREEZE.bind_call(STRING_SLICE.bind_call(value, 0, length))
        raise ArgumentError, "String changed during conversion" unless STRING_SIZE.bind_call(snapshot) == length
        snapshot
      end
      def graph_array(value, scope, pair = false)
        raise TypeError, "Expected exact Array" unless graph_exact?(value, ::Array)
        length = ARRAY_LENGTH.bind_call(value)
        raise ArgumentError, "Prod requires two elements" if pair && length != 2
        scope.charge(:storage, length, 8)
        snapshot = FREEZE.bind_call(ARRAY_GET.bind_call(value, 0, length))
        raise ArgumentError, "Array changed during conversion" unless ARRAY_LENGTH.bind_call(snapshot) == length
        snapshot
      end
      def graph_span(pointer, count, width, alignment)
        return 0 if count == 0
        raise GraphInvalidNative, "Missing, misaligned or overflowing native span" if pointer == 0 || pointer % alignment != 0 || count > ((1 << 63) - 1) / width || pointer > (1 << 64) - 1 - count * width
        # Only authenticated adapters supply readable memory. Arithmetic checks
        # do not make arbitrary foreign process pointers safe to dereference.
        pointer
      end
      def graph_pointer(pointer, size, alignment)
        ::Fiddle::Pointer.new(graph_span(pointer, 1, size, alignment))
      end
      def graph_status(status)
        return if status == 0
        messages = {1 => "Invalid native input", 2 => "Native graph copy limit exceeded", 3 => "Native allocation failed", 5 => "Lean runtime is unavailable"}
        raise GraphInvalidNative unless messages.key?(status)
        raise LeanBridgeError.new(status, messages.fetch(status))
      end
`;
