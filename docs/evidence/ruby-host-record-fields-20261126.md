# Application-owned objects in an installed Ruby record

The [station project](../../tests/fixtures/ruby-host-record/Workshop.lean)
defines `Station.Panel` in a module named `Workshop`. It takes two panels as
arguments, reads the application's meters, and can return a fresh panel with
the same meters in different fields. These are application-owned MRI objects,
not handles for Lean objects.

| Source route | Installed consumer | Original gem |
| --- | --- | --- |
| Ordinary Lean project | [Execution](ruby-host-record-fields-20261126/ordinary.execution.json) | [Receipt](ruby-host-record-fields-20261126/ordinary.package-set.json) |
| Independently reviewed interface | [Execution](ruby-host-record-fields-20261126/reviewed.execution.json) | [Receipt](ruby-host-record-fields-20261126/reviewed.package-set.json) |

The [Ruby application](../../tests/fixtures/ruby-host-record/consumer.rb):

- Uses `equal?` to identify the original objects after a swap and heap
  compaction. Mutating a sensor affects the next call through Lean.
- Puts an invalid object in the second record, or an out-of-range integer
  in the first. Neither sensor is read. If a valid object raises in a call,
  the caller receives that exact exception and the binding remains usable.
- Keeps two fields pointing to one object. Closing a duplicated or frozen
  panel releases only that panel's references. A weak reference observes
  the meter while a result owns it and its collection after close.
- Distinguishes reading a Ruby field after the binding closes from calling
  Lean on an unbound fiber. The former works; the latter fails.

The [test](../../tests/helpers/ruby-host-record-installed.mjs) installs the
publisher CLI offline, builds the two projects, authenticates each receipt
and deletes the producer. It installs the gem locally, removes both copies
of its archive, moves the installed directory, and runs the consumer with
no tools on `PATH`. The reviewed interface can change a field's documentation.
Reordering the fields is rejected without producing a release directory.

With the configured Lean toolchain and the supported MRI on your system:

```sh
LEAN_BRIDGE_RUBY=/path/to/ruby npm run test:ruby-host-records
```

This is the synchronous RubyGems host adapter on Linux. It does not
establish that a Ruby record can cross a worker API, that its fields can
be callbacks, or that another language implements this shape.
