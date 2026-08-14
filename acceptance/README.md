# Acceptance records

This directory stores reviewed, versioned inputs for onboarding and clean-room acceptance. The records describe which sessions or observations count as evidence. They do not contain generated packages or replace the human-readable evidence pages.

## Files

| File | Role |
|---|---|
| [`clean-room-sessions.v1.json`](clean-room-sessions.v1.json) | Identifies clean environments, participant or runner context, tasks, observations, and completion status for the usability protocol. |
| [`zero-config-audit.v1.json`](zero-config-audit.v1.json) | Records whether an unannotated Lake project passed analysis, build, package, receipt, prompt, wrapper, and source-mutation checks. |
| [`time-to-package-budgets.v1.json`](time-to-package-budgets.v1.json) | Preserves the legacy versioned comparison input consumed by the existing time-to-package tooling. It is retained for record compatibility, not as an end-user performance claim. |

The file names and versions are stable inputs to validators under [`../src/adoption`](../src/adoption/README.md). Schemas under [`../schema`](../schema/README.md) define their machine-readable shape.

## Evidence flow

```text
onboarding fixtures + acceptance record
                    |
                    v
         adoption validators and checks
                    |
                    v
       executed report with limitations
                    |
                    v
              evidence page
```

The acceptance record fixes the reviewed protocol. The executed report captures what happened in one run. Evidence pages interpret the result and retain links to commands and artifacts. Keeping these layers separate prevents a planned check from being mistaken for a passed workflow.

## Editing a record

1. Change the versioned record and its schema together when the shape changes.
2. Update the matching validator in [`../src/adoption`](../src/adoption/README.md).
3. Add valid and invalid fixtures to the corresponding test.
4. Execute the acceptance command in a clean directory.
5. Update the evidence page only from the observed result.

Do not hand-edit generated run output into these protocol files. A changed task, fixture, or acceptance criterion requires a new reviewed record and fresh evidence.

## Running the checks

`npm run acceptance:zero-config` evaluates the unannotated project workflow. `npm run acceptance:clean-room` evaluates the clean-room session record. `npm run test:onboarding-acceptance` and `npm run test:usability-gate` cover validators and decision logic without claiming a new clean-room execution.

Human-readable results live in the [zero-configuration evidence](../docs/evidence/zero-configuration-acceptance.md) and [clean-room usability protocol](../docs/evidence/clean-room-usability-protocol.md). Current downstream runtime states remain in the [consumer support contract](../docs/consumer-support.v1.json).
