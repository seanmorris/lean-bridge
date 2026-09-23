# Recursive Ruby value declarations

The Ruby graph generator emits keyword-initialized, frozen record and constructor
classes. Variants retain named families such as `Spine::Leaf` and `Spine::Next`.
Their abstract family cannot be constructed with `new`. Values support `==`,
`eql?`, `hash` and `deconstruct_keys` for Ruby pattern matching. Equality requires
the exact generated class and follows the contained values' Ruby semantics.
Bound builtin methods read stored fields and check classes without calling
overridden instance accessors.

Unit uses the generated `UNIT` singleton. `nil`, `Some.new(nil)` and
`Some.new(UNIT)` remain distinct. `Ok` and `Err` retain their branches even when
payload types match. Arrays and Lists use Ruby Arrays. Frozen field references
can contain mutable arrays and strings; construction alone does not validate
the payload against the Lean contract.

Concrete aliases keep their original targets and chains in metadata and source
comments. They use their Ruby target values without adding constants, wrapper
classes or RBS declarations. Nominal references stay finite across direct and
mutual recursion. A 700-alias shared structural graph produces bounded source
instead of expanding an exponential tree.

The enabled MRI Ruby 3.3.12 test executes 70 assertions covering recursion,
equality and hashes, pattern matching, frozen fields, nested option/result
values, all nineteen scalar fields, empty/Unit constructors, an uninhabited
family, a 256-field constructor and independent nested copies. Name checks reject
helper/member collisions before source generation.

```sh
LEAN_BRIDGE_RUBY_GRAPH_TEST=1 \
  node --test tests/ruby-copied-graph-values.test.mjs
```

CI requires this execution and retains `build/recursive/ruby-values.json`.
These declaration checks do not exercise compiled Lean calls or prepared gems.
The subsequent [native conversion milestone](ruby-recursive-conversions-20260923.md)
verifies layouts, bounded copies and lifecycle/failure cleanup with compiled
Lean. Original installed gem acceptance remains pending. Ruby's package path
still rejects recursive exports; these milestones promote no installed cells.
