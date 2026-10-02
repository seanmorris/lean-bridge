require_relative "probe"

module Probe
  HANDOFFS = native("owned_test_handoffs")
  class << self
    def sanitizer_finish
      return unless ENV["LEAN_BRIDGE_OWNED_SANITIZER_CHECK"] == "1"
      # All immediate-cleanup assertions have already run with exceptions held.
      # Drop the harness roots before MRI's full-shutdown leak check.
      failures.clear
      3.times { GC.start(full_mark: true, immediate_sweep: true) }
      raise "Leaked bridge owners before sanitizer checkpoint" unless counts == [0, 0]
      $stdout.flush
    end
    alias dispose_children dispose
    def dispose(value)
      value.instance_of?(API::Value) ? value.close : dispose_children(value)
    end
    def bundle(ticket)
      API::Bundle.new(primary: ticket, spare: API::Some.new(ticket), peers: [ticket], history: [ticket],
        payload: API::Payload.new(count: -(1 << 180), bytes: "\x00\x7f\x80\xff".b))
    end
    def record(number)
      ticket = API.new_ticket(number, "native\0🙂")
      API.copy_value(bundle(ticket.get))
    ensure
      ticket&.close
    end
    def gc_callback_borrow
      root = API.copy_value(API::Tree::Branch.new(children: []))
      closure = API.make_recursive(root.get)
      closure.call(false, root)
    ensure
      closure&.close
    end
    def nonlocal_callback(value)
      API.callback_record(value, proc { |item| return item })
    end
    def callback_close_races
      [:get, :retain, :dup, :clone].map do |operation|
        root = API.copy_value(API::Tree::Branch.new(children: []))
        closure = API.make_recursive(root.get)
        view = closure.call(false, root)
        sibling = view.dup
        lease = view.instance_variable_get(:@guard).lease
        require_open = lease.method(:require_open)
        pending = true
        result = nil
        lease.define_singleton_method(:require_open) do
          require_open.call
          if pending
            pending = false
            closer = Thread.new { view.close }
            raise "foreign close timed out" unless closer.join(10)
            closer.value
          end
        end
        begin
          result = view.public_send(operation)
          check(!pending && view.closed?, "callback view close must run")
          value = operation == :get ? result : result.get
          check(value.children == [], "foreign-close #{operation} preserves the captured payload")
        rescue NoMethodError, API::LeanBridgeError
          check(false, "foreign-close #{operation} lost the captured owner")
        ensure
          lease.singleton_class.remove_method(:require_open)
          dispose([result, root, closure, view, sibling])
        end
        operation.to_s
      end
    end
  end

  if ENV["LEAN_BRIDGE_OWNED_SANITIZER_CHECK"] == "1"
    native("owned_test_sanitizer_tls_touch", [], Fiddle::TYPE_VOID).call
  end
  case ENV["LEAN_BRIDGE_OWNED_SANITIZER_FAULT"]
  when "address"
    native("owned_test_sanitizer_fault", [Fiddle::TYPE_SIZE_T], Fiddle::TYPE_VOID).call(4)
    raise "AddressSanitizer did not detect the overflow"
  when "undefined"
    native("owned_test_undefined_fault", [Fiddle::TYPE_INT], Fiddle::TYPE_INT).call(40)
    raise "UndefinedBehaviorSanitizer did not detect the invalid shift"
  when "leak"
    native("owned_test_sanitizer_leak", [], Fiddle::TYPE_VOID).call
    state.close
    puts JSON.generate({leaked: true})
    sanitizer_finish
    exit
  when "tls-live", "tls-leak"
    native("owned_test_sanitizer_tls_hold", [], Fiddle::TYPE_VOID).call
    leaked = ENV["LEAN_BRIDGE_OWNED_SANITIZER_FAULT"] == "tls-leak"
    native("owned_test_sanitizer_tls_clear", [], Fiddle::TYPE_VOID).call if leaked
    state.close
    puts JSON.generate({tls: leaked ? "leak" : "live"})
    sanitizer_finish
    exit
  end
  if ENV["LEAN_BRIDGE_OWNED_COLD_ONLY"] == "1"
    state.close
    puts JSON.generate({cold: true})
    sanitizer_finish
    exit
  end

  def self.exercise
    state
    baseline = counts
    check(baseline == [1, 1])
    first, second = record(17), record(29)
    closure = API.make_record(first.get)
    view = closure.call(true, second)
    descendant = closure.get.call(false, view)
    raw = view.get.primary.dup
    kept, copied = descendant.retain, API.copy_value(descendant.get)
    alias_owner = second.dup
    check(API.serial(view.get.primary) == 17, "captured payload")
    check(API.serial(descendant.get.primary) == 17, "transitive callback anchor")
    rejected(TypeError) { closure.call(false, second.get) }
    rejected(TypeError) { closure.call(false, first.get.primary) }
    first.close
    closure.close
    second.close
    check(!view.closed? && !descendant.closed?, "original owner alias keeps callback borrow live")
    alias_owner.close
    check(view.closed? && descendant.closed? && raw.closed?, "selected callback owner controls expiration")
    rejected(API::LeanBridgeError, 4) { view.get }
    rejected(API::LeanBridgeError, 4) { API.serial(raw) }
    check(API.serial(kept.get.primary) == 17 && API.serial(copied.get.primary) == 17)
    dispose([first, second, closure, view, descendant, raw, kept, copied, alias_owner])
    check(counts == baseline, "record owners release")

    first, second = record(41), record(43)
    closure = API.make_record_callback(first.get)
    [closure, closure.get].each do |callable|
      result = API.callback_record(second.get, callable)
      check(API.serial(result.get.primary) == 41, "native closure round trip")
      result.close
    end
    dispose([first, second, closure])
    check(counts == baseline, "native closures release")

    empty = API.copy_value(API::Tree::Branch.new(children: []))
    closure = API.make_recursive(empty.get)
    view = closure.call(false, empty)
    descendant = closure.call(false, view)
    kept = descendant.retain
    check(view.get.children == [] && descendant.get.children == [])
    empty.close
    check(view.closed? && descendant.closed?, "empty recursive values still expire")
    rejected(API::LeanBridgeError, 4) { view.get }
    check(kept.get.children == [])
    dispose([empty, closure, view, descendant, kept])
    check(counts == baseline, "empty owners release")

    # A borrowed callback result must not keep its selected whole owner alive.
    gc_view = gc_callback_borrow
    collect
    check(gc_view.closed?, "GC expires callback-result owners")
    rejected(API::LeanBridgeError, 4) { gc_view.get }
    gc_view.close
    exited_threads = ObjectSpace::WeakMap.new
    exited = Thread.new {
      exited_threads[Thread.current] = true
      root = API.copy_value(API::Tree::Branch.new(children: []))
      closure = API.make_recursive(root.get)
      [root, closure, closure.call(false, root)]
    }.value
    check(exited.all?(&:closed?), "thread exit expires callback owners")
    rejected(API::LeanBridgeError, 4) { exited[-1].get }
    dispose(exited)
    collect
    check(exited_threads.length.zero?, "closed owners do not retain exited creator threads")
    root = API.copy_value(API::Tree::Branch.new(children: []))
    closure = API.make_recursive(root.get)
    chain = [root]
    bounded = false
    160.times do
      begin
        chain << closure.call(false, chain[-1])
      rescue API::LeanBridgeError => error
        failures << error
        check(error.status == 2)
        bounded = true
        break
      end
    end
    check(bounded && chain.length >= 100, "callback anchor ancestry stays bounded")
    kept = chain[-1].retain
    chain[48].close
    check(!chain[47].closed? && chain[49].closed? && chain[-1].closed?)
    root.close
    check(chain.all?(&:closed?) && kept.get.children == [])
    dispose([closure, chain, kept])
    foreign_close_schedules = callback_close_races
    root = record(47)
    closure = API.make_record(root.get)
    view = closure.call(false, root)
    Thread.new { rejected(API::LeanBridgeError, 5) { view.get } }.value
    child = Process.fork do
      begin
        view.get
        exit! 1
      rescue API::LeanBridgeError => error
        exit!(error.status == 6 ? 0 : 2)
      end
    end
    check(Process.wait2(child)[1].success?, "forked callback view is rejected")
    check(API.serial(view.get.primary) == 47)
    dispose([root, closure, view])
    check(counts == baseline, "affinity and ancestry release all owners")

    if HOST_CALLBACKS
      root = record(53)
      escaped = retained = nil
      result = API.callback_record(root.get, ->(value) {
        escaped = value.primary.dup
        retained = value.primary.retain
        check(API.serial(value.primary) == 53)
        value
      })
      check(API.serial(result.get.primary) == 53 && escaped.closed?)
      rejected(API::LeanBridgeError, 4) { API.serial(escaped) }
      check(API.serial(retained) == 53)
      dispose([result, escaped, retained])
      [->(value) { value }, ->(_value) { root }].each do |callback|
        [root.get, root].each do |recovery|
          result = API.callback_record(root.get, API.with_recovery(callback, recovery))
          check(API.serial(result.get.primary) == 53)
          result.close
        end
      end
      failure = RuntimeError.new("exact callback failure")
      observed = rejected(RuntimeError) { API.callback_record(root.get, ->(_value) { raise failure }) }
      check(observed.equal?(failure))
      expired = API.copy_value(API::Tree::Branch.new(children: []))
      expired.close
      rejected(API::LeanBridgeError, 4) {
        API.callback_recursive(API::Tree::Branch.new(children: []), ->(_value) { expired })
      }
      rejected(API::LeanBridgeError, 4) {
        API.callback_recursive(API::Tree::Branch.new(children: []), API.with_recovery(->(value) { value }, expired))
      }
      [-> { nonlocal_callback(root.get) },
       -> { catch(:escape) { API.callback_record(root.get, proc { |item| throw :escape, item }) } },
       -> { API.callback_record(root.get, proc { |item| break item }) }].each do |call|
        rejected(LocalJumpError) { call.call }
        check(API.serial(root.get.primary) == 53, "nonlocal exit preserves the caller")
      end
      rejected(FiberError) { API.callback_record(root.get, ->(value) { Fiber.new {}.resume; value }) }
      rejected(FiberError) { Fiber.new { API.callback_record(root.get, ->(value) { Fiber.yield; value }) }.resume }
      rejected(TypeError) { API.callback_record(root.get, ->(_value) { 42 }) }
      root.close
      check(counts == baseline, "host replies and retained exceptions release")

      interrupted = []
      [:raise, :kill].each do |kind|
        ready, release = Queue.new, Queue.new
        victim = Thread.new do
          Thread.current.report_on_exception = false
          owner = record(59)
          callback = API.make_record(owner.get)
          interrupted.push(owner, callback, callback.call(false, owner))
          begin
            result = API.callback_record(owner.get, ->(value) { ready << true; release.pop; value })
            result.close
          rescue RuntimeError => error
            failures << error
            check(error.message == "callback interruption")
          end
        end
        ready.pop
        kind == :raise ? victim.raise(RuntimeError, "callback interruption") : victim.kill
        release << true
        check(!!victim.join(10), "interrupted callback thread must exit")
        victim.value
        check(interrupted.all?(&:closed?), "thread retirement expires callback descendants")
        check(counts == baseline, "#{kind} cleans callback frames")
      end
      dispose(interrupted)
    end

    if COMBINED
      root = record(61)
      closure = root.make_record
      view = closure.call(false, root)
      child = view.borrow_record
      kept = child.retain
      observed = false
      moved = root.move_record(->(value) {
        observed = true
        check(root.closed? && view.closed? && child.closed?, "transfer expires callback borrows before reentry")
        check(API.serial(kept.get.primary) == 61)
        value
      })
      check(observed && API.serial(moved.get.primary) == 61)
      rejected(API::LeanBridgeError, 4) { child.get }
      dispose([root, closure, view, child, kept, moved])
      check(counts == baseline, "combined handoff releases")
    end

    root, captured = record(71), record(73)
    closure = API.make_record(captured.get)
    unary = API.make_record_callback(captured.get)
    tree = API.copy_value(API::Tree::Branch.new(children: []))
    recursive = API.make_recursive(tree.get)
    recursive_callback = API.make_tree_callback(tree.get)
    calls = {
      nativeRecord: -> { closure.call(true, root) },
      nativeArgument: -> { closure.call(false, root) },
      nativePassback: -> { API.callback_record(root.get, unary) },
      nativeRawPassback: -> { API.callback_record(root.get, unary.get) },
      recursive: -> { recursive.call(false, tree) },
      recursivePassback: -> { API.callback_recursive(tree.get, recursive_callback) }
    }
    if HOST_CALLBACKS
      calls.merge!(hostRaw: -> { API.callback_record(root.get, ->(value) { value }) },
        hostWhole: -> { API.callback_record(root.get, ->(_value) { captured }) },
        recoveryRaw: -> { API.callback_record(root.get, API.with_recovery(->(value) { value }, captured.get)) },
        recoveryWhole: -> { API.callback_record(root.get, API.with_recovery(->(_value) { captured }, captured)) },
        recursiveWhole: -> { API.callback_recursive(tree.get, ->(_value) { tree }) })
    end
    faults = calls.transform_values { |call| sweep { call.call } }
    dispose([root, captured, closure, unary, tree, recursive, recursive_callback])
    check(counts == baseline, "all callback allocation sweeps release immediately")
    transfers = []
    if COMBINED
      [:raw, :whole, :native].each do |reply|
        [:ruby, :native].each do |allocator|
          before_faults = after_faults = 0
          succeeded = false
          2048.times do |point|
            root, captured = record(79), record(83)
            closure = root.make_record
            view = closure.call(false, root)
            child = view.borrow_record
            alias_owner, kept = root.dup, child.retain
            unary = API.make_record_callback(captured.get)
            callback = case reply
                       when :raw then ->(value) { check(root.closed? && child.closed?); value }
                       when :whole then ->(_value) { captured }
                       else unary
                       end
            result = nil
            before = HANDOFFS.call
            begin
              if allocator == :ruby
                result = fail_ruby_after(point) { root.move_record(callback) }
              else
                NATIVE_FAIL.call(point)
                result = root.move_record(callback)
              end
              succeeded = true
            rescue AllocationFault, Owned::Error => error
              failures << error
              check(error.instance_of?(AllocationFault) || error.status == 3)
              HANDOFFS.call > before ? after_faults += 1 : before_faults += 1
            ensure
              NATIVE_FAIL.call(-1)
            end
            moved = HANDOFFS.call > before
            check([root, alias_owner, view, child].all? { |value| value.closed? == moved }, "#{reply}/#{allocator}/#{point}: handoff is atomic")
            check(API.serial(kept.get.primary) == 79)
            check(API.serial(result.get.primary) == (reply == :raw ? 79 : 83)) if result
            dispose([root, captured, closure, view, child, alias_owner, kept, unary, result])
            check(counts == baseline, "#{reply}/#{allocator}/#{point}: failure rollback retains no owners")
            break if succeeded
          end
          check(succeeded && before_faults > 0 && after_faults > 0)
          transfers << {reply: reply, allocator: allocator, before: before_faults, after: after_faults}
        end
      end
    end
    finish(hostCallbacks: HOST_CALLBACKS, combined: COMBINED, faults: faults,
      transfers: transfers, foreignCloseSchedules: foreign_close_schedules,
      boundedAncestry: true, garbageCollection: true, threadExit: true, forkRejection: true,
      nonlocalExits: HOST_CALLBACKS, asynchronousInterruptions: HOST_CALLBACKS ? 2 : 0,
      exitedThreadCollected: true)
  end
  exercise
  sanitizer_finish
end
