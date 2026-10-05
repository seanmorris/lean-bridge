# frozen_string_literal: true
# Re-run the public contract before test-only reflection into the private module.
require_relative "public"
N = M.const_get(:Native, false)
indices = JSON.parse(ARGV.fetch(0))
before = $checks
buffers = []
attempts = 0
fail_at = nil
failure = NoMemoryError
phase = :input
owned = 0
cleared = 0
pause_phase = nil
entered, resume = Queue.new, Queue.new
N.define_singleton_method(:graph_checkpoint) do
  attempts += 1
  if phase == pause_phase
    pause_phase = nil
    entered << true
    resume.pop
  end
  raise failure, "Injected installed conversion failure" if attempts == fail_at
end
N::GraphScope.prepend(Module.new do
  define_method(:allocate) do |size|
    pointer = super(size)
    buffers << pointer if pointer
    pointer
  end
end)
N.const_get("CALL#{indices.fetch('envelope')}").define_singleton_method(:call) do |*args|
  status = super(*args)
  phase = :output
  owned += 1 if args.last[0, 8].unpack1("Q<") != 0
  status
end
N::CLEAR.define_singleton_method(:call) do |output|
  cleared += 1 if output[0, 8].unpack1("Q<") != 0
  super(output)
  check(output[0, 16] == "\0" * 16)
end
clean = lambda do
  check(buffers.all?(&:freed?))
  buffers.clear
  check(owned == cleared)
  check(N::READY.call == 1)
end
tree = M::Tree::Branch.new(children: [M::Tree::Leaf.new(payload: payload), M::Tree::Branch.new(children: [])])
value = M::Envelope.new(tree: tree, alternatives: [[], [tree]], fallback: M::Some.new(tree),
  outcome: M::Ok.new([tree, tree]), marker: M::Some.new(M::Some.new(M::UNIT)))
check(M.envelope(value) == value)
checkpoints = attempts
clean.call
input_failures = 0
output_failures = 0
(1..checkpoints).each do |point|
  [NoMemoryError, Interrupt].each do |kind|
    attempts = 0
    phase = :input
    failure = kind
    fail_at = point
    rejects(kind) { M.envelope(value) }
    if kind == NoMemoryError
      phase == :input ? input_failures += 1 : output_failures += 1
    end
    fail_at = nil
    clean.call
  end
end
check(input_failures > 0 && output_failures > 0)
[:input, :output].each do |target|
  attempts = 0
  phase = :input
  pause_phase = target
  worker = Thread.new { M.envelope(value) }
  worker.report_on_exception = false
  entered.pop
  worker.raise(Interrupt, "Real installed cross-thread interruption")
  resume << true
  rejects(Interrupt) { worker.value }
  clean.call
end
phase = :input
check(M.envelope(value) == value)
clean.call
puts JSON.generate({checks: $checks - before, checkpoints: checkpoints, inputFailures: input_failures,
  outputFailures: output_failures, ownedOutputs: owned, exactlyOnceCleanup: owned == cleared, asynchronousInterruptions: 2})
