# frozen_string_literal: true
# Installed-client test scheduler. Applications use their existing scheduler.
# Only io_wait is implemented: the generated package must not need polling,
# a timer, a hand-written adapter, or the optional multi-descriptor io_select.
class ProbeScheduler
  attr_reader :registrations, :waiting
  def initialize
    @waiting, @registrations = {}, 0
  end
  def fiber(&block) = Fiber.new(blocking: false, &block).tap(&:resume)
  def io_wait(io, events, timeout = nil)
    raise "unexpected wait" unless events & IO::READABLE != 0 && timeout.nil?
    f = Fiber.current
    @registrations += 1
    @waiting[f] = io
    Fiber.yield
    IO::READABLE
  ensure
    @waiting.delete(f)
  end
  def block(*) = raise("unexpected scheduler block")
  def unblock(*) = raise("unexpected scheduler unblock")
  def kernel_sleep(*) = raise("unexpected timer polling")
  def run
    until @waiting.empty?
      ready = IO.select(@waiting.values, nil, nil, 12)
      raise "fiber never woke" unless ready
      @waiting.to_a.each { |fiber, io| fiber.resume if ready[0].include?(io) && @waiting[fiber].equal?(io) }
    end
  end
  def close = run
end
