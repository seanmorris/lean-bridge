use v5.36;
use Scalar::Util qw(refaddr weaken);
use LeanBridge::Workshop ();
use LeanBridge::Peer ();

{ package App::Meter;
  sub new ($class,$n) { bless {value=>$n},$class }
  sub read ($x) { $x->{hook}->() if $x->{hook}; $x->{value} }
  sub level ($x,@n) { $x->{value}=$n[0] if @n; $x->{value} }
  sub identity ($x) { $x }
}
sub check ($cond,$name) { die "failed: $name" unless $cond }
sub same ($a,$b) { refaddr($a)==refaddr($b) }
my $host={Box=>'App::Meter'};
LeanBridge::Workshop::with_hosts($host,sub {
    my $x=LeanBridge::Workshop::make(10);my $y=LeanBridge::Workshop::make(20);
    my $f=LeanBridge::Workshop::remember($x);
    check(same(LeanBridge::Workshop::relay($y,$f)->get,$x),'actual coderef in retained callback');
    check(same(LeanBridge::Workshop::echo_box($x)->get,$x),'task identity');
    my $err=bless {},'App::Failure';
    { local $y->{hook}=sub {die $err};
      my $ok=eval {LeanBridge::Workshop::relay($y,$f)->get;1};
      check(!$ok && same($@,$err),'original member failure survives Future');
    }
    my $read=LeanBridge::Workshop::file_reader();
    my $ok=eval {$read->('missing');1};my $io=$@;
    check(!$ok && ref($io) eq 'LeanBridge::Workshop::IOError' && $io->declaration eq 'Closures.fileReader','inner IO.Error');
    for my $value ('first','another') {
        open my $fh,'>','state' or die $!;print {$fh} $value;close $fh or die $!;
        check($read->('state') eq $value,'independent file reads');
    }
    my ($stale,$weak,$victim,$survivor,$ran,$completed);
    LeanBridge::Peer::with_hosts($host,sub {
        my $z=LeanBridge::Peer::make(30);$weak=$z;weaken($weak);
        $stale=LeanBridge::Peer::remember($z);
        check(same($stale->($x),$z) && same($f->($z),$x),'two independent lexical owners');
        $victim=LeanBridge::Peer::relay($y,sub {++$ran;$stale->($_[0])});
        $survivor=LeanBridge::Workshop::relay($y,sub {++$completed;$f->($_[0])});
    });
    check($victim->is_cancelled && !$ran,'pending sibling binding cancelled');
    check(!defined $weak,'captured object released even with escaped coderef');
    check(!eval {$stale->($y);1},'no invocation beyond closed peer');
    check(same($survivor->get,$x) && $completed==1,'sibling callback completes once');
    check($victim->is_cancelled && !$ran,'no late delivery');
});
say 'Perl worker: returned callbacks, original errors, file effects and independent binding cancellation passed';
