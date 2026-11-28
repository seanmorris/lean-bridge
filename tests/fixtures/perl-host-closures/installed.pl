use v5.36;
use Config;
use Scalar::Util qw(refaddr reftype weaken);
use LeanBridge::Workshop ();

{ package App::Meter;
  sub new ($class,$n) { bless {value=>$n},$class }
  sub read ($x) { $x->{read}->() if $x->{read}; $x->{value} }
  sub level ($x,@n) { $x->{value}=$n[0] if @n; $x->{value} }
  sub identity ($x) { $x }
  our %destroyed;
  sub DESTROY ($x) { ++$destroyed{$x->{label}} if defined $x->{label} }
}
{ package App::Fault; use overload 'bool'=>sub {0},'""'=>sub {die "stringified a host exception"},fallback=>1; }
sub failure :prototype(&) ($body) { local $@;return $@ unless eval {$body->();1};die "missing exception" }
sub check ($condition,$label) { die "failed: $label" unless $condition }
sub same ($a,$b) { refaddr($a)==refaddr($b) }
sub capture ($label) {
    my $x=LeanBridge::Workshop::make(40);$x->{label}=$label;
    return LeanBridge::Workshop::reader($x);
}
my $bind={Box=>'App::Meter'};
my $stale;
LeanBridge::Workshop::with_hosts($bind,sub {
    my $x=LeanBridge::Workshop::make(11);my $y=LeanBridge::Workshop::make(12);
    my $fn=LeanBridge::Workshop::remember($x);my $other=capture('sibling');
    check(reftype($fn) eq 'CODE' && same($fn->($y),$x),'typed native coderef');
    check(failure {$fn->(bless {},'Wrong')} =~ /wrong nominal/,'wrong application type');
    check(failure {LeanBridge::Workshop::Returned::reader::close($fn)} =~ /invalid or foreign/,'wrong-site close');
    my $error=bless {},'App::Fault';
    {
        local $y->{read}=sub {die $error};
        check(same(failure {LeanBridge::Workshop::remember($y)},$error),'original factory error');
        check(same(failure {$fn->($y)},$error),'original invocation error');
    }
    check($other->(2)==42,'scalar reply');
    my $identity=LeanBridge::Workshop::identity_reader($y);
    check(same($identity->(0),$y),'nominal reply');
    {
        local $y->{read}=sub {
            check($other->(3)==43,'reentry through sibling');
            $fn->close;check(failure {$fn->($y)} =~ /expired/,'revocation during invocation');
        };
        check(same($fn->($y),$x),'in-flight result');
    }
    $fn->close;
    my $gone=capture('explicit');$gone->close;$gone->close;
    check(($App::Meter::destroyed{explicit}//0)==1,'explicit release exactly once');
    { my $forgotten=capture('dropped');check($forgotten->(7)==47,'capture held'); }
    check(($App::Meter::destroyed{dropped}//0)==1,'last reference release');
    my $pid=fork();die "fork: $!" unless defined $pid;
    if(!$pid) {
        require POSIX;
        my $ok=eval {$other->(1);1};my $closed=eval {$other->close;1};
        POSIX::_exit(!$ok && !$closed ? 0 : 1);
    }
    waitpid($pid,0);check($?==0 && $other->(1)==41,'fork cannot use parent coderef');
    if($Config{useithreads}) {
        require threads;
        my $thread=threads->create(sub {
            my $ok=eval {$other->(1);1};my $closed=eval {$other->close;1};return !$ok && !$closed;
        });
        check($thread->join && $other->(1)==41,'ithread cannot use or release parent coderef');
    }
    $stale=capture('orphan');
});
check(($App::Meter::destroyed{orphan}//0)==1 && ($App::Meter::destroyed{sibling}//0)==1,'scope releases each remaining capture');
check(failure {$stale->(0)} =~ /no active|expired/,'no call outside binding');
my $thrown=bless {},'App::Fault';my $abandoned;
my $caught=failure {
    LeanBridge::Workshop::with_hosts($bind,sub { $abandoned=capture('unwind');die $thrown });
};
check(same($caught,$thrown) && ($App::Meter::destroyed{unwind}//0)==1,'exceptional scope exit revokes once and preserves original');
LeanBridge::Workshop::with_hosts($bind,sub {
    check(failure {$stale->(0)} =~ /expired/,'fresh binding cannot revive function');$stale->close;
    check(failure {$abandoned->(0)} =~ /expired/,'unwound binding cannot revive function');$abandoned->close;
    check(capture('new')->(2)==42,'new binding works');
});
print "Perl: identity, original exceptions, self-close, process isolation and scoped cleanup passed\n";
