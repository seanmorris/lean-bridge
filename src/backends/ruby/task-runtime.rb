# frozen_string_literal: true
require "io/wait"
require "weakref"

module LeanBridge::GeneratedTaskComponent
  class Cancelled < BoundaryError; end
  class Busy < BoundaryError; end
  class StepError < DeclaredError; end
  class TaskIOError < IOError; end

  module TaskRuntimeV1
    API = ::LeanBridge::GeneratedTaskComponent
    PID = ::Process.pid
    SLOTS = {}.compare_by_identity
    Slot = ::Struct.new(:h, :ops, :gates, :abandoned, :state, :value, :pulling, :iterating, :dispatcher, :scope, :calls)
    END_OF_STREAM = ::Object.new.freeze

    def self.context
      unless ::Ractor.current.equal?(::Ractor.main) && ::Thread.current.equal?(::Thread.main) && ::Process.pid == PID
        raise WrongContext, "Lean delivery requires its original process and main thread"
      end
    end
    def self.atomic(&block) = ::Thread.handle_interrupt(::Exception => :never, &block)
    def self.bind_scope
      @owner_fiber, @scope = ::Fiber.current, ::Object.new.freeze
    end
    def self.require_scope(expected = @scope)
      unless expected && expected.equal?(@scope) && @owner_fiber.equal?(::Fiber.current)
        raise WrongContext, "Enter the original bind_hosts block on its owning fiber"
      end
      expected
    end
    def self.end_scope
      return unless @scope
      scope, @scope, @owner_fiber = @scope, nil, nil
      SLOTS.each_key do |slot|
        next unless slot.scope.equal?(scope)
        slot.state, slot.value = slot.ops[:pull] ? [:closed, nil] : [:error, Cancelled.new("Ruby host binding ended")]
        slot.calls.__getobj__.clear if slot.calls&.weakref_alive?
        release(slot)
      end
    end
    def self.finalizer(flag) = proc { flag[0] = true }
    def self.release(slot)
      return unless slot.h
      slot.gates.each { |gate| slot.ops[:wake].call(gate) }
      unless slot.h[0, 8].unpack1("Q<").zero?
        code = slot.ops[:close].call(slot.h)
        unless code == 0 || code == 6
          slot.abandoned[0] = true
          status(code)
        end
      end
      slot.h.call_free
      slot.h = nil
      SLOTS.delete(slot)
      Native.collect_hosts if slot.ops[:scoped]
    end
    def self.drain
      context
      Native.drain_resources if Native.respond_to?(:drain_resources)
      atomic { SLOTS.each_key { |slot| release(slot) if slot.abandoned[0] } }
    end
    at_exit do
      if ::Process.pid == PID && ::Thread.current.equal?(::Thread.main)
        atomic { SLOTS.each_key { |slot| release(slot) } }
      end
    end
    def self.status(code)
      case code
      when 5 then raise ::ArgumentError, "Invalid Lean argument"
      when 6 then raise Cancelled, "Lean operation is closed"
      when 7 then raise Busy, "A pull is already in flight"
      when 9 then raise WrongContext, "Wrong Lean runtime context"
      when 10 then raise Unavailable, "Lean runtime is unavailable"
      when 11 then raise ::NoMemoryError, "Lean allocation failed"
      when 12 then raise ::RangeError, "Lean copy budget exceeded"
      else raise BoundaryError, "Unexpected Lean delivery status #{code}"
      end
    end
    def self.output(ops)
      frame = NativeSyncWireV1::Frame.new
      begin
        out = frame.bytes(32); tags = frame.bytes(ops[:depth]); out[0, 32] = "\0" * 32
        begin
          yield frame, out, tags
        ensure
          ops[:clear].call(out)
          Native.collect_hosts if ops[:scoped]
        end
      ensure
        frame.close
      end
    end
    def self.decode(type, out, tags) = NativeSyncWireV1.decode(API, type, out[0, 32].unpack("Q<4"), tags, out)
    def self.start(ops, args)
      drain
      scope = require_scope if ops[:scoped]
      atomic do
        h = ::Fiddle::Pointer.malloc(16, ::Fiddle::RUBY_FREE); h[0, 16] = "\0" * 16
        slot = Slot.new(h, ops, [], [false])
        slot.scope = scope
        begin
          callbacks = ops[:callbacks] && RetainedRuntimeV1.new(ops, args)
          slot.calls = ::WeakRef.new(callbacks) if scope && callbacks
          SLOTS[slot] = true
          output(ops) do |frame, out, tags|
            input = frame.bytes(24 * args.size)
            ops[:args].each_with_index do |type, i|
              next if type == "callback"
              input[24 * i, 24] = NativeSyncWireV1.encode(type, args[i], frame, UNIT).pack("Q<3")
            end
            code = ops[:start].call(input, h, out, tags)
            frame.admit_hosts if ops[:scoped] && [0, 3, 4].include?(code)
            case code
            when 0 then nil
            when 3 then raise DeclaredError.new(ops[:decl], decode(ops[:error], out, tags))
            when 4 then raise IOError.new(ops[:decl], decode("string", out, tags))
            when 6
              raise ClosedResource, "Lean resource is closed" if ops[:args].any? { |t| t.start_with?("lease:") }
              status(code)
            else status(code)
            end
          end
          obj = (ops[:pull] ? PullStream : Task).__send__(:new, slot, callbacks)
          ::ObjectSpace.define_finalizer(obj, finalizer(slot.abandoned))
          obj
        rescue ::Exception
          release(slot)
          raise
        end
      end
    end
    # A separate epoll registration per waiter. Another fiber may settle or
    # cancel the owner at any time inside wait_readable, even before it returns.
    def self.ready(slot, callbacks = nil)
      ops = slot.ops
      if callbacks && !slot.dispatcher
        callbacks.pump(slot)
        return false if slot.state
      end
      ::Fiddle::Pointer.malloc(4, ::Fiddle::RUBY_FREE) do |fd|
        code = ops[:poll].call(slot.h, fd)
        return true if code.zero?
        status(code) unless code == 1
        ::Fiddle::Pointer.malloc(8, ::Fiddle::RUBY_FREE) do |gate|
          cb = -1
          if callbacks && !slot.dispatcher
            code = ops[:callback_fd].call(slot.h, gate)
            status(code) unless code.zero?
            cb = gate[0, 4].unpack1("l<")
          end
          code = ops[:open_wait].call(fd[0, 4].unpack1("l<"), cb, gate)
          status(code) unless code.zero?
          begin
            slot.gates << gate
            io = ::IO.for_fd(gate[0, 4].unpack1("l<"), autoclose: false)
            ::Thread.handle_interrupt(::Exception => :immediate) { io.wait_readable }
          ensure
            slot.gates.delete(gate)
            ops[:end_wait].call(gate)
          end
        end
        false
      end
    end
    def self.take(slot, callbacks = nil)
      ops = slot.ops
      output(ops) do |_, out, tags|
        case code = ops[:take].call(slot.h, out, tags)
        when 0 then decode(ops[:result], out, tags)
        when 2 then END_OF_STREAM
        when 3
          raise DeclaredError.new(ops[:decl], decode(ops[:error], out, tags)) if callbacks
          raise StepError.new(ops[:step], decode(ops[:terminal], out, tags))
        when 4 then raise TaskIOError.new(ops[:step] || ops[:decl], decode("string", out, tags))
        when 13 then raise IOError.new(ops[:decl], decode("string", out, tags))
        when 14 then raise callbacks.original(out[0, 8].unpack1("Q<")) # __LB_ONCE_DECODE__
        else status(code)
        end
      end
    end
  end
  private_constant :TaskRuntimeV1

  class DeliveryOwner
    private_class_method :new, :allocate
    def initialize(slot, callbacks) = (@slot, @callbacks = slot, callbacks)
    def initialize_copy(other)
      ::ObjectSpace.undefine_finalizer(self)
      raise ::TypeError, "Lean delivery owners cannot be copied"
    end
    def _dump(*) = raise(::TypeError, "Lean delivery owners cannot be serialized")
    def with
      TaskRuntimeV1.context
      TaskRuntimeV1.require_scope(@slot.scope) if @slot.scope
      begin
        yield self
      ensure
        close
      end
    end
  end
  private_constant :DeliveryOwner
  class Task < DeliveryOwner
    def await
      TaskRuntimeV1.drain
      TaskRuntimeV1.require_scope(@slot.scope) if @slot.scope
      TaskRuntimeV1.atomic do
        raise Busy, "A callback cannot await its own task" if !@slot.state && @slot.dispatcher == ::Fiber.current.object_id
        begin
          until @slot.state
            next unless TaskRuntimeV1.ready(@slot, @callbacks)
            settle(:value, TaskRuntimeV1.take(@slot, @callbacks))
          end
        rescue ::Exception => error
          settle(:error, error) unless @slot.state
        end
        raise @slot.value if @slot.state == :error
        @slot.value
      end
    end
    def cancel
      TaskRuntimeV1.context
      TaskRuntimeV1.require_scope(@slot.scope) if @slot.scope && !@slot.state
      TaskRuntimeV1.atomic { @slot.state ? false : settle(:error, Cancelled.new("Lean task cancelled")) }
    end
    alias close cancel
    private
    def settle(state, value)
      @slot.state, @slot.value = state, value
      @callbacks&.clear
      TaskRuntimeV1.release(@slot)
      true
    end
  end
  class PullStream < DeliveryOwner
    include ::Enumerable
    def next
      TaskRuntimeV1.drain
      TaskRuntimeV1.require_scope(@slot.scope) if @slot.scope
      TaskRuntimeV1.atomic do
        raise ::StopIteration if @slot.state == :closed
        raise Busy, "Another fiber is already pulling this stream" if @slot.pulling || (@slot.iterating && @slot.iterating != ::Fiber.current.object_id)
        @slot.pulling = true
        begin
          code = @slot.ops[:pull].call(@slot.h); TaskRuntimeV1.status(code) unless code.zero?
          until TaskRuntimeV1.ready(@slot)
            raise Cancelled, "Lean stream closed during pull" if @slot.state == :closed
          end
          item = TaskRuntimeV1.take(@slot)
          if item.equal?(TaskRuntimeV1::END_OF_STREAM)
            close
            raise ::StopIteration
          end
          item
        rescue ::Exception
          close
          raise
        ensure
          @slot.pulling = false
        end
      end
    end
    def each
      return enum_for(:each) unless block_given?
      TaskRuntimeV1.drain
      TaskRuntimeV1.require_scope(@slot.scope) if @slot.scope
      TaskRuntimeV1.atomic do
        raise Busy, "Another enumeration is active" if @slot.pulling || @slot.iterating
        # Do not retain an Enumerator's suspended Fiber (and therefore its owner).
        @slot.iterating = ::Fiber.current.object_id
        begin
          ::Thread.handle_interrupt(::Exception => :immediate) do
            while true
              begin
                item = self.next
              rescue ::StopIteration
                break
              end
              yield item
            end
          end
        ensure
          @slot.iterating = nil
          close
        end
      end
      self
    end
    def close
      TaskRuntimeV1.context
      TaskRuntimeV1.require_scope(@slot.scope) if @slot.scope && !@slot.state
      TaskRuntimeV1.atomic do
        return false if @slot.state == :closed
        @slot.state = :closed; TaskRuntimeV1.release(@slot); true
      end
    end
  end
end
