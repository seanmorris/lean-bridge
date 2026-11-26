# Test applications use only the public gem. The read-only snapshot below
# independently counts the broker's identities, not the number of wrappers.
require "lean_bridge/tariff_quotes"
require "fiddle"
require "json"
API = LeanBridge::TariffQuotes
root = Gem.loaded_specs.fetch("tariff-quotes").full_gem_path
raise "wrong installed gem" unless File.realpath(root).start_with?(ENV.fetch("GEM_HOME") + "/")
libs = Dir[File.join(root, "lib/**/liblean_bridge_native.so")]
raise "expected one installed identity broker" unless libs.size == 1
broker = Fiddle.dlopen(libs.first)
snap = Fiddle::Function.new(broker["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
live = -> { Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |ptr| snap.call(ptr); ptr[20,4].unpack1("L<") } }
def check(value) = (raise("failed at #{caller(1,1).first}") unless value)
def refused
  yield
rescue API::LeanBridgeError => e
  e.status
else
  raise "expected a refused call"
end

# Warm the binding before measuring: a per-thread runtime reference may
# outlive an individual API call. Explicitly dispose every function result.
API.make_tariff(0).quote.close
baseline = live.call
src = API.make_tariff(40)
echoed = API.echo_tariff(API::Tariff.new(quote: src.quote))
unpacked = API.unpack_quote(echoed)
retained = unpacked.retain
repacked = API.pack_quote(retained)
keep = repacked.quote.retain
held = live.call
check(held > baseline)
[src.quote, echoed.quote, unpacked, retained, repacked.quote].each(&:close)
check(keep.call(3) == 43 && API.apply_tariff(API::Tariff.new(quote: keep), 2) == 42)

visits = 0
escaped = API.pack_quote(->(n) { visits += 1; n })
check(refused { escaped.quote.call(1) } == 10)
check(refused { API.apply_tariff(escaped, 1) } == 10)
check(visits.zero?)
escaped.quote.close

recovery = API.make_tariff(100).quote
stage_calls = 0
stage = API.with_recovery(->(n) { check(n == 40); stage_calls += 1; keep }, recovery)
check(API.staged_quote(stage, 40, 4) == 44 && stage_calls == 1)
err = RuntimeError.new("application rejected tariff")
bad = API.with_recovery(->(_n) {
  tmp = API.make_tariff(5).quote
  begin
    check(tmp.call(1) == 6)
    raise err
  ensure
    tmp.close
  end
}, recovery)
begin
  API.staged_quote(bad, 9, 3)
  raise "swallowed callback failure"
rescue RuntimeError => e
  raise unless e.equal?(err)
end
check(recovery.call(2) == 102 && keep.call(5) == 45)
recovery.close
keep.close
check(refused { API.echo_tariff(API::Tariff.new(quote: keep)) } == 4)
fresh = API.make_tariff(6).quote
check(fresh.call(36) == 42)
fresh.close
after = live.call
check(after == baseline)
fields = {}
if ENV["CHECK_TARIFF_INPUT"] == "1"
  require_relative "tariff-host-fields"
  fields[:hostInput] = verify_tariff_inputs(API, live)
end
puts JSON.generate({baseline: baseline, held: held, after: after, kept: 42,
  staged: 44, stageCalls: stage_calls, staleVisits: visits, recovered: 42, **fields})
