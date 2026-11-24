use v5.36;
use Scalar::Util qw(refaddr weaken);
use LeanBridge::Workshop;

{ package App::Meter;
  sub new ($class,$value) { bless {level=>$value},$class }
  sub level ($self,@v) { $self->{level}=$v[0] if @v; $self->{level} }
  sub read ($self) { $self->{level} }
  sub identity ($self) { $self }
}
my $binding={Box=>'App::Meter'};
for my $unwind (0,1) {
    my ($weak,$survivor);
    my $ok=eval {
        LeanBridge::Workshop::with_hosts($binding, sub {
            die 'prior lease revived' if $unwind && !LeanBridge::Workshop::_probe_stale();
            my $box=App::Meter->new(27);
            $weak=$box; weaken($weak);
            my $baseline=LeanBridge::Workshop::_probe_live();
            my $bad=eval { LeanBridge::Workshop::_probe_rollback($box,bless({},'Other')); 1 };
            die 'wrong class or partial conversion cleanup' if $bad || $@!~/wrong nominal Perl host object/
                || LeanBridge::Workshop::_probe_live()!=$baseline;
            for my $route (0..2) {
                my $got=LeanBridge::Workshop::_probe_call($box,$route);
                die "object identity in route $route" unless refaddr($got)==refaddr($box);
                $survivor=$got;
            }
            LeanBridge::Workshop::_probe_park($box);
            die "intentional lexical unwind\n" if $unwind;
        }); 1;
    };
    die "unexpected scope result: $@" unless $unwind ? !$ok && $@ eq "intentional lexical unwind\n" : $ok;
    die 'escaped lease or registry row after with_hosts'
        unless LeanBridge::Workshop::_probe_stale() && LeanBridge::Workshop::_probe_live()==0;
    die 'returned object was destroyed' unless $survivor->read==27 && refaddr($weak)==refaddr($survivor);
    undef $survivor; die 'unexpected strong reference after unbind' if defined $weak;
}
say 'Perl worker returned original objects, rejected wrong-class input, and retired leases on return and die';
