# encoding: UTF-8
require "json"
ARGV.each { |name| require "lean_bridge/#{name}" }
a, b = LeanBridge::RubyFeedback, LeanBridge::RubyRelay
result = a.during_start(->(s) { b.run(s) { |v| v + "!" }.await }, ->(s) { s + "?" }, "α\0").await
raise unless result == "α\0!!?!!"
owner = a::RetainedCallback.new { |s| s + "x" }
first, second = a.repeat_call("a", owner), b.run("b", owner)
raise unless first.cancel && second.await == "bxx" && !owner.closed?
owner.close
begin
  b.run("q", owner).await
  raise "closed callback was accepted"
rescue a::CallbackClosed
end
raise unless b.direct(41).await == 42
cursor = b.constant((1 << 4096) + 3)
raise unless cursor.next == (1 << 4096) + 3 && cursor.close && !cursor.close
raise unless b.checked(0, false).to_a == []
snapshot = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |p|
  snapshot.call(p)
  abi, _, runtime, components, attached, live = p[0, 24].unpack("L<6")
  raise unless [abi, runtime, components, attached, live] == [1, 1, 2, 2, 0]
  puts JSON.generate({order: ARGV, runtimeInitializations: runtime, componentInitializations: components, attached: attached, liveIdentities: live})
end
