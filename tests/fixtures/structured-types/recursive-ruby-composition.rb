# frozen_string_literal: true
require "json"
order, mode, indices = ARGV
indices = JSON.parse(indices)
if order == "acyclic-first"
  require "lean_bridge/recursive_peer"
  raise "Peer did not initialize" unless LeanBridge::RecursivePeer.answer == 42
end
require "lean_bridge/recursive"
require "lean_bridge/recursive_peer"
M = LeanBridge::Recursive
P = LeanBridge::RecursivePeer
S = LeanBridge.const_get(:NativeCopiedRuntimeV1, false)
N = M.const_get(:Native, false)
raise "Initial calls failed" unless M.empty.children == [] && P.answer == 42
entered, release = Queue.new, Queue.new
locker = Thread.new { S::LOCK.synchronize { entered << true; release.pop } }
entered.pop
begin
  child = Process.fork do
    Thread.new { sleep 4; Process.exit!(91) }
    rejected = 0
    [-> { M.empty }, -> { P.answer }].each do |call|
      begin
        call.call
      rescue M::LeanBridgeError, P::LeanBridgeError => error
        rejected += 1 if error.message.include?("after fork")
      end
    end
    begin
      require "lean_bridge/graph_names"
    rescue LoadError => error
      rejected += 1 if error.message.include?("after fork")
    end
    Process.exit!(rejected == 3 ? 0 : 92)
  end
  raise "Post-fork call/import rejection failed" unless Process.waitpid2(child).last.exitstatus == 0
ensure
  release << true
  locker.value
end
require "lean_bridge/graph_names"
G = LeanBridge::GraphNames
names = G::GraphInvalidNative.new(payload: G::GraphScope::Next.new(value: G::GraphScope::Leaf.new(value: 7)))
raise "Public/private type collision" unless G.echo(names) == names && G.next(names.payload) == names.payload
raise "Packages did not share runtime state" unless S::STATE[:components].length == 3 && S::STATE[:handles].length == 8

# Ruby emits an experimental-feature warning on the first Ractor creation.
# This probe checks the supported main-Ractor guard, not that warning.
Warning[:experimental] = false
ractor_error = Ractor.new do
  begin
    LeanBridge::Recursive.empty
    "unexpected success"
  rescue LeanBridge::Recursive::LeanBridgeError => error
    error.message
  end
end.take
raise "Ractor call reached native code" unless ractor_error.include?("Ractor")
retained = M.grow(M::Spine::Leaf.new(value: 9))
clears = 0
N::CLEAR.define_singleton_method(:call) do |output|
  clears += 1 if output[0, 8].unpack1("Q<") != 0
  super(output)
end
if mode == "raw"
  N.const_get("CALL#{indices.fetch('grow')}").define_singleton_method(:call) do |input, output|
    status = super(input, output)
    raise "Retirement probe requires an owned native result" if output[0, 8].unpack1("Q<") == 0
    output[16, 4] = [2**32 - 1].pack("L<")
    status
  end
elsif mode == "during"
  N::READY.define_singleton_method(:call) do
    N::RETIRE.call
    super()
  end
else
  raise "Unknown retirement probe"
end
begin
  M.grow(M::Spine::Leaf.new(value: 9))
  raise "Retired result escaped"
rescue M::LeanBridgeError => error
  raise "Unexpected retirement status" unless error.status == (mode == "raw" ? 4 : 5)
end
raise "Owned result was not cleared exactly once" unless clears == 1
raise "Copied value lost ownership" unless retained.value.value == 9
[-> { M.empty }, -> { P.answer }, -> { G.echo(names) }].each do |call|
  begin
    call.call
    raise "Retired package remained available"
  rescue M::LeanBridgeError, P::LeanBridgeError, G::LeanBridgeError
  end
end
raise "Failed calls acquired new native results" unless clears == 1
puts JSON.generate({order: order, mode: mode, components: 3, handles: 8, forkRejection: true,
  forkWithLockHeld: true, ractorRejection: true, crossPackageRetirement: true,
  retainedValuesUsable: true, retirementClears: clears, publicNameCollisions: ["GraphScope", "GraphInvalidNative", "next"]})
