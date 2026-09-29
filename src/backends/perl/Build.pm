package LeanBridgeBuild;
use strict;
use warnings;
use Config;
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use File::Basename qw(dirname basename);
use File::Path qw(make_path);
use File::Copy qw(copy);
use File::Spec;
use Cwd qw(abs_path);
use ExtUtils::MakeMaker 6.64;
use lib 'inc';
use LeanBridge::Runtime::Platform;

# Packaged with each distribution; installation never invokes Lean, Lake or Node.
sub read_bytes {
  my ($path) = @_;
  open my $file, '<:raw', $path or die "Cannot read $path: $!\n";
  local $/; return <$file>;
}
sub read_json { return JSON::PP->new->decode(read_bytes($_[0])); }
sub write_json {
  my ($path, $value) = @_;
  open my $file, '>:raw', $path or die "Cannot write $path: $!\n";
  print {$file} JSON::PP->new->canonical->encode($value), "\n";
  close $file or die "Cannot close $path: $!\n";
}
sub abi { return LeanBridge::Runtime::Platform::abi(); }
sub abi_key { return LeanBridge::Runtime::Platform::abi_key(); }
sub platform { return LeanBridge::Runtime::Platform::platform(@_); }
sub checked_path {
  my ($path) = @_;
  die "Unsafe package path\n" if !defined($path) || $path !~ m{\A[A-Za-z0-9_.+/-]+\z}
    || $path =~ m{(?:\A|/)\.\.(?:/|\z)} || $path =~ m{\A/};
  my $partial = '';
  for my $part (split m{/}, $path) {
    die "Unsafe package path\n" if $part eq '' || $part eq '.' || $part eq '..';
    $partial = length($partial) ? "$partial/$part" : $part;
    die "Symlink in package payload: $partial\n" if -l $partial;
  }
  return $path;
}
sub verify {
  my ($manifest) = @_;
  for my $path (sort keys %{$manifest->{files}}) {
    checked_path($path);
    die "Corrupt package artifact: $path\n" unless sha256_hex(read_bytes($path)) eq $manifest->{files}{$path};
  }
}
sub owned_values {
  my ($manifest) = @_;
  return unless exists $manifest->{ownedValues};
  my $owned = $manifest->{ownedValues};
  die "Invalid owned Perl package contract\n" unless ref($owned) eq 'HASH'
    && $manifest->{module} ne 'LeanBridge::Runtime' && ($owned->{schemaVersion} == 1 || $owned->{schemaVersion} == 2)
    && $owned->{prefix} =~ /\A[A-Za-z_][A-Za-z0-9_]*\z/
    && $owned->{gmpLibrary} eq 'libgmp-lean-bridge.so.10'
    && $owned->{componentLibrary} =~ /\A[A-Za-z0-9_][A-Za-z0-9_.+-]*\.so\z/;
  my $model = read_json('model.json');
  if ($owned->{schemaVersion} == 2 || $model->{schemaVersion} == 8) {
    my $binding = read_json('binding-manifest.json');
    my $native = $model->{ownedGraph}{inputTransfers};
    my $moves = $owned->{inputTransfers};
    my $json = JSON::PP->new->canonical;
    die "Invalid owned Perl input-transfer contract\n"
      unless $owned->{schemaVersion} == 2 && $model->{schemaVersion} == 8 && $binding->{schemaVersion} == 2
        && ref($native) eq 'HASH' && ref($moves) eq 'HASH'
        && $json->encode($binding->{owned}) eq $json->encode($owned)
        && $owned->{bindingIrSha256} eq $model->{bindingIrSha256}
        && $moves->{arguments} eq 'ordinary-values' && $moves->{aliases} eq 'shared-lease'
        && $moves->{borrowedInputs} eq 'reject' && $moves->{independentRetains} eq 'preserved';
    my %expected = (%$native, arguments => 'ordinary-values', aliases => 'shared-lease',
      borrowedInputs => 'reject', independentRetains => 'preserved');
    die "Owned Perl input transfers differ from the native model\n"
      unless $json->encode($moves) eq $json->encode(\%expected);
  }
  return $owned;
}
sub compile_xs {
  my ($manifest, $directory) = @_;
  require ExtUtils::ParseXS;
  require ExtUtils::CBuilder;
  die "Perl headers are unavailable; install the development package for this Perl\n"
    unless -f "$Config{archlib}/CORE/perl.h";
  make_path($directory);
  my $stem = $manifest->{module}; $stem =~ s/.*:://;
  my $c = "$directory/$stem.c";
  ExtUtils::ParseXS::process_file(filename => checked_path($manifest->{xs}), output => $c, prototypes => 0);
  my @include = ('.', $manifest->{include});
  my $runtime_root;
  if ($manifest->{module} ne 'LeanBridge::Runtime') {
    require LeanBridge::Runtime;
    die "Incompatible shared Lean runtime package version\n" unless $LeanBridge::Runtime::VERSION eq $manifest->{runtimeVersion};
    die "Incompatible shared Lean runtime\n" unless LeanBridge::Runtime::_identity() eq $manifest->{runtimeIdentity};
    my $root = $INC{'LeanBridge/Runtime.pm'}; $root =~ s/\.pm\z//;
    $runtime_root = $root;
    push @include, "$root/include";
  }
  my @link_flags = ('-Wl,--build-id=none');
  if (my $owned = owned_values($manifest)) {
    push @include, map { checked_path($_) } qw(owned/include owned/internal owned/gmp/include);
    my $relative = $manifest->{module}; $relative =~ s{::}{/}g;
    my $native = checked_path("lib/$relative/native");
    # Order is part of the ownership ABI: the C adapter must use private GMP.
    push @link_flags, '-L', $native, '-L', "$runtime_root/native", '-Wl,--no-as-needed',
      "-l:$owned->{gmpLibrary}", "-l:$owned->{componentLibrary}", '-llean_bridge_native', '-lleanshared';
  }
  # Keep root identities for both compiler diagnostics and the build receipt.
  my @root_mappings = ([abs_path('.'), '\${DISTRIBUTION}', '/lean-bridge/distribution'],
    [abs_path("$Config{archlib}/CORE"), '\${PERL_CORE}', '/perl/core']);
  push @root_mappings, [abs_path($runtime_root), '\${LEAN_BRIDGE_RUNTIME}', '/lean-bridge/runtime']
    if defined $runtime_root;
  # CBuilder appends Config's optimize flags after extra_compiler_flags. A distro
  # -g there would restore debug paths and make relocated archives differ.
  my $builder = LeanBridgeBuild::Compiler->new(quiet => 0, config => { optimize => '-O2 -g0' });
  die "C compiler unavailable; install one or select a compatible prebuilt XS\n" unless $builder->have_compiler;
  $builder->{lean_bridge_commands} = [];
  my @flags = qw(-O2 -g0 -fvisibility=default);
  # Lean's inline assertions embed __FILE__ even with debug information disabled.
  # Their runtime-header location must not expose a producer/installer directory.
  push @flags, map { "-ffile-prefix-map=$_->[0]=$_->[2]" } @root_mappings
    if owned_values($manifest);
  my $object = $builder->compile(source => $c, include_dirs => \@include,
    extra_compiler_flags => \@flags);
  my $library = $builder->link(objects => $object, module_name => $manifest->{module},
    lib_file => "$directory/$stem.$Config{dlext}", extra_linker_flags => \@link_flags);
  # Paths vary between build roots. Keep exact flags and portable root tokens.
  my %roots = map { $_->[0] => $_->[1] } @root_mappings;
  my $flags = join ' ', @flags;
  for my $root (sort { length($b) <=> length($a) } keys %roots) { $flags =~ s/\Q$root\E/$roots{$root}/g; }
  my @commands = map { [map {
    my $argument = $_;
    for my $root (sort { length($b) <=> length($a) } keys %roots) { $argument =~ s/\Q$root\E/$roots{$root}/g; }
    $argument;
  } @$_] } @{$builder->{lean_bridge_commands}};
  my $receipt = { schemaVersion => 1, operation => 'generated-xs-only', abi => abi(),
    sourceSha256 => $manifest->{files}{$manifest->{xs}}, compiler => $Config{cc},
    compilerFlags => $Config{ccflags}, extraCompilerFlags => $flags,
    linker => $Config{ld}, linkerFlags => $Config{lddlflags}, commands => \@commands,
    generatedCSha256 => sha256_hex(read_bytes($c)), runtimeIdentity => $manifest->{runtimeIdentity},
    outputSha256 => sha256_hex(read_bytes($library)) };
  write_json("$directory/receipt.json", $receipt);
  verify($manifest);
  return ($library, $receipt);
}
sub seal_owned_loader {
  my ($manifest, $relative, $receipt) = @_;
  return unless owned_values($manifest);
  my $original = "lib/$relative.pm";
  my $source = read_bytes($original);
  my $marker = '__LEAN_BRIDGE_OWNED_XS_SHA256__';
  my $hash = $receipt->{outputSha256};
  die "Invalid installed XS identity\n" unless defined($hash) && $hash =~ /\A[0-9a-f]{64}\z/;
  my $count = ($source =~ s/\Q$marker\E/$hash/g);
  die "Owned Perl loader has no unique XS seal\n" unless $count == 1;
  # Keep the verified distribution sources unchanged, including on reconfigure.
  # A complete private data copy also supports the mandatory pre-install load.
  for my $path ((sort keys %{$manifest->{files}}), "lib/$relative/install-receipt.json") {
    next unless index($path, "lib/$relative/") == 0;
    my $target = "_owned-install/$path";
    make_path(dirname($target)); copy($path, $target) or die "Cannot stage owned loader data: $!\n";
  }
  my $target = "_owned-install/$original";
  make_path(dirname($target));
  open my $file, '>:raw', $target or die "Cannot stage owned Perl loader: $!\n";
  print {$file} $source;
  close $file or die "Cannot finish owned Perl loader: $!\n";
  return $target;
}
sub configure {
  my $manifest = read_json('lean-bridge-package.json');
  die "Unsupported Perl package format\n" unless $manifest->{schemaVersion} == 1;
  verify($manifest);
  platform($manifest->{glibcMinimumVersion});
  if ($manifest->{module} eq 'LeanBridge::Runtime') {
    die "Incompatible Perl binding runtime identity\n"
      unless sha256_hex(read_bytes('lib/LeanBridge/Runtime/binding.json')) eq $manifest->{runtimeIdentity};
  } else {
    require LeanBridge::Runtime;
    die "Incompatible shared Lean runtime package version\n" unless $LeanBridge::Runtime::VERSION eq $manifest->{runtimeVersion};
    die "Incompatible shared Lean runtime\n" unless LeanBridge::Runtime::_identity() eq $manifest->{runtimeIdentity};
  }
  my $mode = $ENV{LEAN_BRIDGE_PERL_INSTALL_MODE} // 'auto';
  die "LEAN_BRIDGE_PERL_INSTALL_MODE must be auto, prebuilt-only or build-xs\n"
    unless $mode =~ /\A(?:auto|prebuilt-only|build-xs)\z/;
  my $key = abi_key();
  my ($prebuilt) = grep { $_->{abiKey} eq $key } @{$manifest->{prebuilt}};
  my ($library, $receipt);
  if ($mode ne 'build-xs' && $prebuilt) {
    die "Corrupt prebuilt ABI fingerprint\n" unless sha256_hex(JSON::PP->new->canonical->encode($prebuilt->{abi})) eq $prebuilt->{abiKey};
    $library = checked_path($prebuilt->{path});
    die "Prebuilt XS is not covered by the artifact inventory\n" unless exists $manifest->{files}{$library};
    $receipt = { schemaVersion => 1, operation => 'prebuilt-xs', abi => abi(), outputSha256 => $manifest->{files}{$library} };
  } else {
    die "No compatible prebuilt XS for this Perl; use auto or build-xs with matching headers and a C compiler\n" if $mode eq 'prebuilt-only';
    ($library, $receipt) = compile_xs($manifest, '_xs-build');
  }
  my $relative = $manifest->{module}; $relative =~ s{::}{/}g;
  my $stem = basename($relative);
  my $binary = "lib/auto/$relative/$stem.$Config{dlext}";
  make_path(dirname($binary)); copy($library, $binary) or die "Cannot stage XS: $!\n";
  my $receipt_path = "lib/$relative/install-receipt.json";
  make_path(dirname($receipt_path)); write_json($receipt_path, $receipt);
  my $sealed_loader = seal_owned_loader($manifest, $relative, $receipt);
  my %pm;
  for my $path (sort keys %{$manifest->{files}}) {
    next unless $path =~ m{\Alib/};
    (my $target = $path) =~ s{\Alib/}{\$(INST_LIB)/};
    $pm{$path} = $target;
  }
  $pm{$binary} = "\$(INST_ARCHLIB)/auto/$relative/$stem.$Config{dlext}";
  $pm{$receipt_path} = "\$(INST_LIB)/$relative/install-receipt.json";
  if (defined $sealed_loader) {
    delete $pm{"lib/$relative.pm"};
    $pm{$sealed_loader} = "\$(INST_LIB)/$relative.pm";
  }
  # Loading the chosen XS is mandatory, including in prebuilt-only mode.
  # Corrupt or ABI-incompatible binaries fail here. They never trigger fallback.
  system($^X, (defined($sealed_loader) ? ('-I_owned-install/lib') : ()),
    '-Ilib', '-M' . $manifest->{module}, '-e', '1') == 0
    or die "Installed XS compatibility check failed\n";
  my $metadata = read_json('META.json');
  WriteMakefile(NAME => $manifest->{module}, VERSION => $manifest->{version},
    ABSTRACT => $metadata->{abstract}, AUTHOR => join(', ', @{$metadata->{author}}),
    LICENSE => $metadata->{license}[0], MIN_PERL_VERSION => '5.036',
    META_MERGE => { 'meta-spec' => { version => 2 },
      (exists $metadata->{x_spdx_expression} ? (x_spdx_expression => $metadata->{x_spdx_expression}) : ()),
      (exists $metadata->{resources} ? (resources => $metadata->{resources}) : ()) },
    CONFIGURE_REQUIRES => $metadata->{prereqs}{configure}{requires},
    PREREQ_PM => { 'Math::BigInt' => 0, 'JSON::PP' => 0, 'Digest::SHA' => 0,
      ($manifest->{module} eq 'LeanBridge::Runtime' ? () : ('LeanBridge::Runtime' => '== ' . $manifest->{runtimeVersion})) },
    PM => \%pm, XS => {}, C => [], OBJECT => '', NO_META => 1,
    clean => { FILES => '_xs-build' });
}

package LeanBridgeBuild::Compiler;
our @ISA = ('ExtUtils::CBuilder');
sub do_system {
  my ($self, @command) = @_;
  push @{$self->{lean_bridge_commands}}, [@command];
  return $self->SUPER::do_system(@command);
}
1;
