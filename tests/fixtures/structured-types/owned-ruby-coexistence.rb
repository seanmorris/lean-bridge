require "json"
Process.setrlimit(Process::RLIMIT_CORE, 0)
order, retire = ARGV
names = order == "copied-first" ? ["copied_peer", "owned_aggregates", "owned_peer"] : ["owned_aggregates", "owned_peer", "copied_peer"]
names.each { |name| require "lean_bridge/#{name}" }
A = LeanBridge::OwnedAggregates
B = LeanBridge::OwnedPeer
C = LeanBridge::CopiedPeer
registry = LeanBridge.const_get(:NativeCopiedRuntimeV1, false)
state = registry.const_get(:STATE, false)
raise "Expected three components" unless state[:components].length == 3
raise "Libraries were loaded more than once" unless state[:handles].length == 9 && state[:libraries].length == 9
raise "Runtime policy mismatch" unless state[:policy] == "linux-x64-deepbind-v1"
huge = (1 << 200) + 31
raise "Copied Nat uses another allocator" unless C.answer == huge
tree = C::Tree::Branch.new(children: [C::Tree::Tip.new(value: huge), C::Tree::Branch.new(children: [])])
raise "Copied recursive call failed" unless C.echo(tree) == tree
raise "Copied callback failed" unless C.apply(tree, ->(value) { value }) == tree
first = A.new_ticket(huge, "primary")
second = B.new_ticket(huge + 1, "peer")
raise "Owned packages lost values" unless A.serial(first) == huge && B.serial(second) == huge + 1
begin
  A.serial(second)
  raise "Cross-component resource was accepted"
rescue TypeError
end
bundle = A::Bundle.new(primary: first, spare: nil, peers: [], history: [], payload: A::Payload.new(count: -huge, bytes: "\0\xff".b))
returned = A.callback_record(bundle, ->(value) {
  raise "Copied call during owned callback failed" unless C.apply(tree, ->(node) { node }) == tree
  raise "Owned peer call during callback failed" unless B.serial(second) == huge + 1
  value
})
raise "Composed callbacks changed identity" unless returned == bundle
returned.primary.close
borrowed = first.dup
first.close
raise "Duplicate guard released native owner" unless A.serial(borrowed) == huge
threads = 4.times.map do |index|
  Thread.new do
    16.times do
      A.new_ticket(index, "thread").with { |value| raise "Thread value drift" unless A.serial(value) == index }
      raise "Thread copied callback failed" unless C.apply(tree, ->(value) { value }) == tree
    end
  end
end
threads.each(&:value)

native = A.const_get(:Native, false)
library = native.const_get(:LIBRARY, false)
read = Fiddle::Function.new(library["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID, need_gvl: true)
snapshot = -> {
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |value|
    read.call(value)
    value[0, 40].unpack("L<6Q<2")
  end
}
raise "Lean initialized more than once" unless snapshot.call[2] == 1 && snapshot.call[3] == 3
if retire == "owned"
  native.instance_variable_get(:@runtime).retire
elsif retire == "copied"
  C.const_get(:Native, false).const_get(:RETIRE, false).call
else
  raise "Unknown retirement source"
end
rejected = 0
[-> { A.serial(borrowed) }, -> { B.serial(second) }, -> { C.echo(tree) }].each do |action|
  begin
    action.call
    raise "Retired package remained callable"
  rescue A::LeanBridgeError, B::LeanBridgeError, C::LeanBridgeError
    rejected += 1
  end
end
raise "Copied result was invalidated" unless tree.children[0].value == huge
borrowed.close
second.close
[A, B].each { |api| api.const_get(:Native, false).instance_variable_get(:@runtime).current_state.close }
final = snapshot.call
raise "Retired resource identities leaked: #{final}" unless final[5].zero?
puts JSON.generate({ order: order, retiredBy: retire, rejectedCalls: rejected, liveIdentities: final[5], components: final[3], runtimeInitializations: final[2], libraries: state[:libraries].length, threadedCalls: 64 })
