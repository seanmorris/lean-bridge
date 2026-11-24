use v5.36;
use Scalar::Util qw(refaddr weaken);
my @order=@ARGV;
die 'bad load order' unless "@order" eq 'Peer Workshop' || "@order" eq 'Workshop Peer';
for my $short (@order) {
    my $file="LeanBridge/$short.pm"; require $file;
    die 'consumer did not use the relocated package' unless index($INC{$file},$ENV{EXPECT_PERL_LIB}.'/')==0;
}
{ package App::Box;
  sub new ($class,$value) { bless {v=>$value},$class }
  sub read ($self) { $self->{v} }
  sub level ($self,@v) { $self->{v}=$v[0] if @v; $self->{v} }
  sub identity ($self) { $self }
}
die 'one component substituted its scalar provider' unless LeanBridge::Workshop::scalar(5)->get==6 && LeanBridge::Peer::scalar(5)->get==42;
my $host={Box=>'App::Box'};
my ($weak,$got,$ran,$pending,$parked);
LeanBridge::Workshop::with_hosts($host,sub {
    my $box=LeanBridge::Workshop::make(35); $weak=$box; weaken($weak);
    my $waiting;
    LeanBridge::Peer::with_hosts($host,sub {
        $got=LeanBridge::Peer::relay($box,sub ($value) {
            die 'independent component changed the object' unless refaddr($value)==refaddr($box);
            my $result=LeanBridge::Workshop::update($value,73);
            die 'wrong reentry' unless $result==73;
            return $value;
        })->get;
        my $cursor=LeanBridge::Peer::boxes($got,!!0);
        die 'cursor lost identity' unless refaddr($cursor->next->get)==refaddr($box);
        $cursor->close;
        $parked=LeanBridge::Peer::boxes($got,!!0);
        # Start both after the last event-loop wait so neither can have
        # delivered its callback when the peer binding begins to close.
        $waiting=LeanBridge::Workshop::relay($box,sub { $_[0] });
        $pending=LeanBridge::Peer::relay($got,sub { ++$ran; $got });
        die 'expected pending work in both components' if $waiting->is_ready || $pending->is_ready;
    });
    die 'peer close invalidated or completed the wrong Future'
        unless $pending->is_cancelled && !$ran && !$waiting->is_cancelled && refaddr($waiting->get)==refaddr($box);
    die 'wrong mutable state after peer close' unless LeanBridge::Workshop::read($got)==73;
});
my @items=$parked->next->get; die 'parked cursor escaped' if @items;
die 'detached Perl result not usable' unless $got->read==73;
undef $got; die 'retained an object after both bindings closed' if defined $weak;
say 'Independent Perl worker objects, reentry, load order and sibling shutdown passed';
