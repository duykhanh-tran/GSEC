# WS6 React foundation — Group B

## Outcome

Group B adds reusable interaction primitives and configuration contracts only. Codes 60161–60166 remain `planned` and continue to use the Foundation intake page until Group C migrates each task.

## Added components

- `ListeningPlaybackCard`: full-listening gate, replay state, progress semantics and configurable language/rate.
- `ListeningChoiceTask`: listening-specialised wrapper over the existing `GuidedChoiceTask`; it does not duplicate retry logic.
- `SequenceOrderInput`: controlled slots, fixed positions and duplicate-choice prevention.
- `SequenceRepairPanel`: position-focused repair, multi-attempt hints and optional model reveal.
- `ReadinessChecklist`: controlled, accessible checklist extracted as a reusable contract for speaking and writing readiness.
- `WritingVerificationChecklist`: book-based mechanics checks, vocabulary evidence and validation-message surface.
- `DraftComparison`: reusable first/revised version comparison.
- `LanguageHelpPanel`: compact reusable phrase support.

## Optimised existing components

- `GuidedChoiceTask` now optionally supports mandatory full playback and item-level targeted replay.
- `RepairRecordingFlow` now reports model use and renders a configurable Guided note.
- `useSpeechSynthesis` now accepts language, rate and completion callbacks while preserving existing calls.

## Rules for Group C

- 60161–60162 must use `ListeningChoiceTask` with data-only configurations.
- 60163 must compose `RepairRecordingFlow`, `ProgressSteps` and recording primitives.
- 60164 must use both ordering components.
- 60165 must use `ReadinessChecklist` and `LanguageHelpPanel`.
- 60166 must use `WritingVerificationChecklist`, `DraftComparison`, `ScoreGrid`, `MasteryGate` and recording primitives.
- Task-local CSS may only express task-specific layout; standard controls must remain in shared CSS.
