# frozen_string_literal: true
require "fiddle"
require "digest"
require "digest/sha2"
module LeanBridge
  module Nominalprimitivesubtypes
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
      libraries = {"libcomponent_19ad06f04a0c2d39db76.so" => "58a916198cb50e5bb7fab57554591812a8381960749e100c43effecedd0a3672", "liblean_bridge_native.so" => "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7", "libleanshared.so" => "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4", "libnominalprimitivesubtypes.so" => "eb46ccf3accce434eca3d3071099d945d515ec305901040e05ec3e44264dd4f0"}.freeze
      libraries.each do |name, expected|
        path = ::File.join(root, name)
        raise LoadError, "Native library differs from compiled evidence: #{name}" unless ::File.lstat(path).file? && ::Digest::SHA256.file(path).hexdigest == expected
      end
      LIBRARY = ::Thread.handle_interrupt(::Object => :never) do
        NativeCopiedRuntimeV1::LOCK.synchronize do
          state = NativeCopiedRuntimeV1::STATE
          raise LoadError, "Lean native loading failed earlier" if state[:failed]
          identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
          component = "nominalprimitivesubtypes@1.0.0"
          receipt = "31ea60c50a725460981dda018423cd9ccf1c6c7ae49435e3956a7006ef674f15"
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
              order.concat(libraries.keys.reject { |name| order.include?(name) || name == "libnominalprimitivesubtypes.so" })
              order << "libnominalprimitivesubtypes.so"
              order.each do |name|
                next if known[name]
                handle = ::Fiddle::Handle.new(::File.join(root, name), flags)
                state[:handles] << handle
                known[name] = { sha256: libraries.fetch(name), handle: handle }
              end
              previous = { receipt: receipt, library: known.fetch("libnominalprimitivesubtypes.so").fetch(:handle) }
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

      CALL0 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_aliases"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL1 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_combine"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL2 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_echo_a"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL3 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_echo_b"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL4 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_echo_event_a"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL5 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_echo_event_b"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL6 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_echo_pair"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL7 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_produce"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL8 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_produce_choices"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL9 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_produce_event"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL10 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_produce_group"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL11 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_produce_pair"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL12 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_refuse_unit"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL13 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_word_bits"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)

      CLEAR10 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_nat_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR11 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_int_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR14 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_string_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR15 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_bytes_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR19 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_packet_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR20 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR21 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR22 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR23 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR24 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR25 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR26 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_event_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR27 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_pair_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR28 = ::Fiddle::Function.new(LIBRARY["nominalprimitivesubtypes_raw_packet_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
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
      def to0(value)
        raise TypeError, "Expected UNIT" unless same?(value, UNIT)
        0
      end
      def from0(value)
        UNIT
      end
      def to1(value)
        raise TypeError, "Expected true or false" unless same?(value, true) || same?(value, false)
        value ? 1 : 0
      end
      def from1(value)
        value != 0
      end
      def to2(value)
        integer(value, 0, (1 << 8) - 1)
        value >= (1 << 7) ? value - (1 << 8) : value
      end
      def from2(value)
        value & ((1 << 8) - 1)
      end
      def to3(value)
        integer(value, 0, (1 << 16) - 1)
        value >= (1 << 15) ? value - (1 << 16) : value
      end
      def from3(value)
        value & ((1 << 16) - 1)
      end
      def to4(value)
        integer(value, 0, (1 << 32) - 1)
        value >= (1 << 31) ? value - (1 << 32) : value
      end
      def from4(value)
        value & ((1 << 32) - 1)
      end
      def to5(value)
        integer(value, 0, (1 << 64) - 1)
        value >= (1 << 63) ? value - (1 << 64) : value
      end
      def from5(value)
        value & ((1 << 64) - 1)
      end
      def to6(value)
        integer(value, -(1 << 7), (1 << 7) - 1)
      end
      def from6(value)
        value
      end
      def to7(value)
        integer(value, -(1 << 15), (1 << 15) - 1)
      end
      def from7(value)
        value
      end
      def to8(value)
        integer(value, -(1 << 31), (1 << 31) - 1)
      end
      def from8(value)
        value
      end
      def to9(value)
        integer(value, -(1 << 63), (1 << 63) - 1)
      end
      def from9(value)
        value
      end
      def to10(value, scope)
        raise TypeError, "Expected Integer" unless exact?(value, ::Integer)
        raise RangeError, "Nat cannot be negative" if value < 0
        magnitude = value.abs
        count = (magnitude.bit_length + 31) / 32
        data = scope.allocate(count * 4)
        data[0, count * 4] = [magnitude.to_s(16).rjust(count * 8, "0")].pack("H*").reverse unless count.zero?
        result = span(scope, data, count, 32)
        
        result
      end
      def from10(value)
        data, count = value[0, 16].unpack("Q<Q<")
        result = count.zero? ? 0 : ::Fiddle::Pointer.new(data)[0, count * 4].reverse.unpack1("H*").to_i(16)
        result
      end
      def to11(value, scope)
        raise TypeError, "Expected Integer" unless exact?(value, ::Integer)
        
        magnitude = value.abs
        count = (magnitude.bit_length + 31) / 32
        data = scope.allocate(count * 4)
        data[0, count * 4] = [magnitude.to_s(16).rjust(count * 8, "0")].pack("H*").reverse unless count.zero?
        result = span(scope, data, count, 40)
        result[32, 1] = [value < 0 ? 1 : 0].pack("C")
        result
      end
      def from11(value)
        data, count = value[0, 16].unpack("Q<Q<")
        result = count.zero? ? 0 : ::Fiddle::Pointer.new(data)[0, count * 4].reverse.unpack1("H*").to_i(16)
        value[32, 1].unpack1("C").zero? ? result : -result
      end
      def to12(value)
        raise TypeError, "Expected Float" unless exact?(value, ::Float)
        value
      end
      def from12(value)
        value
      end
      def to13(value)
        raise TypeError, "Expected Float" unless exact?(value, ::Float)
        value
      end
      def from13(value)
        value
      end
      def to14(value, scope)
        value = string_input(value, scope)
        raise EncodingError, "Expected valid UTF-8 or US-ASCII" unless text?(value)
        length = STRING_BYTESIZE.bind_call(value)
        data = scope.allocate(length, charged: true)
        data[0, length] = value
        span(scope, data, length, 32)
      end
      def from14(value)
        data, length = value[0, 16].unpack("Q<Q<")
        result = length.zero? ? +"".b : ::Fiddle::Pointer.new(data)[0, length]
        result.force_encoding(Encoding::UTF_8)
        raise EncodingError, "Invalid native UTF-8" unless result.valid_encoding?
        result
      end
      def to15(value, scope)
        value = string_input(value, scope)
        
        length = STRING_BYTESIZE.bind_call(value)
        data = scope.allocate(length, charged: true)
        data[0, length] = value
        span(scope, data, length, 32)
      end
      def from15(value)
        data, length = value[0, 16].unpack("Q<Q<")
        result = length.zero? ? +"".b : ::Fiddle::Pointer.new(data)[0, length]
        result.force_encoding(Encoding::BINARY)
        result
      end
      def to16(value)
        value = string_input(value, nil, 4)
        raise EncodingError, "Char requires valid UTF-8 or US-ASCII" unless text?(value)
        raise RangeError, "Char requires one Unicode scalar" unless STRING_LENGTH.bind_call(value) == 1
        STRING_ORD.bind_call(value)
      end
      def from16(value)
        raise RangeError, "Invalid native Unicode scalar" unless value.between?(0, 0x10ffff) && !value.between?(0xd800, 0xdfff)
        value.chr(Encoding::UTF_8)
      end
      def to17(value)
        integer(value, 0, (1 << 64) - 1)
        value >= (1 << 63) ? value - (1 << 64) : value
      end
      def from17(value)
        value & ((1 << 64) - 1)
      end
      def to18(value)
        integer(value, -(1 << 63), (1 << 63) - 1)
      end
      def from18(value)
        value
      end
      def to19(value, scope)
        raise TypeError, "Expected Packet" unless exact?(value, Packet)
        field0 = STORED_FIELD.bind_call(value, :@unit_value)
        field1 = STORED_FIELD.bind_call(value, :@bool_value)
        field2 = STORED_FIELD.bind_call(value, :@uint8_value)
        field3 = STORED_FIELD.bind_call(value, :@uint16_value)
        field4 = STORED_FIELD.bind_call(value, :@uint32_value)
        field5 = STORED_FIELD.bind_call(value, :@uint64_value)
        field6 = STORED_FIELD.bind_call(value, :@int8_value)
        field7 = STORED_FIELD.bind_call(value, :@int16_value)
        field8 = STORED_FIELD.bind_call(value, :@int32_value)
        field9 = STORED_FIELD.bind_call(value, :@int64_value)
        field10 = STORED_FIELD.bind_call(value, :@nat_value)
        field11 = STORED_FIELD.bind_call(value, :@int_value)
        field12 = STORED_FIELD.bind_call(value, :@float32_value)
        field13 = STORED_FIELD.bind_call(value, :@float64_value)
        field14 = STORED_FIELD.bind_call(value, :@text_value)
        field15 = STORED_FIELD.bind_call(value, :@bytes_value)
        field16 = STORED_FIELD.bind_call(value, :@char_value)
        field17 = STORED_FIELD.bind_call(value, :@usize_value)
        field18 = STORED_FIELD.bind_call(value, :@isize_value)
        field19 = STORED_FIELD.bind_call(value, :@digit)
        result = scope.allocate(248)
        result[0, 1] = [to0(field0)].pack("C")
        result[1, 1] = [to1(field1)].pack("C")
        result[2, 1] = [to2(field2)].pack("C")
        result[4, 2] = [to3(field3)].pack("S<")
        result[8, 4] = [to4(field4)].pack("L<")
        result[16, 8] = [to5(field5)].pack("Q<")
        result[24, 1] = [to6(field6)].pack("c")
        result[26, 2] = [to7(field7)].pack("s<")
        result[28, 4] = [to8(field8)].pack("l<")
        result[32, 8] = [to9(field9)].pack("q<")
        result[40, 32] = to10(field10, scope)[0, 32]
        result[72, 40] = to11(field11, scope)[0, 40]
        result[112, 4] = [to12(field12)].pack("e")
        result[120, 8] = [to13(field13)].pack("E")
        result[128, 32] = to14(field14, scope)[0, 32]
        result[160, 32] = to15(field15, scope)[0, 32]
        result[192, 4] = [to16(field16)].pack("L<")
        result[200, 8] = [to17(field17)].pack("Q<")
        result[208, 8] = [to18(field18)].pack("q<")
        result[216, 32] = to10(field19, scope)[0, 32]
        result
      end
      def from19(value)
        Packet.new(unit_value: from0(value[0, 1].unpack1("C")), bool_value: from1(value[1, 1].unpack1("C")), uint8_value: from2(value[2, 1].unpack1("C")), uint16_value: from3(value[4, 2].unpack1("S<")), uint32_value: from4(value[8, 4].unpack1("L<")), uint64_value: from5(value[16, 8].unpack1("Q<")), int8_value: from6(value[24, 1].unpack1("c")), int16_value: from7(value[26, 2].unpack1("s<")), int32_value: from8(value[28, 4].unpack1("l<")), int64_value: from9(value[32, 8].unpack1("q<")), nat_value: from10((value + 40)), int_value: from11((value + 72)), float32_value: from12(value[112, 4].unpack1("e")), float64_value: from13(value[120, 8].unpack1("E")), text_value: from14((value + 128)), bytes_value: from15((value + 160)), char_value: from16(value[192, 4].unpack1("L<")), usize_value: from17(value[200, 8].unpack1("Q<")), isize_value: from18(value[208, 8].unpack1("q<")), digit: from10((value + 216)))
      end
      def to20(value, scope)
        raise TypeError, "Option requires nil or Some(value)" unless same?(value, nil) || exact?(value, Some)
        present = !same?(value, nil)
        payload = data_payload(value) if present
        result = scope.allocate(256)
        if present
          result[0, 1] = [1].pack("C")
          result[8, 248] = to19(payload, scope)[0, 248]
        end
        result
      end
      def from20(value)
        case value[0, 1].unpack1("C")
        when 0 then nil
        when 1 then Some.new(from19((value + 8)))
        else raise RangeError, "Invalid native Option flag"
        end
      end
      def to21(value, scope)
        values = array_input(value, scope, 256)
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * 256, charged: true)
        length.times do |index|
          data[index * 256, 256] = to20(ARRAY_GET.bind_call(values, index), scope)[0, 256]
        end
        span(scope, data, length, 32)
      end
      def from21(value)
        data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / 256
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % 8 != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from20((pointer + index * 256)) }
      end
      def to22(value, scope)
        raise TypeError, "Prod requires a two-element Array" unless exact?(value, ::Array)
        raise ArgumentError, "Prod requires exactly two elements" unless ARRAY_LENGTH.bind_call(value) == 2
        values = FREEZE.bind_call(ARRAY_GET.bind_call(value, 0, 2))
        raise ArgumentError, "Prod requires exactly two elements" unless ARRAY_LENGTH.bind_call(values) == 2
        result = scope.allocate(496)
        result[0, 248] = to19(ARRAY_GET.bind_call(values, 0), scope)[0, 248]
        result[248, 248] = to19(ARRAY_GET.bind_call(values, 1), scope)[0, 248]
        result
      end
      def from22(value)
        [from19((value + 0)), from19((value + 248))]
      end
      def to23(value, scope)
        raise TypeError, "Result requires Ok(value) or Err(error)" unless exact?(value, Ok) || exact?(value, Err)
        success = exact?(value, Ok)
        payload = data_payload(value)
        result = scope.allocate(504)
        if success
          result[0, 1] = [1].pack("C")
          result[8, 248] = to19(payload, scope)[0, 248]
        else
          result[256, 248] = to19(payload, scope)[0, 248]
        end
        result
      end
      def from23(value)
        case value[0, 1].unpack1("C")
        when 1 then Ok.new(from19((value + 8)))
        when 0 then Err.new(from19((value + 256)))
        else raise RangeError, "Invalid native Except flag"
        end
      end
      def to24(value, scope)
        raise TypeError, "Option requires nil or Some(value)" unless same?(value, nil) || exact?(value, Some)
        present = !same?(value, nil)
        payload = data_payload(value) if present
        result = scope.allocate(512)
        if present
          result[0, 1] = [1].pack("C")
          result[8, 504] = to23(payload, scope)[0, 504]
        end
        result
      end
      def from24(value)
        case value[0, 1].unpack1("C")
        when 0 then nil
        when 1 then Some.new(from23((value + 8)))
        else raise RangeError, "Invalid native Option flag"
        end
      end
      def to25(value, scope)
        values = array_input(value, scope, 512)
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * 512, charged: true)
        length.times do |index|
          data[index * 512, 512] = to24(ARRAY_GET.bind_call(values, index), scope)[0, 512]
        end
        span(scope, data, length, 32)
      end
      def from25(value)
        data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / 512
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % 8 != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from24((pointer + index * 512)) }
      end
      def to26(value, scope)
        if exact?(value, Event::Empty)

          result = scope.allocate(256)
          result[0, 4] = [0].pack("L<")

        elsif exact?(value, Event::Box)
          field0 = STORED_FIELD.bind_call(value, :@value)
          result = scope.allocate(256)
          result[0, 4] = [1].pack("L<")
          result[8, 248] = to19(field0, scope)[0, 248]
        elsif exact?(value, Event::Choices)
          field0 = STORED_FIELD.bind_call(value, :@values)
          result = scope.allocate(256)
          result[0, 4] = [2].pack("L<")
          result[8, 32] = to25(field0, scope)[0, 32]
        else
          raise TypeError, "Expected an exact Event constructor"
        end
        result
      end
      def from26(value)
        case value[0, 4].unpack1("L<")
        when 0 then Event::Empty.new()
        when 1 then Event::Box.new(value: from19((value + 8)))
        when 2 then Event::Choices.new(values: from25((value + 8)))
        else raise RangeError, "Invalid native Event constructor"
        end
      end
      def to27(value, scope)
        raise TypeError, "Expected Pair" unless exact?(value, Pair)
        field0 = STORED_FIELD.bind_call(value, :@left)
        field1 = STORED_FIELD.bind_call(value, :@right)
        result = scope.allocate(64)
        result[0, 32] = to21(field0, scope)[0, 32]
        result[32, 32] = to21(field1, scope)[0, 32]
        result
      end
      def from27(value)
        Pair.new(left: from21((value + 0)), right: from21((value + 32)))
      end
      def to28(value, scope)
        raise TypeError, "Expected RawPacket" unless exact?(value, RawPacket)
        field0 = STORED_FIELD.bind_call(value, :@unit_value)
        field1 = STORED_FIELD.bind_call(value, :@bool_value)
        field2 = STORED_FIELD.bind_call(value, :@uint8_value)
        field3 = STORED_FIELD.bind_call(value, :@uint16_value)
        field4 = STORED_FIELD.bind_call(value, :@uint32_value)
        field5 = STORED_FIELD.bind_call(value, :@uint64_value)
        field6 = STORED_FIELD.bind_call(value, :@int8_value)
        field7 = STORED_FIELD.bind_call(value, :@int16_value)
        field8 = STORED_FIELD.bind_call(value, :@int32_value)
        field9 = STORED_FIELD.bind_call(value, :@int64_value)
        field10 = STORED_FIELD.bind_call(value, :@nat_value)
        field11 = STORED_FIELD.bind_call(value, :@int_value)
        field12 = STORED_FIELD.bind_call(value, :@float32_value)
        field13 = STORED_FIELD.bind_call(value, :@float64_value)
        field14 = STORED_FIELD.bind_call(value, :@text_value)
        field15 = STORED_FIELD.bind_call(value, :@bytes_value)
        field16 = STORED_FIELD.bind_call(value, :@char_value)
        field17 = STORED_FIELD.bind_call(value, :@usize_value)
        field18 = STORED_FIELD.bind_call(value, :@isize_value)
        field19 = STORED_FIELD.bind_call(value, :@digit)
        result = scope.allocate(248)
        result[0, 1] = [to0(field0)].pack("C")
        result[1, 1] = [to1(field1)].pack("C")
        result[2, 1] = [to2(field2)].pack("C")
        result[4, 2] = [to3(field3)].pack("S<")
        result[8, 4] = [to4(field4)].pack("L<")
        result[16, 8] = [to5(field5)].pack("Q<")
        result[24, 1] = [to6(field6)].pack("c")
        result[26, 2] = [to7(field7)].pack("s<")
        result[28, 4] = [to8(field8)].pack("l<")
        result[32, 8] = [to9(field9)].pack("q<")
        result[40, 32] = to10(field10, scope)[0, 32]
        result[72, 40] = to11(field11, scope)[0, 40]
        result[112, 4] = [to12(field12)].pack("e")
        result[120, 8] = [to13(field13)].pack("E")
        result[128, 32] = to14(field14, scope)[0, 32]
        result[160, 32] = to15(field15, scope)[0, 32]
        result[192, 4] = [to16(field16)].pack("L<")
        result[200, 8] = [to17(field17)].pack("Q<")
        result[208, 8] = [to18(field18)].pack("q<")
        result[216, 32] = to10(field19, scope)[0, 32]
        result
      end
      def from28(value)
        RawPacket.new(unit_value: from0(value[0, 1].unpack1("C")), bool_value: from1(value[1, 1].unpack1("C")), uint8_value: from2(value[2, 1].unpack1("C")), uint16_value: from3(value[4, 2].unpack1("S<")), uint32_value: from4(value[8, 4].unpack1("L<")), uint64_value: from5(value[16, 8].unpack1("Q<")), int8_value: from6(value[24, 1].unpack1("c")), int16_value: from7(value[26, 2].unpack1("s<")), int32_value: from8(value[28, 4].unpack1("l<")), int64_value: from9(value[32, 8].unpack1("q<")), nat_value: from10((value + 40)), int_value: from11((value + 72)), float32_value: from12(value[112, 4].unpack1("e")), float64_value: from13(value[120, 8].unpack1("E")), text_value: from14((value + 128)), bytes_value: from15((value + 160)), char_value: from16(value[192, 4].unpack1("L<")), usize_value: from17(value[200, 8].unpack1("Q<")), isize_value: from18(value[208, 8].unpack1("q<")), digit: from10((value + 216)))
      end

      def call0(arg0, arg1)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to21(arg0, scope)
            input1 = to21(arg1, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL0.call(input0, input1, output, error), error)
              from21((output + 0))
            ensure
              CLEAR21.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call1(arg0, arg1)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to19(arg0, scope)
            input1 = to19(arg1, scope)
            output = scope.allocate(496)
            error = scope.allocate(24)
            begin
              check(CALL1.call(input0, input1, output, error), error)
              from22((output + 0))
            ensure
              CLEAR22.call(output)
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
            input0 = to19(arg0, scope)
            output = scope.allocate(248)
            error = scope.allocate(24)
            begin
              check(CALL2.call(input0, output, error), error)
              from19((output + 0))
            ensure
              CLEAR19.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call3(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to19(arg0, scope)
            output = scope.allocate(248)
            error = scope.allocate(24)
            begin
              check(CALL3.call(input0, output, error), error)
              from19((output + 0))
            ensure
              CLEAR19.call(output)
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
            input0 = to26(arg0, scope)
            output = scope.allocate(256)
            error = scope.allocate(24)
            begin
              check(CALL4.call(input0, output, error), error)
              from26((output + 0))
            ensure
              CLEAR26.call(output)
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
            input0 = to26(arg0, scope)
            output = scope.allocate(256)
            error = scope.allocate(24)
            begin
              check(CALL5.call(input0, output, error), error)
              from26((output + 0))
            ensure
              CLEAR26.call(output)
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
            input0 = to27(arg0, scope)
            output = scope.allocate(64)
            error = scope.allocate(24)
            begin
              check(CALL6.call(input0, output, error), error)
              from27((output + 0))
            ensure
              CLEAR27.call(output)
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
            input0 = to28(arg0, scope)
            output = scope.allocate(256)
            error = scope.allocate(24)
            begin
              check(CALL7.call(input0, output, error), error)
              from20((output + 0))
            ensure
              CLEAR20.call(output)
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
            input0 = to28(arg0, scope)
            output = scope.allocate(256)
            error = scope.allocate(24)
            begin
              check(CALL8.call(input0, output, error), error)
              from26((output + 0))
            ensure
              CLEAR26.call(output)
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
            input0 = to28(arg0, scope)
            output = scope.allocate(256)
            error = scope.allocate(24)
            begin
              check(CALL9.call(input0, output, error), error)
              from26((output + 0))
            ensure
              CLEAR26.call(output)
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
            input0 = to28(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL10.call(input0, output, error), error)
              from21((output + 0))
            ensure
              CLEAR21.call(output)
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
            input0 = to28(arg0, scope)
            output = scope.allocate(64)
            error = scope.allocate(24)
            begin
              check(CALL11.call(input0, output, error), error)
              from27((output + 0))
            ensure
              CLEAR27.call(output)
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
            input0 = to19(arg0, scope)
            output = scope.allocate(248)
            error = scope.allocate(24)
            begin
              check(CALL12.call(input0, output, error), error)
              from19((output + 0))
            ensure
              CLEAR19.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call13()
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin

            output = scope.allocate(4)
            error = scope.allocate(24)
            begin
              check(CALL13.call(output, error), error)
              from4(output[0, 4].unpack1("L<"))
            ensure
              
            end
          ensure
            scope.close
          end
        end
      end
    end
  end
end
