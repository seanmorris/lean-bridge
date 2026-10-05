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
sub native_snapshot { [LeanBridge::Recursive::Probe::native_snapshot()] }
sub native_reset { LeanBridge::Recursive::Probe::native_reset(@_); }
sub all_clean { clean(); check(native_snapshot()->[0] == ($_[0] // 0)); }
sub fork_rejects {
  my $child = fork(); die "fork failed: $!" unless defined($child);
  if (!$child) {
    my $ok = eval { call('empty'); 1 };
    POSIX::_exit(!$ok && $@ =~ /initiating process/ ? 0 : 1);
  }
  waitpid($child, 0); check($? == 0);
}

check(!native_snapshot()->[4]);
my $too_deep = LeanBridge::Recursive::Spine::Leaf->new(value => 0);
for (1 .. 128) { $too_deep = LeanBridge::Recursive::Spine::Next->new(value => $too_deep); }
rejects(qr/depth/, sub { call('spine', $too_deep) });
rejects(qr/out of range/, sub { call('join_trees', tree_value(), LeanBridge::Recursive::Tree::Leaf->new(payload => payload(u32 => -1))) });
rejects(qr/expects/, sub { call('tree') });
rejects(qr/expects/, sub { call('empty', 1) });
check(!native_snapshot()->[4] && native_snapshot()->[2] == 0);
all_clean(); fork_rejects();
my $thread_rejections = 0;
if (($Config{useithreads} // '') eq 'define') {
  require threads;
  my $thread = threads->create(sub {
    my $ok = eval { call('empty'); 1 };
    return !$ok && $@ =~ /interpreter thread/ ? 1 : 0;
  });
  check($thread->join() == 1); ++$thread_rejections;
}
my $oracle = Math::BigInt->new(2)->bpow(128)->badd(1);
check(call('inspect', payload(natural => $oracle, integer => $oracle->copy()->bneg())));
check(call('word_max', 18446744073709551615));
check(call('signed_min', -9223372036854775808));
check(same_value(call('scalars', payload()), payload()));
check(same_value(call('scalars', payload(natural => Math::BigInt->new(0), integer => Math::BigInt->new(0), text => '', bytes => '')),
  payload(natural => Math::BigInt->new(0), integer => Math::BigInt->new(0), text => '', bytes => '')));
my $special = call('scalars', payload(f32 => POSIX::nan(0), f64 => -0.0));
check(isnan($special->f32) && pack('d>', $special->f64) eq pack('d>', -0.0));
$special = call('scalars', payload(f32 => -HUGE_VAL(), f64 => HUGE_VAL()));
check($special->f32 == -HUGE_VAL() && $special->f64 == HUGE_VAL());
$special = call('scalars', payload(f32 => 1.1)); check($special->f32 == unpack('f', pack('f', 1.1)));
my $tree = tree_value();
check(same_value(call('tree', $tree), $tree));
my $empty = LeanBridge::Recursive::Tree::Branch->new(children => []);
check(same_value(call('empty'), $empty));
check(same_value(call('join_trees', $tree, $tree), LeanBridge::Recursive::Tree::Branch->new(children => [$tree, $tree])));
my $forest = [($tree) x 512]; check(same_value(call('forest', $forest), $forest));
my $mutable = LeanBridge::Recursive::Tree::Branch->new(children => [$empty, $empty]);
my $copied = call('tree', $mutable);
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
my $right = LeanBridge::Recursive::RightTree::Many->new(lefts => [$left, $left]); check(same_value(call('right', $right), $right));
my $spine = LeanBridge::Recursive::Spine::Leaf->new(value => 41);
for (1 .. 127) { $spine = LeanBridge::Recursive::Spine::Next->new(value => $spine); }
my ($a, $b) = ($spine, call('spine', $spine));
for (1 .. 127) { check(refaddr($a) != refaddr($b)); $a = $a->value; $b = $b->value; }
check($a->value == 41 && $b->value == 41);
rejects(qr/status=2/, sub { call('grow', $spine) }); all_clean();
check(same_value(call('grow', $a), LeanBridge::Recursive::Spine::Next->new(value => $a)));
my $wide = LeanBridge::Recursive::Wide::Next->new((map { ('field' . $_ => $_) } 0 .. 254), child => LeanBridge::Recursive::Wide::Leaf->new(value => 17));
check(same_value(call('wide', $wide), $wide));
for my $marker (LeanBridge::Recursive::Marker::Empty->new(), LeanBridge::Recursive::Marker::Unit->new(value => undef), LeanBridge::Recursive::Marker::Next->new(value => LeanBridge::Recursive::Marker::Empty->new())) {
  check(same_value(call('marker', $marker), $marker));
}
check(same_value(call('empty_record', LeanBridge::Recursive::EmptyRecord->new()), LeanBridge::Recursive::EmptyRecord->new()));
check(same_value(call('units', [(undef) x 123]), [(undef) x 123]));
rejects(qr/no finite value/, sub { call('never', bless({value => undef}, 'LeanBridge::Recursive::Never::Again')) });
all_clean(); fork_rejects();

my $envelope = envelope_value();
native_reset(); graph_reset();
check(same_value(call('envelope', $envelope), $envelope));
my ($native_count, $perl_count, $malloc_count) = (native_snapshot()->[1], snapshot()->[3], snapshot()->[2]);
all_clean();
for my $point (1 .. $native_count) {
  native_reset($point); graph_reset();
  rejects(qr/status=3/, sub { call('envelope', $envelope) });
  all_clean(); check(native_snapshot()->[4]);
}
my ($input_failures, $output_failures) = (0, 0);
local $SIG{USR1} = sub { die "interrupted Perl graph conversion\n" };
for my $signal (0, 1) {
  for my $point (1 .. $perl_count) {
    native_reset(); graph_reset(0, $point, 0, $signal);
    rejects($signal ? qr/interrupted/ : qr/injected/, sub { call('envelope', $envelope) });
    all_clean(); check(native_snapshot()->[4]);
    if (!$signal) { if (native_snapshot()->[2]) { ++$output_failures; } else { ++$input_failures; } }
  }
}
for my $point (1 .. $malloc_count) {
  native_reset(); graph_reset($point);
  rejects(qr/allocation/, sub { call('envelope', $envelope) }); all_clean();
}
native_reset(); graph_reset();
check($input_failures && $output_failures);
my $exception = bless {}, 'GraphException';
{
  no warnings 'redefine';
  local *Math::BigInt::new = sub { die $exception; };
  my $ok = eval { call('tree', $tree); 1 };
  check(!$ok && refaddr($@) == refaddr($exception));
}
all_clean(); check(native_snapshot()->[4]);
my $retained_perl = call('envelope', $envelope); check(same_value($retained_perl, $envelope));
check(LeanBridge::Recursive::Probe::hold() == 0);
my $retained = native_snapshot()->[0]; check($retained > 0);
my $mode = $ARGV[0];
if ($mode eq 'carrier') {
  native_reset(0, 1); rejects(qr/Invalid native/, sub { call('tree', $tree) });
} elsif ($mode eq 'raw') {
  native_reset(0, 0, 1); rejects(qr/Invalid native/, sub { call('tree', $tree) });
} elsif ($mode eq 'during') {
  native_reset(0, 0, 2); rejects(qr/status=5/, sub { call('tree', $tree) });
} elsif ($mode eq 'publication') {
  no warnings 'redefine';
  my $constructor = \&Math::BigInt::new;
  local *Math::BigInt::new = sub { LeanBridge::Recursive::Probe::retire(); $constructor->(@_); };
  rejects(qr/status=5/, sub { call('tree', $tree) });
} else { die "Unknown retirement mode $mode\n"; }
check(!native_snapshot()->[4]); all_clean($retained);
native_reset();
rejects(qr/status=5/, sub { call('envelope', $envelope) });
check(native_snapshot()->[2] == 0); all_clean($retained);
check(same_value($retained_perl, $envelope));
LeanBridge::Recursive::Probe::release(); LeanBridge::Recursive::Probe::release();
LeanBridge::Recursive::Probe::detach(); all_clean();
print JSON::PP->new->canonical->encode({ checks => $checks, nativeCheckpoints => $native_count, perlCheckpoints => $perl_count,
  mallocCheckpoints => $malloc_count, inputFailures => $input_failures, outputFailures => $output_failures,
  threadRejections => $thread_rejections, perl_identity() }), "\n";
