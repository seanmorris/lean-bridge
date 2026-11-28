# frozen_string_literal: true
require "lean_bridge/workshop"

class Box
  attr_accessor :level
  def initialize(n) = (@level = n)
  def read = level
  def identity = self
end
api = LeanBridge::Workshop
api.bind_hosts(box: Box) do
  raise "wrong host class" unless api.read(Box.new(41)) == 41
  raise "wrong startup environment" unless api.read_boot == "from-app"
  ENV["LEAN_BRIDGE_EFFECT_BOOT"] = "after-init"
  raise "startup ran again" unless api.read_boot == "from-app"
  path = "state"
  File.write(path, "open")
  raise "ordinary IO became async" unless api.observe(path) == 37
  task = api.worker(path)
  raise "wrong worker API" unless task.is_a?(api::Task) && task.await == 37
  stream = api.walk(path)
  raise "wrong stream API" unless stream.is_a?(api::PullStream)
  raise "first pull missed state" unless File.read(path) == "open" && stream.next == 37
  File.write(path, "changed")
  stream.each do |value|
    raise "next pull reused first result" unless value == 0 && File.read(path) == "changed"
    break
  end
  raise "break skipped finalizer" unless File.read(path) == "closed"
  File.write(path, "after-close")
  begin
    stream.next
    raise "closed stream yielded"
  rescue StopIteration
    stream.close
  end
  raise "finalizer ran again" unless File.read(path) == "after-close"
end
puts "Ruby startup, sync IO, worker, independent pulls and early-break close passed"
