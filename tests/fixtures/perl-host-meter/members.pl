use strict;
use warnings FATAL => 'all';
use Scalar::Util qw(refaddr);
use Config;
use LeanBridge::Workshop::_HostMembers;

{ package Meter;
  use overload bool => sub { 0 }, '""' => sub { die "object stringified" }, fallback => 1;
  sub new { bless {level => $_[1]}, $_[0] }
  sub level { my ($self, @v) = @_; $self->{level} = $v[0] if @v; $self->{level} }
  sub read { die $_[0]->{fault} if exists $_[0]->{fault}; $_[0]->{level} }
  sub identity { exists $_[0]->{alternate} ? $_[0]->{alternate} : $_[0] }
}
{ package Child; our @ISA = ('Meter'); sub read { 42 } }
{ package Pretender; sub isa { 1 } sub can { sub { 1 } } }
{ package Changing; use Tie::Hash; use parent -norequire, 'Tie::StdHash';
  sub FETCH { my ($self, $key) = @_; return $self->{seen}++ ? 'Pretender' : $self->{$key} }
}
{ package Fault; use overload bool => sub { 0 }, '""' => sub { die "error stringified" }, fallback => 1; }

sub failure (&) {
    my ($f) = @_;
    local $@;
    return $@ unless eval { $f->(); 1 };
    die "expected failure";
}
my ($r, $n, $g, $s, $i) = @ARGV;
my $bind = \&LeanBridge::Workshop::_HostMembers::_bind;
die unless failure { $bind->({Box => 'Pretender'}) } =~ /missing host method/;
die unless failure { $bind->({Other => 'Meter'}) } =~ /invalid Perl host class/;
my $slots = $bind->({Box => 'Meter'});
tie my %changing, 'Changing';
$changing{Box} = 'Meter';
my $snap = $bind->(\%changing);
die unless ref($snap->[$n]->(1)) eq 'Meter';
my $box = $slots->[$n]->(17);
die unless ref($box) eq 'Meter' && $slots->[$r]->($box) == 17;
die if defined $slots->[$s]->($box, 29);
die unless $slots->[$g]->($box) == 29 && refaddr($slots->[$i]->($box)) == refaddr($box);
die unless $slots->[$r]->(Child->new(0)) == 42;
die unless failure { $slots->[$r]->(bless {}, 'Pretender') } =~ /wrong nominal/;
die unless failure { $slots->[$r]->('Meter') } =~ /wrong nominal/;
die unless failure { $slots->[$s]->($box) } =~ /wrong host method arity/;
$box->{alternate} = bless {}, 'Pretender';
die unless failure { $slots->[$i]->($box) } =~ /wrong nominal/;
my $err = bless {}, 'Fault';
$box->{fault} = $err;
die unless refaddr(failure { $slots->[$r]->($box) }) == refaddr($err);
delete $box->{fault};
die unless $slots->[$r]->($box) == 29;
my $threads = $Config{useithreads} ? 'threaded' : 'unthreaded';
print "Perl $] ($threads): constructor, accessor, subclass, nominal identity, exception identity\n";
