# frozen_string_literal: true
require "lean_bridge/workshop"

App = LeanBridge::Workshop
class Box
  attr_accessor :hook
  attr_reader :reads
  def initialize(value) = (@value, @reads = value, 0)
  def read
    @reads += 1
    hook&.call
    @value
  end
end
def check(ok, message) = (raise message unless ok)
def refuses(kind)
  yield
rescue kind => error
  return error
else
  raise "expected #{kind}"
end
# Do not keep the returned ticket on the main fiber's stack.
def abandon_ticket = (App.reader(Box.new(9)); nil)

captured, other = Box.new(40), Box.new(1)
stale = stale_proc = nil
App.bind_hosts(box: Box) do
  fn = App.remember(captured)
  number = App.reader(captured)
  GC.compact
  check(fn.call(other).equal?(captured) && number.call(2) == 42, "original identity or scalar result")
  check([2, 3].map(&number) == [42, 43], "ordinary Ruby block conversion")
  original = ArgumentError.new("original member error")
  other.hook = -> { raise original }
  check(refuses(ArgumentError) { fn.call(other) }.equal?(original), "member exception replaced")
  other.hook = -> { check(number.call(3) == 43, "reentry") }
  check(fn.call(other).equal?(captured), "nested callable lost original")
  refused_calls = -> {
    refuses(RuntimeError) { number.call(2) }
    refuses(RuntimeError) { number.close }
    refuses(RuntimeError) { App.remember(other) }
  }
  n = other.reads
  Fiber.new(&refused_calls).resume
  Thread.new(&refused_calls).value
  check(!number.closed? && other.reads == n, "foreign owner entered Lean or closed ticket")
  refuses(TypeError) { number.call("2") }
  refuses(RangeError) { number.call(-1) }
  refuses(TypeError) { fn.call(Object.new) }
  [-> { fn.dup }, -> { fn.clone }, -> { Marshal.dump(fn) }, -> { App::LeanClosure.allocate }].each { |attempt| refuses(TypeError, &attempt) }
  other.hook = -> {
    fn.close
    check(fn.closed?, "self-close did not revoke")
    refuses(RuntimeError) { fn.call(other) }
    refuses(RuntimeError) { App.send(:__unbind) }
  }
  check(fn.call(other).equal?(captured), "self-close interrupted its own invocation")
  fn.close; number.close
  check(App.send(:__live).zero?, "closure leaked a host object after explicit close")
  abandon_ticket
  10.times do
    Thread.new { GC.start }.join
    App.read(captured)
    break if App.send(:__live).zero?
  end
  check(App.send(:__live).zero?, "owner did not sweep abandoned callable")
  if App.respond_to?(:echo_box)
    check(App.echo_box(captured).await.equal?(captured), "task neighbor lost identity")
    read_file = App.file_reader
    File.write("input", "first")
    check(read_file.call("input") == "first", "delayed filesystem read")
    File.write("input", "second")
    check(read_file.call("input") == "second", "cached old value")
    read_file.close
  end
  stale = App.reader(captured)
  stale_proc = stale.to_proc
  check(App.send(:__live) == 1, "binding did not retain the captured box")
end
check(stale.closed? && App.send(:__live).zero?, "binding exit leaked a captured box")
App.bind_hosts(box: Box) do
  refuses(RuntimeError) { stale.call(2) }
  refuses(RuntimeError) { stale_proc.call(2) }
  stale.close
  check(App.reader(other).call(2) == 3, "new binding unavailable")
end
check(App.send(:__live).zero?, "rebinding leaked owners")
puts "Ruby returned closures: identity, self-close, error identity, foreign fiber/thread, GC and rebind; live=0"
