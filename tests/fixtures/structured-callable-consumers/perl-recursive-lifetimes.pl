use strict;
use warnings;
use Math::BigInt;
use Scalar::Util qw(weaken);
use JSON::PP;
use LeanBridge::Recursive;

sub identities {
  return defined(&LeanBridge::Runtime::_snapshot)
    ? LeanBridge::Runtime::_snapshot()->{live_identities} : (LeanBridge::Recursive::snapshot())[0];
}
die "dirty identity table\n" if identities();
my $leaf = LeanBridge::Recursive::Tree::Leaf->new(value => Math::BigInt->new(19));
my @held;
push @held, LeanBridge::Recursive::make_recursive($leaf) for 1 .. 4096;
die "capacity accounting differs\n" unless identities() == 4096;
my $overflow = eval { LeanBridge::Recursive::make_recursive($leaf); 1 };
die "closure capacity did not reject cleanly\n" if $overflow || "$@" !~ /status=3/ || identities() != 4096;
my $stale = $held[0]; $stale->close;
die "close did not release capacity\n" unless identities() == 4095;
$held[0] = LeanBridge::Recursive::make_recursive($leaf);
die "released slot not reusable\n" unless identities() == 4096;
my $wrong = eval { $stale->call(LeanBridge::Recursive::true(), $leaf); 1 };
die "stale wrapper acquired replacement identity\n" if $wrong || "$@" !~ /closed/;
die "replacement closure unusable\n" unless $held[0]->call(LeanBridge::Recursive::true(), $leaf)->value->bstr eq '19';
my $weak = $held[-1]; weaken($weak);
@held = (); undef $stale;
die "automatic finalization retained closures\n" if defined($weak) || identities();

my $parent = LeanBridge::Recursive::make_recursive($leaf);
my $pid = fork(); die "fork failed" unless defined($pid);
if (!$pid) {
  # Exercise the actual private magic finalizer in the child process.
  undef $parent;
  require POSIX; POSIX::_exit(0);
}
waitpid($pid, 0); die "forked finalization failed\n" if $?;
die "child disposal changed parent identity\n" unless identities() == 1;
die "parent closure damaged\n" unless $parent->call(LeanBridge::Recursive::true(), $leaf)->value->bstr eq '19';
$parent->close; undef $parent;
die "remaining identities\n" if identities();
print JSON::PP->new->canonical->encode({capacity => 4096, overflowRejected => JSON::PP::true,
  replacementUsable => JSON::PP::true, staleRejected => JSON::PP::true,
  finalized => JSON::PP::true, childFinalizationIsolated => JSON::PP::true, identities => 0}), "\n";
