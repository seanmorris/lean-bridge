use strict;
use warnings;
use Config;
BEGIN { require threads if ($Config{useithreads} // '') eq 'define'; }
use DynaLoader;
use JSON::PP;
use POSIX ();
use LeanBridge::Runtime;

my ($mode, $root) = @ARGV;
my $checks = 0;
sub check { ++$checks; die "loader check $checks: $_[1]\n" unless $_[0]; }
my $extension = "$root/LoaderProbe.so";
my $global = DynaLoader::dl_load_file("$root/liblb-loader-global.so", 0x01)
  or die DynaLoader::dl_error();
if ($mode eq 'private') {
  check(!defined LeanBridge::Runtime::_mapped_library('liblb-loader-absent.so'), 'absent probe does not load');
  check(!defined LeanBridge::Runtime::_mapped_library("$root/liblb-loader-transient.so"), 'unloaded absolute path');
  my $transient = DynaLoader::dl_load_file("$root/liblb-loader-transient.so", 0) or die DynaLoader::dl_error();
  for (1..100) {
    check(LeanBridge::Runtime::_mapped_library('liblb-loader-transient.so') eq "$root/liblb-loader-transient.so", 'mapped SONAME');
  }
  DynaLoader::dl_unload_file($transient);
  check(!defined LeanBridge::Runtime::_mapped_library('liblb-loader-transient.so'), 'probes release every temporary reference');
  for my $entry (\&LeanBridge::Runtime::_mapped_library, \&LeanBridge::Runtime::_open_private_library) {
    for my $bad (undef, '', [], {}, 17, "bad\0path", "./relative.so") {
      my $ok = eval { $entry->($bad); 1 };
      check(!$ok && $@ =~ /Native library path/, 'invalid loader argument');
    }
  }
  my $missing = eval { LeanBridge::Runtime::_open_private_library("$root/absent.so"); 1 };
  check(!$missing && $@ =~ /Cannot load private native artifact/, 'missing private library');
  LeanBridge::Runtime::_open_private_library($extension);
}
my $library = DynaLoader::dl_load_file($extension, 0) or die DynaLoader::dl_error();
my $symbol = DynaLoader::dl_find_symbol($library, 'boot_LeanBridge__LoaderProbe') or die DynaLoader::dl_error();
my $boot = DynaLoader::dl_install_xsub('LeanBridge::LoaderProbe::bootstrap', $symbol, $extension);
$boot->('LeanBridge::LoaderProbe');
my $value = LeanBridge::LoaderProbe::read();
my $reader = DynaLoader::dl_load_file("$root/GlobalProbe.so", 0) or die DynaLoader::dl_error();
my $reader_symbol = DynaLoader::dl_find_symbol($reader, 'boot_LeanBridge__GlobalProbe') or die DynaLoader::dl_error();
my $reader_boot = DynaLoader::dl_install_xsub('LeanBridge::GlobalProbe::bootstrap', $reader_symbol, "$root/GlobalProbe.so");
$reader_boot->('LeanBridge::GlobalProbe');
my $default = LeanBridge::GlobalProbe::read();
check($value == ($mode eq 'private' ? 29 : 11), 'private binding differs from unguarded global binding');
check($default == 11, 'private dependency does not replace the global symbol');
check(!LeanBridge::GlobalProbe::private_visible(), 'private-only symbol is absent from a separate extension');
if ($mode eq 'private') {
  check(LeanBridge::Runtime::_mapped_library($extension) eq $extension, 'exact extension path');
  check(LeanBridge::Runtime::_mapped_library('liblb-loader-private.so') eq "$root/liblb-loader-private.so", 'exact dependency path');
  for (1..8) {
    LeanBridge::Runtime::_open_private_library($extension);
    check(LeanBridge::LoaderProbe::read() == 29, 'warm load keeps private binding');
  }
  my $child = fork();
  die "fork failed: $!" unless defined $child;
  if (!$child) {
    for my $entry (\&LeanBridge::Runtime::_mapped_library, \&LeanBridge::Runtime::_open_private_library) {
      my $ok = eval { $entry->($extension); 1 };
      POSIX::_exit(71) if $ok || $@ !~ /initiating process and Perl interpreter thread/;
    }
    POSIX::_exit(0);
  }
  waitpid($child, 0); check($? == 0, 'fork child rejected before loader access');
  if (($Config{useithreads} // '') eq 'define') {
    my $thread = threads->create(sub {
      for my $entry (\&LeanBridge::Runtime::_mapped_library, \&LeanBridge::Runtime::_open_private_library) {
        my $ok = eval { $entry->($extension); 1 };
        return 0 if $ok || $@ !~ /initiating process and Perl interpreter thread/;
      }
      return 1;
    });
    check($thread->join(), 'cloned interpreter rejected before loader access');
  }
  check(LeanBridge::LoaderProbe::read() == 29, 'parent survives foreign-context rejection');
}
print JSON::PP->new->canonical->encode({ checks => $checks, value => $value, global => $default });
