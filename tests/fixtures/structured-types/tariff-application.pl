use strict;
use warnings;
use Scalar::Util qw(refaddr);
use LeanBridge::TariffQuotes;

sub checked { die "unexpected public API result at line ".(caller)[2]."\n" unless $_[0] }
sub caught {
    my ($code) = @_; local $@;
    return $@ unless eval { $code->(); 1 };
    die "expected callback failure\n";
}
sub exercise_incoming_quote {
    my ($checkpoint) = @_;
    checked(LeanBridge::TariffQuotes::flat_quote(sub { $_[0]+$_[1] },2,3) == 5);
    $checkpoint->('baseline');
    my @calls;
    my $price = sub { push @calls,$_[0]; return 40+$_[0] };
    my $expired = LeanBridge::TariffQuotes::pass_application_quote($price);
    checked(caught(sub { $expired->call(999) }) =~ /status=10/);
    $expired->close; checked(!@calls); $checkpoint->('expired');

    my ($saved,$lease);
    my $fallback = LeanBridge::TariffQuotes::make_tariff(800)->quote;
    my $forwarded = LeanBridge::TariffQuotes::visit_application_quote($price,sub {
        my ($q,$n) = @_; $saved=$q; $lease=$q->retain;
        checked($q->call(0)==40);
        my $live = LeanBridge::TariffQuotes::pass_application_quote($q);
        $checkpoint->('held');
        my $reply = LeanBridge::TariffQuotes::Runtime::Callback->new(code=>sub { $live },recovery=>$fallback);
        my $result = LeanBridge::TariffQuotes::staged_quote($reply,99,$n);
        $live->close; return $result;
    },2);
    checked($forwarded==42 && join(',',@calls) eq '0,2');
    checked(caught(sub { $saved->call(999) }) =~ /closed or its callback borrow has expired/);
    checked(caught(sub { $lease->call(999) }) =~ /status=10/);
    $saved->close; $lease->close; $fallback->close; $checkpoint->('forward');

    my $marker=bless {},'Tariff::ApplicationFailure';
    my $after=LeanBridge::TariffQuotes::visit_application_quote($price,sub {
        my ($outer,$n)=@_;
        my $error=caught(sub { LeanBridge::TariffQuotes::visit_application_quote(
            sub { die $marker },sub { $_[0]->call($_[1]) },98) });
        checked(ref($error) && refaddr($error)==refaddr($marker));
        return $outer->call($n);
    },3);
    checked($after==43 && join(',',@calls) eq '0,2,3');
    # The visitor itself may catch the failure at the call site, without
    # poisoning its enclosing registration. It may also throw its own error.
    my $other=bless {},'Tariff::ReplacementFailure';
    for my $replace (0,1) {
        my $visits=0;
        my $attempt=sub { LeanBridge::TariffQuotes::visit_application_quote(
            sub { ++$visits; die $marker },sub {
                my ($q,$n)=@_;
                my $e=caught(sub { $q->call($n) });
                checked(ref($e) && refaddr($e)==refaddr($marker));
                die $other if $replace;
                return $n+100;
            },7) };
        if ($replace) {
            my $e=caught($attempt);
            checked(ref($e) && refaddr($e)==refaddr($other));
        } else { checked($attempt->()==107) }
        checked($visits==1);
    }
    $checkpoint->('nested');
    for my $n (42,71) {
        my $input=LeanBridge::TariffQuotes::new_ticket($n);
        my $recovery=LeanBridge::TariffQuotes::new_ticket(800);
        my $reply=LeanBridge::TariffQuotes::new_ticket($n+1);
        my @received;
        for my $fail (0,1) {
            my $cb=LeanBridge::TariffQuotes::Runtime::Callback->new(recovery=>$recovery,code=>sub {
                push @received,LeanBridge::TariffQuotes::ticket_serial($_[0]);
                die $marker if $fail; return $reply;
            });
            if ($fail) {
                my $e=caught(sub { LeanBridge::TariffQuotes::exchange_ticket($input,$cb) });
                checked(ref($e) && refaddr($e)==refaddr($marker));
            } else { checked(LeanBridge::TariffQuotes::exchange_ticket($input,$cb)==$n+1) }
        }
        checked(join(',',@received) eq "$n,$n");
        checked(LeanBridge::TariffQuotes::ticket_serial($input)==$n && LeanBridge::TariffQuotes::ticket_serial($recovery)==800);
        $input->close; $reply->close; $recovery->close; $checkpoint->("ticket$n");
    }
    checked(LeanBridge::TariffQuotes::visit_application_quote($price,sub { $_[0]->call($_[1]) },7)==47);
    checked(join(',',@calls) eq '0,2,3,7'); $checkpoint->('fresh');
}
1;
