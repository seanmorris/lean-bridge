use v5.36;
use Scalar::Util qw(refaddr weaken);
use LeanBridge::Workshop;

{ package App::Box;
  sub new ($class,$value) { bless {v=>$value},$class }
  sub read ($self) { $self->{v} }
  sub level ($self,@v) { $self->{v}=$v[0] if @v; $self->{v} }
  sub identity ($self) { $self }
}
my $hosts={Box=>'App::Box'};
my $box=App::Box->new(8);
die 'scalar requires a binding' unless LeanBridge::Workshop::scalar(41)->get==42;
my $outside=eval { LeanBridge::Workshop::echo($box); 1 };
die 'class worker started outside a binding' if $outside || $@!~/No active Perl worker binding/;
my ($cold,$weak,$late,$ran,$observer,$got);
my @scope=LeanBridge::Workshop::with_hosts($hosts,sub {
    my $copy=App::Box->new(8);
    $got=LeanBridge::Workshop::relay($box,sub ($arg) {
        die 'callback argument identity' unless refaddr($arg)==refaddr($box);
        die 'synchronous reentry' unless LeanBridge::Workshop::read($arg)==8;
        return $copy;
    })->get;
    die 'changed callback reply' unless refaddr($got)==refaddr($copy);
    my $error=bless {},'App::Fault';
    my $ok=eval { LeanBridge::Workshop::relay($box,sub { die $error })->get; 1 };
    die 'lost original callback exception' if $ok || refaddr($@)!=refaddr($error);
    die 'recovered callback failure leaked' unless refaddr(LeanBridge::Workshop::recover($box,sub { die $error })->get)==refaddr($box);
    my $returned=LeanBridge::Workshop::outcome($box)->get;
    die 'returned Except is not a value' unless $returned->isa('LeanBridge::Workshop::Err') && refaddr($returned->value)==refaddr($box);
    $ok=eval { LeanBridge::Workshop::refuse($box)->get; 1 }; my $declared=$@;
    die 'lost declared factory payload' if $ok || ref($declared) ne 'LeanBridge::Workshop::Error::refuse'
        || refaddr($declared->payload)!=refaddr($box);
    for my $fail (!!0,!!1) {
        my $cursor=LeanBridge::Workshop::boxes($box,$fail);
        die 'first demand lost the object' unless refaddr($cursor->next->get)==refaddr($box);
        my @end; $ok=eval { @end=$cursor->next->get; 1 }; my $step=$@;
        if ($fail) {
            die 'wrong declared step failure' if $ok || ref($step) ne 'LeanBridge::Workshop::StepError::boxes'
                || refaddr($step->payload)!=refaddr($box);
        } else { die 'no exhaustion' unless $ok && !@end }
    }
    my $io=LeanBridge::Workshop::io_boxes($box); $io->next->get;
    $ok=eval { $io->next->get; 1 }; my $failure=$@;
    die 'IO step confused with declared failure' if $ok || ref($failure) ne 'LeanBridge::Workshop::IOError'
        || $failure->declaration ne 'Jobs.ioNext' || $failure->message!~/Perl cursor ended/;
    my $temp=App::Box->new(3); $weak=$temp; weaken($weak);
    $cold=LeanBridge::Workshop::boxes($temp,!!0);
    $late=LeanBridge::Workshop::relay($box,sub { ++$ran; $box });
    $late->on_ready(sub {
        my $started=eval { LeanBridge::Workshop::echo($box); 1 };
        $observer=!$started && $@=~/No active Perl worker binding/;
    });
    return (4,6);
});
die 'lost caller context' unless "@scope" eq '4 6';
die 'late callback after close' if $ran || !$late->is_cancelled || !$observer;
my @end=$cold->next->get;
die 'cold cursor retained application inputs or ran after close' if @end || defined $weak;
my $outer=bless {},'App::OuterFault';
my ($abandoned,$escaped,$called);
my $ok=eval {
    LeanBridge::Workshop::with_hosts($hosts,sub {
        my $fresh=App::Box->new(19); $escaped=$fresh; weaken($escaped);
        $abandoned=LeanBridge::Workshop::relay($fresh,sub { ++$called; $_[0] });
        die $outer;
    });
    1;
};
die 'unwind replaced the original exception' if $ok || refaddr($@)!=refaddr($outer);
die 'abandoned work survived a throwing binding' if !$abandoned->is_cancelled || $called || defined $escaped;
my $again=LeanBridge::Workshop::with_hosts($hosts,sub {
    return LeanBridge::Workshop::echo($box)->get;
});
die 'failed binding prevented fresh use' unless refaddr($again)==refaddr($box);
die 'scoped failure retired scalar calls' unless LeanBridge::Workshop::scalar(0)->get==1;
say 'Generated Perl Future and Cursor APIs preserved objects and failures, demand, reentry and scoped cancellation';
