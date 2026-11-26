use v5.36;
BEGIN { $ENV{LEAN_NUM_THREADS}=4 }
use Config ();
use JSON::PP ();
use Scalar::Util qw(refaddr weaken);
use IO::Async::Loop::Poll;
use LeanBridge::Budget;

sub check ($ok,$why) { die "$why\n" unless $ok }
sub caught ($type,$call) {
    my $ok=eval { $call->(); 1 }; my $e=$@;
    die "expected $type\n" if $ok;
    check(ref($e) eq $type,"expected $type, got ".ref($e)); return $e;
}
sub denied ($declaration,$call) {
    my $e=caught('LeanBridge::Budget::CallbackAlreadyInvoked',$call);
    check($e->declaration eq $declaration && $e->message eq 'callback-already-invoked','wrong refusal');
    return $e;
}
my $loop=IO::Async::Loop::Poll->new;
my ($calls,$many)=(0,0); my ($weak,$registration);
{
    my $owner={}; $weak=$owner; weaken($weak);
    $registration=LeanBridge::Budget::RetainedCallback->new(sub ($n) { $owner->{n}=$n; ++$calls; $n+1 });
}
my $f=$registration->callback;
denied('Budget.probe',sub { LeanBridge::Budget::probe(1,$f,sub ($n) { ++$many; $n+1 })->get });
check($calls==1 && $many==2,'wrong slot or repeated worker dispatch');
check(LeanBridge::Budget::pair(40,$f,$f)->get==42,'allowance was shared across two slots');
my $a=LeanBridge::Budget::single(3,$f); my $b=LeanBridge::Budget::single(41,$f);
check($b->get==42 && $a->get==4 && $calls==5,'allowance was shared across tasks');
{ package Application::Error; use overload '""'=>sub { 'callback-already-invoked' },fallback=>1; }
my $original=bless {},'Application::Error'; my $failed=0;
my $boom=sub ($n) { ++$failed; die $original };
denied('Budget.retry',sub { LeanBridge::Budget::retry(1,$boom)->get });
check($failed==1,'caught failure did not spend the allowance');
check(refaddr(caught(ref($original),sub { LeanBridge::Budget::single(1,$boom)->get }))==refaddr($original),'original replaced');
my $earlier=denied('Racing.duringStart',sub { LeanBridge::Budget::during_start(1,$f)->get });
check(refaddr(caught(ref($earlier),sub { LeanBridge::Budget::single(1,sub ($n) { die $earlier })->get }))==refaddr($earlier),'prior refusal replaced');
my $factory=caught('LeanBridge::Budget::IOError',sub { LeanBridge::Budget::start(0,$f)->get });
my $end=caught('LeanBridge::Budget::TaskIOError',sub { LeanBridge::Budget::replace(1,$f)->get });
check($factory->declaration eq 'FactoryFault.start' && $end->declaration eq 'Racing.replace','wrong IO phase');
for ($factory,$end) { check(index($_->message,'callback-already-invoked')>=0,'unexpected IO error') }
my $before=$calls;
my $typed=caught('LeanBridge::Budget::Error::checked',sub { LeanBridge::Budget::checked(0,$f)->get });
check($typed->declaration eq 'TypedBudget.checked' && $typed->payload==73 && $calls==$before,'wrong typed error');
denied('TypedBudget.checked',sub { LeanBridge::Budget::checked(1,$f)->get });
check($calls==$before+1,'typed task did not admit one call');
for my $n (1..16) {
    my $start=$calls; denied('Racing.race',sub { LeanBridge::Budget::race($n,$f)->get });
    check($calls==$start+1,'two racing workers entered the callback');
}
check(defined($weak) && $registration->close && !defined($weak),'retained capture not released');
my $snapshot=LeanBridge::Runtime::_snapshot();
check($snapshot->{runtime_init_runs}==1,'extra runtime');
for (qw(live_identities live_wrappers live_callbacks live_scopes)) { check($snapshot->{$_}==0,"leaked $_") }
print JSON::PP->new->canonical->encode({perl=>sprintf('%vd',$^V),threads=>$Config::Config{useithreads}?1:0,
    abiKey=>LeanBridge::Runtime::Platform::abi_key(),races=>16,live=>0}),"\n";
