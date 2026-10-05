use strict;
use warnings;
use JSON::PP;
use Math::BigInt;
use POSIX ();
use DynaLoader;
use Config;
my ($order, $mode) = @ARGV;
my $checks = 0;
sub check { ++$checks; die "Composition assertion $checks at " . (caller)[2] . "\n" unless $_[0]; }
sub rejects {
  my ($pattern, $call) = @_;
  my $ok = eval { $call->(); 1 }; my $error = $@;
  die "Expected $pattern, got " . ($ok ? 'success' : $error) . "\n" if $ok || $error !~ $pattern;
  check(1);
}
sub leaf { LeanBridge::GraphAlpha::Tree::Leaf->new(value => Math::BigInt->new(17)) }
for my $module ($order eq 'acyclic-first' ? qw(Peer GraphAlpha) : qw(GraphAlpha Peer)) {
  eval "require LeanBridge::$module; 1" or die $@;
  if ($module eq 'Peer') { check(LeanBridge::Peer::answer() == 42); }
  else { check(LeanBridge::GraphAlpha::stamp(1) == 12); }
}
my $handle = DynaLoader::dl_load_file('./Composition.so', 0) or die DynaLoader::dl_error();
for my $name (qw(start stop retire snapshot)) {
  my $symbol = DynaLoader::dl_find_symbol($handle, "composition_$name") or die DynaLoader::dl_error();
  DynaLoader::dl_install_xsub("CompositionProbe::$name", $symbol);
}
my @before = CompositionProbe::snapshot();
check($before[0] == 1 && $before[1] == 2 && $before[2] == 2);
my $input = leaf();
my $retained = LeanBridge::GraphAlpha::tree($input);
check($retained->child->value == 17);
my $closure = LeanBridge::Peer::make_adder(7);
check($closure->call(35) == 42);

# The native worker holds the real broker mutex while the parent forks.
CompositionProbe::start();
my $child = fork(); die "fork failed: $!" unless defined($child);
if (!$child) {
  # A default OS signal also terminates a child blocked inside pthread_mutex_lock.
  local $SIG{ALRM} = 'DEFAULT'; alarm(5);
  my $ok = eval {
    rejects(qr/initiating process/, sub { LeanBridge::GraphAlpha::tree($input) });
    rejects(qr/initiating process/, sub { LeanBridge::Peer::answer() });
    rejects(qr/initiating process/, sub { require LeanBridge::GraphBeta; });
    rejects(qr/initiating process/, sub { LeanBridge::Runtime::_snapshot() });
    rejects(qr/initiating process/, sub { $closure->call(35) });
    undef $closure;
    1;
  };
  warn $@ unless $ok;
  POSIX::_exit($ok ? 0 : 92);
}
waitpid($child, 0); my $child_status = $?;
CompositionProbe::stop();
die "Forked closure cleanup failed (child status $child_status)\n" if $child_status;
check($child_status == 0 && $closure->call(35) == 42);
require LeanBridge::GraphBeta;
my $beta = LeanBridge::GraphBeta::Tree::Leaf->new(value => Math::BigInt->new(23));
check(LeanBridge::GraphBeta::tree($beta)->child->value == 23);
check(LeanBridge::GraphAlpha::stamp(1) == 12 && LeanBridge::GraphBeta::stamp(1) == 30);
check(LeanBridge::Peer::answer() == 42);
my @after = CompositionProbe::snapshot();
check($after[0] == 1 && $after[1] == 4 && $after[2] == 4);

if ($mode eq 'publication') {
  my $constructor = \&Math::BigInt::new;
  no warnings 'redefine';
  local *Math::BigInt::new = sub { CompositionProbe::retire(); return $constructor->(@_); };
  rejects(qr/status=5/, sub { LeanBridge::GraphAlpha::tree($input) });
} elsif ($mode eq 'direct') {
  CompositionProbe::retire();
} else { die "Unknown retirement mode: $mode\n"; }
rejects(qr/status=5/, sub { LeanBridge::GraphAlpha::tree($input) });
rejects(qr/status=5/, sub { LeanBridge::GraphBeta::tree($beta) });
rejects(qr/retired/, sub { LeanBridge::Peer::answer() });
rejects(qr/retired/, sub { $closure->call(35) });
$closure->close;
check($closure->closed);
check($retained->child->value == 17);
$retained->child->{value}->badd(1);
check($retained->child->value == 18 && $input->value == 17);
my $state = LeanBridge::Runtime::_snapshot();
check(!$state->{live_scopes} && !$state->{live_wrappers} && !$state->{live_identities} && !$state->{live_callbacks});
print JSON::PP->new->canonical->encode({ order => $order, mode => $mode, checks => $checks,
  perl => $^V->normal, threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
  runtimeInitRuns => $after[0], packageComponents => 3, forkWithBrokerLockHeld => JSON::PP::true,
  forkedClosureCleanup => JSON::PP::true, crossPackageRetirement => JSON::PP::true,
  retainedValuesUsable => JSON::PP::true }), "\n";
