/**
 * Bounded Ruby storage, exact snapshots and explicit resource input pins.
 *
 * @file
 */

/**
 * Emit private conversion support inside the generated Native module.
 *
 * @param limits - Authenticated native conversion limits.
 */
export const ownedRubyConversionSupport = limits => `
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
      RESOURCE_RAW = Owned::Resource.instance_method(:raw)
      class Invalid < Owned::Error
        def initialize(message = "Malformed native owned value"); super(9, message); end
      end
      class Limit < Owned::Error
        def initialize(message = "Owned conversion limit exceeded"); super(2, message); end
      end
      class Budget
        attr_accessor :nodes, :native, :storage
        def initialize
          @nodes, @native, @storage = ${limits.visits}, ${limits.bytes}, ${limits.bytes}
        end
      end
      class ValueScope
        attr_reader :state, :check_only, :budget
        def initialize(state, check_only = false, budget = nil)
          @state, @check_only, @budget = state, check_only, budget || Budget.new
          @active, @buffers, @leases, @closures = {}, [], [], []
        end
        def nodes; @budget.nodes; end
        def charge(field, count, width = 1)
          remaining = field == :native ? @budget.native : @budget.storage
          raise Limit if count < 0 || width < 1 || count > remaining / width
          if field == :native
            @budget.native -= count * width
          else
            @budget.storage -= count * width
          end
        end
        def enter(key, depth, size, output = false)
          raise Limit, "Owned depth or visit limit exceeded" if depth > ${limits.depth} || @budget.nodes.zero?
          @budget.nodes -= 1
          charge(:native, size)
          if key
            raise(output ? Invalid : ::ArgumentError, "Cyclic owned value") if @active.key?(key)
            @active[key] = true
          end
        end
        def leave(key); @active.delete(key) if key; end
        def allocate(size)
          charge(:storage, size + 128)
          return nil if @check_only
          Owned.checkpoint
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
        def pin_lease(lease)
          charge(:storage, 32)
          return if @check_only
          Owned.checkpoint
          lease.acquire
          begin
            Owned.checkpoint
            @leases << lease
          rescue ::Exception
            lease.release
            raise
          end
        end
        def pin_closure(closure)
          begin
            charge(:storage, 256)
            Owned.checkpoint
            @closures << closure
          rescue ::Exception
            closure.free
            raise
          end
        end
        def close
          failure = nil
          @closures.reverse_each do |closure|
            begin; closure.free unless closure.freed?; rescue ::Exception => error; failure ||= error; end
          end
          @leases.reverse_each do |lease|
            begin; lease.release; rescue ::Exception => error; failure ||= error; end
          end
          @buffers.reverse_each { |pointer| pointer.call_free unless pointer.freed? }
          @closures.clear; @leases.clear; @buffers.clear; @active.clear
          raise failure if failure
        end
      end
      class Output
        def initialize(owner, lease = nil); @owner, @lease = owner, lease; end
        def hold
          unless @lease
            raise Invalid, "Missing native result owner" unless @owner && @owner.slot && !@owner.slot.value.zero?
            @lease = @owner.adopt
          end
          @lease.require_open
          @lease
        end
      end
      def exact?(value, type); EXACT.bind_call(value, type); end
      def integer(value, minimum = nil, maximum = nil)
        raise TypeError, "Expected exact Integer" unless exact?(value, ::Integer)
        raise RangeError, "Integer outside the Lean range" if minimum && value < minimum || maximum && value > maximum
        value
      end
      def text?(value)
        encoding = STRING_ENCODING.bind_call(value)
        (encoding == ::Encoding::UTF_8 || encoding == ::Encoding::US_ASCII) && STRING_VALID.bind_call(value)
      end
      def string(value, scope, limit = ${limits.bytes})
        raise TypeError, "Expected exact String" unless exact?(value, ::String)
        length = STRING_SIZE.bind_call(value)
        raise Limit, "String exceeds the conversion limit" if length > limit
        scope.charge(:storage, length + 128)
        Owned.checkpoint
        snapshot = FREEZE.bind_call(STRING_SLICE.bind_call(value, 0, length))
        raise ArgumentError, "String changed during conversion" unless STRING_SIZE.bind_call(snapshot) == length
        snapshot
      end
      def array(value, scope, pair = false)
        raise TypeError, "Expected exact Array" unless exact?(value, ::Array)
        length = ARRAY_LENGTH.bind_call(value)
        raise ArgumentError, "Prod requires two elements" if pair && length != 2
        raise Limit, "Array exceeds the visit limit" if length > scope.nodes
        scope.charge(:storage, length, 8)
        scope.charge(:storage, 128)
        Owned.checkpoint
        snapshot = FREEZE.bind_call(ARRAY_GET.bind_call(value, 0, length))
        raise ArgumentError, "Array changed during conversion" unless ARRAY_LENGTH.bind_call(snapshot) == length
        snapshot
      end
      def span(pointer, count, width, alignment)
        return 0 if count.zero?
        raise Invalid, "Missing, misaligned or overflowing native span" if pointer.zero? || pointer % alignment != 0 || count > ((1 << 63) - 1) / width || pointer > (1 << 64) - 1 - count * width
        pointer
      end
      def pointer(address, size, alignment)
        ::Fiddle::Pointer.new(span(address, 1, size, alignment))
      end
`;
