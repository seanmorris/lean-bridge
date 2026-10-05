# Unit-level converter checks. No native Lean execution is claimed by this probe.
require "json"
module CollectionSnapshots
  extend self
  API = LeanBridge::Collections
  Native = API.const_get(:Native, false)
  LAYOUT = JSON.parse(ARGV.fetch(0))
  def check(value); raise "snapshot assertion" unless value; end
  def convert(name, value, mutation = nil)
    scope = Native::Scope.new
    if mutation
      allocation = scope.method(:allocate)
      scope.define_singleton_method(:allocate) do |*args, **keywords|
        action = mutation; mutation = nil; action.call if action
        allocation.call(*args, **keywords)
      end
    end
    begin
      Native.public_send("from#{LAYOUT.fetch(name)}", Native.public_send("to#{LAYOUT.fetch(name)}", value, scope))
    ensure
      scope.close
      check(scope.instance_variable_get(:@buffers).empty?)
    end
  end
  text = +"abc"
  def text.bytesize; @calls = (@calls || 0) + 1; @calls == 1 ? 1 : 3; end
  def text.encoding; Encoding::BINARY; end
  def text.valid_encoding?; false; end
  def text.instance_of?(_); false; end
  check(convert("string", text) == "abc")
  check(convert("bytes", text).bytes == [97, 98, 99])
  check(convert("string", text, -> { text.replace("changed") }) == "abc")
  array = [1, 2]
  def array.length; 1; end
  def array.[](_); 9; end
  def array.instance_of?(_); false; end
  check(convert("array", array) == [1, 2])
  check(convert("array", array, -> { array.clear }) == [1, 2])
  record = API::Pair.new(first: 42, second: "stored")
  original = API::Pair.instance_method(:first)
  API::Pair.define_method(:first) { 99 }
  begin
    result = convert("record", record)
    check(result.instance_variable_get(:@first) == 42)
  ensure
    API::Pair.define_method(:first, original)
  end
  mutable = API::Pair.allocate
  mutable.instance_variable_set(:@first, 17); mutable.instance_variable_set(:@second, "pinned")
  result = convert("record", mutable, -> { mutable.instance_variable_set(:@first, 99) })
  check(result.first == 17)
  fake = Object.new
  def fake.instance_of?(_); true; end
  def fake.equal?(_); true; end
  rejected = 0
  %w[bytes string array record char bool unit].each do |name|
    failed = false
    begin
      if %w[char bool unit].include?(name)
        Native.public_send("to#{LAYOUT.fetch(name)}", fake)
      else
        convert(name, fake)
      end
    rescue TypeError
      failed = true
    end
    check(failed); rejected += 1
  end
  subclass = Class.new(String).new("abc")
  failed = false
  begin; convert("string", subclass); rescue TypeError; failed = true; end
  check(failed); rejected += 1
  a = API::Pair.new(first: 42, second: +"value")
  b = API::Pair.new(first: 42, second: +"value")
  check(a == b); check(a.eql?(b)); check(a.hash == b.hash)
  check({a => 7}.fetch(b) == 7)
  check(a.deconstruct_keys(nil) == {first: 42, second: "value"})
  puts JSON.generate(snapshots: 7, rejections: rejected, valueChecks: 5)
end
