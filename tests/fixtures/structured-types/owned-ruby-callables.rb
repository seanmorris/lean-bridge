require_relative "probe"

module Probe
  class CallbackError < StandardError; end
  first = API.new_ticket(1, "first")
  second = API.new_ticket(2, "second")
  bundle = API::Bundle.new(primary: first, spare: API::Some.new(second), peers: [first, second], history: [second], payload: API::Payload.new(count: -3, bytes: "abc".b))
  escaped, retained, locals = [], [], []
  result = API.callback_record(bundle, ->(value) {
    escaped << value.primary << value.primary.dup
    retained << value.primary.retain
    local = API.new_ticket(91, "local")
    locals << local
    replace(value, primary: local, payload: API::Payload.new(count: 7, bytes: "reply".b))
  })
  check(escaped.all?(&:closed?))
  rejected(Owned::Error, 4) { API.serial(escaped[0]) }
  check(API.serial(retained[0]) == 1)
  check(API.serial(result.primary) == 91)
  check(result.payload == API::Payload.new(count: 7, bytes: "reply".b))
  dispose(result); dispose(retained); dispose(locals)
  equal_call(bundle) { API.callback_record(bundle, ->(value) { value }) }

  sentinel = CallbackError.new("original callback exception")
  fail_callback = ->(value) { escaped << value.primary; raise sentinel }
  check(rejected(CallbackError) { API.callback_record(bundle, fail_callback) }.equal?(sentinel))
  check(escaped[-1].closed?)
  equal_call(bundle) { API.echo_record(bundle) }
  nested = ->(value) {
    check(rejected(CallbackError) { API.callback_record(value, fail_callback) }.equal?(sentinel))
    value
  }
  equal_call(bundle) { API.callback_record(bundle, nested) }

  count = 0
  mutable = ->(value) { count += 1; replace(value, payload: API::Payload.new(count: count, bytes: "count".b)) }
  result = API.twice(bundle, mutable)
  check(result.payload.count == 2); dispose(result)
  dispatcher = API.dispatch(bundle)
  result = dispatcher.call(mutable)
  check(result.payload.count == 3); dispose(result)
  identity = API.identity_closure(API::UNIT)
  equal_call(bundle) { dispatcher.call(identity) }
  equal_call(bundle) { API.callback_record(bundle, identity) }
  kept = API.retain_callback(identity)
  identity.close
  equal_call(bundle) { kept.call(bundle) }
  expired = API.retain_callback(->(value) { value })
  rejected(Owned::Error, 10) { expired.call(bundle) }
  expired.close
  kept.close
  equal_call(bundle) { dispatcher.call(->(value) { dispatcher.close; value }) }
  rejected(Owned::Error, 4) { dispatcher.call(->(value) { value }) }

  rejected(TypeError) { API.factory(->(_unit) { first }) }
  rejected(TypeError) { API.factory(API.with_recovery(->(_unit) { first }, bundle)) }
  made = API.factory(API.with_recovery(->(unit) { check(unit.equal?(API::UNIT)); first }, first))
  check(API.serial(made) == 1)
  made.close
  check(rejected(CallbackError) { API.factory(API.with_recovery(->(_unit) { raise sentinel }, first)) }.equal?(sentinel))
  equal_call(bundle) { API.construct(first, ->(ticket) { replace(bundle, primary: ticket) }) }
  tree = API::Tree::Branch.new(children: [API::Tree::Leaf.new(ticket: first), API::Tree::Leaf.new(ticket: second)])
  equal_call(tree) { API.callback_recursive(tree, ->(value) { value }) }
  chooser = API.make_recursive(tree)
  empty = API::Tree::Branch.new(children: [])
  equal_call(tree) { chooser.call(true, empty) }
  equal_call(empty) { chooser.call(false, empty) }
  chooser.close

  # Inputs stay pinned until C returns even if the callback closes the original
  # owning Ruby wrapper. The returned view receives a distinct result lease.
  victim = API.new_ticket(93, "pinned")
  pinned = replace(bundle, primary: victim, spare: nil, peers: [], history: [])
  result = API.callback_record(pinned, ->(value) { victim.close; value })
  check(victim.closed?)
  check(API.serial(result.primary) == 93)
  dispose(result)

  [nil, 7].each { |bad| rejected(TypeError) { API.callback_record(bundle, bad) } }
  rejected(TypeError) { API.callback_record(bundle, ->(value) { value.primary }) }
  rejected(TypeError) { API.callback_record(bundle, ->(_value) { Fiber.new {} }) }
  def self.nonlocal_callback(value)
    API.callback_record(value, proc { |item| return item })
  end
  rejected(LocalJumpError) { nonlocal_callback(bundle) }
  rejected(LocalJumpError) { catch(:escape) { API.callback_record(bundle, proc { |item| throw :escape, item }) } }
  rejected(LocalJumpError) { API.callback_record(bundle, proc { |item| break item }) }
  Fiber.singleton_class.alias_method(:owned_probe_yield, :yield)
  [:yield, :owned_probe_yield].each do |method|
    suspended = Fiber.new { rejected(FiberError) { API.callback_record(bundle, ->(value) { escaped << value.primary; Fiber.public_send(method, :paused); value }) } }
    suspended.resume
    check(!suspended.alive?)
    check(escaped[-1].closed?)
  end
  rejected(FiberError) { API.callback_record(bundle, ->(value) { Fiber.new {}.resume; value }) }
  equal_call(bundle) { API.echo_record(bundle) }

  # These execute actual native callbacks, not just Ruby-only ownership blocks.
  collect
  baseline = counts
  workers = []
  [:raise, :kill, :fiber].each do |kind|
    entered, resume = Queue.new, Queue.new
    worker = Thread.new do
      Thread.current.report_on_exception = false
      begin
        ticket = API.new_ticket(71, "thread")
        local = API::Bundle.new(primary: ticket, spare: nil, peers: [], history: [], payload: API::Payload.new(count: 0, bytes: "".b))
        if kind == :fiber
          child = Fiber.new { rejected(FiberError) { API.callback_record(local, ->(value) { escaped << value.primary; Fiber.yield; value }) } }
          child.resume
          check(!child.alive?)
        else
          API.callback_record(local, ->(value) { escaped << value.primary; entered << true; resume.pop; value })
        end
        escaped << ticket
      rescue CallbackError => error
        check(error.message == "interrupt")
      end
    end
    unless kind == :fiber
      entered.pop
      kind == :raise ? worker.raise(CallbackError, "interrupt") : worker.kill
      resume << true
    end
    worker.value
    workers << worker
    check(escaped.all?(&:closed?))
    check(counts == baseline, "native callback #{kind} cleanup")
  end

  calls = 0
  rejected(Owned::Error, 2) { API.repeatedly(bundle, ->(value) { calls += 1; value }, 10000) }
  check(calls > 1 && calls < 10000)
  equal_call(bundle) { API.callback_record(bundle, ->(value) { value }) }
  faults = sweep { API.callback_record(bundle, ->(value) { value }) }
  check(escaped.all?(&:closed?))
  finish(faults.merge(boundedInvocations: calls))
end
