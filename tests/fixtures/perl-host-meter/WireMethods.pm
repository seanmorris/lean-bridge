package Box;
use strict;
use warnings FATAL => 'all';
use Math::BigInt;
our ($bad,%seen);
sub new { bless {level=>$_[1]},$_[0] }
sub read { $_[0]->{level} }
sub level { $_[0]->{level}=$_[1] if @_==2; $_[0]->{level} }
sub identity { $_[0] }
sub child { my $v=$_[0]->{child}; $_[0]=undef; return $v }
sub child_of { my $v=$_[1]->{child}; $_[1]=undef; return $v }
sub echo_unit { ++$seen{unit}; die if defined $_[1]; undef }
sub echo_bool { ++$seen{bool}; die unless $_[1]; return $bad if defined $bad; return !!0 }
sub echo_char { ++$seen{char}; die unless $_[1] eq chr(0x1f41d); chr(0x1f98b) }
for my $k (qw(uint8 uint16 uint32 uint64 usize int8 int16 int32 int64 isize)) {
    no strict 'refs';
    *{"echo_$k"}=sub { ++$seen{$k}; $k =~ /^u/ ? $_[1]-1 : $_[1]+1 };
}
sub echo_float32 { ++$seen{float32}; -$_[1] }
sub echo_float64 { ++$seen{float64}; -$_[1] }
sub echo_string { ++$seen{string}; die unless utf8::is_utf8($_[1]); $_[1]."!" }
sub echo_bytes { ++$seen{bytes}; die if utf8::is_utf8($_[1]); substr($_[1],0,1)="*"; $_[1] }
sub echo_nat { ++$seen{nat}; die unless ref($_[1]) eq 'Math::BigInt'; $_[1]->badd(7) }
sub echo_int { ++$seen{int}; die unless ref($_[1]) eq 'Math::BigInt'; $_[1]->bsub(7) }
1;
