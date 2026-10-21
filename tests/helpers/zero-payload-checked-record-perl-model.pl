# Independent Perl model for the immutable zero-payload caller. It shares no
# generated binding, XS conversion, package, or native runtime code.
use strict;
use warnings;
use Cwd qw(abs_path);
use JSON::PP ();
use Math::BigInt;
use Scalar::Util qw(blessed);

my $api_serial = 0;

sub install_record_class {
    my ($class, @fields) = @_;
    no strict 'refs';
    *{"${class}::new"} = sub {
        my ($kind, @values) = @_;
        die "unexpected record fields\n" if @values != @fields * 2;
        my %values = @values;
        die "unexpected record fields\n"
            unless join("\0", sort keys %values) eq join("\0", sort @fields);
        return bless { map { $_ => $values{$_} } @fields }, $kind;
    };
    for my $field (@fields) {
        *{"${class}::$field"} = sub { $_[0]->{$field} };
    }
}

sub install_some_class {
    my ($class) = @_;
    no strict 'refs';
    *{"${class}::new"} = sub {
        my ($kind, $value) = @_;
        die "Some expects one value\n" unless @_ == 2;
        return bless { value => $value }, $kind;
    };
    *{"${class}::value"} = sub { $_[0]->{value} };
}

sub exact_class {
    my ($value, $class) = @_;
    die "expected $class\n" unless (blessed($value) // '') eq $class;
    return $value;
}

sub exact_nat {
    my ($value) = @_;
    die "expected Math::BigInt\n"
        unless blessed($value) && $value->isa('Math::BigInt');
    die "Nat cannot be negative\n" if $value->is_neg;
    return $value;
}

sub exact_bool {
    my ($value) = @_;
    die "expected Bool\n" if ref($value) || !defined($value)
        || ($value ne '0' && $value ne '1');
    return $value ? 1 : 0;
}

sub build_zero_payload_api {
    my ($result_only, $prefix, $fault) = @_;
    my $api = 'ZeroPayloadPerlModel::Api' . ++$api_serial;
    my %classes = map { $_ => "${api}::$_" }
        qw(Witness Token Marker Some Mark Mark::Blank Mark::Marked);
    install_record_class($classes{Witness});
    install_record_class($classes{Token}, 'tag');
    install_record_class($classes{Marker});
    install_some_class($classes{Some});
    install_record_class($classes{'Mark::Blank'});
    install_record_class($classes{'Mark::Marked'}, 'witness');
    my $function = sub {
        my ($name, $body) = @_;
        no strict 'refs';
        *{"${api}::$name"} = $body;
    };
    my $witness = sub { $classes{Witness}->new() };
    my $token = sub { $classes{Token}->new(tag => undef) };
    my $marker = sub { $classes{Marker}->new() };
    my $blank = sub { $classes{'Mark::Blank'}->new() };
    my $marked = sub { $classes{'Mark::Marked'}->new(witness => $witness->()) };
    my $witness_input = sub {
        my ($value) = @_;
        return $value if defined($fault) && $fault eq 'host-accepts-undef'
            && !defined($value);
        return exact_class($value, $classes{Witness});
    };
    $function->('produce_witness', sub {
        defined($fault) && $fault eq 'wrong-produced' ? $marker->() : $witness->();
    });
    $function->('produce_token', sub { $token->() });
    $function->('witnesses', sub {
        my $count = exact_nat($_[0])->numify;
        --$count if defined($fault) && $fault eq 'array-length' && $count > 0;
        return [map { $witness->() } 1 .. $count];
    });
    $function->('maybe_witness', sub {
        return undef unless exact_bool($_[0]);
        return $witness->() if defined($fault) && $fault eq 'option-collapsed';
        return $classes{Some}->new($witness->());
    });
    $function->('produce_marker', sub { $marker->() });
    $function->('produce_mark', sub {
        exact_bool($_[0]) ? $marked->() : $blank->();
    }) unless defined($fault) && $fault eq 'missing-producer';
    if (!$result_only || defined($fault) && $fault eq 'inputs-exported') {
        $function->('witness_count', sub {
            $witness_input->($_[0]); Math::BigInt->new(1);
        });
        $function->('absent_count', sub {
            $witness_input->($_[0]);
            return Math::BigInt->new(0)
                if defined($fault) && $fault eq 'accept-invalid';
            my $message = defined($fault) && $fault eq 'wrong-message'
                ? 'wrong' : "${prefix}0";
            die "$message was rejected by ZeroPayloadCheckedRecords.mkAbsent at model.pl line 1.\n";
        });
        $function->('token_tag', sub {
            my $value = exact_class($_[0], $classes{Token});
            die "Unit requires undef\n" if defined($value->tag);
            return undef;
        });
        $function->('marker_count', sub {
            exact_class($_[0], $classes{Marker}); Math::BigInt->new(0);
        });
        $function->('mark_count', sub {
            return Math::BigInt->new(0)
                if (blessed($_[0]) // '') eq $classes{'Mark::Blank'};
            if ((blessed($_[0]) // '') eq $classes{'Mark::Marked'}) {
                exact_class($_[0]->witness, $classes{Witness});
                return Math::BigInt->new(1);
            }
            die "expected an exact Mark constructor\n";
        });
    }
    return $api;
}

my ($caller, @options) = @ARGV;
die "usage: model.pl caller.pl [--result-only] [--reviewed|--faults]\n"
    unless defined $caller;
$caller = abs_path($caller) // die "missing caller\n";
local $ENV{LEAN_BRIDGE_ZERO_PAYLOAD_PERL_MODEL} = '1';
my $loaded = do $caller;
die $@ if $@; die $! unless defined $loaded;

if (@options == 1 && $options[0] eq '--faults') {
    my %rejected;
    my %modes = (
        full => [0, [qw(accept-invalid wrong-message wrong-produced missing-producer option-collapsed array-length host-accepts-undef)]],
        'result-only' => [1, [qw(wrong-produced missing-producer inputs-exported option-collapsed array-length)]]
    );
    for my $mode (sort keys %modes) {
        my ($result_only, $faults) = @{$modes{$mode}};
        $rejected{$mode} = [];
        for my $fault (@$faults) {
            my $passed = eval {
                check_zero_payload_records(build_zero_payload_api(
                    $result_only, 'arg', $fault
                ), $result_only, 'arg');
                1;
            };
            die "caller accepted fault: $fault\n" if $passed;
            push @{$rejected{$mode}}, $fault;
        }
    }
    print JSON::PP->new->canonical->encode(\%rejected), "\n";
} else {
    my $result_only = scalar(grep { $_ eq '--result-only' } @options) ? 1 : 0;
    my $reviewed = scalar(grep { $_ eq '--reviewed' } @options) ? 1 : 0;
    die "invalid model options\n" if @options != $result_only + $reviewed;
    my $prefix = $reviewed ? 'value' : 'arg';
    print JSON::PP->new->canonical->encode(check_zero_payload_records(
        build_zero_payload_api($result_only, $prefix), $result_only, $prefix
    )), "\n";
}
