use v5.36;
use utf8;
use Test::More;
use Math::BigInt;
use Scalar::Util qw(refaddr weaken);
use Time::HiRes qw(time);
use POSIX ();
use Config;
use IO::Async::Loop::Poll;
use LeanBridge::Pulse;

my $loop=IO::Async::Loop::Poll->new;
sub wait_until ($check) {
    my $end=time()+25;
    until ($check->()) { die "timed out waiting for Lean" if time()>$end; $loop->delay_future(after=>0.01)->get }
}
sub error_from ($call) {
    my $ok=eval { $call->(); 1 }; my $e=$@;
    die "expected failure" if $ok;
    return $e;
}
sub identities () { LeanBridge::Runtime::_snapshot()->{live_identities} }
sub fds () { opendir(my $d,'/proc/self/fd') or die $!; return scalar grep { /^\d+$/ } readdir($d) }
my $text="雪\0🙂", my $octets="\xff\0b";
my $n=Math::BigInt->new(2)->bpow(257)->badd(9);
my $max=unpack('Q<',"\xff"x8);
my $min=unpack('q<',("\0"x7)."\x80");
for my $row ([unit=>undef],[bool=>!!1],[char=>'🙂'],[uint8=>255],[uint16=>65535],[uint32=>4294967295],[uint64=>$max],[usize=>$max],
             [int8=>-128],[int16=>-32768],[int32=>-2147483648],[int64=>$min],[isize=>$min],[nat=>$n],[int=>$n->copy->bneg],
             [string=>$text],[bytes=>$octets],[float32=>1.5],[float64=>-3.25]) {
    my ($type,$expected)=@$row;
    my $future=LeanBridge::Pulse->can("rt_$type")->($expected);
    isa_ok($future,'Future');
    is(refaddr($future->loop),refaddr($loop),"$type uses application loop");
    my @values=$future->get;
    is(scalar(@values),1,"$type delivered exactly one item"); is($values[0],$expected,"exact $type");
}
is(LeanBridge::Pulse::identity($text),$text,'pure companion is synchronous');
is(LeanBridge::Pulse::base($max),$max,'BaseIO companion is synchronous');
is(LeanBridge::Pulse::direct(!!0,'direct'),23,'direct EIO is not a Future');
like(error_from(sub { LeanBridge::Pulse::rt_uint8(999) }),qr/out of range/,'argument validation fails at the call');
is(LeanBridge::Pulse::bytes($octets)->get,$octets,'opaque bytes survive task');
my $returned=LeanBridge::Pulse::checked(!!0,!!1,'data')->get;
isa_ok($returned,'LeanBridge::Pulse::Err'); is($returned->value,'data','returned error is data');
my $factory=LeanBridge::Pulse::checked(!!1,!!0,'factory');
isa_ok($factory,'Future'); my $e=error_from(sub { $factory->get });
isa_ok($e,'LeanBridge::Pulse::Error::checked'); is($e->payload,'factory','typed factory failure');
is(refaddr($factory->failure),refaddr($e),'Future preserves the original error object');
$e=error_from(sub { LeanBridge::Pulse::io_task(!!1)->get }); isa_ok($e,'LeanBridge::Pulse::IOError');
is($e->declaration,'Pulse.ioTask','factory IO provenance');
$e=error_from(sub { LeanBridge::Pulse::terminal(!!1,$n)->get }); isa_ok($e,'LeanBridge::Pulse::TaskIOError');
is($e->declaration,'PerlTasks.terminal','terminal IO provenance');
$e=error_from(sub { LeanBridge::Pulse::wide(!!1,$n,$octets)->get }); isa_ok($e,'LeanBridge::Pulse::Error::wide');
isa_ok($e->payload,'LeanBridge::Pulse::Ok'); is($e->payload->value->bstr,$n->bstr,'typed factory owns arbitrary integer');

LeanBridge::Pulse::reset();
my $task=LeanBridge::Pulse::late(!!0,-71); my $other=LeanBridge::Pulse::late(!!0,31);
my $ticks=0; my $timer=$loop->delay_future(after=>0.03);
$timer->on_done(sub { ++$ticks; LeanBridge::Pulse::release() });
ok(!$task->is_ready && !$other->is_ready,'two genuine Lean tasks pending');
is($task->get,-71,'first delayed result'); is($other->get,31,'second delayed result');
is($ticks,1,'unrelated application timer advanced while waiting');
wait_until(sub { !identities() }); my $baseline=fds();
for my $coop (!!1,!!0) {
    LeanBridge::Pulse::reset(); my $f=LeanBridge::Pulse::late($coop,1);
    wait_until(sub { LeanBridge::Pulse::state()==1 });
    $f->cancel; ok($f->is_cancelled,'cancelled future');
    if ($coop) { wait_until(sub { LeanBridge::Pulse::state()==2 }) }
    else { LeanBridge::Pulse::release(); wait_until(sub { LeanBridge::Pulse::state()==3 }) }
    wait_until(sub { !identities() }); is(fds(),$baseline,'cancel drained native notification and host subscription');
}
LeanBridge::Pulse::reset();
my $lost=LeanBridge::Pulse::late(!!1,13); wait_until(sub { LeanBridge::Pulse::state()==1 });
my $weak=$lost; weaken($weak); undef $lost;
ok(!defined $weak,'loop does not keep abandoned future alive');
wait_until(sub { LeanBridge::Pulse::state()==2 && !identities() });
is(fds(),$baseline,'last-reference drop cancelled and released the abandoned task');
LeanBridge::Pulse::reset(); my $published=LeanBridge::Pulse::late(!!1,-5);
wait_until(sub { LeanBridge::Pulse::state()==1 }); $published->done(99);
is($published->get,99,'public completion wins over a later native result');
wait_until(sub { LeanBridge::Pulse::state()==2 && !identities() });
LeanBridge::Pulse::reset(); my $borrowed=LeanBridge::Pulse::late(!!1,11);
wait_until(sub { LeanBridge::Pulse::state()==1 });
my $pid=fork(); die "fork: $!" unless defined $pid;
if (!$pid) {
    local $SIG{ALRM}=sub { POSIX::_exit(3) }; alarm 4;
    my $err=error_from(sub { $borrowed->get }); POSIX::_exit($err=~/initiating process/?0:2);
}
waitpid($pid,0); is($?,0,'forked process refuses an inherited pending task without pumping the loop');
SKIP: {
    skip 'unthreaded Perl',1 unless $Config{useithreads}; require threads;
    my $error=threads->create(sub { error_from(sub { $borrowed->cancel }) })->join;
    like($error,qr/(?:initiating process|unblessed|undefined)/i,'foreign interpreter cannot cancel the original pending task');
}
$borrowed->cancel; wait_until(sub { LeanBridge::Pulse::state()==2 && !identities() });
{
    package Local::FalseError;
    use overload 'bool'=>sub { 0 }, '""'=>sub { 'false host error' }, fallback=>1;
}
my $false=bless {},'Local::FalseError'; my $failed;
{
    no warnings 'redefine'; local *Math::BigInt::new=sub { die $false };
    $failed=LeanBridge::Pulse::rt_int($n);
    my $err=error_from(sub { $failed->get }); is(refaddr($err),refaddr($false),'get preserves a false-valued host exception');
}
is(refaddr(scalar $failed->failure),refaddr($false),'failure preserves the same false-valued exception');
my $callback_error; $failed->on_fail(sub { $callback_error=shift });
is(refaddr($callback_error),refaddr($false),'on_fail receives the original exception object');
LeanBridge::Pulse::reset(); my $late_int=LeanBridge::Pulse::delayed_int($n);
wait_until(sub { LeanBridge::Pulse::state()==1 });
{
    no warnings 'redefine'; my $new=\&Math::BigInt::new;
    local *Math::BigInt::new=sub { $late_int->cancel; return $new->(@_) };
    LeanBridge::Pulse::release(); $loop->await($late_int);
}
ok($late_int->is_cancelled,'cancellation inside result conversion suppresses the late native value');
wait_until(sub { !identities() }); is(fds(),$baseline,'conversion/cancellation race cleaned the native owner exactly once');

my $before=LeanBridge::Pulse::pulls(); my $closes=LeanBridge::Pulse::closes();
my $cursor=LeanBridge::Pulse::series(!!0,!!0,$text);
isa_ok($cursor,'LeanBridge::Pulse::Cursor'); is(LeanBridge::Pulse::pulls(),$before,'creating cursor demands no items');
my @first=$cursor->next->get; is(scalar @first,1,'one item per demand'); isa_ok($first[0],'LeanBridge::Pulse::Err'); is($first[0]->value,$text,'returned item, not stream failure');
my @second=$cursor->next->get; isa_ok($second[0],'LeanBridge::Pulse::Ok'); is($second[0]->value,73,'second item');
my @end=$cursor->next->get; is(scalar @end,0,'exhaustion returns an empty list');
@end=$cursor->next->get; is(scalar @end,0,'no extra native pull after end');
is(LeanBridge::Pulse::pulls()-$before,3,'no prefetch'); is(LeanBridge::Pulse::closes()-$closes,1,'exactly one Lean close at exhaustion');
my $bad=LeanBridge::Pulse::series(!!1,!!0,'x'); $bad->next->get;
$e=error_from(sub { $bad->next->get }); isa_ok($e,'LeanBridge::Pulse::StepError::series');
is($e->declaration,'Pulse.next','step provenance'); is($e->payload,413,'exact step error');
my $early=LeanBridge::Pulse::series(!!0,!!0,'early'); $early->next->get; $closes=LeanBridge::Pulse::closes();
undef $early; is(LeanBridge::Pulse::closes(),$closes+1,'early scope exit closes cursor');
LeanBridge::Pulse::reset(); my $paused=LeanBridge::Pulse::series(!!0,!!1,'pending'); my $pull=$paused->next;
wait_until(sub { LeanBridge::Pulse::state()==1 });
like(error_from(sub { $paused->next->get }),qr/already pending/,'second demand cannot steal the pending item');
$paused->close; ok($pull->is_cancelled,'closing a pending cursor cancels its future');
LeanBridge::Pulse::release(); wait_until(sub { !identities() });
is(fds(),$baseline,'all stream gates and watches closed');
done_testing;
