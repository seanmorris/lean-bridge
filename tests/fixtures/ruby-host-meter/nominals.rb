require_relative "scalars"

class Box
  attr_accessor :lookup_hook
  def lookup = lookup_hook ? lookup_hook.call : Token.new
end
class ComparableToken < Token
  def ==(other) = other.is_a?(ComparableToken)
  alias eql? ==
  def hash = 0
end

def registration_count(api, expected)
  actual = api.send(:__live)
  check(actual == expected, "expected #{expected} native registrations, found #{actual}")
end

def weak_only(api)
  WeakRef.new(api.make(7))
end

def strong_only(api)
  # No Ruby argument of kind Token enters this call: the pin must be made on
  # the Ruby member's return path, before Lean returns the object to Ruby.
  WeakRef.new(api.lookup_token(Box.new(7)))
end

def collect_without_reference(ref)
  8.times do
    GC.start(full_mark: true, immediate_sweep: true)
    return true unless ref.weakref_alive?
    GC.compact
  end
  false
end

def exercise_order(outer, inner)
  member = nil
  outer.bind_hosts(box: Box, token: Token) do
    refused(TypeError) { inner.bind_hosts(box: Box, token: Class.new(Token)) { raise "incompatible token class" } }
    inner.bind_hosts(box: Box, token: Token) do
      calls = 0
      box = Box.new(7)
      box.on_read = -> { calls += 1; 7 }
      32.times do
        # A valid strong argument must not acquire a permanent root if another
        # object or a later scalar fails validation before Lean is entered.
        refused(TypeError) { outer.check_pair(Token.new, Token.new, 0) }
        refused(RangeError) { inner.check_pair(Token.new, box, 256) }
      end
      check(calls.zero?, "rejected inputs reached Lean")
      registration_count(outer, 0)

      refused(TypeError) { outer.token_identity(box) }
      refused(TypeError) { inner.identity(Token.new) }
      box.lookup_hook = -> { box }
      refused(TypeError) { outer.lookup_token(box) }
      registration_count(inner, 0)

      left, right = ComparableToken.new, ComparableToken.new
      check(left == right && !left.equal?(right), "value-equal fixture")
      check(inner.check_pair(left, box, 0) == 19 && calls == 1, "nominal dispatch")
      check(outer.token_identity(left).equal?(left), "lost referential identity")
      registration_count(inner, 1)
      refused(RangeError) { inner.check_pair(left, box, 256) }
      registration_count(outer, 1) # A failed call must not roll back an earlier admission.
      check(inner.token_identity(right).equal?(right), "collapsed value-equal instances")
      registration_count(outer, 2)
      error = RuntimeError.new("entered Lean")
      fresh = Token.new
      fresh.on_read = -> { raise error }
      check(refused(RuntimeError) { outer.check_pair(fresh, box, 0) }.equal?(error), "lost accepted host fault")
      registration_count(inner, 3) # The method really ran; this object was admitted.

      transient = weak_only(outer)
      member = strong_only(inner)
      check(collect_without_reference(transient), "weak kind retained solely by the domain")
      GC.compact
      check(member.weakref_alive?, "strong member return collected inside binding")
      registration_count(outer, 4)
      outer.remember_token(left)
      check(inner.token_identity(outer.recalled_token).equal?(left), "independent component changed the object")
      registration_count(inner, 4)
    end
    GC.start; GC.compact
    check(member.weakref_alive?, "closing one component released a shared strong kind")
    registration_count(outer, 4)
  end
  registration_count(inner, 0)
  member
end

[[A, B], [B, A]].each do |outer, inner|
  # MRI may conservatively mark VALUEs in the native stack of a still-running
  # fiber. End the caller's stack before checking for surviving Ruby roots.
  member = Fiber.new { exercise_order(outer, inner) }.resume
  check(collect_without_reference(member), "strong kind retained after its last binding")
  outer.bind_hosts(box: Box, token: Token) do
    refused(TypeError) { outer.recalled_token }
    outer.forget_token
    registration_count(outer, 0)
  end
end

# A class may implement two declared interfaces. The public Ruby object is the
# same; distinct nominal kinds must not share a native ownership registration.
A.bind_hosts(box: Box, token: Box) do
  object = Box.new(3)
  A.keep(object)
  check(A.token_identity(object).equal?(object) && A.held.equal?(object), "nominal views")
  registration_count(A, 2)
  A.forget
  registration_count(A, 1)
end
registration_count(A, 0)
puts "strong and weak kinds; both binding orders; live=0"

# Returned sums and declared errors must hold the actual Ruby objects, not
# Lean references that expire when the last binding closes.
def saved_leases(outer, inner)
  outer.bind_hosts(box: Box, token: Token) do
    inner.bind_hosts(box: Box, token: Token) do
      box, token = outer.make(17), ComparableToken.new
      wrong = ComparableToken.new
      refused(TypeError) { inner.pick_object(token, box, true) }
      ok, err = outer.pick_object(box, token, true), inner.pick_object(box, token, false)
      declared = refused(inner::DeclaredError) { inner.reject_box(box) }
      check(declared.declaration.end_with?(".rejectBox"), "wrong declared error")
      scalar = refused(outer::DeclaredError) { outer.mixed_fault(box, token, 0) }
      check(scalar.payload.is_a?(outer::Err) && scalar.payload.value == "outer", "wrong outer branch")
      bad = refused(outer::DeclaredError) { outer.mixed_fault(box, token, 1) }
      good = refused(inner::DeclaredError) { inner.mixed_fault(box, token, 2) }
      outer.mixed_fault(box, token, 3)
      outer.keep(box)
      check(good.payload.value.value == wrong && !good.payload.value.value.equal?(wrong), "collapsed value-equal tokens")
      [WeakRef.new(box), WeakRef.new(token), ok, err, declared, bad, good]
    end
  end
end

[[A, B], [B, A]].each do |outer, inner|
  box, token, ok, err, declared, bad, good = Fiber.new { saved_leases(outer, inner) }.resume
  registration_count(outer, 0)
  GC.start(full_mark: true, immediate_sweep: true)
  GC.compact
  check(ok.is_a?(outer::Ok) && ok.value.equal?(box.__getobj__), "lost successful result")
  check(err.is_a?(inner::Err) && err.value.equal?(token.__getobj__), "lost returned error")
  check(declared.payload.equal?(box.__getobj__) && declared.payload.read == 17, "stale direct payload")
  check(bad.payload.is_a?(outer::Ok) && bad.payload.value.is_a?(outer::Err) &&
    bad.payload.value.value.equal?(box.__getobj__), "wrong nominal in nested declared error")
  check(good.payload.is_a?(inner::Ok) && good.payload.value.is_a?(inner::Ok) &&
    good.payload.value.value.equal?(token.__getobj__), "wrong nominal in nested success arm")
  outer.bind_hosts(box: Box, token: Token) do
    # The saved Ruby exception remains usable, but a new call must not turn
    # the old binding's stale Lean reference into a new Ruby exception payload.
    refused(TypeError) { outer.reject_saved }
    outer.forget
    empty = refused(outer::DeclaredError) { outer.reject_saved }
    check(empty.payload.is_a?(outer::Err) && empty.payload.value == "empty", "failed conversion poisoned binding")
  end
  registration_count(inner, 0)
end
puts "leased values and declared errors survived GC after both bindings closed; live=0"
