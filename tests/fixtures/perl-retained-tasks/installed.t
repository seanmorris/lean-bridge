use v5.36;
use utf8;
use Test::More;
use Math::BigInt;
use IO::Async::Loop::Poll;
use Scalar::Util qw(refaddr weaken);
use Time::HiRes qw(time);
use LeanBridge::Retained;

# The Retained.lean fixture requests callbacks from real Lean workers and from
# the task factory. A consumer supplies normal Perl subs; it never polls an ABI.
my $loop = IO::Async::Loop::Poll->new;
my $max=unpack('Q<',"\xff"x8);
my $min=unpack('q<',("\0"x7)."\x80");
my $wide=Math::BigInt->new(2)->bpow(270)->badd(5);
my @carriers=(undef,!!1,'🙂',"雪\0🙂","\xff\0\x01",$wide,$wide->copy->bneg,255,65535,
              4294967295,$max,$max,-128,-32768,-2147483648,$min,$min,1.5,-3.25,undef);
my @seen;
my @callbacks=map {
    my $slot=$_;
    sub ($value) {
        push @seen,$slot;
        is($value,$carriers[$slot],"exact callback input at slot $slot");
        return $carriers[$slot+1];
    }
} 0..18;
my @unit=LeanBridge::Retained::scalar_tour(@callbacks)->get;
is_deeply(\@unit,[undef],'task delivered exactly one Unit after all nineteen callback replies');
is_deeply(\@seen,[0..18],'callbacks ran in the actual Lean request order');
my @order;
my $joined = LeanBridge::Retained::during_start(
    sub ($s) { push @order, 'f'; return $s . 'f' },
    sub ($s) {
        push @order, 'g';
        is(LeanBridge::Retained::plain(41), 42, 'callback reenters an ordinary export');
        return LeanBridge::Retained::repeat_call($s, sub ($v) { $v . 'g' })->get;
    }, 'a');
is(refaddr($joined->loop), refaddr($loop), 'factory and worker use application loop');
is($joined->get, 'afggf', 'nested wait dispatches a different retained owner');
is_deeply(\@order, [qw(f g f)], 'callbacks before and after start execute in order');

{ package Local::Fault; use overload '""' => sub { 'identical' }, fallback => 1; }
my $fault = bless {}, 'Local::Fault';
sub error_from ($call) {
    my $ok = eval { $call->(); 1 }; my $error = $@;
    die 'expected a failed call' if $ok; return $error;
}
my $orig = error_from(sub { LeanBridge::Retained::repeat_call('x', sub { die $fault })->get });
is(refaddr($orig), refaddr($fault), 'uncaught callback error preserves Perl object identity');
{ package Local::FalseFault; use overload 'bool'=>sub { 0 }, '""'=>sub { 'false fault' }, fallback=>1; }
my $false=bless {},'Local::FalseFault';
my $false_future=LeanBridge::Retained::repeat_call('x',sub { die $false });
my $false_error=error_from(sub { $false_future->get });
is(refaddr($false_error),refaddr($false),'false-valued original exception survives the worker round trip');
is(refaddr(scalar $false_future->failure),refaddr($false),'failed future exposes that same object');
my $native_error=Future::Exception->new('categorised','original',7);
my $native_future=LeanBridge::Retained::repeat_call('x',sub { die $native_error });
my $reported;
$native_future->on_fail(sub ($error,@rest) { $reported=$error });
is(refaddr(error_from(sub { $native_future->get })),refaddr($native_error),'Future::Exception is not decomposed and reconstructed by the scheduler');
is(refaddr($reported),refaddr($native_error),'on_fail receives the original object');
my @source=map { bless {},'Local::Fault' } 1..2;
my @settled=(0,0);
my @simultaneous=map {
    my $i=$_;
    LeanBridge::Retained::repeat_call('x',sub { die $source[$i] })
        ->on_ready(sub { ++$settled[$i] });
} 0..1;
for my $i (1,0) {
    is(refaddr(error_from(sub { $simultaneous[$i]->get })),refaddr($source[$i]),
       "native failure identity belongs to owner $i even with identical diagnostic text");
}
is_deeply(\@settled,[1,1],'concurrent failing callback owners each settled exactly once');
{ package Local::OverloadedFault;
  our $touches=0;
  use overload 'bool'=>sub { ++$touches; die 'unexpected bool conversion' },
               '""'=>sub { ++$touches; die 'unexpected string conversion' },fallback=>1;
}
my $hostile=bless {},'Local::OverloadedFault';
my $hostile_future=LeanBridge::Retained::repeat_call('x',sub { die $hostile });
is(refaddr(error_from(sub { $hostile_future->get })),refaddr($hostile),'exception can round-trip without coercion');
is($Local::OverloadedFault::touches,0,'bridge did not invoke host conversion hooks while reporting failure');
my $caught = LeanBridge::Retained::recover(sub { die $fault }, Math::BigInt->bone)->get;
isa_ok($caught, 'LeanBridge::Retained::Err');
is($caught->value, 'caught in Lean', 'caught host error does not fail the future');
my $replacement = error_from(sub { LeanBridge::Retained::replace_error(sub { die $fault })->get });
isa_ok($replacement, 'LeanBridge::Retained::TaskIOError');
isnt(refaddr($replacement), refaddr($fault), 'matching text does not resurrect a replaced exception');
my $started=0;
my $early=error_from(sub { LeanBridge::Retained::typed_start(sub { ++$started; 'x' },!!1,'v')->get });
isa_ok($early,'LeanBridge::Retained::Error::typed_start');
is($early->payload,'factory refused','typed factory error retains its payload');
is($started,0,'failed factory did not invoke Perl');
my $factory=error_from(sub { LeanBridge::Retained::early(!!1,sub { ++$started })->get });
is(ref($factory),'LeanBridge::Retained::IOError','IO factory failure is not a terminal task failure');
is($factory->message,'early Ruby factory','factory message comes from the shared Lean fixture');
is($started,0,'rejected IO factory never ran Perl');
my $bad_reply=error_from(sub { LeanBridge::Retained::repeat_call('x',sub { [] })->get });
ok(!ref($bad_reply),'invalid reply is a boundary error, not a declared Lean failure');
is(LeanBridge::Retained::plain(5),6,'wrong reply released its owner without poisoning the runtime');
my $self_wait;
$self_wait=LeanBridge::Retained::repeat_call('x',sub { $self_wait->get });
like(error_from(sub { $self_wait->get }),qr/own pending task/,'callback cannot deadlock waiting on its own owner');
my $self_cancel; my $visits=0;
$self_cancel=LeanBridge::Retained::repeat_call('x',sub { ++$visits; $self_cancel->cancel; 'ignored' });
eval { $self_cancel->get };
ok($self_cancel->is_cancelled,'callback may cancel its own owner');
is($visits,1,'cancelled owner did not dispatch a second invocation');
{
    package Local::CancelInt;
    our @ISA=('Math::BigInt');
    our $hook;
    sub as_hex ($self) { $hook->(); return $self->SUPER::as_hex }
}
my ($convert_calls,$conversion)=(0);
{
    local $Local::CancelInt::hook=sub { ++$convert_calls; $conversion->cancel };
    $conversion=LeanBridge::Retained::recover(sub { Local::CancelInt->new(7) },Math::BigInt->bone);
    eval { $conversion->get };
}
ok($conversion->is_cancelled,'cancellation during a host reply conversion wins over the reply');
is($convert_calls,1,'reentrant scalar conversion ran exactly once');
is(LeanBridge::Retained::plain(14),15,'reentrant reply cancellation did not retire the runtime');
my $registration;
$registration=LeanBridge::Retained::RetainedCallback->new(sub ($n) { $registration->close; return $n+3 });
is(LeanBridge::Retained::once(7,$registration->callback)->get,10,'self-revocation permits the reply already in flight');
like(error_from(sub { LeanBridge::Retained::once(7,$registration->callback)->get }),qr/closed/,'subsequent invocation sees revocation');

my $calls = 0;
is(LeanBridge::Retained::remember(sub { ++$calls; 5 })->get, 17, 'Lean kept a callback past task completion');
my $expired = error_from(sub { LeanBridge::Retained::use_expired()->get });
isa_ok($expired, 'LeanBridge::Retained::TaskIOError');
is($calls, 0, 'expired retained callback cannot invoke Perl');
LeanBridge::Retained::forget();
LeanBridge::Retained::reset();
my $queued = LeanBridge::Retained::queued(sub { ++$calls; 8 });
my $deadline = time() + 25;
while (LeanBridge::Retained::state() != 3) {
    die 'worker did not reach its queue' if time() > $deadline;
    $loop->delay_future(after => 0.01)->get;
}
$queued->cancel;
LeanBridge::Retained::release();
while (LeanBridge::Retained::state() != 4) {
    die 'worker did not observe revocation' if time() > $deadline;
    $loop->delay_future(after => 0.01)->get;
}
ok($queued->is_cancelled, 'cancelled worker cannot settle the future again');
is($calls, 0, 'cancelled worker cannot call the released Perl sub');
LeanBridge::Retained::reset();
my $late=LeanBridge::Retained::cancel_late(sub { ++$calls; 6 });
sub wait_phase ($wanted) {
    my $end=time()+25;
    until (LeanBridge::Retained::state()==$wanted) {
        die "timed out waiting for phase $wanted" if time()>$end;
        $loop->delay_future(after=>0.01)->get;
    }
}
wait_phase(1);
$late->cancel;
LeanBridge::Retained::release();
wait_phase(2);
ok($late->is_cancelled,'cancel propagates to a native worker created after its owner cancelled');
is($calls,0,'late worker never invoked its revoked Perl callback');
LeanBridge::Retained::reset();
my $observer;
{
    my $discard=LeanBridge::Retained::queued(sub { ++$calls; 11 });
    $observer=$discard; weaken($observer);
    wait_phase(3);
    ok(!$discard->is_ready,'worker is pending as its last public owner is released');
}
ok(!defined($observer),'native callback watch does not retain an abandoned future');
LeanBridge::Retained::release();
wait_phase(4);
is($calls,0,'worker observed revocation after the future went out of scope without cancel');
is(LeanBridge::Runtime::_snapshot()->{live_identities}, 0, 'all native owners released');
done_testing;
