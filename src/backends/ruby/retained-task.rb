# frozen_string_literal: true
# This component-local owner dispatches boxed Lean requests only after Fiddle
# has returned. Lean worker threads never enter Ruby or hold a Ruby object.
module LeanBridge::GeneratedTaskComponent
  class CallbackClosed < BoundaryError; end

  class RetainedCallback
    def initialize(callable = nil, &block)
      TaskRuntimeV1.context
      raise ::ArgumentError, "Pass a callable or a block, not both" if callable && block
      fn = block || callable
      raise ::TypeError, "Expected a callable" unless fn.respond_to?(:call)
      @binding = [fn]
    end
    def call(value)
      TaskRuntimeV1.context
      fn = @binding[0]
      raise CallbackClosed, "Retained Ruby callback is closed" unless fn
      fn.call(value) # An in-flight call keeps its own reference even if it closes itself.
    end
    def close
      TaskRuntimeV1.context
      !!@binding.delete_at(0)
    end
    def closed?
      TaskRuntimeV1.context
      @binding.empty?
    end
    def initialize_copy(_) = raise(::TypeError, "Retained Ruby callbacks cannot be copied")
    def _dump(*) = raise(::TypeError, "Retained Ruby callbacks cannot be serialized")
  end

  class RetainedRuntimeV1
    def initialize(ops, args)
      @ops, @calls, @faults = ops, {}, []
      ops[:callbacks].each do |index, arg, reply|
        fn = args[index]
        raise ::TypeError, "Expected a callback at argument #{index + 1}" unless fn.respond_to?(:call)
        @calls[index] = [fn, arg, reply]
      end
    end
    def clear
      @calls.clear
      @faults.clear
    end
    def original(id)
      raise BoundaryError, "Unknown callback failure identity" unless id.between?(1, @faults.length)
      @faults.fetch(id - 1)
    end
    def invoke(fn, input)
      returned = false
      begin
        value = ::Thread.handle_interrupt(::Exception => :immediate) { fn.call(input) }
        returned = true
        value
      rescue ::Exception
        returned = true
        raise
      ensure
        raise ::LocalJumpError, "A retained Ruby callback must return normally" unless returned
      end
    end
    def diagnostic(error)
      # Even the built-in Exception#to_s can invoke an arbitrary message object's
      # to_s. A raise/throw/return from that conversion is not the callback failure.
      fallback = "Ruby callback failed"
      invoke(->(err) {
        raw = ::Exception.instance_method(:to_s).bind_call(err)
        next fallback unless ::String === raw && ::String.instance_method(:bytesize).bind_call(raw) <= NativeSyncWireV1::LIMIT
        text = ::String.new(raw).encode(::Encoding::UTF_8, invalid: :replace, undef: :replace).scrub
        text.bytesize <= NativeSyncWireV1::LIMIT ? text : fallback
      }, error)
    rescue ::StandardError
      fallback
    end
    def fail_request(slot, error, frame)
      # Only the broker's failure identity selects the actual exception.
      begin
        text = diagnostic(error)
      rescue ::Exception
        @ops[:trap].call
        raise
      end
      return if slot.state
      words = frame.bytes(24); id = frame.bytes(4)
      words[0, 24] = NativeSyncWireV1.encode("string", text, frame, UNIT).pack("Q<3")
      @faults << error
      code = @ops[:fail].call(slot.h, words, id)
      TaskRuntimeV1.status(code) unless code.zero?
      raise BoundaryError, "Invalid callback failure identity" unless id[0, 4].unpack1("L<") == @faults.length
    end
    def dispatch(slot, index)
      fn, input, reply = @calls.fetch(index)
      value = TaskRuntimeV1.output(@ops) do |_, out, tags|
        code = @ops[:read_arg].call(slot.h, index, out)
        TaskRuntimeV1.status(code) unless code.zero?
        TaskRuntimeV1.decode(input, out, tags)
      end
      frame = NativeSyncWireV1::Frame.new
      begin
        begin
          answer = slot.scope ? TaskRuntimeV1::API.__send__(:__worker_call) { invoke(fn, value) } : invoke(fn, value)
        rescue ::StandardError => err
          fail_request(slot, err, frame) unless slot.state
          return
        rescue ::Exception
          # A trap retires the broker even when the callback first cancelled itself.
          @ops[:trap].call
          raise
        end
        return if slot.state
        words = frame.bytes(24)
        words[0, 24] = NativeSyncWireV1.encode(reply, answer, frame, UNIT).pack("Q<3")
        return if slot.state
        code = @ops[:reply].call(slot.h, index, words)
        TaskRuntimeV1.status(code) unless code.zero?
        frame.admit_hosts if slot.scope
      ensure
        frame.close
      end
    end
    def pump(slot)
      slot.dispatcher = ::Fiber.current.object_id
      begin
        ::Fiddle::Pointer.malloc(4, ::Fiddle::RUBY_FREE) do |index|
          16.times do
            break if slot.state
            code = @ops[:next_request].call(slot.h, index)
            break if code == 1
            TaskRuntimeV1.status(code) unless code.zero?
            dispatch(slot, index[0, 4].unpack1("L<"))
          end
        end
      ensure
        slot.dispatcher = nil
      end
    end
  end
  private_constant :RetainedRuntimeV1
end
