# encoding: UTF-8
require "json"
ARGV.each { |name| require "lean_bridge/#{name}" }
pure, journal = LeanBridge::Orchard, LeanBridge::JournalRuby
value = -((1 << 4096) + 39)
labels = ["a\0λ", ""]
raise unless pure.integer(value) == value && pure.labels(labels) == labels
raise unless journal.bump(3) == 3 && journal.count == 3

# Test-only observation of the actual process broker after both public APIs ran.
read = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |out|
  read.call(out)
  abi, _, runtime, components, attached, live = out[0, 24].unpack("L<6")
  raise "unexpected shared broker" unless [abi, runtime, components, attached, live] == [1, 1, 2, 2, 0]
  puts JSON.generate({order: ARGV, runtimeInitializations: runtime, componentInitializations: components, attached: attached, liveIdentities: live})
end
