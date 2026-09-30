/**
 * Ruby ownership leases over checked native sessions and result owners.
 *
 * @file
 */
import { ownedRubyAnchoredValues } from "./owned-borrows.mjs";

/**
 * Emit deterministic resource copies, borrowed frames and queued GC cleanup.
 * The caller nests this support inside its generated component namespace.
 *
 * @param prefix - Validated public C package identifier.
 * @param options - Explicit ownership capabilities.
 * @param options.transferredInputs - Observe the C consuming-input owner slots.
 * @param options.anchoredResults - Keep and validate whole result owners.
 */
export const ownedRubyRuntime = (prefix, { transferredInputs = false, anchoredResults = false } = {}) => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned Ruby prefix");
	return `require "fiddle"
raise LoadError, "Owned Lean values require MRI Ruby 3.3 on Linux x86-64" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.") && RUBY_PLATFORM.include?("x86_64-linux") && Fiddle::SIZEOF_VOIDP == 8 && [1].pack("I") == [1].pack("L<")
raise LoadError, "Owned Lean values require Ruby 1:1 threads; unset RUBY_MN_THREADS" unless ENV.fetch("RUBY_MN_THREADS", "0").to_i.zero?
module Owned
  class Error < RuntimeError
    attr_reader :status
    def initialize(status, message = nil)
      @status = status
      super(message || {1 => "Invalid argument", 2 => "Ownership limit exceeded",
             3 => "Native allocation failed", 4 => "Resource is closed",
             5 => "Resource belongs to another thread",
             6 => "Start a fresh interpreter after fork",
             7 => "Lean runtime is unavailable", 8 => "Invalid native call order",
             9 => "Malformed native result", 10 => "Host callback failed"}.fetch(status, "Unknown native status: #{status}"))
    end
  end
  def self.check(status)
    raise Error, status unless status.zero?
  end
  def self.checkpoint; end
  def self.atomic(&block)
    # Thread.kill/terminate are interrupts outside the Exception hierarchy.
    # Defer them too until every native call and ownership cleanup has returned.
    ::Thread.handle_interrupt(::Object => :never, &block)
  end
  def self.pointer
    checkpoint
    value = ::Fiddle::Pointer.malloc(8, ::Fiddle::RUBY_FREE)
    begin
      value[0, 8] = "\\0" * 8
    rescue Exception
      value.call_free
      raise
    end
    value
  end
  class Slot
    attr_reader :pointer
    attr_accessor :pending, :releasing
    def initialize
      @pointer = Owned.pointer
      @pending = @releasing = @released = false
    end
    def value
      @released ? 0 : @pointer[0, 8].unpack1("Q<")
    end
    def dispose
      return if @released
      @released = true
      @pointer.call_free
    end
  end
  class Lease
    attr_reader :state, :slot, :scope${anchoredResults ? ", :borrowed_result, :whole_result" : ""}${transferredInputs ? "\n    attr_accessor :input_move" : ""}
    def initialize(state, slot = nil, scope = nil${anchoredResults ? ", borrowed_result = false, whole_result = false" : ""})
      @state, @slot, @scope = state, slot, scope
${anchoredResults ? "      @borrowed_result, @whole_result = borrowed_result, whole_result\n" : ""}\
      @references = 0${transferredInputs ? "\n      @input_move = nil" : ""}
    end
    def closed?
      ${anchoredResults ? "closed = " : ""}@state.closed? || @state.exited? || ::Process.pid != @state.runtime.pid ||${transferredInputs ? "\n        (@input_move && @input_move.value.zero?) ||" : ""}
        (@scope ? !@scope.active : !@slot || @slot.pending || @slot.releasing || @slot.value.zero?)
${anchoredResults ? `      return true if closed
      if @slot
        status = @state.runtime.result_validate.call(@state.require_open, @slot.value)
        return true if status == 4
        Owned.check(status)
      end
      false
` : ""}\
    end
    def require_open
      @state.require_open
      raise Error, 4 if closed?
    end
    def acquire
      require_open
      @references += 1
    end
    def release(finalizing = false)
      return if @references.zero?
      @references -= 1
      @state.release(@slot, finalizing) if @references.zero? && @slot
    end
    def referenced?; @references > 0; end
${anchoredResults ? `    def owner(state)
      require_open
      raise Error, 1 unless @state.equal?(state) && @slot && !@scope
      @slot.value
    end
` : ""}\
  end
  class Guard
    attr_reader :lease, :handle
    def initialize(lease, handle${anchoredResults ? ", owning = !lease.whole_result" : ""})
      @lease, @handle = lease, handle
      @released = true
${anchoredResults ? "      @owning = owning\n" : ""}\
      lease.acquire${anchoredResults ? " if @owning" : ""}
      @released = false
    end
    def closed?; @released || @lease.closed?; end
    def released?; @released; end
    def close(finalizing = false)
      return if @released
      @released = true
      @handle = 0
      @lease.release(finalizing)${anchoredResults ? " if @owning" : ""}
    end
    def self.finalizer(guard)
      proc do
        begin
          # Ruby finalizers run in trap context. Mark only; never lock or enter C.
          guard.close(true)
        rescue Exception
          # Explicit close reports errors; GC must not interrupt unrelated work.
        end
      end
    end
  end
  class Owner
    attr_reader :slot, :lease
    def initialize(state)
      @state, @slot, @lease = state, nil, nil
      state.require_open
      slot = Slot.new
      begin
        Owned.checkpoint
        state.register(slot)
      rescue Exception
        slot.dispose
        raise
      end
      @slot = slot
    end
    def pointer
      raise Error, 4 unless @slot
      @slot.pointer
    end
    def adopt${anchoredResults ? "(borrowed_result = false, whole_result = false)" : ""}
      @state.require_open
      raise Error, 1 if !@slot || @slot.value.zero? || @lease
      Owned.checkpoint
      @lease = Lease.new(@state, @slot${anchoredResults ? ", nil, borrowed_result, whole_result" : ""})
    end
    def publish
      if @lease && @lease.referenced?
        @slot = @lease = nil
      else
        close
      end
    end
    def close
      slot, @slot, @lease = @slot, nil, nil
      @state.release(slot) if slot
    end
  end
  class Scope
    attr_accessor :active
    def initialize; @active = true; end
  end
  class BorrowFrame
    attr_reader :lease
    def initialize(state)
      state.require_open
      Owned.checkpoint
      @scope = Scope.new
      Owned.checkpoint
      @lease = Lease.new(state, nil, @scope)
    end
    def close; @scope.active = false; end
    def self.with(state)
      frame = new(state)
      begin
        yield frame
      ensure
        frame.close
      end
    end
  end
  class State
    attr_reader :runtime, :thread, :slots
    def initialize(runtime)
      runtime.ensure_process
      @runtime, @thread = runtime, ::Thread.current
      @slots = []
      @closed = @exited = @draining = false
      @session = Owned.pointer
      begin
        Owned.check(runtime.session_open.call(@session))
        raise Error, 9 if @session[0, 8].unpack1("Q<").zero?
      rescue Exception
        runtime.session_close.call(@session) unless @session[0, 8].unpack1("Q<").zero?
        @session.call_free
        raise
      end
    end
    def closed?; @closed; end
    def exited?; @exited; end
    def affinity(exiting = false)
      @runtime.ensure_process
      raise Error, 4 if @exited
      raise Error, 5 unless ::Thread.current.equal?(@thread)
      active = @thread.thread_variable_get(:lean_bridge_native_call_fiber_v1)
      raise Error, 8 if !exiting && active && !active[0].equal?(::Fiber.current)
    end
    def require_open
      affinity
      raise Error, 4 if @closed
      drain
      @session[0, 8].unpack1("Q<")
    end
    def register(slot); @slots << slot; end
    def release(slot, finalizing = false)
      # GVL-protected flag writes are safe in GC/trap context. No native calls,
      # synchronization, array mutation or inherited locks on this path.
      return if ::Process.pid != @runtime.pid || @exited
      slot.pending = true
      drain if !finalizing && ::Thread.current.equal?(@thread)
    end
    def drain(exiting = false)
      affinity(exiting)
      return if @draining
      @draining = true
      begin
        while (slot = @slots.find { |candidate| candidate.pending && !candidate.releasing })
          slot.releasing = true
          begin
            status = @runtime.result_release.call(slot.pointer)
          ensure
            slot.releasing = false
            if slot.value.zero?
              @slots.delete(slot)
              slot.dispose
            end
          end
          Owned.check(status)
          raise Error, 9 unless slot.value.zero?
        end
      ensure
        @draining = false
      end
    end
    def with_result
      Owned.atomic do
        require_open
        owner, active = nil, nil
        published = entered = false
        begin
          owner = Owner.new(self)
          active = @thread.thread_variable_get(:lean_bridge_native_call_fiber_v1)
          Owned.checkpoint
          @thread.thread_variable_set(:lean_bridge_native_call_fiber_v1, [::Fiber.current, active ? active[1] + 1 : 1])
          entered = true
          value = yield owner
          owner.publish
          published = true
          value
        ensure
          begin
            owner&.close unless published
          ensure
            @thread.thread_variable_set(:lean_bridge_native_call_fiber_v1, active) if entered
          end
        end
      end
    end
    def close(exiting = false)
      Owned.atomic do
        affinity(exiting)
        unless @closed
          Owned.check(@runtime.session_close.call(@session))
          @closed = true
          @session.call_free
        end
        @slots.each { |slot| slot.pending = true }
        drain(exiting)
      end
    end
    def retire
      return if @exited || ::Process.pid != @runtime.pid
      # A dead thread cannot resume its suspended Fibers. Their result scopes
      # may never run ensure, so retire every slot on the creating native thread.
      close(true)
      @exited = true
    end
  end
  class Runtime
    attr_reader :pid, :library, :session_open, :session_close, :result_release${anchoredResults ? ", :result_validate" : ""}
    def initialize(library, ensure_process = nil)
      @pid, @library, @loader_context = ::Process.pid, library, ensure_process
      ensure_process()
      @key = :"lean_bridge_owned_${prefix}_#{object_id}"
      @session_open = function("${prefix}_session_open")
      @session_close = function("${prefix}_session_close")
      @result_release = function("${prefix}_result_release")
${anchoredResults ? `      @result_validate = ::Fiddle::Function.new(library["${prefix}_result_validate"], [::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
` : ""}\
      @retire = ::Fiddle::Function.new(library["lean_bridge_native_runtime_retire"], [], ::Fiddle::TYPE_VOID, need_gvl: true)
      key = @key
      @trace = ::TracePoint.new(:thread_end) do
        begin
          ::Thread.current.thread_variable_get(key)&.retire
        rescue Exception
          # Thread-exit cleanup cannot replace the thread's original exception.
        end
      end
      @trace.enable
      at_exit do
        begin
          ::Thread.current.thread_variable_get(key)&.retire
        rescue Exception
          # Explicit close and compiled probes report cleanup failures.
        end
      end
    end
    def function(name)
      ::Fiddle::Function.new(@library[name], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_INT, need_gvl: true)
    end
    def ensure_process
      raise Error, 6 unless ::Process.pid == @pid
      raise RuntimeError, "Lean packages cannot be used from another Ractor" unless ::Ractor.current.equal?(::Ractor.main)
      @loader_context&.call
    end
    def retire
      ensure_process
      @retire.call
    end
    def current_state
      ensure_process
      state = ::Thread.current.thread_variable_get(@key)
      unless state
        Owned.atomic do
          Owned.checkpoint
          state = State.new(self)
          begin
            Owned.checkpoint
            ::Thread.current.thread_variable_set(@key, state)
          rescue Exception
            state.close
            raise
          end
        end
      end
      state.require_open
      state
    end
  end
  class Resource
    def initialize(*)
      raise TypeError, "Resources are returned by Lean functions"
    end
    def self.from_lease(lease, handle)
      Owned.atomic do
        lease.require_open
        raise Error, 1 unless handle.instance_of?(Integer) && handle > 0 && handle < (1 << 64)
        Owned.checkpoint
        value = allocate
        value.__send__(:install, lease, handle)
        value
      end
    end
    def install(lease, handle)
      @guard = nil
      Owned.checkpoint
      guard = Guard.new(lease, handle)
      begin
        Owned.checkpoint
        ::ObjectSpace.define_finalizer(self, Guard.finalizer(guard))
        @guard = guard
      rescue Exception
        guard.close
        raise
      end
    end
    private :install
    def dup
      Owned.atomic { super }
    end
    def clone(**options)
      Owned.atomic { super(**options) }
    end
    def initialize_copy(original)
      # Ruby copies registered finalizers too. Remove that inherited guard before
      # any operation that can fail, then create an independent wrapper guard.
      ::ObjectSpace.undefine_finalizer(self)
      @guard = nil
      Owned.atomic do
        guard = original.instance_variable_get(:@guard)
        raise Error, 4 unless guard && !guard.released?
        guard.lease.require_open
        install(guard.lease, guard.handle)
      end
    end
    def raw(state)
      guard = @guard
      raise Error, 4 unless guard && !guard.released?
      guard.lease.require_open
      raise Error, 1 unless guard.lease.state.equal?(state)
      guard.handle
    end
    def state
      raise Error, 4 unless @guard && !@guard.released?
      @guard.lease.state
    end
    private :raw, :state
    def closed?; !@guard || @guard.closed?; end
    def close
      Owned.atomic { @guard&.close }
      nil
    end
    def with
      raise Error, 4 unless @guard && !@guard.released?
      @guard.lease.require_open
      begin
        yield self
      ensure
        close
      end
    end
    def ==(other)
      return true if equal?(other)
      return false unless other.instance_of?(self.class) && !closed? && !other.closed?
      right = other.instance_variable_get(:@guard)
      @guard.handle == right.handle && @guard.lease.state.equal?(right.lease.state)
    end
    alias eql? ==
    def hash; raise TypeError, "Resource identity cannot be used as a Hash key"; end
    def marshal_dump; raise TypeError, "Lean resources cannot be serialized"; end
    def _dump(*); raise TypeError, "Lean resources cannot be serialized"; end
    def inspect; "#<#{self.class} #{closed? ? 'closed' : 'open'}>"; end
    alias to_s inspect
  end
${anchoredResults ? ownedRubyAnchoredValues : ""}\
end
`;
};
