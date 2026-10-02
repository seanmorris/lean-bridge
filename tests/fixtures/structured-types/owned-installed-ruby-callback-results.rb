require "lean_bridge/owned_aggregates"
require "json"

module InstalledCallbackProbe
  API = LeanBridge::OwnedAggregates
  @checks = 0
  @failures = []
  class << self
    attr_reader :checks, :failures
    def check(value, label = nil)
      raise "Installed callback check #{@checks + 1} failed: #{label}" unless value
      @checks += 1
    end
    def rejected(kind, status = nil)
      begin
        yield
      rescue kind => error
        check(status.nil? || error.status == status)
        failures << error
        error
      else
        raise "Expected #{kind}"
      end
    end
    def dispose(value)
      if value.respond_to?(:close) && value.respond_to?(:retain)
        value.close
      elsif value.instance_of?(Array)
        value.each { |child| dispose(child) }
      end
    end
    def record(number)
      ticket = API.new_ticket(number, "callback\0🙂")
      raw = ticket.get
      API.copy_value(API::Bundle.new(primary: raw, spare: API::Some.new(raw),
        peers: [raw], history: [raw],
        payload: API::Payload.new(count: -(1 << 180), bytes: "\x00\x7f\x80\xff".b)))
    ensure
      ticket&.close
    end
    def original_owners
      [false, true].each do |captured|
        first, second = record(17), record(29)
        callback = API.make_record(first.get)
        view = callback.call(captured, second)
        child = callback.call(false, view)
        raw = child.get.primary.dup
        kept, copied = child.retain, API.copy_value(child.get)
        alias_owner = second.clone(freeze: true)
        expected = captured ? 17 : 29
        check(API.serial(view.get.primary) == expected)
        check(API.serial(child.get.primary) == expected)
        check(child.get.payload.count == -(1 << 180))
        check(child.get.payload.bytes == "\x00\x7f\x80\xff".b)
        rejected(TypeError) { callback.call(false, second.get) }
        rejected(TypeError) { callback.call(false, first.get.primary) }
        first.close
        callback.close
        second.close
        check(!view.closed? && !child.closed?, "original alias keeps descendants live")
        alias_owner.close
        check(view.closed? && child.closed? && raw.closed?, "callback argument controls expiration")
        rejected(API::LeanBridgeError, 4) { view.get }
        rejected(API::LeanBridgeError, 4) { API.serial(raw) }
        check(API.serial(kept.get.primary) == expected)
        check(API.serial(copied.get.primary) == expected)
        dispose([first, second, callback, view, child, raw, kept, copied, alias_owner])
      end
    end
    def independent_closures
      root = record(31)
      callback = API.make_record(root.get)
      leased = API.make_leased_record(root.get)
      retained = callback.retain
      argument = record(37)
      view = retained.call(true, argument)
      independent = leased.call(true, argument.get)
      root.close
      callback.close
      leased.close
      check(API.serial(view.get.primary) == 31)
      argument.close
      check(view.closed? && !independent.closed?)
      check(API.serial(independent.get.primary) == 31)
      dispose([root, callback, leased, retained, argument, view, independent])
    end
    def native_passback
      root, captured = record(41), record(43)
      callback = API.make_record_callback(captured.get)
      [callback, callback.get].each do |function|
        value = API.callback_record(root.get, function)
        check(API.serial(value.get.primary) == 43)
        value.close
      end
      tree = API.copy_value(API::Tree::Branch.new(children: []))
      recursive = API.make_tree_callback(tree.get)
      [recursive, recursive.get].each do |function|
        value = API.callback_recursive(tree.get, function)
        check(value.get.children == [])
        value.close
      end
      dispose([root, captured, callback, tree, recursive])
    end
    def recursive_owners
      root = API.copy_value(API::Tree::Branch.new(children: []))
      callback = API.make_recursive(root.get)
      chain = [root]
      bounded = false
      160.times do
        begin
          child = callback.call(false, chain[-1])
          check(child.get.children == [])
          chain << child
        rescue API::LeanBridgeError => error
          failures << error
          check(error.status == 2)
          bounded = true
          break
        end
      end
      check(bounded && chain.length >= 100, "bounded transitive ancestry")
      kept = chain[-1].retain
      chain[48].close
      check(!chain[47].closed? && chain[49].closed? && chain[-1].closed?)
      root.close
      check(chain.all?(&:closed?))
      rejected(API::LeanBridgeError, 4) { chain[-1].get }
      check(kept.get.children == [])
      dispose([chain, callback, kept])
    end
    def gc_view
      owner = API.copy_value(API::Tree::Branch.new(children: []))
      callback = API.make_recursive(owner.get)
      callback.call(false, owner)
    ensure
      callback&.close
    end
    def affinity
      collected = gc_view
      3.times { GC.start(full_mark: true, immediate_sweep: true) }
      check(collected.closed?, "GC expires a callback's selected owner")
      rejected(API::LeanBridgeError, 4) { collected.get }
      collected.close
      exited_threads = ObjectSpace::WeakMap.new
      exited = Thread.new {
        exited_threads[Thread.current] = true
        owner = API.copy_value(API::Tree::Branch.new(children: []))
        callback = API.make_recursive(owner.get)
        [owner, callback, callback.call(false, owner)]
      }.value
      check(exited.all?(&:closed?), "thread exit retires callback owners")
      rejected(API::LeanBridgeError, 4) { exited[-1].get }
      dispose(exited)
      3.times { GC.start(full_mark: true, immediate_sweep: true) }
      check(exited_threads.length.zero?, "closed owners do not retain exited creator threads")
      owner = record(47)
      callback = API.make_record(owner.get)
      view = callback.call(false, owner)
      Thread.new { rejected(API::LeanBridgeError, 5) { view.get } }.value
      child = Process.fork do
        begin
          view.get
          exit! 1
        rescue API::LeanBridgeError => error
          exit!(error.status == 6 ? 0 : 2)
        end
      end
      check(Process.wait2(child)[1].success?)
      check(API.serial(view.get.primary) == 47)
      dispose([owner, callback, view])
    end
    def host_replies
      owner = record(53)
      escaped = retained = nil
      result = API.callback_record(owner.get, ->(value) {
        escaped, retained = value.primary.dup, value.primary.retain
        value
      })
      check(escaped.closed? && API.serial(result.get.primary) == 53)
      rejected(API::LeanBridgeError, 4) { API.serial(escaped) }
      check(API.serial(retained) == 53)
      dispose([result, escaped, retained])
      [->(value) { value }, ->(_value) { owner }].each do |callback|
        [owner.get, owner].each do |recovery|
          result = API.callback_record(owner.get, API.with_recovery(callback, recovery))
          check(API.serial(result.get.primary) == 53)
          result.close
        end
      end
      failure = RuntimeError.new("installed callback sentinel")
      check(rejected(RuntimeError) { API.callback_record(owner.get, ->(_) { raise failure }) }.equal?(failure))
      rejected(TypeError) { API.callback_record(owner.get, ->(_) { 42 }) }
      expired = API.copy_value(API::Tree::Branch.new(children: []))
      expired.close
      rejected(API::LeanBridgeError, 4) { API.callback_recursive(API::Tree::Branch.new(children: []), ->(_) { expired }) }
      rejected(API::LeanBridgeError, 4) {
        API.callback_recursive(API::Tree::Branch.new(children: []), API.with_recovery(->(value) { value }, expired))
      }
      owner.close
    end
    def combined_transfers
      [:raw, :whole, :native].each do |reply|
        owner, captured = record(61), record(67)
        alias_owner = owner.dup
        callback = owner.make_record
        view = callback.call(false, owner)
        child = view.borrow_record
        kept = child.retain
        unary = API.make_record_callback(captured.get)
        rejected(API::LeanBridgeError, 1) { child.move_record(->(value) { value }) }
        check(!owner.closed? && !child.closed?, "borrowed transfer leaves the owner intact")
        selected = case reply
                   when :raw then ->(value) {
                     check([owner, alias_owner, view, child].all?(&:closed?), "handoff precedes callback reentry")
                     value
                   }
                   when :whole then ->(_) { captured }
                   else unary
                   end
        moved = owner.move_record(selected)
        check([owner, alias_owner, view, child].all?(&:closed?))
        check(API.serial(kept.get.primary) == 61)
        check(API.serial(moved.get.primary) == (reply == :raw ? 61 : 67))
        rejected(API::LeanBridgeError, 4) { child.get }
        dispose([owner, captured, alias_owner, callback, view, child, kept, unary, moved])
      end
      owner = record(71)
      failure = RuntimeError.new("installed consuming callback sentinel")
      error = rejected(RuntimeError) { owner.move_record(->(_) { raise failure }) }
      check(error.equal?(failure) && owner.closed?, "exception after handoff leaves the receiver consumed")
      owner.close
    end
  end

  scenarios = [:original_owners, :independent_closures, :native_passback, :recursive_owners, :affinity]
  scenarios << :host_replies if HOST_CALLBACKS
  scenarios << :combined_transfers if COMBINED
  scenarios.each { |operation| public_send(operation) }
  puts JSON.generate({checks: checks, ordinaryRequire: true, scenarios: scenarios})
end
