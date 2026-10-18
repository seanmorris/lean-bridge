use strict;
use warnings;
use Cwd qw(abs_path);
use JSON::PP ();
use Math::BigInt;
use Scalar::Util qw(blessed);

sub model_nat {
    my ($value) = @_;
    die "expected Nat\n"
        unless defined(blessed($value)) && blessed($value) eq 'Math::BigInt';
    die "expected nonnegative Nat\n" if $value->is_neg;
    return $value->copy;
}

sub model_add {
    my $total = Math::BigInt->new(0);
    $total->badd($_) for @_;
    return $total;
}

sub install_record_class {
    my ($class, @fields) = @_;
    no strict 'refs';
    *{"${class}::new"} = sub {
        my $kind = shift;
        die "unexpected record class\n" unless $kind eq $class && @_ % 2 == 0;
        my %values;
        while (@_) {
            my ($key, $value) = splice @_, 0, 2;
            die "unexpected record fields\n"
                if !defined($key) || ref($key) || exists $values{$key};
            $values{$key} = $value;
        }
        die "unexpected record fields\n"
            unless join("\0", sort keys %values) eq join("\0", sort @fields);
        return bless \%values, $class;
    };
    for my $field (@fields) {
        *{"${class}::$field"} = sub { $_[0]->{$field} };
    }
}

sub install_api_function {
    my ($api, $name, $code) = @_;
    no strict 'refs';
    *{"${api}::$name"} = $code;
}

sub exact_record {
    my ($value, $class) = @_;
    die "unexpected public record class\n"
        unless defined(blessed($value)) && blessed($value) eq $class;
    return $value;
}

sub model_refused {
    my ($prefix, $suffix, $constructor) = @_;
    die "${prefix}${suffix} was rejected by InheritedCheckedRecords.${constructor}\n";
}

sub model_span {
    my ($value, $class, $prefix, $normalize) = @_;
    $value = exact_record($value, $class);
    my $lo = model_nat($value->lo);
    my $hi = model_nat($value->hi);
    return $class->new(lo => Math::BigInt->new(0), hi => model_add($lo, $hi))
        if $normalize;
    model_refused($prefix, '.toSpan', 'mkSpan') if $lo->bcmp($hi) > 0;
    return $class->new(lo => $lo, hi => $hi);
}

sub model_ticket {
    my ($value, $span_class, $ticket_class, $prefix,
        $normalize_record, $normalize_parent, $normalize_word) = @_;
    $value = exact_record($value, $ticket_class);
    my $parent = model_span(
        $value->toSpan, $span_class, $prefix, $normalize_parent
    );
    my $word = model_nat($value->word);
    if ($normalize_word) {
        $word->badd(1);
    } elsif ($word->is_zero) {
        model_refused($prefix, '.word', 'mkWord');
    }
    if ($normalize_record) {
        $word = $parent->hi->copy->badd(1);
    } elsif ($parent->hi->bcmp($word) > 0) {
        model_refused($prefix, '', 'mkTicket');
    }
    return $ticket_class->new(toSpan => $parent, word => $word);
}

sub build_model_api {
    my ($result_only, $prefix, $fault) = @_;
    my $api = 'InheritedCheckedRecordPerlModel';
    my $span_class = "${api}::Span";
    my $ticket_class = "${api}::Ticket";
    my $stamped_class = "${api}::Stamped";
    install_record_class($span_class, qw(lo hi));
    install_record_class($ticket_class, qw(toSpan word));
    install_record_class($stamped_class, qw(toTicket mark));

    install_api_function($api, 'produce', sub {
        my ($value) = @_;
        die "\n"
            if ($fault // '') eq 'wrong-host-exception'
                && defined(blessed($value))
                && blessed($value) eq 'JSON::PP::Boolean';
        $value = model_nat($value);
        my $offset = ($fault // '') eq 'produce-offset' ? 2 : 1;
        return $ticket_class->new(
            toSpan => $span_class->new(lo => $value, hi => $value->copy),
            word => $value->copy->badd($offset)
        );
    });
    unless (($fault // '') eq 'missing-produce-stamped') {
        install_api_function($api, 'produce_stamped', sub {
            my ($value) = @_;
            $value = model_nat($value);
            return $stamped_class->new(
                toTicket => $ticket_class->new(
                    toSpan => $span_class->new(
                        lo => $value, hi => $value->copy
                    ),
                    word => $value->copy->badd(1)
                ),
                mark => Math::BigInt->new(0)
            );
        });
    }
    if ($result_only) {
        install_api_function($api, 'first', sub { Math::BigInt->new(0) })
            if ($fault // '') eq 'inputs-exported';
        return $api;
    }

    install_api_function($api, 'first', sub {
        my ($value) = @_;
        my $ticket;
        {
            local $@;
            $ticket = eval {
                model_ticket($value, $span_class, $ticket_class, $prefix,
                    0, 0, 0)
            };
            if (length $@) {
                die "wrong diagnostic\n" if ($fault // '') eq 'wrong-diagnostic';
                return Math::BigInt->new(0) if ($fault // '') eq 'accept-invalid';
                die $@;
            }
        }
        return model_add($ticket->toSpan->lo, $ticket->toSpan->hi, $ticket->word);
    });
    install_api_function($api, 'normalized', sub {
        my ($value) = @_;
        my $bypass = ($fault // '') eq 'normalize-bypass';
        my $ticket = model_ticket(
            $value, $span_class, $ticket_class, $prefix,
            $bypass ? 0 : 1, $bypass ? 0 : 1, $bypass ? 0 : 1
        );
        return model_add($ticket->toSpan->lo, $ticket->toSpan->hi, $ticket->word);
    });
    install_api_function($api, 'pair', sub {
        my ($left, $right) = @_;
        $left = model_ticket(
            $left, $span_class, $ticket_class, $prefix, 0, 0, 0
        );
        (my $right_prefix = $prefix) =~ s/0\z/1/;
        $right = model_ticket(
            $right, $span_class, $ticket_class, $right_prefix, 1, 1, 1
        );
        return model_add($left->word, $right->word);
    });
    install_api_function($api, 'aliased', sub {
        my ($value) = @_;
        return model_ticket(
            $value, $span_class, $ticket_class, $prefix, 0, 1, 1
        )->word;
    });
    install_api_function($api, 'nested', sub {
        my ($value) = @_;
        $value = exact_record($value, $stamped_class);
        my $ticket = model_ticket(
            $value->toTicket, $span_class, $ticket_class, $prefix, 0, 0, 0
        );
        my $mark = model_nat($value->mark);
        die "${prefix}.mark is not below its Fin 8 bound\n"
            if $mark->bcmp(8) >= 0;
        model_refused($prefix, '', 'mkStamped')
            if $mark->bcmp($ticket->word) > 0;
        return model_add($ticket->word, $mark);
    });
    install_api_function($api, 'echo', sub {
        my ($value) = @_;
        return $value if ($fault // '') eq 'echo-alias';
        return model_ticket(
            $value, $span_class, $ticket_class, $prefix, 1, 0, 1
        );
    });
    return $api;
}

my $caller = shift @ARGV
    or die "usage: model.pl caller.pl [--result-only] [--reviewed] [--fault=name]\n";
$caller = abs_path($caller) // die "caller does not exist\n";
my $loaded = do $caller;
die $@ if $@;
die "$caller: $!\n" unless defined $loaded;
my $result_only = scalar(grep { $_ eq '--result-only' } @ARGV) ? 1 : 0;
my $reviewed = scalar(grep { $_ eq '--reviewed' } @ARGV) ? 1 : 0;
my ($fault_argument) = grep { /\A--fault=/ } @ARGV;
my $fault = defined($fault_argument) ? substr($fault_argument, 8) : undef;
my $api = build_model_api($result_only, $reviewed ? 'value0' : 'arg0', $fault);
my $result = check_inherited_checked_records(
    $api, $result_only, 256, $reviewed ? 'value' : 'arg'
);
print JSON::PP->new->canonical->encode($result), "\n";
