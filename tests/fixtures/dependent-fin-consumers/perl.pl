use strict;
use warnings;
use Math::BigInt;
use LeanBridge::DependentFin;

my $checks = 0;
sub check { die "failed: $_[1]\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub rejected {
  my ($call, $parameter, $bound) = @_;
  my $ok = eval { $call->(); 1 }; my $error = "$@";
  return !$ok && index($error,
    "$parameter is not below its dependent Fin bound $bound") == 0;
}
sub dies {
  my ($call) = @_;
  my $ok = eval { $call->(); 1 };
  return !$ok;
}

my $huge = n(2)->bpow(70); my $word = n(2)->bpow(32);
# Fin 0: the live bound zero has no values.
check(rejected(sub { LeanBridge::DependentFin::mirror(n(0), n(0)) },
  'arg1', 'arg0'), 'Fin 0 rejects zero');
check(rejected(sub { LeanBridge::DependentFin::mirror(n(0), n(1)) },
  'arg1', 'arg0'), 'Fin 0 rejects one');
# Fin 1: only zero.
check(LeanBridge::DependentFin::mirror(n(1), n(0))->bstr eq '0',
  'Fin 1 accepts zero');
check(rejected(sub { LeanBridge::DependentFin::mirror(n(1), n(1)) },
  'arg1', 'arg0'), 'Fin 1 rejects its bound');
# Exact endpoints and values far above a small live bound.
check(LeanBridge::DependentFin::mirror(n(10), n(0))->bstr eq '9'
  && LeanBridge::DependentFin::mirror(n(10), n(9))->bstr eq '0',
  'Fin 10 endpoints');
for my $value (n(10), n(11), $word->copy, $huge->copy) {
  check(rejected(sub { LeanBridge::DependentFin::mirror(n(10), $value) },
    'arg1', 'arg0'), "Fin 10 rejects $value");
}
# Live bounds wider than a machine word are compared limb by limb.
check(LeanBridge::DependentFin::mirror($word->copy,
  $word->copy->bsub(1))->bstr eq '0'
  && LeanBridge::DependentFin::mirror($word->copy->badd(1),
    $word->copy)->bstr eq '0', 'word bounds');
check(rejected(sub { LeanBridge::DependentFin::mirror($word->copy,
  $word->copy) }, 'arg1', 'arg0'), 'word rejects itself');
check(LeanBridge::DependentFin::mirror($huge->copy,
  $huge->copy->bsub(1))->bstr eq '0'
  && LeanBridge::DependentFin::mirror($huge->copy, n(0))->bstr
    eq $huge->copy->bsub(1)->bstr, 'huge endpoints');
check(LeanBridge::DependentFin::mirror($huge->copy->badd(1),
  $huge->copy)->bstr eq '0', 'one past huge');
for my $value ($huge->copy, $huge->copy->badd(1), n(2)->bpow(128)) {
  check(rejected(sub { LeanBridge::DependentFin::mirror($huge->copy,
    $value) }, 'arg1', 'arg0'), "huge rejects $value");
}
# The bound changes with each call and is never frozen into the package.
for my $bound (0 .. 11) {
  if ($bound > 5) {
    check(LeanBridge::DependentFin::mirror(n($bound), n(5))->bstr
      eq $bound - 6, "live bound $bound");
  } else {
    check(rejected(sub { LeanBridge::DependentFin::mirror(n($bound), n(5)) },
      'arg1', 'arg0'), "reject live bound $bound");
  }
}
# The later arg2 depends on arg1, not the unrelated larger arg0.
check(LeanBridge::DependentFin::label(n(100), n(3), n(2), 'slot')
  eq 'slot:102', 'later dependency');
check(rejected(sub { LeanBridge::DependentFin::label(n(100), n(3), n(3),
  'slot') }, 'arg2', 'arg1'), 'correct later bound');
check(rejected(sub { LeanBridge::DependentFin::label(n(100), n(0), n(0),
  'slot') }, 'arg2', 'arg1'), 'later Fin 0');
check(LeanBridge::DependentFin::label(n(0), $huge->copy,
  $huge->copy->bsub(1), 'x') eq 'x:' . $huge->copy->bsub(1)->bstr,
  'later huge');
# Negative and non-BigInt values use ordinary Nat/type errors.
check(dies(sub { LeanBridge::DependentFin::mirror(n(-1), n(0)) })
  && !rejected(sub { LeanBridge::DependentFin::mirror(n(-1), n(0)) },
    'arg1', 'arg0'), 'negative bound');
check(dies(sub { LeanBridge::DependentFin::mirror(n(5), n(-1)) })
  && !rejected(sub { LeanBridge::DependentFin::mirror(n(5), n(-1)) },
    'arg1', 'arg0'), 'negative value');
check(dies(sub { LeanBridge::DependentFin::mirror(n(5), 1.5) }),
  'non-BigInt value');
# Rejection leaves caller-owned objects unchanged.
my ($start, $bound, $value, $name) = (n(7), n(4), n(4), 'slot');
check(rejected(sub { LeanBridge::DependentFin::label($start, $bound, $value,
  $name) }, 'arg2', 'arg1'), 'rejected label');
check($start->bstr eq '7' && $bound->bstr eq '4' && $value->bstr eq '4'
  && $name eq 'slot' && LeanBridge::DependentFin::label($start, $bound,
    n(3), $name) eq 'slot:10', 'caller data unchanged');
# 1000 rejection/recovery cycles keep the runtime usable.
for my $i (0 .. 999) {
  die "invalid call accepted at $i\n" unless rejected(sub {
    LeanBridge::DependentFin::mirror(n(10), n(10 + $i % 5))
  }, 'arg1', 'arg0');
  die "valid call failed at $i\n"
    unless LeanBridge::DependentFin::mirror(n($i % 7 + 1), n($i % 7))->bstr
      eq '0'
    && LeanBridge::DependentFin::mirror(n(10), n($i % 10))->bstr
      eq 9 - $i % 10;
}
$checks += 2000;
print "dependent-fin-ok:$checks\n";
