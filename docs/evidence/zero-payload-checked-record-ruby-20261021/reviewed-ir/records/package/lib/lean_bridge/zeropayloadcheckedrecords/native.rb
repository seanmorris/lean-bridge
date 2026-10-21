# frozen_string_literal: true
require "fiddle"
require "digest"
require "digest/sha2"
module LeanBridge
  module Zeropayloadcheckedrecords
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
      libraries = {"libcomponent_d43d7c5a9f170f3ce127.so" => "99757ffd528089839276986cecbacc46ff50f89c9c9d51ddfaa77e680091384a", "liblean_bridge_native.so" => "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21", "libleanshared.so" => "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4", "libzeropayloadcheckedrecords.so" => "0e5597b960e36703438c54db29b3c2a99aeadfbfeefc0b5ca86b386c5e465e07"}.freeze
      libraries.each do |name, expected|
        path = ::File.join(root, name)
        raise LoadError, "Native library differs from compiled evidence: #{name}" unless ::File.lstat(path).file? && ::Digest::SHA256.file(path).hexdigest == expected
      end
      LIBRARY = ::Thread.handle_interrupt(::Object => :never) do
        NativeCopiedRuntimeV1::LOCK.synchronize do
          state = NativeCopiedRuntimeV1::STATE
          raise LoadError, "Lean native loading failed earlier" if state[:failed]
          identity = "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
          component = "zeropayloadcheckedrecords@1.0.0"
          receipt = "6f61dc170c7a9b6fdd20550926e6429e8da168c19583a007a159d1ac4c1a760d"
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
              order.concat(libraries.keys.reject { |name| order.include?(name) || name == "libzeropayloadcheckedrecords.so" })
              order << "libzeropayloadcheckedrecords.so"
              order.each do |name|
                next if known[name]
                handle = ::Fiddle::Handle.new(::File.join(root, name), flags)
                state[:handles] << handle
                known[name] = { sha256: libraries.fetch(name), handle: handle }
              end
              previous = { receipt: receipt, library: known.fetch("libzeropayloadcheckedrecords.so").fetch(:handle) }
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

      CALL0 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_absent_count"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL1 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_mark_count"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL2 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_marker_count"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL3 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_maybe_witness"], [::Fiddle::TYPE_CHAR, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL4 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_produce_mark"], [::Fiddle::TYPE_CHAR, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL5 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_produce_marker"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL6 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_produce_token"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL7 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_produce_witness"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL8 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_token_tag"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL9 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_witness_count"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL10 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_witnesses"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)

      CLEAR0 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_witness_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR1 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_nat_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR2 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_mark_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR3 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_marker_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR5 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR7 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_token_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR8 = ::Fiddle::Function.new(LIBRARY["zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
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
        raise TypeError, "Expected Witness" unless exact?(value, Witness)

        result = scope.allocate(1)

        result
      end
      def from0(value)
        Witness.new()
      end
      def to1(value, scope)
        raise TypeError, "Expected Integer" unless exact?(value, ::Integer)
        raise RangeError, "Nat cannot be negative" if value < 0
        magnitude = value.abs
        count = (magnitude.bit_length + 31) / 32
        data = scope.allocate(count * 4)
        data[0, count * 4] = [magnitude.to_s(16).rjust(count * 8, "0")].pack("H*").reverse unless count.zero?
        result = span(scope, data, count, 32)
        
        result
      end
      def from1(value)
        data, count = value[0, 16].unpack("Q<Q<")
        result = count.zero? ? 0 : ::Fiddle::Pointer.new(data)[0, count * 4].reverse.unpack1("H*").to_i(16)
        result
      end
      def to2(value, scope)
        if exact?(value, Mark::Blank)

          result = scope.allocate(8)
          result[0, 4] = [0].pack("L<")

        elsif exact?(value, Mark::Marked)
          field0 = STORED_FIELD.bind_call(value, :@witness)
          result = scope.allocate(8)
          result[0, 4] = [1].pack("L<")
          result[4, 1] = to0(field0, scope)[0, 1]
        else
          raise TypeError, "Expected an exact Mark constructor"
        end
        result
      end
      def from2(value)
        case value[0, 4].unpack1("L<")
        when 0 then Mark::Blank.new()
        when 1 then Mark::Marked.new(witness: from0((value + 4)))
        else raise RangeError, "Invalid native Mark constructor"
        end
      end
      def to3(value, scope)
        raise TypeError, "Expected Marker" unless exact?(value, Marker)

        result = scope.allocate(1)

        result
      end
      def from3(value)
        Marker.new()
      end
      def to4(value)
        raise TypeError, "Expected true or false" unless same?(value, true) || same?(value, false)
        value ? 1 : 0
      end
      def from4(value)
        value != 0
      end
      def to5(value, scope)
        raise TypeError, "Option requires nil or Some(value)" unless same?(value, nil) || exact?(value, Some)
        present = !same?(value, nil)
        payload = data_payload(value) if present
        result = scope.allocate(2)
        if present
          result[0, 1] = [1].pack("C")
          result[1, 1] = to0(payload, scope)[0, 1]
        end
        result
      end
      def from5(value)
        case value[0, 1].unpack1("C")
        when 0 then nil
        when 1 then Some.new(from0((value + 1)))
        else raise RangeError, "Invalid native Option flag"
        end
      end
      def to6(value)
        raise TypeError, "Expected UNIT" unless same?(value, UNIT)
        0
      end
      def from6(value)
        UNIT
      end
      def to7(value, scope)
        raise TypeError, "Expected Token" unless exact?(value, Token)
        field0 = STORED_FIELD.bind_call(value, :@tag)
        result = scope.allocate(1)
        result[0, 1] = [to6(field0)].pack("C")
        result
      end
      def from7(value)
        Token.new(tag: from6(value[0, 1].unpack1("C")))
      end
      def to8(value, scope)
        values = array_input(value, scope, 8)
        length = ARRAY_LENGTH.bind_call(values)
        data = scope.allocate(length * 1, charged: true)
        length.times do |index|
          data[index * 1, 1] = to0(ARRAY_GET.bind_call(values, index), scope)[0, 1]
        end
        span(scope, data, length, 32)
      end
      def from8(value)
        data, count = value[0, 16].unpack("Q<Q<")
        raise RangeError, "Lean Bridge native sequence exceeds the 16 MiB copy limit" if count > (16 * 1024 * 1024) / 8
        raise RangeError, "Invalid native sequence buffer" if !count.zero? && (data.zero? || data % 1 != 0)
        pointer = ::Fiddle::Pointer.new(data)
        ::Array.new(count) { |index| from0((pointer + index * 1)) }
      end

      def call0(arg0)
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
              check(CALL0.call(input0, output, error), error)
              from1((output + 0))
            ensure
              CLEAR1.call(output)
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
            input0 = to2(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL1.call(input0, output, error), error)
              from1((output + 0))
            ensure
              CLEAR1.call(output)
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
            input0 = to3(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL2.call(input0, output, error), error)
              from1((output + 0))
            ensure
              CLEAR1.call(output)
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
            input0 = to4(arg0)
            output = scope.allocate(2)
            error = scope.allocate(24)
            begin
              check(CALL3.call(input0, output, error), error)
              from5((output + 0))
            ensure
              CLEAR5.call(output)
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
            input0 = to4(arg0)
            output = scope.allocate(8)
            error = scope.allocate(24)
            begin
              check(CALL4.call(input0, output, error), error)
              from2((output + 0))
            ensure
              CLEAR2.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call5()
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin

            output = scope.allocate(1)
            error = scope.allocate(24)
            begin
              check(CALL5.call(output, error), error)
              from3((output + 0))
            ensure
              CLEAR3.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call6()
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin

            output = scope.allocate(1)
            error = scope.allocate(24)
            begin
              check(CALL6.call(output, error), error)
              from7((output + 0))
            ensure
              CLEAR7.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call7()
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin

            output = scope.allocate(1)
            error = scope.allocate(24)
            begin
              check(CALL7.call(output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
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
            input0 = to7(arg0, scope)
            
            error = scope.allocate(24)
            begin
              check(CALL8.call(input0, error), error)
              UNIT
            ensure
              
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
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL9.call(input0, output, error), error)
              from1((output + 0))
            ensure
              CLEAR1.call(output)
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
            input0 = to1(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL10.call(input0, output, error), error)
              from8((output + 0))
            ensure
              CLEAR8.call(output)
            end
          ensure
            scope.close
          end
        end
      end
    end
  end
end
