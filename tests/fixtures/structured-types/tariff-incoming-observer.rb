# Test-only; count identities in the native broker the public API really loaded.
require "fiddle"
require "json"
module DirectQuoteObserver
  def self.observe(client, runtime, library)
    read = Fiddle::Function.new(library["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
    count = -> {
      Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |p|
        read.call(p)
        raise "wrong broker" unless p[0,4].unpack1("L<") == 1
        p[20,4].unpack1("L<")
      }
    }
    raise "dirty broker" unless count.call.zero?
    state = runtime.current_state
    raise "missing session" unless count.call == 1
    load client
    counts = []
    DirectQuoteConsumer.checkpoint_cases(-> {
      counts << count.call
      raise "owned value escaped" unless counts.last == 1
    })
    state.close
    counts << count.call
    raise "leaked broker owners: #{counts}" unless counts == [1,1,1,1,1,1,0]
    puts JSON.generate(counts)
  end
end
