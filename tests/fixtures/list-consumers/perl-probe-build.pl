# Build only the isolated test XS, using headers from the installed runtime.
use strict;
use warnings;
use ExtUtils::ParseXS;
use ExtUtils::CBuilder;
use LeanBridge::Runtime;
my $root = $INC{'LeanBridge/Runtime.pm'}; $root =~ s/\.pm\z//;
ExtUtils::ParseXS::process_file(filename => 'Probe.xs', output => 'Probe.c', prototypes => 0);
my $builder = ExtUtils::CBuilder->new(quiet => 1, config => { optimize => '-O2 -g0' });
my $object = $builder->compile(source => 'Probe.c', include_dirs => ['.', "$root/include"], extra_compiler_flags => '-O2 -g0');
$builder->link(objects => $object, module_name => 'LeanBridge::Lists', lib_file => 'Probe.so', extra_linker_flags => '-Wl,--build-id=none');
