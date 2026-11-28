# frozen_string_literal: true
require_relative "scheduler"
require "fiddle"

def check(ok, message)
  raise message unless ok
end
def until_ready
  deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 12
  until yield
    raise "Lean worker never reached the expected phase" if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
    sleep 0.002
  end
end
def live_owners
  read = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |p| read.call(p); p[0, 24].unpack("L<6").last }
end
def descriptors = Dir.children("/proc/self/fd").length
def peer
  cursor = LeanBridge::RubySignals.constant(9)
  check(cursor.next == 9, "peer failed to deliver")
ensure
  cursor&.close
end
case ARGV.fetch(0)
when "peer-first"
  require "lean_bridge/ruby_signals"; peer; require "lean_bridge/ruby_pulse"
when "pulse-first"
  require "lean_bridge/ruby_pulse"; LeanBridge::RubyPulse.reset; require "lean_bridge/ruby_signals"; peer
else
  raise "expected package initialization order"
end
api = LeanBridge::RubyPulse
scheduler = ProbeScheduler.new
Fiber.set_scheduler(scheduler)
api.bytes("warm").await
until_ready { live_owners.zero? }; baseline = descriptors
[:interrupt, :close].each do |stop|
  api.reset
  closes, pulls = api.closes, api.pulls
  stream = api.series(false, true, "not delivered")
  interruption = StandardError.new("application stopped the reader")
  events = []
  reader = Fiber.schedule do
    begin
      stream.each { |item| events << [:item, item] }
      events << :completed
    rescue StandardError => error
      events << error
    ensure
      events << :settled
    end
  end
  until_ready { api.state == 1 }
  check(scheduler.waiting.key?(reader) && events.empty?, "reader was not parked")
  begin
    stream.next
    raise "overlapping demand advanced the stream"
  rescue api::Busy
    check(api.pulls == pulls + 1, "second demand reached Lean")
  end
  if stop == :interrupt
    reader.raise(interruption)
    check(events.first.equal?(interruption), "fiber lost the original interruption")
  else
    check(stream.close, "cursor did not close")
    scheduler.run
    check(events.first.is_a?(api::Cancelled), "closing did not wake the reader with cancellation")
  end
  check(events.length == 2 && events.last == :settled && !reader.alive?, "fiber settled incorrectly")
  check(api.closes == closes + 1 && api.state == 1, "Lean did not finalize before worker release")
  peer
  check(api.state == 1, "peer released the worker")
  begin
    stream.next
    raise "closed cursor returned an item"
  rescue StopIteration
    check(api.pulls == pulls + 1, "closed cursor asked Lean for another item")
  end
  api.release; until_ready { api.state == 3 && live_owners.zero? }
  scheduler.run
  check(events.length == 2 && !stream.close && api.closes == closes + 1, "late settlement or repeated finalization")
  check(scheduler.waiting.empty? && descriptors == baseline, "event descriptors did not return to baseline")
end
Fiber.set_scheduler(nil)
puts "parked Ruby fiber: original interruption, cursor cancellation, peer delivery, one finalizer, no late item or leaked owner"
