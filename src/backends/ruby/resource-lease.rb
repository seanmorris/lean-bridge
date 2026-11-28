# frozen_string_literal: true
require "fiddle"

module LeanBridge
  # Shared by independently installed IO and task gems. A slot contains one
  # native lease, never the Ruby wrapper, a user callback, or a Lean pointer.
  module NativeResourceLeaseV1
    PID = ::Process.pid
    TYPES = {}
    OWNERS = ::ObjectSpace::WeakMap.new
    ORIGINS = ::ObjectSpace::WeakMap.new
    LIVE = {}.compare_by_identity
    ABANDONED = []
    ZERO = "\0".b * 16
    ZERO.freeze
    Slot = ::Struct.new(:handle, :ops)
    def self.atomic(&block) = ::Thread.handle_interrupt(::Object => :never, &block)
    def self.context(api)
      unless ::Ractor.current.equal?(::Ractor.main) && ::Thread.current.equal?(::Thread.main) && ::Process.pid == PID
        raise api::WrongContext, "Lean resources require the original process main thread"
      end
    end
    def self.status(code, api)
      case code
      when 0 then nil
      when 6 then raise api::ClosedResource, "Lean resource is closed"
      when 9 then raise api::WrongContext, "Wrong Lean resource context"
      when 10 then raise api::Unavailable, "Lean runtime is unavailable"
      when 11 then raise ::NoMemoryError, "Lean resource allocation failed"
      else raise api::BoundaryError, "Unexpected Lean resource status #{code}"
      end
    end
    def self.release(s)
      return false unless s&.handle
      code = s.ops[:close].call(s.handle)
      status(code, s.ops[:api]) unless code == 0 || code == 6
      s.handle.call_free
      s.handle = nil
      LIVE.delete(s)
      true
    end
    def self.drain(api)
      context(api)
      atomic { release(ABANDONED.pop) until ABANDONED.empty? }
    end
    # The finalizer enqueues work; it never calls Fiddle on a GC thread.
    def self.finalizer(slot) = proc { ABANDONED << slot if slot.handle }
    at_exit do
      if ::Process.pid == PID && ::Thread.current.equal?(::Thread.main)
        atomic { LIVE.each_key { |s| release(s) } }
      end
    end
    def self.kind(ledger, hash, api)
      context(api)
      TYPES[[ledger, hash]] ||= ::Class.new(Lease).tap do |klass|
        klass.const_set(:ORIGIN, api); klass.private_constant(:ORIGIN)
      end
    end
    def self.take(ops, source)
      bytes = source[0, 16]
      raise ops[:api]::BoundaryError, "Invalid native resource lease" if bytes.unpack("Q<2").any?(&:zero?)
      obj = ::Class.instance_method(:allocate).bind_call(ops[:class])
      s = Slot.new(::Fiddle::Pointer.malloc(16, ::Fiddle::RUBY_FREE), ops)
      moved = false
      begin
        s.handle[0, 16] = bytes
        LIVE[s] = true; OWNERS[obj] = s; ORIGINS[obj] = ops[:api]
        ::ObjectSpace.define_finalizer(obj, finalizer(s))
        source[0, 16] = ZERO # until here the caller's ensure still owns the lease
        moved = true
      ensure
        unless moved
          LIVE.delete(s); s.handle.call_free; s.handle = nil
        end
      end
      obj
    end
    def self.live(klass, obj, api)
      unless ::Object.instance_method(:instance_of?).bind_call(obj, klass)
        raise ::TypeError, "Expected a #{klass} lease"
      end
      s = OWNERS[obj]
      raise api::ClosedResource, "Lean resource is closed or was not issued by its runtime" unless s&.handle
      s
    end
    def self.borrow(ops, obj)
      live(ops[:class], obj, ops[:api]).handle[0, 16].unpack("Q<2") << 0
    end
    class Lease
      private_class_method :new, :allocate
      def closed?
        resource_context
        !OWNERS[self]&.handle
      end
      def close
        resource_context
        NativeResourceLeaseV1.atomic { NativeResourceLeaseV1.release(OWNERS[self]) }
      end
      def with
        klass, api = resource_context
        NativeResourceLeaseV1.live(klass, self, api)
        begin
          yield self
        ensure
          close
        end
      end
      def retain
        klass, api = resource_context
        NativeResourceLeaseV1.atomic do
          s = NativeResourceLeaseV1.live(klass, self, api)
          ::Fiddle::Pointer.malloc(16, ::Fiddle::RUBY_FREE) do |out|
            out[0, 16] = ZERO
            begin
              NativeResourceLeaseV1.status(s.ops[:retain].call(s.handle, out), api)
              return NativeResourceLeaseV1.take(s.ops, out)
            ensure
              s.ops[:close].call(out) unless out[0, 16] == ZERO
            end
          end
        end
      end
      def same_resource?(other)
        klass, api = resource_context
        NativeResourceLeaseV1.atomic do
          a = NativeResourceLeaseV1.live(klass, self, api)
          b = NativeResourceLeaseV1.live(klass, other, api)
          ::Fiddle::Pointer.malloc(1, ::Fiddle::RUBY_FREE) do |out|
            NativeResourceLeaseV1.status(a.ops[:same].call(a.handle, b.handle, out), api)
            return out[0, 1] != "\0"
          end
        end
      end
      def initialize_copy(_)
        ::ObjectSpace.undefine_finalizer(self)
        raise ::TypeError, "Use retain for an independently disposable Lean resource"
      end
      def _dump(*) = raise(::TypeError, "Lean resources cannot be serialized")
      private
      def resource_context
        klass = ::Object.instance_method(:class).bind_call(self)
        # Once a closed slot is collected, wrapper errors still belong to
        # the gem that issued this lease, regardless of component load order.
        api = (::Ractor.current.equal?(::Ractor.main) && ORIGINS[self]) || klass.const_get(:ORIGIN)
        NativeResourceLeaseV1.drain(api)
        [klass, api]
      end
    end
    private_constant :Lease, :Slot, :OWNERS, :ORIGINS, :TYPES, :LIVE, :ABANDONED
  end
  private_constant :NativeResourceLeaseV1
end
