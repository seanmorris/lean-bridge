use v5.36;
use IO::Async::Loop::Poll;
use Math::BigInt;
use Time::HiRes qw(time);

my $loop=IO::Async::Loop::Poll->new;
sub check ($ok,$why) { die "$why\n" unless $ok }
sub until_ready ($predicate) {
    my $deadline=time()+25;
    until ($predicate->()) {
        die "timed out waiting for Lean\n" if time()>$deadline;
        $loop->delay_future(after=>0.01)->get;
    }
}
sub descriptors () { opendir(my $d,'/proc/self/fd') or die $!; scalar grep { /^\d+$/ } readdir($d) }
sub owners () { LeanBridge::Runtime::_snapshot()->{live_identities} }
sub peer () {
    my $s=LeanBridge::Signals::constant(Math::BigInt->new(9));
    check($s->next->get==9,'independent cursor failed'); $s->close;
}
if ($ARGV[0] eq 'peer-first') { require LeanBridge::Signals; peer(); require LeanBridge::Pulse; }
elsif ($ARGV[0] eq 'pulse-first') { require LeanBridge::Pulse; LeanBridge::Pulse::reset(); require LeanBridge::Signals; peer(); }
else { die "expected a package load order"; }
check(LeanBridge::Runtime::_snapshot()->{runtime_init_runs}==1,'packages did not share one runtime');
LeanBridge::Pulse::bytes('warm')->get; until_ready(sub { !owners() }); my $baseline=descriptors();
for my $stop ('cancel-read','close-cursor') {
    LeanBridge::Pulse::reset(); my $closes=LeanBridge::Pulse::closes(); my $pulls=LeanBridge::Pulse::pulls();
    my $stream=LeanBridge::Pulse::series(!!0,!!1,'late'); my $read=$stream->next;
    my ($succeeded,$failed,$cancelled,$settled)=(0,0,0,0);
    $read->on_done(sub { ++$succeeded }); $read->on_fail(sub { ++$failed });
    $read->on_cancel(sub { ++$cancelled }); $read->on_ready(sub { ++$settled });
    until_ready(sub { LeanBridge::Pulse::state()==1 });
    check(!$read->is_ready && LeanBridge::Pulse::pulls()==$pulls+1,'first pull never parked');
    my $second=$stream->next; check($second->is_failed && $second->failure =~ /already pending/,'second demand stole first pull');
    if ($stop eq 'cancel-read') { $read->cancel; } else { $stream->close; }
    check($read->is_cancelled && $cancelled==1 && $settled==1,'pending reader did not cancel exactly once');
    check(LeanBridge::Pulse::closes()==$closes+1 && LeanBridge::Pulse::state()==1,'Lean finalizer did not run while worker remained parked');
    peer(); check(LeanBridge::Pulse::state()==1,'peer released the blocked worker');
    my @end=$stream->next->get; check(!@end && LeanBridge::Pulse::pulls()==$pulls+1,'terminal cursor admitted another pull');
    LeanBridge::Pulse::release(); until_ready(sub { LeanBridge::Pulse::state()==3 && !owners() });
    $loop->delay_future(after=>0.01)->get;
    $read->cancel; $stream->close; $stream->close;
    check(!$succeeded && !$failed && $cancelled==1 && $settled==1,'late result or duplicate settlement');
    check(LeanBridge::Pulse::closes()==$closes+1 && descriptors()==$baseline,'finalizer or event descriptors did not return to baseline');
}
print "blocked pull: reader cancel and cursor close each finalized once; usable peer, no late value, zero live owners and descriptor delta\n";
