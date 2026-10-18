use strict;
use warnings;
use JSON::PP ();
use Math::BigInt;
use Scalar::Util qw(blessed refaddr reftype);

my @INHERITED_FULL_NAMES = qw(first normalized pair aliased nested echo);
my @INHERITED_RESULT_NAMES = qw(produce produce_stamped);
my $INHERITED_DIAGNOSTIC
    = qr/ (?:is not below its Fin [0-9]+ bound|was rejected by InheritedCheckedRecords\.[A-Za-z]+)\z/;

sub inherited_n { Math::BigInt->new("$_[0]") }

sub inherited_add {
    my $total = inherited_n(0);
    $total->badd($_) for @_;
    return $total;
}

sub check_inherited_checked_records {
    my ($api, $result_only, $rounds, $parameter_prefix) = @_;
    die "invalid inherited caller options\n"
        unless defined($api) && !ref($api)
            && ($result_only == 0 || $result_only == 1)
            && defined($rounds) && !ref($rounds)
            && $rounds =~ /\A[0-9]+\z/ && $rounds >= 1 && $rounds <= 1000;
    die "invalid parameter prefix\n"
        unless $parameter_prefix eq 'arg' || $parameter_prefix eq 'value';

    my ($checks, $rejections, $host_rejections, $calls, $recoveries, $snapshots)
        = (0, 0, 0, 0, 0, 0);
    my $snapshot_controls = 0;
    my $span_class = "${api}::Span";
    my $ticket_class = "${api}::Ticket";
    my $stamped_class = "${api}::Stamped";
    my %fields = (
        $span_class => [qw(lo hi)],
        $ticket_class => [qw(toSpan word)],
        $stamped_class => [qw(toTicket mark)]
    );
    my $json = JSON::PP->new->canonical->allow_blessed(0);
    my $snapshot;
    $snapshot = sub {
        my ($value) = @_;
        return ['undef'] unless defined $value;
        my $kind = blessed($value);
        if (defined($kind) && $kind eq 'Math::BigInt') {
            return ['Math::BigInt', $value->bstr];
        }
        if (ref($value) eq 'ARRAY') {
            return ['ARRAY', map { $snapshot->($_) } @$value];
        }
        if (defined($kind) && exists $fields{$kind}) {
            die "unexpected inherited record storage: $kind\n"
                unless (reftype($value) // '') eq 'HASH';
            my @names = @{$fields{$kind}};
            die "unexpected inherited record fields: $kind\n"
                unless join("\0", sort keys %$value) eq join("\0", sort @names);
            return [$kind, map {
                my $reader = $value->can($_)
                    or die "missing inherited record accessor: $kind\::$_\n";
                [$_, $snapshot->($reader->($value))]
            } @names];
        }
        if (defined $kind) {
            return ['BLESSED', $kind, "$value"];
        }
        die "unexpected public reference type: " . ref($value) . "\n" if ref $value;
        return ['SCALAR', "$value"];
    };
    my $same = sub {
        return $json->encode($snapshot->($_[0])) eq $json->encode($snapshot->($_[1]));
    };
    my $check = sub {
        die "failed: $_[1]\n" unless $_[0];
        ++$checks;
    };
    my $equal = sub {
        $check->($same->($_[0], $_[1]), $_[2]);
    };
    my $function = sub {
        my ($name) = @_;
        no strict 'refs';
        return *{"${api}::$name"}{CODE};
    };
    my $clean_error = sub {
        my ($error) = @_;
        $error =~ s/\n\z//;
        $error =~ s/ at [^\n]+ line [0-9]+\.?\z//;
        return $error;
    };
    my $invoke = sub {
        my ($name, $arguments, $expected, $label) = @_;
        $label //= $name;
        my $before = $snapshot->($arguments);
        my $code = $function->($name)
            or die "$name is not exported\n";
        ++$calls;
        my ($result, $error);
        {
            local $@;
            $result = eval { $code->(@$arguments) };
            $error = $@;
        }
        die "$name unexpectedly raised: $error" if length $error;
        $equal->($result, $expected, $label);
        $check->($json->encode($snapshot->($arguments)) eq $json->encode($before),
            "$label preserved every input");
        ++$snapshots;
        return $result;
    };
    my $refused = sub {
        my ($name, $arguments, $message) = @_;
        my $before = $snapshot->($arguments);
        my $code = $function->($name)
            or die "$name is not exported\n";
        ++$calls;
        my ($passed, $error);
        {
            local $@;
            $passed = eval { $code->(@$arguments); 1 };
            $error = $@;
        }
        die "accepted invalid input: $message\n" if $passed;
        my $clean = $clean_error->($error);
        $check->($clean eq $message,
            "exact refusal: $message; got $clean");
        $check->($json->encode($snapshot->($arguments)) eq $json->encode($before),
            "$name rejection preserved every input");
        ++$snapshots;
        ++$rejections;
    };
    my $host_refused = sub {
        my ($name, $arguments, $label) = @_;
        my $before = $snapshot->($arguments);
        my $code = $function->($name)
            or die "$name is not exported\n";
        ++$calls;
        my ($passed, $error);
        {
            local $@;
            $passed = eval { $code->(@$arguments); 1 };
            $error = $@;
        }
        die "accepted malformed input: $label\n" if $passed;
        my $clean = $clean_error->($error);
        $check->(length($clean) > 0 && $clean !~ $INHERITED_DIAGNOSTIC,
            "$name host refusal: $label; got $clean");
        $check->($json->encode($snapshot->($arguments)) eq $json->encode($before),
            "$label preserved every input");
        ++$snapshots;
        ++$host_rejections;
    };
    my $distinct = sub {
        $check->(!$same->($_[0], $_[1]), 'independent snapshot mutation control');
        ++$snapshot_controls;
    };

    my $span = sub {
        return $span_class->new(lo => inherited_n($_[0]), hi => inherited_n($_[1]));
    };
    my $ticket = sub {
        return $ticket_class->new(
            toSpan => $span->($_[0], $_[1]), word => inherited_n($_[2])
        );
    };
    my $stamped = sub {
        return $stamped_class->new(
            toTicket => $ticket->($_[0], $_[1], $_[2]), mark => inherited_n($_[3])
        );
    };
    my $produced = sub {
        return $ticket->($_[0], $_[0], inherited_n($_[0])->badd(1));
    };
    my $produced_stamped = sub {
        return $stamped->($_[0], $_[0], inherited_n($_[0])->badd(1), 0);
    };

    for my $name (@INHERITED_FULL_NAMES) {
        $check->(!!$function->($name) != !!$result_only, "full export selection: $name");
    }
    for my $name (@INHERITED_RESULT_NAMES) {
        $check->(!!$function->($name), "result export selection: $name");
    }

    my $huge = inherited_n(2)->bpow(100);
    $distinct->($ticket->(0, 0, 1), $ticket->(0, 0, 2));
    $distinct->($ticket->(0, 0, 1), $ticket->(0, 1, 1));
    $distinct->($stamped->(0, 0, 1, 0), $stamped->(0, 0, 1, 1));
    $distinct->(inherited_n(0), $huge);
    $distinct->($span->(0, 1), $ticket->(0, 1, 1));
    $distinct->($ticket->(0, 1, 1), $stamped->(0, 1, 1, 0));
    unless ($result_only) {
        $distinct->($ticket->(1, 2, 3), $ticket->(2, 2, 3));
        $distinct->($stamped->(1, 2, 3, 0), $stamped->(1, 2, 3, 7));
    }

    for my $value (inherited_n(0), inherited_n(4), $huge) {
        $invoke->('produce', [$value], $produced->($value));
        $invoke->('produce_stamped', [$value], $produced_stamped->($value));
    }
    for my $round (0 .. $rounds - 1) {
        my $value = $huge->copy->badd($round);
        my $first_result = $invoke->('produce', [$value], $produced->($value));
        my $marked_result = $invoke->(
            'produce_stamped', [$value], $produced_stamped->($value)
        );
        $check->(refaddr($first_result) != refaddr($marked_result->toTicket),
            'returned tickets own independent managed storage');
        $check->(refaddr($first_result->toSpan)
            != refaddr($marked_result->toTicket->toSpan),
            'returned parent fields own independent managed storage');
    }
    $host_refused->('produce', [JSON::PP::true], 'true Nat');
    $host_refused->('produce', [inherited_n(-1)], 'negative Nat');
    $host_refused->('produce_stamped', [1.0], 'Float Nat');
    $host_refused->('produce_stamped', [undef], 'undef Nat');

    my $summary = sub {
        return {
            checks => $checks, rejections => $rejections,
            hostRejections => $host_rejections, calls => $calls,
            recoveries => $recoveries, snapshots => $snapshots,
            snapshotControls => $snapshot_controls, rounds => $rounds
        };
    };
    return $summary->() if $result_only;

    my $p0 = "${parameter_prefix}0";
    my $rejected = sub {
        return "$_[0] was rejected by InheritedCheckedRecords.$_[1]";
    };
    my $first_value = $ticket->(2, 3, 4);
    my $raw_right = $ticket->(4, 1, 999);
    $invoke->('first', [$first_value], inherited_n(9));
    $invoke->('normalized', [$ticket->(4, 1, 0)], inherited_n(11));
    $invoke->('pair', [$first_value, $raw_right], inherited_n(10));
    $invoke->('aliased', [$ticket->(4, 1, 4)], inherited_n(5));
    $invoke->('nested', [$stamped->(1, 2, 4, 3)], inherited_n(7));
    $invoke->('echo', [$ticket->(1, 2, 0)], $ticket->(1, 2, 3));
    $refused->('first', [$ticket->(4, 1, 5)], $rejected->("$p0.toSpan", 'mkSpan'));
    $refused->('first', [$ticket->(1, 2, 0)], $rejected->("$p0.word", 'mkWord'));
    $refused->('first', [$ticket->(1, 5, 3)], $rejected->($p0, 'mkTicket'));
    $refused->('nested', [$stamped->(1, 2, 9, 8)],
        "$p0.mark is not below its Fin 8 bound");
    $refused->('nested', [$stamped->(1, 2, 4, 5)], $rejected->($p0, 'mkStamped'));
    $refused->('aliased', [$ticket->(1, 5, 3)], $rejected->($p0, 'mkTicket'));
    $refused->('pair', [$ticket->(4, 1, 5), $raw_right],
        $rejected->("$p0.toSpan", 'mkSpan'));
    $refused->('pair', [$ticket->(1, 5, 3), $raw_right],
        $rejected->($p0, 'mkTicket'));
    $host_refused->('first', [1], 'unrelated scalar as Ticket');
    $host_refused->('first', [$span->(1, 2)], 'Span as Ticket');
    $host_refused->('nested', [$ticket->(1, 2, 4)], 'Ticket as Stamped');
    $equal->($raw_right, $ticket->(4, 1, 999),
        'normalization never mutated reused input');

    for my $round (0 .. $rounds - 1) {
        my $value = $round + 10;
        my $valid = $ticket->($value, $value + 1, $value + 2);
        $invoke->('first', [$valid], inherited_n(3 * $value + 3), 'round accepted');
        $invoke->('normalized', [$ticket->($value + 2, $value, 0)],
            inherited_n(4 * $value + 5), 'round normalized');
        $invoke->('pair', [$valid, $ticket->($value + 2, $value, 0)],
            inherited_n(3 * $value + 5), 'round repeated position');
        $invoke->('aliased', [$ticket->($value + 2, $value, 2 * $value + 1)],
            inherited_n(2 * $value + 2), 'round alias');
        my $mark = $round % 8;
        $invoke->('nested', [$stamped->($mark, $mark, $mark + 1, $mark)],
            inherited_n(2 * $mark + 1), 'round nested');
        $refused->('first', [$ticket->($value + 1, $value, $value + 2)],
            $rejected->("$p0.toSpan", 'mkSpan'));
        $refused->('first', [$ticket->(0, 1, 0)],
            $rejected->("$p0.word", 'mkWord'));
        $refused->('first', [$ticket->(0, $value + 2, $value + 1)],
            $rejected->($p0, 'mkTicket'));
        $refused->('nested', [$stamped->(0, 9, 9, 8)],
            "$p0.mark is not below its Fin 8 bound");
        $refused->('nested', [$stamped->(0, 6, 6, 7)],
            $rejected->($p0, 'mkStamped'));
        $invoke->('first', [$valid], inherited_n(3 * $value + 3),
            'recovery after nested rejection');
        ++$recoveries;
    }
    $equal->($raw_right, $ticket->(4, 1, 999),
        'all rounds preserved reused input');
    return $summary->();
}

if ($0 eq __FILE__) {
    my %allowed = map { $_ => 1 } ('', '--result-only', '--reviewed',
        '--result-only\0--reviewed');
    my $arguments = join("\0", @ARGV);
    die "usage: consumer.pl [--result-only] [--reviewed]\n"
        unless $allowed{$arguments};
    require LeanBridge::InheritedCheckedRecords;
    my $result = check_inherited_checked_records(
        'LeanBridge::InheritedCheckedRecords',
        scalar(grep { $_ eq '--result-only' } @ARGV) ? 1 : 0,
        256,
        scalar(grep { $_ eq '--reviewed' } @ARGV) ? 'value' : 'arg'
    );
    print JSON::PP->new->canonical->encode($result), "\n";
}

1;
