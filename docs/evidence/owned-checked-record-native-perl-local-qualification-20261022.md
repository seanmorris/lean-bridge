# Native and Perl owned checked-record local qualification

Implementation: `162f6aafa07f6f3221e67079a9f92f2b874d1f6a`

The ordinary-source full and result-only packages were rebuilt byte-for-byte, verified, installed without their author trees, relocated, and executed from their public C, C++, and Perl APIs. The full C consumer completed 261 checks, C++ completed 125 with ASan, UBSan, and LSan, and every one of the eight Perl ABI/install combinations completed 63 checks plus six cold/warm installed-asset tamper controls. Result-only packages completed 14 C, 3 C++, and 9 Perl checks per Perl combination without relying on callback declarations.

This is the bounded local qualification used before the milestone push. The recurring workflow executes and retains the complete ordinary/reviewed, full/result-only matrix.
