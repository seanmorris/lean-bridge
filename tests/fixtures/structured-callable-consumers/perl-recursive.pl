use strict;
use warnings;
use utf8;
use JSON::PP;
use Scalar::Util qw(refaddr weaken);
use Math::BigInt;
use Config;
use LeanBridge::Recursive;

my $checks = 0;
sub check { ++$checks; die "check $checks: $_[1]\n" unless $_[0] }
sub rejects {
  my ($code, $message) = @_;
  my $ok = eval { $code->(); 1 };
  check(!$ok && "$@" =~ $message, "expected rejection $message, got $@");
}
sub leaf { LeanBridge::Recursive::Tree::Leaf->new(value => Math::BigInt->new($_[0])) }
sub branch { LeanBridge::Recursive::Tree::Branch->new(children => [@_]) }
sub tree_text {
  my ($tree) = @_;
  return $tree->value->bstr if ref($tree) eq 'LeanBridge::Recursive::Tree::Leaf';
  return '[' . join(',', map { tree_text($_) } @{$tree->children}) . ']';
}
my $tree = branch(leaf('123456789012345678901234567890'), branch(leaf(7)), branch());
my $expected = tree_text($tree);
for (1 .. 20) {
  my $seen = 0;
  my $out = LeanBridge::Recursive::twice_recursive($tree, sub {
    ++$seen; check(tree_text($_[0]) eq $expected, 'callback recursive values');
    check(refaddr($_[0]) != refaddr($tree), 'callback receives a copy');
    return $_[0];
  });
  check($seen == 2, 'two callback invocations');
  check(tree_text($out) eq $expected, 'recursive result');
  check(refaddr($out) != refaddr($tree), 'result is a copy');
  $out->children->[0]->{value}->badd(1);
  check(tree_text($tree) eq $expected, 'independent BigInt');
}
my $closure = LeanBridge::Recursive::make_recursive($tree);
check(!$closure->closed, 'new closure open');
check(tree_text($closure->call(LeanBridge::Recursive::true(), branch())) eq $expected, 'closure capture');
check(tree_text($closure->call(LeanBridge::Recursive::false(), leaf(9))) eq '9', 'closure argument');
$closure->close; $closure->close;
check($closure->closed, 'close idempotent');
rejects(sub { $closure->call(LeanBridge::Recursive::true(), $tree) }, qr/closed/);
my $error = bless {}, 'MyException';
for (1 .. 10) {
  my $ok = eval { LeanBridge::Recursive::twice_recursive($tree, sub { die $error }); 1 };
  check(!$ok && refaddr($@) == refaddr($error), 'exception identity');
  check(tree_text(LeanBridge::Recursive::call_recursive($tree, sub { $_[0] })) eq $expected, 'recovery');
}
my $false_error = bless {}, 'FalseException';
{
  package FalseException;
  use overload 'bool' => sub { die "error boolean overload called\n" }, '""' => sub { die "error string overload called\n" }, fallback => 1;
}
my $ok = eval { LeanBridge::Recursive::call_recursive($tree, sub { die $false_error }); 1 };
check(!$ok && refaddr($@) == refaddr($false_error), 'error overloads bypassed');
{
  local $@ = 'outer error';
  my $alias = \$@;
  LeanBridge::Recursive::call_recursive($tree, sub { $_[0] });
  check($@ eq 'outer error' && $$alias eq 'outer error', 'successful callback preserves caller error scalar');
  my $passed = eval { LeanBridge::Recursive::call_recursive($tree, sub { die $error }); 1 };
  check(!$passed && refaddr($@) == refaddr($error) && refaddr($$alias) == refaddr($error), 'failure preserves aliases to caller error scalar');
}
my $cycle = branch(); push @{$cycle->children}, $cycle;
rejects(sub { LeanBridge::Recursive::call_recursive($cycle, sub { $_[0] }) }, qr/Cyclic/);
rejects(sub { LeanBridge::Recursive::call_recursive($tree, sub { $cycle }) }, qr/Cyclic/);
@{$cycle->children} = ();
my $deep = leaf(0); $deep = branch($deep) for 1 .. 130;
rejects(sub { LeanBridge::Recursive::call_recursive($deep, sub { $_[0] }) }, qr/depth|node|limit/);
rejects(sub { LeanBridge::Recursive::call_recursive($tree, sub { $deep }) }, qr/depth|node|limit/);
my $calls = 0;
my $out = LeanBridge::Recursive::call_recursive($tree, sub {
  ++$calls; LeanBridge::Recursive::call_recursive($_[0], sub { ++$calls; $_[0] });
});
check($calls == 2 && tree_text($out) eq $expected, 'nested callbacks');
my $escaped = LeanBridge::Recursive::retain_record(sub { $_[0] });
my $payload = LeanBridge::Recursive::Payload->new(text => "one\0λ", rows => [], count => Math::BigInt->new(10), nested => undef);
rejects(sub { $escaped->call($payload) }, qr/status=1/);
$escaped->close;
my $nested = LeanBridge::Recursive::make_nested_alias($payload);
check(LeanBridge::Recursive::call_nested_alias($payload, $nested) eq "one\0λ<none>one\0λ", 'returned closure as a callback');
my $plain = LeanBridge::Recursive::make_nested_plain($payload);
check(LeanBridge::Recursive::call_nested_plain($payload, $plain) eq "one\0λ<none>one\0λ", 'plain nested callback');
$nested->close; $plain->close;
my $held = LeanBridge::Recursive::make_recursive($tree);
my $weak = $held; weaken($weak); undef $held;
check(!defined($weak), 'closure finalization');
my $deferred = LeanBridge::Recursive::make_recursive($tree);
{
  my $original = Math::BigInt->can('bstr'); my $seen = 0;
  no warnings 'redefine';
  local *Math::BigInt::bstr = sub {
    if (!$seen++) { $deferred->close; check($deferred->closed, 'close during conversion'); }
    return $original->(@_);
  };
  check(tree_text($deferred->call(LeanBridge::Recursive::false(), $tree)) eq $expected, 'active borrow survives close');
}
check($deferred->closed, 'deferred close completed');
rejects(sub { LeanBridge::Recursive::LeanClosure->new }, qr/factory/);
require Storable;
my $serialized = LeanBridge::Recursive::make_recursive($tree);
rejects(sub { Storable::freeze($serialized) }, qr/serialized/);
$serialized->close;
my $pid = fork(); die "fork failed" unless defined $pid;
if (!$pid) {
  my $passed = eval { LeanBridge::Recursive::call_recursive($tree, sub { $_[0] }); 1 };
  my $failed = !$passed && "$@" =~ /initiating/;
  require POSIX; POSIX::_exit($failed ? 0 : 31);
}
waitpid($pid, 0); check($? == 0, 'fork calls reject');
if (($Config{useithreads} // '') eq 'define') {
  require threads;
  my $parent = LeanBridge::Recursive::make_recursive($tree);
  my $thread = threads->create(sub {
    my $passed = eval { LeanBridge::Recursive::call_recursive(undef, sub { $_[0] }); 1 };
    return !$passed && "$@" =~ /initiating/;
  });
  check($thread->join, 'cross-interpreter call rejected');
  check(tree_text($parent->call(LeanBridge::Recursive::true(), $tree)) eq $expected, 'thread cleanup preserves parent closure');
  $parent->close;
}
my $identities = defined(&LeanBridge::Runtime::_snapshot)
  ? LeanBridge::Runtime::_snapshot()->{live_identities} : (LeanBridge::Recursive::snapshot())[0];
check($identities == 0, 'zero remaining identities');
print encode_json({checks => $checks, perl => "$^V", threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false, identities => $identities});
