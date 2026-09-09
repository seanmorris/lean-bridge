require "lean_bridge/alpha"

alpha = LeanBridge::Alpha
box = alpha::Box.new(42)
adder = nil
begin
  raise "Box identity" unless box.read == 42 && box.identity.equal?(box)
  puts "Box: #{box.read}"

  payload = alpha.round_trip(alpha::Payload.new(
    enabled: true, count: 41, label: "Lean λ", bytes: "\x00\xff".b, values: [0, 2**32 - 1]))
  raise "Payload" unless !payload.enabled && payload.count == 42 && payload.label == "Lean λ" &&
    payload.bytes.bytes == [0, 255] && payload.values == [0, 2**32 - 1]
  puts "Payload count: #{payload.count}"

  callback = alpha.with_callback(40) { |value| value + 2 }
  raise "Callback result" unless callback == 44
  puts "Callback: #{callback}"
  adder = alpha.make_adder(2)
  raise "Returned callable" unless adder.call(40) == 42
  puts "Callable: #{adder.call(40)}"

  begin
    alpha.with_callback(40) { raise ArgumentError, "callback marker" }
    raise "Callback failure was accepted"
  rescue ArgumentError => error
    raise unless error.message == "callback marker"
  end

  adder.close
  adder.close
  box.close
  box.close
  begin
    box.read
    raise "Closed Box was accepted"
  rescue alpha::DisposedResourceError
  end
  begin
    adder.call(40)
    raise "Closed callable was accepted"
  rescue alpha::DisposedResourceError
  end
  puts "Errors and cleanup: passed"
ensure
  adder&.close
  box.close
end
