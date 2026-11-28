use strict;
use warnings FATAL => 'all';
use Config;
use DynaLoader;
use Scalar::Util qw(refaddr weaken);
use LeanBridge::Workshop::_HostMembers;

my $so = DynaLoader::dl_load_file('./host-check.so', 0) or die DynaLoader::dl_error();
my $sym = DynaLoader::dl_find_symbol($so, 'ph_probe') or die DynaLoader::dl_error();
my $call = DynaLoader::dl_install_xsub('FrameCheck::run', $sym);
{ package Fault; use overload bool => sub {0}, '""' => sub {die "error stringified"}, fallback => 1; }
my ($first,$second) = map { bless {}, 'Fault' } 1..2;
my $calls = 0;
my $slot;
{ package Meter;
  sub observe {
    my ($class, $n) = @_;
    ++$calls;
    return $call->($slot, 0, 3) if $n == 4;
    die $first if $n == 11; die $second if $n == 12;
    return [] if $n == 13;
    return 2*$n;
  }
}
sub fault (&) {
    my ($f) = @_; local $@;
    return $@ unless eval { $f->(); 1 };
    die "unexpected success";
}
$slot = LeanBridge::Workshop::_HostMembers::_bind({Box => 'Meter'})->[0];
die unless $call->($slot,0,4) == 8;
{
    local $@ = 'caller state';
    my $alias = \$@;
    die unless $call->($slot,1,11) eq 'mapped in Lean' && $$alias eq 'caller state';
}
die unless refaddr(fault { $call->($slot,0,11) }) == refaddr($first);
die unless refaddr(fault { $call->($slot,3,11) }) == refaddr($first);
die unless fault { $call->($slot,2,11) } =~ /replacement Lean IO error/;
die unless fault { $call->($slot,0,13) } =~ /invalid UInt32 reply/;
my $before = $calls;
die unless fault { $call->($slot,4,11) } =~ /frame unavailable/;
die unless $calls - $before == 64 && $call->($slot,0,5) == 11;
my $pid = fork(); die 'fork failed' unless defined $pid;
if (!$pid) { require POSIX; POSIX::_exit(fault { $call->($slot,0,7) } =~ /foreign Perl owner/ ? 0 : 1); }
waitpid($pid,0); die "fork owner guard" if $?;
if ($Config{useithreads}) {
    require threads;
    my $ok = threads->create(sub { fault { $call->($slot,0,7) } =~ /foreign Perl owner/ })->join;
    die "thread owner guard" unless $ok;
}
my $mark = $first; weaken($mark); undef $first;
die "host frame leaked original exception" if defined $mark;
my $profile = $Config{useithreads} ? 'threaded' : 'unthreaded';
print "Perl $] ($profile), compiled Lean: reentry, original fault, mapped EIO, replacement IO, owner and cleanup\n";
