<?php
declare(strict_types=1);
define('PHP_RECURSIVE_RETIRE_MUTANT',true);
try { require __DIR__.'/php-recursive-native-faults.php'; }
catch(Throwable $error) {
    if(!str_contains($error->getMessage(),'malformed_output_retires_runtime')) {
        fwrite(STDERR,$error::class.': '.$error->getMessage()."\n");exit(2);
    }
    fwrite(STDERR,"malformed_output_retires_runtime\n");exit(1);
}
fwrite(STDERR,"Missing retirement mutant escaped detection\n");exit(3);
