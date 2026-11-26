use v5.36;
use Scalar::Util qw(refaddr weaken);
use JSON::PP ();
use Time::HiRes qw(time);
use IO::Async::Loop::Poll;

die 'expected two independent packages' unless "@ARGV" eq 'Peer Workshop' || "@ARGV" eq 'Workshop Peer';
for my $short (@ARGV) {
    my $file="LeanBridge/$short.pm"; require $file;
    die 'wrong installed component' unless index($INC{$file},$ENV{EXPECT_PERL_LIB}.'/')==0;
}
my ($outer,$worker)=map {"LeanBridge::$_"} @ARGV;
my $hosts={Box=>'App::Meter'};
{ package App::Meter;
  sub new ($class,$value) { bless {value=>$value},$class }
  sub level ($self,@value) { $self->{value}=$value[0] if @value; $self->{value} }
  sub read ($self) { $self->{hook} ? $self->{hook}->() : $self->{value} }
  sub identity ($self) { $self }
  sub DESTROY ($self) { ++${$self->{drops}} if $self->{drops} }
}
sub failed ($f) {
    local $@;
    return $@ unless eval { $f->(); 1 };
    die "unexpected success\n";
}

my ($before,$after,$weak,$held,$drops);
$drops=0;
$outer->can('with_hosts')->($hosts,sub {
    $worker->can('with_hosts')->($hosts,sub {
        my $b=App::Meter->new(23); $b->{drops}=\$drops; $weak=$b; weaken($weak);
        my $value=$worker->can('outcome')->($b)->get;
        die 'returned Except lost identity' unless ref($value) eq $worker.'::Err' && refaddr($value->value)==refaddr($b);
        $held=failed(sub { $worker->can('refuse')->($b)->get });
        die 'wrong declared error' unless ref($held) eq $worker.'::Error::refuse' && refaddr($held->payload)==refaddr($b);
    });
    die 'binding closed over the last error payload' unless defined($weak) && !$drops;
    $before=$outer->can('read')->($held->payload);
    $after=$outer->can('update')->($held->payload,42);
    die 'peer did not mutate the sole error payload' unless $before==23 && $after==42;
    undef $held;
    die 'dropping the exception retained the object' unless !defined($weak) && $drops==1;
});

my ($reads,$calls,$native_id,$bad_id,$caught)=(0,0,0,0,0);
$outer->can('with_hosts')->($hosts,sub {
    $worker->can('with_hosts')->($hosts,sub {
        my $box=App::Meter->new(23); my $original=bless {},'App::Retryable';
        my $validation=failed(sub { $outer->can('update')->($box,-1) });
        die 'validation dispatched a mutation' unless !ref($validation) && $box->level==23;
        $box->{hook}=sub { die $original };
        die 'lost original host error' unless refaddr(failed(sub { $outer->can('read')->($box) }))==refaddr($original);
        my $mapped=failed(sub { $outer->can('mapped')->($box) });
        die 'Lean did not map the host error' unless ref($mapped) eq $outer.'::Error::mapped' && $mapped->payload eq 'host read failed';
        delete $box->{hook};
        die 'an ordinary error retired the runtime' unless $outer->can('read')->($box)==23;
        my $recovered=$worker->can('recover')->($box,sub { die $original })->get;
        die 'healthy worker did not recover' unless refaddr($recovered)==refaddr($box);

        # Inject one inconsistent acknowledgement at the boundary of the real
        # native worker. Never replace its trap, scheduler, take or close.
        my $start=$worker.'::_Retained::start';
        no strict 'refs'; no warnings 'redefine';
        my $real_start=\&{$start};
        local *{$start}=sub ($ops,$indices,$args) {
            my %copy=%$ops;
            $copy{fail}=sub (@args) {
                my $actual=$ops->{fail}->(@args);
                die 'unexpected native acknowledgement' unless $actual==1 && !$native_id;
                $native_id=$actual; return $bad_id=$actual+1;
            };
            return $real_start->(\%copy,$indices,$args);
        };
        my $argument=App::Meter->new(19);
        $box->{hook}=sub {
            ++$reads;
            my $error=failed(sub { $worker->can('recover')->($argument,sub { ++$calls; die $original })->get });
            die 'wrong mismatch diagnostic' unless !ref($error) && $error=~/Invalid retained Perl callback failure identity/;
            ++$caught; return 97;
        };
        my $stale=failed(sub { $outer->can('read')->($box) });
        die 'outer returned or obscured stale success' unless !ref($stale) && $stale=~/frame unavailable|component unavailable/i;
        for my $component ($worker,$outer) {
            my $next=failed(sub { $component->can('read')->($box) });
            die 'later synchronous work was not refused' unless !ref($next) && $next=~/unavailable/i;
            my $task=failed(sub { $component->can('scalar')->(1)->get });
            die 'later task was not refused' unless !ref($task) && $task=~/status 10|unavailable|retired/i;
        }
        die 'unexpected callback dispatch' unless $reads==1 && $calls==1 && $caught==1;
    });
});
my $s=LeanBridge::Runtime::_snapshot();
# The retired native worker may still be releasing its notification and
# callback handles after the Perl Future has already rejected its result.
my $deadline=time()+10;
my $loop=IO::Async::Loop::Poll->new;
while ($s->{live_identities} && time()<$deadline) {
    $loop->delay_future(after=>0.02)->get;
    $s=LeanBridge::Runtime::_snapshot();
}
die 'unbalanced broker: '.JSON::PP->new->canonical->encode($s) unless $s->{runtime_init_runs}==1 && $s->{live_identities}==0;
say JSON::PP->new->canonical->encode({outer=>$ARGV[0],worker=>$ARGV[1],before=>$before,after=>$after,
    destructions=>$drops,nativeFailureId=>$native_id,injectedFailureId=>$bad_id,caught=>$caught,
    reads=>$reads,workerCalls=>$calls,liveIdentities=>$s->{live_identities}});
