# WS6 React migration — Group C

## Outcome

Group C is complete. Tasks 60161–60166 have been migrated from the frozen WS6 HTML sources into registered React routes. The original HTML files remain reference-only and their baseline hashes are unchanged.

## Migrated tasks

| Code | React implementation | Main reusable building blocks |
| --- | --- | --- |
| 60161 | `src/tasks/60161/Task60161.tsx` | `ListeningChoiceTask`, playback gate, targeted replay, Guided retries |
| 60162 | `src/tasks/60162/Task60162.tsx` | `ListeningChoiceTask`, A/B/C choices, playback evidence, Guided retries |
| 60163 | `src/tasks/60163/Task60163.tsx` | `RepairRecordingFlow`, `ProgressSteps`, recording and transcript confirmation |
| 60164 | `src/tasks/60164/Task60164.tsx` | `SequenceOrderInput`, `SequenceRepairPanel`, model reveal |
| 60165 | `src/tasks/60165/Task60165.tsx` | `LanguageHelpPanel`, `ReadinessChecklist`, missing-item validation |
| 60166 | `src/tasks/60166/Task60166.tsx` | `WritingVerificationChecklist`, `DraftComparison`, `ScoreGrid`, `MasteryGate`, recording flow |

All six codes are marked `migrated` in `src/app/task-catalog.json` and mapped to concrete components in `src/app/task-registry.tsx`. The production build now generates 32 static task entry points.

## Behaviour preserved

- Full-listening gates, replay and question-level replay for 60161–60162.
- Five sequential sentence recordings, transcript confirmation and Guided repair for 60163.
- Fixed-position sequence ordering, focused retry and model-answer flow for 60164.
- Worksheet language support, required readiness checks and validation for 60165.
- First draft, feedback, book verification, revision, comparison, rubric score and mastery result for 60166.

## Verification evidence

- WS6 behaviour E2E: 6/6 passed.
- Whole-system route and responsive smoke: 2/2 passed across all 32 migrated routes.
- Static URL compatibility: 3/3 passed.
- Unit tests: 39/39 passed.
- Lint: passed.
- TypeScript: passed.
- Production build: passed; 32 static task entry points generated.
- Baseline verification: WS 1–5 sources 26/26, Propotype baseline 144/144, WS6 sources 6/6 passed.

## Safety boundary

No original WS6 HTML source was edited. Further changes should be made only in `Propotype-React`, while the frozen manifests remain the comparison baseline.

## Source-parity corrections

The post-migration source comparison was applied after Group C:

- 60161 now uses the original introductory instruction and original playback metadata.
- 60162 now shows the original full-replay metadata.
- 60163 uses the shared `ProgressSteps` component in the compact five-segment presentation used by the source.
- 60164 does not mount its repair panel until a completed order has been checked and found incorrect.
- Regression coverage now asserts the source playback copy, compact progress and the absence of premature repair UI.
