require "lean_bridge/owned_aggregates"
require "json"
Process.setrlimit(Process::RLIMIT_CORE, 0)

API = LeanBridge::OwnedAggregates
native = API.const_get(:Native)
runtime = native.instance_variable_get(:@runtime)
identities = Fiddle::Function.new(native.const_get(:LIBRARY)["owned_test_identities"], [], Fiddle::TYPE_SIZE_T, need_gvl: true)
where = Fiddle::Function.new(native.const_get(:LIBRARY)["owned_test_gmp_path"], [], Fiddle::TYPE_VOIDP, need_gvl: true)
checks = 0
check = ->(condition) { checks += 1; raise "Failed check #{checks}" unless condition }
check.call(File.basename(where.call.to_s) == "libgmp-lean-bridge.so.10")

ticket = API.new_ticket((1 << 250) + 3, "ruby\0🌱")
check.call(API.serial(ticket) == (1 << 250) + 3)
check.call(API.label(ticket) == "ruby\0🌱")
bundle = API::Bundle.new(primary: ticket, spare: nil, peers: [], history: [], payload: API::Payload.new(count: -(1 << 170), bytes: "\0\xff".b))
borrowed = nil
result = API.callback_record(bundle, ->(value) { borrowed = value.primary; value })
check.call(result == bundle)
check.call(borrowed.closed?)
check.call(!result.primary.closed?)
copy = result.primary.dup
result.primary.close
check.call(result.primary.closed?)
check.call(API.serial(copy) == (1 << 250) + 3)
copy.close

dispatcher = API.dispatch(bundle)
identity = API.identity_closure(API::UNIT)
result = dispatcher.call(identity)
check.call(result == bundle)
result.primary.close
identity.close
sentinel = RuntimeError.new("original")
begin
  dispatcher.call(->(_value) { raise sentinel })
  raise "Expected callback exception"
rescue RuntimeError => error
  check.call(error.equal?(sentinel))
end
result = dispatcher.call(->(value) { value })
check.call(result == bundle)
result.primary.close
dispatcher.close
check.call(dispatcher.closed?)

state = LeanBridge.const_get(:NativeCopiedRuntimeV1)
ready, release = Queue.new, Queue.new
locker = Thread.new { state.const_get(:LOCK).synchronize { ready << true; release.pop } }
ready.pop
begin
  child = fork do
    begin
      API.serial(ticket)
      exit! 91
    rescue API::LeanBridgeError => error
      exit!(error.status == 6 ? 0 : 92)
    end
  end
  Process.wait(child)
  check.call($?.success?)
ensure
  release << true
  locker.join
end
check.call(API.serial(ticket) == (1 << 250) + 3)
ticket.close
check.call(ticket.closed?)
runtime.current_state.close
check.call(identities.call.zero?)
check.call(state.const_get(:STATE)[:libraries].length == 4)
puts JSON.generate({ checks: checks, identities: identities.call, privateGmp: true, forkBeforeLock: true })
