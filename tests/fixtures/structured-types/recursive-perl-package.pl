use strict;
use warnings;
use utf8;
use B;
use Config;
use POSIX ();
require './fixture.pl';
our $checks;
sub call {
  my $name = shift;
  no strict 'refs';
  return &{'LeanBridge::Recursive::' . $name}(@_);
}
sub initialized { LeanBridge::Runtime::_snapshot()->{runtime_init_runs} }
sub context_rejects {
  rejects(qr/initiating process/, sub { call('empty') });
  # A missing path must not be inspected in a foreign process/interpreter.
  rejects(qr/initiating process/, sub { LeanBridge::Runtime::_load_component('/missing.pm', '', '', '', {}) });
  {
    no warnings 'redefine';
    rejects(qr/initiating process/, sub { LeanBridge::Runtime->bootstrap($LeanBridge::Runtime::VERSION) });
  }
}
sub fork_rejects {
  my $child = fork(); die "fork failed: $!" unless defined($child);
  if (!$child) {
    my $ok = eval { context_rejects(); 1 };
    warn $@ unless $ok;
    POSIX::_exit($ok ? 0 : 1);
  }
  waitpid($child, 0); check($? == 0);
}

check(initialized() == 0);
rejects(qr/expects/, sub { call('tree') });
rejects(qr/expects/, sub { call('empty', 1) });
rejects(qr/out of range/, sub { call('tree', LeanBridge::Recursive::Tree::Leaf->new(payload => payload(u32 => -1))) });
my $cycle = LeanBridge::Recursive::Tree::Branch->new(children => []);
push @{$cycle->children}, $cycle;
rejects(qr/cycl/i, sub { call('tree', $cycle) });
@{$cycle->children} = ();
my $deep = LeanBridge::Recursive::Spine::Leaf->new(value => 31);
for (1 .. 128) { $deep = LeanBridge::Recursive::Spine::Next->new(value => $deep); }
rejects(qr/depth/, sub { call('spine', $deep) });
check(initialized() == 0);
fork_rejects();
my $thread_rejections = 0;
if (($Config{useithreads} // '') eq 'define') {
  require threads;
  my $thread = threads->create(sub { context_rejects(); return 1; });
  check($thread->join() == 1); ++$thread_rejections;
}

my $tree = tree_value();
check(same_value(call('tree', $tree), $tree));
check(initialized() == 1);
check(same_value(call('scalars', payload()), payload()));
my $oracle = Math::BigInt->new(2)->bpow(128)->badd(1);
check(call('inspect', payload(natural => $oracle, integer => $oracle->copy()->bneg())));
check(call('word_max', 18446744073709551615));
check(call('signed_min', -9223372036854775808));
for my $natural (0, 1, '9' x 1000) {
  my $value = payload(natural => Math::BigInt->new($natural), integer => Math::BigInt->new($natural)->bneg());
  check(same_value(call('scalars', $value), $value));
}
my $special = call('scalars', payload(f32 => POSIX::nan(0), f64 => -0.0));
check(isnan($special->f32) && pack('d>', $special->f64) eq pack('d>', -0.0));
$special = call('scalars', payload(f32 => -HUGE_VAL(), f64 => HUGE_VAL()));
check($special->f32 == -HUGE_VAL() && $special->f64 == HUGE_VAL());
$special = call('scalars', payload(f32 => 1.1)); check($special->f32 == unpack('f', pack('f', 1.1)));
my $empty = LeanBridge::Recursive::Tree::Branch->new(children => []);
check(same_value(call('empty'), $empty));
check(same_value(call('join_trees', $tree, $tree), LeanBridge::Recursive::Tree::Branch->new(children => [$tree, $tree])));
check(same_value(call('forest', []), []));
check(same_value(call('forest', [($tree) x 512]), [($tree) x 512]));
my $copied = call('tree', LeanBridge::Recursive::Tree::Branch->new(children => [$empty, $empty]));
push @{$copied->children->[0]->children}, $tree;
check(@{$copied->children->[1]->children} == 0 && @{$empty->children} == 0);
for my $marker (undef, LeanBridge::Recursive::Some->new(undef), LeanBridge::Recursive::Some->new(LeanBridge::Recursive::Some->new(undef))) {
  for my $outcome (LeanBridge::Recursive::Ok->new([$tree, $empty]), LeanBridge::Recursive::Err->new("error\0🌱")) {
    my $value = envelope_value(marker => $marker, outcome => $outcome, fallback => undef);
    check(same_value(call('envelope', $value), $value));
  }
}
my $left = LeanBridge::Recursive::LeftTree::Next->new(right => LeanBridge::Recursive::RightTree::Many->new(lefts => [LeanBridge::Recursive::LeftTree::Leaf->new(value => 9)]));
check(same_value(call('left', $left), $left));
my $right = LeanBridge::Recursive::RightTree::Many->new(lefts => [$left, $left]);
check(same_value(call('right', $right), $right));
my ($a, $b) = ($deep->value, call('spine', $deep->value));
for (1 .. 127) { check(refaddr($a) != refaddr($b)); $a = $a->value; $b = $b->value; }
check($a->value == 31 && $b->value == 31);
rejects(qr/status=2/, sub { call('grow', $deep->value) });
check(same_value(call('grow', $a), LeanBridge::Recursive::Spine::Next->new(value => $a)));
my $wide = LeanBridge::Recursive::Wide::Next->new((map { ('field' . $_ => $_) } 0 .. 254), child => LeanBridge::Recursive::Wide::Leaf->new(value => 17));
check(same_value(call('wide', $wide), $wide));
for my $marker (LeanBridge::Recursive::Marker::Empty->new(), LeanBridge::Recursive::Marker::Unit->new(value => undef), LeanBridge::Recursive::Marker::Next->new(value => LeanBridge::Recursive::Marker::Empty->new())) {
  check(same_value(call('marker', $marker), $marker));
}
check(same_value(call('empty_record', LeanBridge::Recursive::EmptyRecord->new()), LeanBridge::Recursive::EmptyRecord->new()));
check(same_value(call('units', [(undef) x 123]), [(undef) x 123]));
rejects(qr/no finite value/, sub { call('never', bless({value => undef}, 'LeanBridge::Recursive::Never::Again')) });
my $sparse = []; $sparse->[2] = $empty;
rejects(qr/sparse/i, sub { call('forest', $sparse) });
for my $change (
  sub { $_[0]->{extra} = 1 },
  sub { delete $_[0]->{u8} },
  sub { $_[0]->{natural} = Math::BigInt->new(-1) },
  sub { $_[0]->{char} = 'xx' },
  sub { $_[0]->{bytes} = '🌱' },
  sub { $_[0]->{integer} = undef }
) {
  my $value = payload(); $change->($value);
  rejects(qr/field|expected|negative|scalar|octet|integer/i, sub { call('scalars', $value) });
}
my $exception = bless {}, 'PackageException';
{
  no warnings qw(redefine once);
  local *Math::BigInt::new = sub { die $exception; };
  my $ok = eval { call('tree', $tree); 1 };
  check(!$ok && refaddr($@) == refaddr($exception));
}
for (1 .. 32) { check(same_value(call('tree', $tree), $tree)); }
fork_rejects();
check(initialized() == 1);
print JSON::PP->new->canonical->encode({ checks => $checks, exports => 18,
  threadRejections => $thread_rejections, perl_identity() }), "\n";
