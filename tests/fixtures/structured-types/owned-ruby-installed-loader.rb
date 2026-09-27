require "json"
require "stringio"
Process.setrlimit(Process::RLIMIT_CORE, 0)

# Consume the original gem first; native inspection never configures its loader.
4.times.map { Thread.new { require ARGV.fetch(0) } }.each(&:value)
output = StringIO.new
previous = $stdout
begin
  $stdout = output
  load "consumer.rb"
ensure
  $stdout = previous
end
consumer = JSON.parse(output.string)
api = LeanBridge.const_get(ARGV.fetch(1), false)
native = api.const_get(:Native, false)
runtime = native.instance_variable_get(:@runtime)
library = native.const_get(:LIBRARY, false)
read = Fiddle::Function.new(library["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID, need_gvl: true)
snapshot = -> {
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |value|
    read.call(value)
    value[0, 40].unpack("L<6Q<2")
  end
}
3.times { GC.start(full_mark: true, immediate_sweep: true) }
runtime.current_state.require_open
raise "Consumer leaked result slots" unless runtime.current_state.slots.empty?
before = snapshot.call
raise "Unexpected initialization or identity count: #{before}" unless before[2] == 1 && before[3] == 1 && before[5] == 1

dladdr = Fiddle::Function.new(Fiddle::Handle::DEFAULT["dladdr"], [Fiddle::TYPE_VOIDP, Fiddle::TYPE_VOIDP], Fiddle::TYPE_INT, need_gvl: true)
Fiddle::Pointer.malloc(32, Fiddle::RUBY_FREE) do |info|
  raise "GMP symbol has no library" if dladdr.call(library["__gmpz_init"], info).zero?
  path = Fiddle::Pointer.new(info[0, 8].unpack1("Q<")).to_s
  raise "GMP interposition: #{path}" unless File.basename(path) == "libgmp-lean-bridge.so.10"
end
registry = LeanBridge.const_get(:NativeCopiedRuntimeV1, false)
state = registry.const_get(:STATE, false)
raise "Loader did not share native handles" unless state[:libraries].length == 5
ready, release = Queue.new, Queue.new
locker = Thread.new { registry.const_get(:LOCK, false).synchronize { ready << true; release.pop } }
ready.pop
ticket = api.new_ticket(7, "fork")
begin
  child = fork do
    begin
      api.new_ticket(8, "child")
      exit! 91
    rescue api::LeanBridgeError => error
      exit!(error.status == 6 ? 0 : 92)
    end
  end
  Process.wait(child)
  raise "Fork bypassed affinity guard" unless $?.success?
ensure
  release << true
  locker.join
end
parent = api.new_ticket(9, "parent")
raise "Parent failed after fork" if parent.closed? || ticket.closed?
parent.close
ticket.close
runtime.current_state.close
final = snapshot.call
raise "Native identities leaked: #{final}" unless final[5].zero?
puts JSON.generate({ consumer: consumer, liveIdentities: final[5], runtimeInitializations: final[2], componentInitializations: final[3], privateGmp: true, forkBeforeLock: true, concurrentRequires: 4 })
