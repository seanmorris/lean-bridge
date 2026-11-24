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
