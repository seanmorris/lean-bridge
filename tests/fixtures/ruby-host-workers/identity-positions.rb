# frozen_string_literal: true
require "lean_bridge/workshop"
require "lean_bridge/workshop_peer"

A, B = LeanBridge::Workshop, LeanBridge::WorkshopPeer
class Leaf
  def read = 9
end
class Box
  attr_accessor :level
  def initialize = (@level = 42)
  def read = level
  def identity = self
end
def check(ok, message) = (raise message unless ok)

first, second = Box.new, Box.new
calls = 0
B.bind_hosts(box: Box, leaf: Leaf) do
  A.bind_hosts(box: Box, leaf: Leaf) do
    [first, second].each { |box| check(A.plain(box).equal?(box), "export replaced its argument") }
    [[first, second], [second, first]].each do |input, reply|
      task = A.relay(input) do |arg|
        calls += 1
        check(arg.equal?(input) && !arg.equal?(reply), "wrong callback argument")
        check(B.identity(arg).equal?(arg), "peer reentry replaced the argument")
        reply
      end
      observed = task.await
      check(observed.equal?(reply) && !observed.equal?(input), "callback result replaced by input")
      B.update(observed, observed.level + 1)
    end
    check(calls == 2 && [first.level, second.level] == [43, 43], "mutation or invocation count")
    begin
      A.relay(first) { Object.new }.await
      raise "accepted an unregistered callback reply"
    rescue TypeError
      check(A.plain(second).equal?(second), "bad reply damaged binding")
    end
  end
end
check(A.send(:__live).zero? && B.send(:__live).zero?, "host roots survived shutdown")
puts "Ruby worker: export argument/result, callback argument/distinct result, peer mutation, invalid reply, zero host roots"
