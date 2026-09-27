require_relative "runtime"
require "json"

module Probe
  Owned = TestBinding::Owned
  class AllocationFault < Exception; end
  class Ticket < Owned::Resource
    def retain; Probe.retain(self); end
  end

  @library = Fiddle.dlopen(ARGV.fetch(0))
  @loader_lock = Mutex.new
  @runtime = Owned::Runtime.new(@library, -> { @loader_lock.synchronize {} })
  @checks = 0
  class << self
    attr_reader :runtime, :loader_lock, :checks
    def function(name, args, result = Fiddle::TYPE_INT)
      Fiddle::Function.new(@library[name], args, result, need_gvl: true)
    end
    def check(value, label = nil)
      raise "Check #{@checks + 1} failed#{label ? ": #{label}" : ""}" unless value
      @checks += 1
    end
    def rejected(status)
      begin
        yield
      rescue Owned::Error => error
        check(error.status == status, "ownership status #{error.status}, expected #{status}")
      else
        raise "Expected ownership status #{status}"
      end
    end
    def ruby_rejected(kind)
      begin
        yield
      rescue kind
        check(true)
      else
        raise "Expected Ruby failure #{kind}"
      end
    end
    def with_pointer
      pointer = Owned.pointer
      begin
        yield pointer
      ensure
        pointer.call_free
      end
    end
    def new_ticket(state, serial)
      state.with_result do |owner|
        with_pointer do |output|
          Owned.check(NEW.call(state.require_open, serial, output, owner.pointer))
          Ticket.from_lease(owner.adopt, output[0, 8].unpack1("Q<"))
        end
      end
    end
    def retain(ticket)
      state = ticket.__send__(:state)
      raw = ticket.__send__(:raw, state)
      state.with_result do |owner|
        with_pointer do |output|
          Owned.check(RETAIN.call(state.require_open, raw, output, owner.pointer))
          Ticket.from_lease(owner.adopt, output[0, 8].unpack1("Q<"))
        end
      end
    end
    def serial(ticket, state = ticket.__send__(:state))
      raw = ticket.__send__(:raw, state)
      state.with_result do |owner|
        with_pointer do |output|
          Owned.check(SERIAL.call(state.require_open, raw, output, owner.pointer))
          output[0, 8].unpack1("Q<")
        end
      end
    end
    def counts; [LIVE.call, IDENTITIES.call]; end
    def fail_ruby_after(point)
      remaining = point
      Owned.define_singleton_method(:checkpoint) do
        raise AllocationFault, "injected Ruby ownership allocation failure" if remaining.zero?
        remaining -= 1
      end
      begin
        yield
      ensure
        Owned.define_singleton_method(:checkpoint) {}
      end
    end
    def collect
      3.times { GC.start(full_mark: true, immediate_sweep: true) }
    end
    def garbage(state)
      ticket = new_ticket(state, 100)
      check(serial(ticket) == 100)
      nil
    end
    def pop_garbage(values)
      values.pop
      nil
    end
    def aborted_result(state, escaped)
      state.with_result do |owner|
        with_pointer do |output|
          Owned.check(NEW.call(state.require_open, 123, output, owner.pointer))
          escaped << Ticket.from_lease(owner.adopt, output[0, 8].unpack1("Q<"))
          yield
        end
      end
    end
    def returning_result(state, escaped)
      aborted_result(state, escaped) { return :returned }
    end
  end
  pointer = Fiddle::TYPE_VOIDP
  NEW = function("owned_test_new", [pointer, Fiddle::TYPE_LONG_LONG, pointer, pointer])
  RETAIN = function("owned_test_retain", [pointer, pointer, pointer, pointer])
  SERIAL = function("owned_test_serial", [pointer, pointer, pointer, pointer])
  LIVE = function("owned_test_live", [], Fiddle::TYPE_SIZE_T)
  IDENTITIES = function("owned_test_identities", [], Fiddle::TYPE_SIZE_T)
  NATIVE_FAIL = function("owned_test_fail_after", [Fiddle::TYPE_SSIZE_T], Fiddle::TYPE_VOID)

  Owned.check(0)
  [*(1..10), 99].each { |status| rejected(status) { Owned.check(status) } }
  detailed = Owned::Error.new(9, "Invalid native variant tag")
  check(detailed.status == 9 && detailed.message == "Invalid native variant tag")
  state = runtime.current_state
  check(runtime.current_state.equal?(state))
  first = new_ticket(state, 41)
  shared = first.dup
  frozen_copy = first.freeze.clone
  check(frozen_copy.frozen?)
  retained = first.retain
  check(shared == first && retained == first && frozen_copy == first)
  ruby_rejected(TypeError) { Ticket.new }
  ruby_rejected(TypeError) { Marshal.dump(first) }
  ruby_rejected(TypeError) { {first => 1} }
  check(first.inspect == "#<Probe::Ticket open>")
  first.close
  first.close
  check(first.closed?)
  rejected(4) { serial(first) }
  rejected(4) { first.dup }
  check(serial(shared) == 41)
  shared.close
  check(serial(frozen_copy) == 41)
  frozen_copy.close
  check(serial(retained) == 41)

  other = Owned::State.new(runtime)
  rejected(1) { retained.__send__(:raw, other) }
  other.close
  other.close

  borrowed = escaped = kept = nil
  Owned::BorrowFrame.with(state) do |frame|
    borrowed = Ticket.from_lease(frame.lease, retained.__send__(:raw, state))
    escaped = borrowed.clone
    kept = borrowed.retain
    check(serial(borrowed) == 41)
  end
  check(borrowed.closed? && escaped.closed?)
  rejected(4) { serial(escaped) }
  rejected(4) { borrowed.dup }
  check(serial(kept) == 41)

  original = RuntimeError.new("original exception")
  unwound = temporary = nil
  begin
    Owned::BorrowFrame.with(state) do |frame|
      unwound = Ticket.from_lease(frame.lease, kept.__send__(:raw, state))
      new_ticket(state, 99).with do |item|
        temporary = item
        check(serial(item) == 99)
        raise original
      end
    end
  rescue RuntimeError => error
    check(error.equal?(original))
  end
  check(unwound.closed? && temporary.closed?)
  check(serial(kept) == 41)

  Thread.new do
    rejected(5) { serial(kept) }
    rejected(5) { kept.dup }
    rejected(5) { state.close }
  end.value
  collect
  check(serial(kept) == 41, "failed foreign dup must not release the original")
  Warning[:experimental] = false
  ractor_error = Ractor.new do
    begin
      Owned::Runtime.new(nil)
    rescue RuntimeError => ractor_failure
      ractor_failure.message
    end
  end.take
  check(ractor_error == "Lean packages cannot be used from another Ractor")

  baseline = counts
  garbage(state)
  collect
  check(counts != baseline, "GC only queues owning-thread release")
  state.require_open
  check(counts == baseline)
  foreign = [new_ticket(state, 78)]
  held = counts
  Thread.new { pop_garbage(foreign); collect }.value
  check(counts == held, "foreign GC never calls C")
  state.require_open
  check(counts == baseline)

  # Retain the Thread objects and escaped wrappers, so GC cannot hide a missing
  # thread-exit cleanup hook or allow recycled thread IDs to revive resources.
  escaped_threads = []
  workers = 16.times.map do |value|
    Thread.new do
      local = runtime.current_state
      ticket = new_ticket(local, value)
      check(serial(ticket) == value)
      escaped_threads << ticket
    end.tap(&:join)
  end
  check(workers.none?(&:alive?))
  check(escaped_threads.all?(&:closed?))
  check(counts == baseline, "thread exit deterministically releases escaped results")
  escaped_threads.each { |ticket| rejected(4) { serial(ticket) }; ticket.close }

  # PID validation must run before the verified loader's inherited lock.
  ready, release = Queue.new, Queue.new
  locker = Thread.new { loader_lock.synchronize { ready << true; release.pop } }
  ready.pop
  child = fork do
    Signal.trap("ALRM") { Process.exit!(70) }
    Fiddle::Function.new(Fiddle::Handle::DEFAULT["alarm"], [Fiddle::TYPE_INT], Fiddle::TYPE_INT).call(5)
    begin
      rejected(6) { serial(kept) }
      rejected(6) { kept.dup }
      rejected(6) { runtime.current_state }
      rejected(6) { state.close }
      check(kept.closed?)
      kept.close
      retained.close
      Process.exit!(0)
    rescue Exception
      Process.exit!(1)
    end
  end
  release << true
  locker.value
  Process.waitpid(child)
  check($?.success?, "post-fork rejection avoids inherited loader lock")
  check(serial(kept) == 41)

  # A suspended call belongs to its Fiber even when another Fiber shares the
  # same native thread. Resume it before entering C again.
  fiber = Fiber.new { state.with_result { Fiber.yield :suspended; :finished } }
  check(fiber.resume == :suspended)
  rejected(8) { new_ticket(state, 1) }
  rejected(8) { serial(kept) }
  check(fiber.resume == :finished)
  check(serial(kept) == 41)

  # Exiting a thread must revoke owners even when an abandoned Fiber never runs
  # its ensure clauses. Preserve the Fiber as well as the result and Thread.
  abandoned = []
  workers << Thread.new do
    local = runtime.current_state
    abandoned << Fiber.new { aborted_result(local, escaped_threads) { Fiber.yield } }
    abandoned.last.resume
  end.tap(&:join)
  check(escaped_threads.all?(&:closed?))
  check(counts == baseline, "thread exit revokes suspended Fiber results")

  128.times do |value|
    item = new_ticket(state, value)
    copy = item.dup
    item.close
    check(serial(copy) == value)
    copy.close
    check(copy.closed?)
  end
  kept.close
  retained.close
  baseline = counts
  check(baseline == [1, 1])

  # Failed output conversion invalidates even escaped wrappers immediately.
  # Ruby nonlocal exits through an ordinary result scope must also unwind.
  partials, failures = [], []
  begin
    aborted_result(state, partials) { raise original }
  rescue RuntimeError => error
    failures << error
    check(error.equal?(original))
  end
  check(partials.all?(&:closed?))
  check(counts == baseline)
  check(returning_result(state, partials) == :returned)
  check(catch(:escape) { aborted_result(state, partials) { throw :escape, :thrown } } == :thrown)
  check(state.with_result { break :broken } == :broken)
  check(partials.all?(&:closed?))
  check(counts == baseline)

  native_failures = 0
  128.times do |point|
    NATIVE_FAIL.call(point)
    begin
      result = new_ticket(state, 77)
    rescue Owned::Error => error
      check(error.status == 3)
      native_failures += 1
    else
      result.close
      break
    ensure
      NATIVE_FAIL.call(-1)
    end
    check(counts == baseline)
  end
  check(native_failures > 0 && native_failures < 128)

  ruby_failures = 0
  128.times do |point|
    begin
      result = fail_ruby_after(point) { new_ticket(state, 55) }
    rescue AllocationFault => error
      failures << error
      ruby_failures += 1
      check(counts == baseline, "host allocation rollback #{point}")
    else
      result.close
      break
    end
    collect
    state.require_open
    check(counts == baseline)
  end
  check(ruby_failures > 0 && ruby_failures < 128)

  copy_failures = 0
  original_copy = new_ticket(state, 68)
  original_counts = counts
  128.times do |point|
    begin
      result = fail_ruby_after(point) { original_copy.dup }
    rescue AllocationFault => error
      failures << error
      copy_failures += 1
    else
      result.close
      break
    end
    collect
    state.require_open
    check(serial(original_copy) == 68, "failed copy preserves original #{point}")
    check(counts == original_counts)
  end
  check(copy_failures > 0 && copy_failures < 128)
  original_copy.close
  check(counts == baseline)

  session_failures = 0
  16.times do |point|
    outcome = Thread.new do
      begin
        fail_ruby_after(point) { runtime.current_state }
      rescue AllocationFault => error
        failures << error
        :failed
      else
        :created
      end
    end.value
    check(counts == baseline, "session allocation rollback #{point}")
    break if outcome == :created
    session_failures += 1
  end
  check(session_failures > 0 && session_failures < 16)

  # Interrupts arriving during publication must not leak an owner. Keep both
  # escaped wrappers and the terminated Thread objects alive during the check.
  [:raise, :kill].each do |kind|
    entered, resume = Queue.new, Queue.new
    victim = Thread.new do
      Thread.current.report_on_exception = false
      begin
        local = runtime.current_state
        aborted_result(local, partials) { entered << true; resume.pop }
      rescue RuntimeError => error
        check(error.message == "interrupt")
      end
    end
    entered.pop
    kind == :raise ? victim.raise(RuntimeError, "interrupt") : victim.kill
    resume << true
    victim.join
    workers << victim
    check(partials.all?(&:closed?))
    check(counts == baseline, "#{kind} releases native results")
  end

  last = new_ticket(state, 88)
  state.close
  state.close
  check(last.closed?)
  rejected(4) { serial(last) }
  rejected(4) { runtime.current_state }
  last.close
  collect
  check(counts == [0, 0])
  puts JSON.generate({ruby: RUBY_DESCRIPTION, checks: checks, rubyFailures: ruby_failures,
                      copyFailures: copy_failures, sessionFailures: session_failures, nativeFailures: native_failures,
                      live: LIVE.call, identities: IDENTITIES.call})
end
