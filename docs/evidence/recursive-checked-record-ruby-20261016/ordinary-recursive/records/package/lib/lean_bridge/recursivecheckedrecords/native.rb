require "fiddle"
module LeanBridge
  module Recursivecheckedrecords
    module Native
      extend self
      raise LoadError, "Copied graphs require MRI Ruby 3.3, 64-bit little-endian Linux" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.") && RUBY_PLATFORM.include?("x86_64-linux") && ::Fiddle::SIZEOF_VOIDP == 8 && [1].pack("I") == [1].pack("L<")
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
          @nodes = 262144
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
          raise GraphLimit, "Copied graph depth or node limit exceeded" if depth > 128 || @nodes == 0
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
            pointer[0, [size, 1].max] = "\0" * [size, 1].max
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

      def graph_checked_status(status, diagnostic)
        return graph_status(status) unless status == 1
        message = diagnostic.call
        return graph_status(status) if message.null?
        text = message.to_s.force_encoding(::Encoding::UTF_8)
        raise GraphInvalidNative, "Malformed native refinement diagnostic" unless text.valid_encoding?
        raise LeanBridgeError.new(status, text)
      end
      def graph_input0(value, scope, depth = 0, native_storage = true)
        key = IDENTIFY.bind_call(value)
        scope.enter(key, depth, 32, native_storage)
        begin
          snapshot = graph_array(value, scope)
          length = ARRAY_LENGTH.bind_call(snapshot)
          scope.charge(:native, length, 32)
          out = scope.allocate(32)
          data = scope.allocate(length * 32)
          length.times do |index|
            child = graph_input1(ARRAY_GET.bind_call(snapshot, index), scope, depth + 1, false)
            data[index * 32, 32] = child[0, 32] unless scope.check_only
          end
          out[16, 16] = [length == 0 ? 0 : data.to_i, length].pack("Q<Q<") unless scope.check_only
          out
        ensure
          scope.leave(key)
        end
      end
      def graph_output0(value, scope, depth = 0, native_storage = true)
        key = [0, value.to_i]
        scope.enter(key, depth, 32, native_storage, true)
        begin
          pointer, length = value[16, 16].unpack("Q<Q<")
          scope.charge(:native, length, 32)
          scope.charge(:storage, length, 8)
          scope.charge(:storage, 128)
          graph_span(pointer, length, 32, 8)
          graph_checkpoint
          data = ::Fiddle::Pointer.new(pointer)
          ::Array.new(length) { |index| graph_output1((data + index * 32), scope, depth + 1, false) }
        ensure
          scope.leave(key)
        end
      end
      def graph_input1(value, scope, depth = 0, native_storage = true)
        key = IDENTIFY.bind_call(value)
        scope.enter(key, depth, 32, native_storage)
        begin
          return scope.allocate(32) if SAME.bind_call(value, nil)
          if graph_exact?(value, ::LeanBridge::Recursivecheckedrecords::Some)
            payload = ARRAY_GET.bind_call(DATA_FIELDS.bind_call(value), 0)
            out = scope.allocate(32)
            out[16, 1] = [1].pack("C") unless scope.check_only
            child = graph_input2(payload, scope, depth + 1, true)
            out[24, 8] = [child.to_i].pack("Q<") unless scope.check_only
            out
          else
            raise TypeError, "Expected nil or Some(value)"
          end
        ensure
          scope.leave(key)
        end
      end
      def graph_output1(value, scope, depth = 0, native_storage = true)
        key = [1, value.to_i]
        scope.enter(key, depth, 32, native_storage, true)
        begin
          return nil if value[16, 1].unpack1("C") == 0
          if value[16, 1].unpack1("C") == 1
            scope.charge(:storage, 128)
            graph_checkpoint
            ::LeanBridge::Recursivecheckedrecords::Some.new(graph_output2(graph_pointer(value[24, 8].unpack1("Q<"), 88, 8), scope, depth + 1, true))
          else
            raise GraphInvalidNative, "Invalid native option flag"
          end
        ensure
          scope.leave(key)
        end
      end
      def graph_input2(value, scope, depth = 0, native_storage = true)
        key = IDENTIFY.bind_call(value)
        scope.enter(key, depth, 88, native_storage)
        begin
          raise TypeError, "Expected exact Packet" unless graph_exact?(value, ::LeanBridge::Recursivecheckedrecords::Packet)
          field0 = FIELD.bind_call(value, :@value)
          field1 = FIELD.bind_call(value, :@digit)
          field2 = FIELD.bind_call(value, :@tail)
          out = scope.allocate(88)
          child = graph_input3(field0, scope, depth + 1, false)
          out[16, 32] = child[0, 32] unless scope.check_only
          child = graph_input3(field1, scope, depth + 1, false)
          out[48, 32] = child[0, 32] unless scope.check_only
          child = graph_input1(field2, scope, depth + 1, true)
          out[80, 8] = [child.to_i].pack("Q<") unless scope.check_only
          out
        ensure
          scope.leave(key)
        end
      end
      def graph_output2(value, scope, depth = 0, native_storage = true)
        key = [2, value.to_i]
        scope.enter(key, depth, 88, native_storage, true)
        begin
          scope.charge(:storage, 176)
          graph_checkpoint
          ::LeanBridge::Recursivecheckedrecords::Packet.new(value: graph_output3((value + 16), scope, depth + 1, false), digit: graph_output3((value + 48), scope, depth + 1, false), tail: graph_output1(graph_pointer(value[80, 8].unpack1("Q<"), 32, 8), scope, depth + 1, true))
        ensure
          scope.leave(key)
        end
      end
      def graph_input3(value, scope, depth = 0, native_storage = true)
        key = nil
        scope.enter(key, depth, 32, native_storage)
        begin
          graph_integer(value, 0)
          scope.charge(:storage, (value.bit_length + 31) / 32, 4)
          magnitude = value.abs
          length = (magnitude.bit_length + 31) / 32
          scope.charge(:storage, length, 32)
          scope.charge(:native, length, 4)
          out = scope.allocate(32)
          data = scope.allocate(length * 4)
          unless scope.check_only
            data[0, length * 4] = [magnitude.to_s(16).rjust(length * 8, "0")].pack("H*").reverse unless length == 0
            out[16, 16] = [length == 0 ? 0 : data.to_i, length].pack("Q<Q<")
          end
          out
        ensure
          scope.leave(key)
        end
      end
      def graph_output3(value, scope, depth = 0, native_storage = true)
        key = nil
        scope.enter(key, depth, 32, native_storage, true)
        begin
          pointer, length = value[16, 16].unpack("Q<Q<")
          scope.charge(:native, length, 4)
          scope.charge(:storage, length, 32)
          scope.charge(:storage, 128)
          graph_span(pointer, length, 4, 4)
          graph_checkpoint
          bytes = length == 0 ? +"".b : ::Fiddle::Pointer.new(pointer)[0, length * 4]
          magnitude = length == 0 ? 0 : bytes.reverse.unpack1("H*").to_i(16)
          magnitude
        ensure
          scope.leave(key)
        end
      end
      def graph_call_echo(invoke, arg0, clear: nil, lifecycle: nil)
        raise ArgumentError, "Aggregate calls require pre-bound C cleanup" unless clear
        ::Thread.handle_interrupt(::Exception => :never) do
          checked = GraphScope.new(true)
          begin
            graph_input2(arg0, checked)
          ensure
            checked.close
          end
          scope = GraphScope.new
          output = nil
          begin
            input0 = graph_input2(arg0, scope)
            output = scope.allocate(88)
            
            graph_status(lifecycle[0].call) if lifecycle
            graph_checked_status(invoke.call(input0, output), DIAGNOSTIC)
            result = graph_output2((output + 0), scope)
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if lifecycle && lifecycle[1].call == 0
            result
          rescue GraphInvalidNative
            lifecycle[2].call if lifecycle
            raise
          ensure
            begin
              clear.call(output) if output
            ensure
              scope.close
            end
          end
        end
      end
      def graph_call_echo_groups(invoke, arg0, clear: nil, lifecycle: nil)
        raise ArgumentError, "Aggregate calls require pre-bound C cleanup" unless clear
        ::Thread.handle_interrupt(::Exception => :never) do
          checked = GraphScope.new(true)
          begin
            graph_input0(arg0, checked)
          ensure
            checked.close
          end
          scope = GraphScope.new
          output = nil
          begin
            input0 = graph_input0(arg0, scope)
            output = scope.allocate(32)
            
            graph_status(lifecycle[0].call) if lifecycle
            graph_checked_status(invoke.call(input0, output), DIAGNOSTIC)
            result = graph_output0((output + 0), scope)
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if lifecycle && lifecycle[1].call == 0
            result
          rescue GraphInvalidNative
            lifecycle[2].call if lifecycle
            raise
          ensure
            begin
              clear.call(output) if output
            ensure
              scope.close
            end
          end
        end
      end
      def graph_call_first(invoke, arg0, clear: nil, lifecycle: nil)
        raise ArgumentError, "Aggregate calls require pre-bound C cleanup" unless clear
        ::Thread.handle_interrupt(::Exception => :never) do
          checked = GraphScope.new(true)
          begin
            graph_input2(arg0, checked)
          ensure
            checked.close
          end
          scope = GraphScope.new
          output = nil
          begin
            input0 = graph_input2(arg0, scope)
            output = scope.allocate(32)
            
            graph_status(lifecycle[0].call) if lifecycle
            graph_checked_status(invoke.call(input0, output), DIAGNOSTIC)
            result = graph_output3((output + 0), scope)
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if lifecycle && lifecycle[1].call == 0
            result
          rescue GraphInvalidNative
            lifecycle[2].call if lifecycle
            raise
          ensure
            begin
              clear.call(output) if output
            ensure
              scope.close
            end
          end
        end
      end
      def graph_call_groups(invoke, arg0, clear: nil, lifecycle: nil)
        raise ArgumentError, "Aggregate calls require pre-bound C cleanup" unless clear
        ::Thread.handle_interrupt(::Exception => :never) do
          checked = GraphScope.new(true)
          begin
            graph_input0(arg0, checked)
          ensure
            checked.close
          end
          scope = GraphScope.new
          output = nil
          begin
            input0 = graph_input0(arg0, scope)
            output = scope.allocate(32)
            
            graph_status(lifecycle[0].call) if lifecycle
            graph_checked_status(invoke.call(input0, output), DIAGNOSTIC)
            result = graph_output3((output + 0), scope)
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if lifecycle && lifecycle[1].call == 0
            result
          rescue GraphInvalidNative
            lifecycle[2].call if lifecycle
            raise
          ensure
            begin
              clear.call(output) if output
            ensure
              scope.close
            end
          end
        end
      end
      def graph_call_produce(invoke, arg0, clear: nil, lifecycle: nil)
        raise ArgumentError, "Aggregate calls require pre-bound C cleanup" unless clear
        ::Thread.handle_interrupt(::Exception => :never) do
          checked = GraphScope.new(true)
          begin
            graph_input3(arg0, checked)
          ensure
            checked.close
          end
          scope = GraphScope.new
          output = nil
          begin
            input0 = graph_input3(arg0, scope)
            output = scope.allocate(88)
            
            graph_status(lifecycle[0].call) if lifecycle
            graph_checked_status(invoke.call(input0, output), DIAGNOSTIC)
            result = graph_output2((output + 0), scope)
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if lifecycle && lifecycle[1].call == 0
            result
          rescue GraphInvalidNative
            lifecycle[2].call if lifecycle
            raise
          ensure
            begin
              clear.call(output) if output
            ensure
              scope.close
            end
          end
        end
      end
      def graph_call_second(invoke, arg0, clear: nil, lifecycle: nil)
        raise ArgumentError, "Aggregate calls require pre-bound C cleanup" unless clear
        ::Thread.handle_interrupt(::Exception => :never) do
          checked = GraphScope.new(true)
          begin
            graph_input2(arg0, checked)
          ensure
            checked.close
          end
          scope = GraphScope.new
          output = nil
          begin
            input0 = graph_input2(arg0, scope)
            output = scope.allocate(32)
            
            graph_status(lifecycle[0].call) if lifecycle
            graph_checked_status(invoke.call(input0, output), DIAGNOSTIC)
            result = graph_output3((output + 0), scope)
            raise LeanBridgeError.new(5, "Lean runtime is unavailable") if lifecycle && lifecycle[1].call == 0
            result
          rescue GraphInvalidNative
            lifecycle[2].call if lifecycle
            raise
          ensure
            begin
              clear.call(output) if output
            ensure
              scope.close
            end
          end
        end
      end
    end
    private_constant :Native
  end
end

require "digest"
require "digest/sha2"
raise LoadError, "Lean graphs require Ruby 1:1 threads; unset RUBY_MN_THREADS" unless ENV.fetch("RUBY_MN_THREADS", "0").to_i.zero?
module LeanBridge
  module Recursivecheckedrecords
    module Native
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
      libraries = {"libcomponent_a1d30b9a0f384ed52541.so" => "39fd2e912a23a62a9f98962f9c1735759fbd095b12d4b5bcfd2d79e00f23f575", "liblean_bridge_native.so" => "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7", "libleanshared.so" => "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4", "librecursivecheckedrecords.so" => "154dfb279028ed4f709f01731d73f365efaa0e3e3ccbbf3d1056a313669ffe66"}.freeze
      libraries.each do |name, expected|
        path = ::File.join(root, name)
        raise LoadError, "Native library differs from compiled evidence: #{name}" unless ::File.lstat(path).file? && ::Digest::SHA256.file(path).hexdigest == expected
      end
      LIBRARY = ::Thread.handle_interrupt(::Object => :never) do
        NativeCopiedRuntimeV1::LOCK.synchronize do
          state = NativeCopiedRuntimeV1::STATE
          raise LoadError, "Lean native loading failed earlier" if state[:failed]
          identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
          component = "recursivecheckedrecords@1.0.0"
          receipt = "90c0e12105c9e0d9b5884ba6da7ae26a4716f81d7e3a7bbfad36169e9cea2600"
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
              order.concat(libraries.keys.reject { |name| order.include?(name) || name == "librecursivecheckedrecords.so" })
              order << "librecursivecheckedrecords.so"
              order.each do |name|
                next if known[name]
                handle = ::Fiddle::Handle.new(::File.join(root, name), flags)
                state[:handles] << handle
                known[name] = { sha256: libraries.fetch(name), handle: handle }
              end
              previous = { receipt: receipt, library: known.fetch("librecursivecheckedrecords.so").fetch(:handle) }
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

      CLEAR = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_ruby_graph_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID, need_gvl: true)
      INITIALIZE = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_graph_initialize"], [], ::Fiddle::TYPE_INT, need_gvl: true)
      READY = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_graph_ready"], [], ::Fiddle::TYPE_INT, need_gvl: true)
      RETIRE = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_graph_retire"], [], ::Fiddle::TYPE_VOID, need_gvl: true)
      LIFECYCLE = [INITIALIZE, READY, RETIRE].freeze
      DIAGNOSTIC = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_graph_error"], [], ::Fiddle::TYPE_VOIDP, need_gvl: true)
      CALL0 = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_echo_graph"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
      def call0(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        graph_call_echo(CALL0, arg0, clear: CLEAR, lifecycle: LIFECYCLE)
      end
      CALL1 = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_echo_groups_graph"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
      def call1(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        graph_call_echo_groups(CALL1, arg0, clear: CLEAR, lifecycle: LIFECYCLE)
      end
      CALL2 = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_first_graph"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
      def call2(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        graph_call_first(CALL2, arg0, clear: CLEAR, lifecycle: LIFECYCLE)
      end
      CALL3 = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_groups_graph"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
      def call3(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        graph_call_groups(CALL3, arg0, clear: CLEAR, lifecycle: LIFECYCLE)
      end
      CALL4 = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_produce_graph"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
      def call4(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        graph_call_produce(CALL4, arg0, clear: CLEAR, lifecycle: LIFECYCLE)
      end
      CALL5 = ::Fiddle::Function.new(LIBRARY["recursivecheckedrecords_second_graph"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
      def call5(arg0)
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        graph_call_second(CALL5, arg0, clear: CLEAR, lifecycle: LIFECYCLE)
      end
    end
  end
end
