# frozen_string_literal: true
require "fiddle"
require "digest"
require "digest/sha2"
module LeanBridge
  module Nominalsubtypes
    module Native
      extend self
      raise LoadError, "This Lean package requires MRI Ruby 3.3 on Linux x86-64" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.") && RUBY_PLATFORM.include?("x86_64-linux") && ::Fiddle::SIZEOF_VOIDP == 8 && [1].pack("I") == [1].pack("L<")
      raise LoadError, "Lean packages cannot be loaded from another Ractor" unless ::Ractor.current.equal?(::Ractor.main)
      require "lean_bridge/native_copied_runtime_v1"
      if (reason = NativeCopiedRuntimeV1.context_error)
        raise LoadError, reason
      end
      root = ::File.expand_path("native/linux-x64", __dir__)
      [::File.dirname(root), root].each do |directory|
        raise LoadError, "Native library directory must be a regular directory" unless ::File.lstat(directory).directory?
      end
      libraries = {"libcomponent_7f8bfe55e5831a9133c5.so" => "87a82e65ee3397dcdf3de0fe28da6fc4d13593860b9126f1fe1fe0ef143e302c", "liblean_bridge_native.so" => "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7", "libleanshared.so" => "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4", "libnominalsubtypes.so" => "d9f17b465ff4953a63c323967e40f954b118cde8bafd64e3ce03facb70cc3336"}.freeze
      libraries.each do |name, expected|
        path = ::File.join(root, name)
        raise LoadError, "Native library differs from compiled evidence: #{name}" unless ::File.lstat(path).file? && ::Digest::SHA256.file(path).hexdigest == expected
      end
      LIBRARY = ::Thread.handle_interrupt(::Object => :never) do
        NativeCopiedRuntimeV1::LOCK.synchronize do
          state = NativeCopiedRuntimeV1::STATE
          raise LoadError, "Lean native loading failed earlier" if state[:failed]
          identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
          component = "nominalsubtypes@1.0.0"
          receipt = "e5f5f3b47ee4b775f3c8283cbd94971efaad74da01d102b63f6ccdde35f33bf6"
          policy = "linux-x64-deepbind-v1"
          raise LoadError, "Incompatible Lean runtime identities" if state[:identity] && state[:identity] != identity
          raise LoadError, "Incompatible Lean native loading policy" if state[:identity] && state[:policy] != policy
          known = state[:libraries] ||= {}
          libraries.each do |name, expected|
            raise LoadError, "Conflicting builds of the same native library: #{name}" if known[name] && known[name][:sha256] != expected
          end
          previous = state[:components][component]
          raise LoadError, "Conflicting builds of the same Lean component" if previous && previous[:receipt] != receipt
          begin
            unless previous
              # RTLD_NOLOAD rejects unverified preloads before any new load.
              libraries.each_key do |name|
                next if known[name]
                [name, ::File.join(root, name)].each do |candidate|
                  handle = begin
                    ::Fiddle::Handle.new(candidate, ::Fiddle::RTLD_NOW | 4)
                  rescue ::Fiddle::DLError
                    nil
                  end
                  # glibc can return NULL without dlerror for RTLD_NOLOAD.
                  # Fiddle then returns a null Handle, which must not be closed.
                  if handle && !handle.to_i.zero?
                    handle.close
                    raise LoadError, "Unverified native library is already loaded: #{name}"
                  end
                end
              end
              # glibc RTLD_DEEPBIND gives each verified dependency its own
              # symbols before the Ruby process's existing global symbols.
              flags = ::Fiddle::RTLD_NOW | ::Fiddle::RTLD_GLOBAL | 8
              order = ["libleanshared.so", "liblean_bridge_native.so"]
              order << "libgmp-lean-bridge.so.10" if libraries.key?("libgmp-lean-bridge.so.10")
              order.concat(libraries.keys.reject { |name| order.include?(name) || name == "libnominalsubtypes.so" })
              order << "libnominalsubtypes.so"
              order.each do |name|
                next if known[name]
                handle = ::Fiddle::Handle.new(::File.join(root, name), flags)
                state[:handles] << handle
                known[name] = { sha256: libraries.fetch(name), handle: handle }
              end
              previous = { receipt: receipt, library: known.fetch("libnominalsubtypes.so").fetch(:handle) }
              state[:components][component] = previous
              state[:identity], state[:policy] = identity, policy
            end
            previous[:library]
          rescue ::Exception
            state[:failed] = true
            raise
          end
        end
      end

      CALL0 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_aliases"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL1 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_array_values"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL2 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_branch"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL3 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_combine"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL4 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_echo"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL5 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_echo_event"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL6 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_echo_groups"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL7 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_echo_pair"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL8 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_event_choices"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL9 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_event_empty"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL10 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_event_first"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL11 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_event_second"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL12 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_event_value"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL13 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_first"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL14 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_group_values"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL15 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_inspect_alias_pair"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL16 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_list_values"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL17 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_nested"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL18 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_no_items"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL19 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_optional"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL20 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_pair_values"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL21 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_plain_fin"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL22 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_produce_envelope"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL23 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_product"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL24 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_scalar"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL25 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_second"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)

      CLEAR0 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_nat_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR1 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_envelope_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR2 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR3 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR4 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_array_nat_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR5 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_result_nat_nat_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR6 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_option_result_nat_nat_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR7 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_array_option_result_nat_nat_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR8 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_event_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR9 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_alias_pair_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR10 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_list_nat_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR11 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_pair_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR12 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_option_nat_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR13 = ::Fiddle::Function.new(LIBRARY["nominalsubtypes_tuple_nat_nat_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      EXACT_TYPE = ::Object.instance_method(:instance_of?)
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
            pointer[0, [bytes, 1].max] = "\0" * [bytes, 1].max
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
      end
      def to0(value, scope)
        raise TypeError, "Expected Integer" unless exact?(value, ::Integer)
        raise RangeError, "Nat cannot be negative" if value < 0
        magnitude = value.abs
        count = (magnitude.bit_length + 31) / 32
        data = scope.allocate(count * 4)
        data[0, count * 4] = [magnitude.to_s(16).rjust(count * 8, "0")].pack("H*").reverse unless count.zero?
        result = span(scope, data, count, 32)
        
        result
      end
      def from0(value)
        data, count = value[0, 16].unpack("Q<Q<")
        result = count.zero? ? 0 : ::Fiddle::Pointer.new(data)[0, count * 4].reverse.unpack1("H*").to_i(16)
        result
      end
      def to1(value, scope)
        raise TypeError, "Expected Envelope" unless exact?(value, Envelope)
        field0 = STORED_FIELD.bind_call(value, :@payload)
        field1 = STORED_FIELD.bind_call(value, :@digit)
        result = scope.allocate(64)
        result[0, 32] = to0(field0, scope)[0, 32]
        result[32, 32] = to0(field1, scope)[0, 32]
        result
      end
      def from1(value)
        Envelope.new(payload: from0((value + 0)), digit: from0((value + 32)))
      end
      def to2(value, scope)
        raise TypeError, "Option requires nil or Some(value)" unless same?(value, nil) || exact?(value, Some)
        present = !same?(value, nil)
        payload = data_payload(value) if present
        result = scope.allocate(72)
        if present
          result[0, 1] = [1].pack("C")
          result[8, 64] = to1(payload, scope)[0, 64]
        end
        result
      end
      def from2(value)
        case value[0, 1].unpack1("C")
        when 0 then nil
        when 1 then Some.new(from1((value + 8)))
        else raise RangeError, "Invalid native Option flag"
        end
      end
      def to3(value, scope)
        values = array_input(value, scope, 72)
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * 72, charged: true)
        length.times do |index|
          data[index * 72, 72] = to2(ARRAY_GET.bind_call(values, index), scope)[0, 72]
        end
        span(scope, data, length, 32)
      end
      def from3(value)
        data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / 72
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % 8 != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from2((pointer + index * 72)) }
      end
      def to4(value, scope)
        values = array_input(value, scope, 32)
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * 32, charged: true)
        length.times do |index|
          data[index * 32, 32] = to0(ARRAY_GET.bind_call(values, index), scope)[0, 32]
        end
        span(scope, data, length, 32)
      end
      def from4(value)
        data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / 32
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % 8 != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from0((pointer + index * 32)) }
      end
      def to5(value, scope)
        raise TypeError, "Result requires Ok(value) or Err(error)" unless exact?(value, Ok) || exact?(value, Err)
        success = exact?(value, Ok)
        payload = data_payload(value)
        result = scope.allocate(72)
        if success
          result[0, 1] = [1].pack("C")
          result[8, 32] = to0(payload, scope)[0, 32]
        else
          result[40, 32] = to0(payload, scope)[0, 32]
        end
        result
      end
      def from5(value)
        case value[0, 1].unpack1("C")
        when 1 then Ok.new(from0((value + 8)))
        when 0 then Err.new(from0((value + 40)))
        else raise RangeError, "Invalid native Except flag"
        end
      end
      def to6(value, scope)
        raise TypeError, "Option requires nil or Some(value)" unless same?(value, nil) || exact?(value, Some)
        present = !same?(value, nil)
        payload = data_payload(value) if present
        result = scope.allocate(80)
        if present
          result[0, 1] = [1].pack("C")
          result[8, 72] = to5(payload, scope)[0, 72]
        end
        result
      end
      def from6(value)
        case value[0, 1].unpack1("C")
        when 0 then nil
        when 1 then Some.new(from5((value + 8)))
        else raise RangeError, "Invalid native Option flag"
        end
      end
      def to7(value, scope)
        values = array_input(value, scope, 80)
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * 80, charged: true)
        length.times do |index|
          data[index * 80, 80] = to6(ARRAY_GET.bind_call(values, index), scope)[0, 80]
        end
        span(scope, data, length, 32)
      end
      def from7(value)
        data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / 80
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % 8 != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from6((pointer + index * 80)) }
      end
      def to8(value, scope)
        if exact?(value, Event::Empty)

          result = scope.allocate(72)
          result[0, 4] = [0].pack("L<")

        elsif exact?(value, Event::Box)
          field0 = STORED_FIELD.bind_call(value, :@value)
          result = scope.allocate(72)
          result[0, 4] = [1].pack("L<")
          result[8, 64] = to1(field0, scope)[0, 64]
        elsif exact?(value, Event::Choices)
          field0 = STORED_FIELD.bind_call(value, :@values)
          result = scope.allocate(72)
          result[0, 4] = [2].pack("L<")
          result[8, 32] = to7(field0, scope)[0, 32]
        else
          raise TypeError, "Expected an exact Event constructor"
        end
        result
      end
      def from8(value)
        case value[0, 4].unpack1("L<")
        when 0 then Event::Empty.new()
        when 1 then Event::Box.new(value: from1((value + 8)))
        when 2 then Event::Choices.new(values: from7((value + 8)))
        else raise RangeError, "Invalid native Event constructor"
        end
      end
      def to9(value, scope)
        raise TypeError, "Expected AliasPair" unless exact?(value, AliasPair)
        field0 = STORED_FIELD.bind_call(value, :@left)
        field1 = STORED_FIELD.bind_call(value, :@right)
        result = scope.allocate(64)
        result[0, 32] = to3(field0, scope)[0, 32]
        result[32, 32] = to3(field1, scope)[0, 32]
        result
      end
      def from9(value)
        AliasPair.new(left: from3((value + 0)), right: from3((value + 32)))
      end
      def to10(value, scope)
        values = array_input(value, scope, 32)
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * 32, charged: true)
        length.times do |index|
          data[index * 32, 32] = to0(ARRAY_GET.bind_call(values, index), scope)[0, 32]
        end
        span(scope, data, length, 32)
      end
      def from10(value)
        data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / 32
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % 8 != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from0((pointer + index * 32)) }
      end
      def to11(value, scope)
        raise TypeError, "Expected Pair" unless exact?(value, Pair)
        field0 = STORED_FIELD.bind_call(value, :@left)
        field1 = STORED_FIELD.bind_call(value, :@right)
        result = scope.allocate(128)
        result[0, 64] = to1(field0, scope)[0, 64]
        result[64, 64] = to1(field1, scope)[0, 64]
        result
      end
      def from11(value)
        Pair.new(left: from1((value + 0)), right: from1((value + 64)))
      end
      def to12(value, scope)
        raise TypeError, "Option requires nil or Some(value)" unless same?(value, nil) || exact?(value, Some)
        present = !same?(value, nil)
        payload = data_payload(value) if present
        result = scope.allocate(40)
        if present
          result[0, 1] = [1].pack("C")
          result[8, 32] = to0(payload, scope)[0, 32]
        end
        result
      end
      def from12(value)
        case value[0, 1].unpack1("C")
        when 0 then nil
        when 1 then Some.new(from0((value + 8)))
        else raise RangeError, "Invalid native Option flag"
        end
      end
      def to13(value, scope)
        raise TypeError, "Prod requires a two-element Array" unless exact?(value, ::Array)
        raise ArgumentError, "Prod requires exactly two elements" unless ARRAY_LENGTH.bind_call(value) == 2
        values = FREEZE.bind_call(ARRAY_GET.bind_call(value, 0, 2))
        raise ArgumentError, "Prod requires exactly two elements" unless ARRAY_LENGTH.bind_call(values) == 2
        result = scope.allocate(64)
        result[0, 32] = to0(ARRAY_GET.bind_call(values, 0), scope)[0, 32]
        result[32, 32] = to0(ARRAY_GET.bind_call(values, 1), scope)[0, 32]
        result
      end
      def from13(value)
        [from0((value + 0)), from0((value + 32))]
      end

      def call0(arg0, arg1)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to3(arg0, scope)
            input1 = to3(arg1, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL0.call(input0, input1, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call1(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL1.call(input0, output, error), error)
              from4((output + 0))
            ensure
              CLEAR4.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call2(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(72)
            error = scope.allocate(24)
            begin
              check(CALL2.call(input0, output, error), error)
              from5((output + 0))
            ensure
              CLEAR5.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call3(arg0, arg1)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to1(arg0, scope)
            input1 = to1(arg1, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL3.call(input0, input1, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call4(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to1(arg0, scope)
            output = scope.allocate(64)
            error = scope.allocate(24)
            begin
              check(CALL4.call(input0, output, error), error)
              from1((output + 0))
            ensure
              CLEAR1.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call5(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to8(arg0, scope)
            output = scope.allocate(72)
            error = scope.allocate(24)
            begin
              check(CALL5.call(input0, output, error), error)
              from8((output + 0))
            ensure
              CLEAR8.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call6(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to3(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL6.call(input0, output, error), error)
              from3((output + 0))
            ensure
              CLEAR3.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call7(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to9(arg0, scope)
            output = scope.allocate(64)
            error = scope.allocate(24)
            begin
              check(CALL7.call(input0, output, error), error)
              from9((output + 0))
            ensure
              CLEAR9.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call8(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(72)
            error = scope.allocate(24)
            begin
              check(CALL8.call(input0, output, error), error)
              from8((output + 0))
            ensure
              CLEAR8.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call9(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(72)
            error = scope.allocate(24)
            begin
              check(CALL9.call(input0, output, error), error)
              from8((output + 0))
            ensure
              CLEAR8.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call10(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to8(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL10.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call11(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to8(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL11.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call12(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(72)
            error = scope.allocate(24)
            begin
              check(CALL12.call(input0, output, error), error)
              from8((output + 0))
            ensure
              CLEAR8.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call13(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to1(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL13.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call14(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL14.call(input0, output, error), error)
              from3((output + 0))
            ensure
              CLEAR3.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call15(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to9(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL15.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call16(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL16.call(input0, output, error), error)
              from10((output + 0))
            ensure
              CLEAR10.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call17(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to11(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL17.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call18(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL18.call(input0, output, error), error)
              from4((output + 0))
            ensure
              CLEAR4.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call19(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(40)
            error = scope.allocate(24)
            begin
              check(CALL19.call(input0, output, error), error)
              from12((output + 0))
            ensure
              CLEAR12.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call20(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(64)
            error = scope.allocate(24)
            begin
              check(CALL20.call(input0, output, error), error)
              from9((output + 0))
            ensure
              CLEAR9.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call21(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL21.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call22(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(64)
            error = scope.allocate(24)
            begin
              check(CALL22.call(input0, output, error), error)
              from1((output + 0))
            ensure
              CLEAR1.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call23(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(64)
            error = scope.allocate(24)
            begin
              check(CALL23.call(input0, output, error), error)
              from13((output + 0))
            ensure
              CLEAR13.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call24(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to0(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL24.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call25(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to1(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL25.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
    end
  end
end
