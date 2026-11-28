use strict;
use warnings;
use Scalar::Util qw(refaddr);
use LeanBridge::TariffQuotes;

sub visit_quote { LeanBridge::TariffQuotes::visit_quote(@_) }
sub check_quote { die "unexpected quote at line ".(caller)[2]."\n" unless $_[0] }
sub quote_failure {
    my ($code)=@_; local $@;
    return $@ unless eval { $code->(); 1 };
    die "expected callback failure\n";
}
sub expired_quote {
    my ($code)=@_;
    check_quote(quote_failure($code) =~ /\ALean identity is closed or its callback borrow has expired\b/);
}
sub exercise_incoming_quote {
    my ($checkpoint)=@_;
    check_quote(LeanBridge::TariffQuotes::flat_quote(sub { $_[0]+$_[1] },2,3)==5);
    $checkpoint->('baseline');
    for my $keep (0,1) { for my $fail (0,1) {
        my ($borrow,$lease); my $marker=bless {},'Tariff::ApplicationError';
        my $callback=sub {
            my ($q,$n)=@_; check_quote(!defined($borrow) && $q->call($n)==42);
            $borrow=$q;
            if ($keep) {
                $lease=$q->retain;
                check_quote(refaddr($lease)!=refaddr($q) && $q->same_identity($lease) && $lease->same_identity($q));
            }
            die $marker if $fail;
            return $q->call($n);
        };
        if ($fail) {
            my $caught=quote_failure(sub { visit_quote(40,$callback,2) });
            check_quote(ref($caught) && refaddr($caught)==refaddr($marker));
        } else { check_quote(visit_quote(40,$callback,2)==42) }
        expired_quote(sub { $borrow->call(1) });
        if ($keep) {
            expired_quote(sub { $borrow->same_identity($lease) });
            $checkpoint->('held') unless $fail;
            $borrow->close; check_quote($lease->call(5)==45);
            $lease->close; expired_quote(sub { $lease->call(1) });
        } else { $borrow->close }
        $checkpoint->($keep ? ($fail?'errorLease':'lease') : ($fail?'error':'success'));
    }}
    my $inner;
    check_quote(visit_quote(30,sub {
        my ($outer,$n)=@_; my $marker=bless {},'Tariff::InnerError';
        my $error=quote_failure(sub { visit_quote(90,sub {
            my ($other,$m)=@_;check_quote(!$outer->same_identity($other) && $other->call($m)==93);
            $inner=$other; die $marker;
        },3) });
        check_quote(ref($error) && refaddr($error)==refaddr($marker));
        expired_quote(sub { $inner->call(1) }); $inner->close;
        return $outer->call($n);
    },4)==34);
    $checkpoint->('nested');
    check_quote(visit_quote(1,sub { $_[0]->call($_[1]) },5)==6);
    check_quote(visit_quote(60,sub { $_[0]->call($_[1]) },3)==63);
    $checkpoint->('fresh');
}
1;
