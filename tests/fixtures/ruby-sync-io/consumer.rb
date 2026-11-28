# frozen_string_literal: true
require "lean_bridge/journal_ruby"
API = LeanBridge::JournalRuby
def check(value)
  raise "failed at #{caller(1, 1).first}" unless value
end
def rejects(type)
  begin
    yield
  rescue type => e
    return e
  end
  raise "expected #{type}"
end
# Test-only observer; the public caller never opens a library or sees an ABI.
def snapshot
  f = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |p|
    f.call(p); return p[0, 24].unpack("L<6")
  end
end
cold = snapshot
check(cold[0] == 1 && cold[3] == 0)
check(Thread.new { rejects(API::WrongContext) { API.bump(1) } }.value)
rejects(RangeError) { API.bump(-1) }
rejects(RangeError) { API.store("state", "x" * (16 * 1024 * 1024)) }
check(snapshot == cold)
check(API.count == 0 && API.bump(2) == 2 && API.bump(3) == 5)
warm = snapshot
check(warm[3] == 1 && warm[5] == cold[5])
check(API.read("state") == "open")
failure = rejects(API::IOError) { API.read("missing-file") }
check(failure.declaration == "Journal.read" && failure.message.include?("missing-file"))
check(API.store("state", "closed").equal?(API::UNIT))
wide = -((1 << 4096) + 39)
values = {unit: API::UNIT, bool: false, uint8: 255, int8: -128, uint16: 65535, int16: -32768,
  uint32: (1 << 32) - 1, int32: -(1 << 31), uint64: (1 << 64) - 1, int64: -(1 << 63),
  usize: (1 << 64) - 1, isize: -(1 << 63), float32: -1.5, float64: Float::INFINITY,
  char: "🦊", string: "a\0b", bytes: "\x00\xff\x80".b, nat: -wide, int: wide}
values.each { |type, value| check(API.public_send("rt_#{type}", value) == value) }
check(API.rt_float32(Float::NAN).nan? && 1.0 / API.rt_float64(-0.0) == -Float::INFINITY)
rejects(TypeError) { API.rt_bool(1) }; rejects(TypeError) { API.rt_unit(nil) }
rejects(RangeError) { API.rt_char("ab") }; rejects(EncodingError) { API.rt_string("\xff".b) }
rejects(RangeError) { API.rt_nat(-1) }; rejects(RangeError) { API.rt_uint64(1 << 64) }
expected = [API::Ok.new("a\0b"), API::Err.new(API::Ok.new(wide)), API::Err.new(API::Err.new(values[:bytes]))]
expected.each_with_index do |value, tag|
  args = [tag, wide, "a\0b", values[:bytes]]
  check(API.nested(false, *args) == value)
  err = rejects(API::DeclaredError) { API.nested(true, *args) }
  check(err.declaration == "RubyIO.nested" && err.payload == value)
end
# Inject a Ruby decoding exception after Lean has returned a real owned buffer.
# Observe the actual native disposer: exactly one owned slot is cleared.
clear = API.const_get(:Native, false).const_get(:CLEAR)
retired = []
clear.define_singleton_method(:call) do |out|
  before = out[24, 8].unpack1("Q<"); super(out).tap { retired << [before, out[0, 32]] }
end
fault = Class.new(StandardError)
API::Ok.define_singleton_method(:new) { |*| raise fault }
begin
  rejects(fault) { API.nested(false, 0, wide, "owned", "b") }
  rejects(fault) { API.nested(true, 0, wide, "owned", "b") }
ensure
  API::Ok.singleton_class.remove_method(:new)
end
check(retired == [[1, "\0" * 32], [1, "\0" * 32]])
check(API.read("state") == "closed" && API.echo(37) == 37)
child = fork { exit!(rejects(API::WrongContext) { API.count } ? 0 : 12) }
Process.wait(child); check($?.success? && API.count == 5 && snapshot[5] == warm[5])
# Test-only fault injection: an already retired runtime cannot execute or
# initialize again. A user-visible IO error above did not retire that runtime.
Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_runtime_retire"], [], Fiddle::TYPE_VOID).call
rejects(API::Unavailable) { API.count }
rejects(API::Unavailable) { API.store("state", "must not run") }
check(File.binread("state") == "closed" && snapshot[2] == warm[2] && snapshot[5] == warm[5])
puts "Ruby: 19 primitive round trips, direct IO/EIO, owned decode failure, context and cleanup passed"
