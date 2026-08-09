namespace PhpNativeRuntime.RuntimeProbe

@[export lean_link_php_runtime_probe_ping]
def ping (value : UInt32) : UInt32 :=
  value + 2

end PhpNativeRuntime.RuntimeProbe
