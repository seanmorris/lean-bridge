# frozen_string_literal: true
require "fiddle"
require "digest"
require "digest/sha2"
module LeanBridge
  module Inheritedcheckedrecords
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
      libraries = {"libcomponent_95491bb762dabafaf0ed.so" => "53509628e8748849ffa17fca90c68c15ad1be2ae6340b47f9ab5c1ab751ebbd4", "libinheritedcheckedrecords.so" => "b09a8be0f302ce8d24b60c0477ff0ce498d7132614ca3566a0371865217feb27", "liblean_bridge_native.so" => "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21", "libleanshared.so" => "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"}.freeze
      libraries.each do |name, expected|
        path = ::File.join(root, name)
        raise LoadError, "Native library differs from compiled evidence: #{name}" unless ::File.lstat(path).file? && ::Digest::SHA256.file(path).hexdigest == expected
      end
      LIBRARY = ::Thread.handle_interrupt(::Object => :never) do
        NativeCopiedRuntimeV1::LOCK.synchronize do
          state = NativeCopiedRuntimeV1::STATE
          raise LoadError, "Lean native loading failed earlier" if state[:failed]
          identity = "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
          component = "inheritedcheckedrecords@1.0.0"
          receipt = "58f8fc665dacee8f437962873cebb0a1454a0a94095ea713f9adc2b4902b0edc"
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
              order.concat(libraries.keys.reject { |name| order.include?(name) || name == "libinheritedcheckedrecords.so" })
              order << "libinheritedcheckedrecords.so"
              order.each do |name|
                next if known[name]
                handle = ::Fiddle::Handle.new(::File.join(root, name), flags)
                state[:handles] << handle
                known[name] = { sha256: libraries.fetch(name), handle: handle }
              end
              previous = { receipt: receipt, library: known.fetch("libinheritedcheckedrecords.so").fetch(:handle) }
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

      CALL0 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_aliased"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL1 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_echo"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL2 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_first"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL3 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_nested"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL4 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_normalized"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL5 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_pair"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL6 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_produce"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)
      CALL7 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_produce_stamped"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT)

      CLEAR0 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_nat_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR1 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_span_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR2 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_ticket_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
      CLEAR3 = ::Fiddle::Function.new(LIBRARY["inheritedcheckedrecords_stamped_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)
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
        raise TypeError, "Expected Span" unless exact?(value, Span)
        field0 = STORED_FIELD.bind_call(value, :@lo)
        field1 = STORED_FIELD.bind_call(value, :@hi)
        result = scope.allocate(64)
        result[0, 32] = to0(field0, scope)[0, 32]
        result[32, 32] = to0(field1, scope)[0, 32]
        result
      end
      def from1(value)
        Span.new(lo: from0((value + 0)), hi: from0((value + 32)))
      end
      def to2(value, scope)
        raise TypeError, "Expected Ticket" unless exact?(value, Ticket)
        field0 = STORED_FIELD.bind_call(value, :@to_span)
        field1 = STORED_FIELD.bind_call(value, :@word)
        result = scope.allocate(96)
        result[0, 64] = to1(field0, scope)[0, 64]
        result[64, 32] = to0(field1, scope)[0, 32]
        result
      end
      def from2(value)
        Ticket.new(to_span: from1((value + 0)), word: from0((value + 64)))
      end
      def to3(value, scope)
        raise TypeError, "Expected Stamped" unless exact?(value, Stamped)
        field0 = STORED_FIELD.bind_call(value, :@to_ticket)
        field1 = STORED_FIELD.bind_call(value, :@mark)
        result = scope.allocate(128)
        result[0, 96] = to2(field0, scope)[0, 96]
        result[96, 32] = to0(field1, scope)[0, 32]
        result
      end
      def from3(value)
        Stamped.new(to_ticket: from2((value + 0)), mark: from0((value + 96)))
      end

      def call0(arg0)
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
              check(CALL0.call(input0, output, error), error)
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
            input0 = to2(arg0, scope)
            output = scope.allocate(96)
            error = scope.allocate(24)
            begin
              check(CALL1.call(input0, output, error), error)
              from2((output + 0))
            ensure
              CLEAR2.call(output)
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
            input0 = to2(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL2.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
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
            input0 = to3(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL3.call(input0, output, error), error)
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
            input0 = to2(arg0, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL4.call(input0, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
            end
          ensure
            scope.close
          end
        end
      end
      def call5(arg0, arg1)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError, reason
        end
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
            input0 = to2(arg0, scope)
            input1 = to2(arg1, scope)
            output = scope.allocate(32)
            error = scope.allocate(24)
            begin
              check(CALL5.call(input0, input1, output, error), error)
              from0((output + 0))
            ensure
              CLEAR0.call(output)
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
            input0 = to0(arg0, scope)
            output = scope.allocate(96)
            error = scope.allocate(24)
            begin
              check(CALL6.call(input0, output, error), error)
              from2((output + 0))
            ensure
              CLEAR2.call(output)
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
            input0 = to0(arg0, scope)
            output = scope.allocate(128)
            error = scope.allocate(24)
            begin
              check(CALL7.call(input0, output, error), error)
              from3((output + 0))
            ensure
              CLEAR3.call(output)
            end
          ensure
            scope.close
          end
        end
      end
    end
  end
end
