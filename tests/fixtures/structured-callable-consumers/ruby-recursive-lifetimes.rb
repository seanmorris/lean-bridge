require 'lean_bridge/structured'
require 'json'
require 'weakref'
API = LeanBridge::Structured
Native = API.const_get(:Native, false)
SNAPSHOT = Fiddle::Function.new(Native::LIBRARY['lean_bridge_native_snapshot_read'], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
PTHREAD = Fiddle::Function.new(Fiddle::Handle::DEFAULT['pthread_self'], [], Fiddle::TYPE_VOIDP, need_gvl: true)
def live
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |memory|
    SNAPSHOT.call(memory)
    memory[20, 4].unpack1('L<')
  end
end
def check(condition)
  raise 'closure lifetime invariant failed' unless condition
end
value = API::Tree::Branch.new(children: [API::Tree::Leaf.new(value: 1 << 256)])
API.call_recursive(value) { |item| item }
check(live == 0)
creator = Thread.new do
  closure = API.make_recursive(value)
  check(closure.call(true, value) == value)
  [closure, PTHREAD.call.to_i]
end
closure, creator_id = creator.value
check(live == 1)
recycled = 0
16.times do
  recycled += Thread.new do
    begin
      closure.call(true, value)
      raise 'closure outlived its creating thread lifetime'
    rescue API::LeanBridgeError => error
      check(error.message.include?('creating thread'))
    end
    API.make_recursive(value).with { |local| check(local.call(true, value) == value) }
    PTHREAD.call.to_i == creator_id ? 1 : 0
  end.value
end
check(live == 1)
closure.close
closure.close
check(live == 0)
held = Array.new(4096) { API.make_recursive(value) }
check(live == 4096)
begin
  API.make_recursive(value)
  raise 'closure capacity was not enforced'
rescue API::LeanBridgeError => error
  check(error.status == 3)
end
check(live == 4096)
check(held.last.call(true, value) == value)
held.first.close
check(live == 4095)
API.make_recursive(value).with do |replacement|
  check(live == 4096)
  check(replacement.call(true, value) == value)
end
check(live == 4095)
held.each(&:close)
check(live == 0)
fallback = API.make_recursive(value)
weak = WeakRef.new(fallback)
check(live == 1)
fallback = nil
5.times { GC.start; GC.compact }
check(!weak.weakref_alive? && live == 0)
check(API.call_recursive(value) { |item| item } == value)
puts JSON.generate(creator_exit_rejections: 16, recycled_thread_ids: recycled,
                   capacity: 4096, overflow_rejected: true, replacement_usable: true,
                   finalization_released: true, identities: live)
