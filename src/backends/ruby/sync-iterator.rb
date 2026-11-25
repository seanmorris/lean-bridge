# frozen_string_literal: true
module LeanBridge::GeneratedSyncComponent
  module ImmediatePullV1
    API = ::LeanBridge::GeneratedSyncComponent
    PID = ::Process.pid
    SLOTS = {}.compare_by_identity
    DONE = ::Object.new.freeze
    Slot = ::Struct.new(:h, :ops, :abandoned, :busy, :iterating)

    def self.context
      unless ::Ractor.current.equal?(::Ractor.main) && ::Thread.current.equal?(::Thread.main) && ::Process.pid == PID
        raise WrongContext, "A synchronous Lean iterator belongs to its original process and main thread"
      end
    end
    def self.atomic(&block) = ::Thread.handle_interrupt(::Exception => :never, &block)
    def self.finalizer(flag) = proc { flag[0] = true }
    def self.release(slot)
      return unless slot.h
      unless slot.h[0, 8].unpack1("Q<").zero?
        code = slot.ops[:close].call(slot.h)
        unless code == 0 || code == 6
          slot.abandoned[0] = true
          raise BoundaryError, "Cannot close Lean iterator (status #{code})"
        end
      end
      slot.h.call_free
      slot.h = nil
      SLOTS.delete(slot)
    end
    def self.drain
      context
      atomic { SLOTS.each_key { |s| release(s) if s.abandoned[0] } }
    end
    at_exit do
      if ::Process.pid == PID && ::Ractor.current.equal?(::Ractor.main) && ::Thread.current.equal?(::Thread.main)
        atomic { SLOTS.each_key { |s| release(s) } }
      end
    end
    def self.output(ops)
      frame = NativeSyncWireV1::Frame.new
      begin
        out = frame.bytes(32)
        tags = frame.bytes(ops[:depth])
        out[0, 32] = "\0" * 32
        begin
          yield frame, out, tags
        ensure
          ops[:clear].call(out)
        end
      ensure
        frame.close
      end
    end
    def self.decode(type, out, tags) = NativeSyncWireV1.decode(API, type, out[0, 32].unpack("Q<4"), tags, out)
    def self.failure(code, decl, type, out, tags)
      case code
      when 3 then raise DeclaredError.new(decl, decode(type, out, tags))
      when 4 then raise IOError.new(decl, decode("string", out, tags))
      when 5 then raise ::ArgumentError, "Invalid Lean argument"
      when 9 then raise WrongContext, "Wrong Lean iterator owner"
      when 10 then raise Unavailable, "Lean runtime unavailable"
      when 11 then raise ::NoMemoryError, "Lean allocation failed"
      when 12 then raise ::RangeError, "Lean copy budget exceeded"
      else raise BoundaryError, "Unexpected Lean iterator status #{code}"
      end
    end
    def self.open(ops, values)
      drain
      atomic do
        h = ::Fiddle::Pointer.malloc(16, ::Fiddle::RUBY_FREE)
        h[0, 16] = "\0" * 16
        s = Slot.new(h, ops, [false], false, false)
        begin
          SLOTS[s] = true
          output(ops) do |frame, out, tags|
            args = frame.bytes(24 * values.size)
            ops[:args].each_with_index do |type, i|
              args[24*i, 24] = NativeSyncWireV1.encode(type, values[i], frame, UNIT).pack("Q<3")
            end
            code = ops[:open].call(args, h, out, tags)
            failure(code, ops[:decl], ops[:error], out, tags) unless code.zero?
          end
          Cursor.__send__(:new, s)
        rescue ::Exception
          release(s)
          raise
        end
      end
    end
    def self.pull(s)
      drain
      return DONE unless s.h
      raise BoundaryError, "Cannot reenter an active Lean pull" if s.busy
      atomic do
        s.busy = true
        begin
          output(s.ops) do |_, out, tags|
            code = s.ops[:next].call(s.h, out, tags)
            if code == 2
              release(s)
              DONE
            elsif code.zero?
              decode(s.ops[:result], out, tags)
            else
              failure(code, s.ops[:step], s.ops[:terminal], out, tags)
            end
          end
        rescue ::Exception
          release(s)
          raise
        ensure
          s.busy = false
        end
      end
    end
  end
  class Cursor
    include ::Enumerable
    def initialize(slot)
      @slot = slot
      ::ObjectSpace.define_finalizer(self, ImmediatePullV1.finalizer(slot.abandoned))
    end
    private_class_method :new, :allocate
    def initialize_copy(*) = raise(::TypeError, "Lean cursors cannot be copied")
    private :initialize_copy
    def close
      ImmediatePullV1.context
      raise BoundaryError, "Cannot close an active Lean pull" if @slot.busy
      ImmediatePullV1.atomic { ImmediatePullV1.release(@slot) }
    end
    def next
      ImmediatePullV1.context
      raise BoundaryError, "Lean iterator already has an active each" if @slot.iterating
      value = ImmediatePullV1.pull(@slot)
      raise ::StopIteration if ImmediatePullV1::DONE.equal?(value)
      value
    end
    def each
      return enum_for(:each) unless block_given?
      ImmediatePullV1.context
      raise BoundaryError, "Lean iterator already has an active each" if @slot.iterating
      begin
        @slot.iterating = true
        while true
          value = ImmediatePullV1.pull(@slot)
          break if ImmediatePullV1::DONE.equal?(value)
          yield value
        end
        self
      ensure
        @slot.iterating = false
        close
      end
    end
  end
  private_constant :ImmediatePullV1
end
