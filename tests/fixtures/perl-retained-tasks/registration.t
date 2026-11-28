use v5.36;
use Test::More;
use Scalar::Util qw(refaddr weaken);
use LeanBridge::Runtime;
use POSIX ();
use Config;

# For the standalone lifetime check the namespace-specific class is rendered
# into a private file supplied by the producer. Context enforcement is always
# the actual installed runtime XS, never a test double.
if (@ARGV) { require $ARGV[0] }
else { require LeanBridge::Retained }
my $class='LeanBridge::Retained::RetainedCallback';
sub error_from ($fn) { my $ok=eval { $fn->(); 1 }; my $e=$@; die "expected failure" if $ok; return $e }
like(error_from(sub { $class->new(5) }),qr/CODE reference/,'refuses an invalid host callable');
my $owner;
$owner=$class->new(sub ($n) { ok($owner->close,'can close inside active call'); return $n+1 });
my $call=$owner->callback;
is($call->(41),42,'in-flight invocation completes after self-close');
ok($owner->closed,'registration closed'); ok(!$owner->close,'close is idempotent');
like(error_from(sub { $call->(7) }),qr/closed/,'borrowed CODE sees revocation');
my $exception=bless {},'Local::Fault';
my $fail=$class->new(sub { die $exception });
is(refaddr(error_from(sub { $fail->callback->(3) })),refaddr($exception),'registration preserves exception identity');
my $kept=$class->new(sub ($n) { $n+2 })->callback;
is($kept->(40),42,'outstanding CODE retains callable after wrapper collection');
my $target=bless {},'Local::Payload'; my $weak=$target; weaken($weak);
my $closure=do { my $p=$target; sub { $p } };
my $lease=$class->new($closure); undef $target; undef $closure;
ok(defined($weak),'registration retains captured state');
my $old=$lease->callback; $lease->close; ok(!defined($weak),'closing releases captures even if CODE is retained');
my $pid=fork(); die "fork: $!" unless defined $pid;
if (!$pid) {
    my $e=error_from(sub { $kept->(1) });
    POSIX::_exit($e=~/initiating process/?0:1);
}
waitpid($pid,0); is($?,0,'child cannot enter an inherited callback');
my $guarded=$class->new(sub ($n) { $n+3 });
my $borrowed=$guarded->callback;
my ($wrapper1,$wrapper2,$code1,$code2)=($guarded,$guarded,$borrowed,$borrowed);
weaken($_) for ($wrapper1,$wrapper2,$code1,$code2);
SKIP: {
    skip 'unthreaded Perl',4 unless $Config{useithreads}; require threads;
    my @errors=threads->create({context=>'list'},sub {
        return map { local $@; eval { $_->(); 1 } ? '' : "$@" }
            sub { $borrowed->(2) }, sub { $guarded->close },
            sub { $guarded->callback }, sub { $guarded->closed };
    })->join;
    my @labels=('cannot invoke borrowed CODE','cannot close registration','cannot acquire callback','cannot inspect owner state');
    like($errors[$_],qr/initiating process|interpreter|thread/i,'foreign interpreter '.$labels[$_]) for 0..3;
}
ok(!$guarded->closed,'owner still holds its live registration after clone');
is($borrowed->(39),42,'owner still calls the same CODE');
$guarded->close; undef $guarded; undef $borrowed;
ok(!defined($wrapper1) && !defined($wrapper2) && !defined($code1) && !defined($code2),'all weak observers cleared after final release');
done_testing;
