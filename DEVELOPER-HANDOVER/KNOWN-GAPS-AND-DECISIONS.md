# Known gaps và Decision Register

Tài liệu này ngăn đội nhận bàn giao hiểu nhầm prototype là production. Trạng thái
`Open` nghĩa là dev/product/security/legal phải chốt trước giai đoạn liên quan.

| ID | Khoảng trống/quyết định | Owner đề xuất | Hạn chốt | Trạng thái |
|---|---|---|---|---|
| D-01 | Identity provider và session model | Engineering + Security | Trước D2 | Open |
| D-02 | Tenant hierarchy: organization/school/class | Product + Engineering | Trước D2 | Open |
| D-03 | Database, revision và audit storage | Backend lead | Trước D2 | Open |
| D-04 | JSON Schema validator/codegen toolchain | Tech lead | D1 | Open |
| D-05 | Admin form renderer và preview isolation | Frontend lead | Trước D3 | Open |
| D-06 | Assessment service API/idempotency | Backend lead | Trước D4 | Open |
| D-07 | Microphone/upload/ASR/TTS providers | Product + Engineering | Trước D6 | Open |
| D-08 | Raw audio retention/delete/export policy | Privacy + Legal | Trước D6 | Open |
| D-09 | AI provider, model, prompt registry và budget | AI lead + Security | Trước D7 | Open |
| D-10 | AI quality threshold và teacher override policy | Academic + Product | Trước D7 | Open |
| D-11 | Child/student privacy, consent, residency | Legal + Privacy | Trước pilot | Open |
| D-12 | Production hosting, secrets, backup/DR | Platform lead | Trước D9 | Open |
| D-13 | Accessibility target và supported devices | Product + QA | Trước D9 | Open |
| D-14 | Analytics/event taxonomy và retention | Product + Privacy | Trước D9 | Open |
| D-15 | Abstraction cho task 60115 | Frontend + Content | Trước migrate WS1 | Open |

## Khoảng trống kỹ thuật đã biết

- Prototype vẫn có client-side answer key ở một số task; chỉ dùng demo.
- Recording/ASR/TTS hiện mô phỏng hoặc dùng browser capability tham chiếu.
- Không có backend, authentication, persistence, tenant hoặc audit production.
- 19 task vẫn là composed TSX; 13 task dùng config wrapper.
- `writing-capture-repair` 60115 là developer-extension.
- TypeScript runtime schema chứa `ReactNode`/callback và không phải Admin DTO.
- Chưa chọn tool JSON Schema, form generation, API framework hoặc database.
- Chưa có Storybook/package UI độc lập; component hiện nằm trong app prototype.
- Chưa có legal/security review cho dữ liệu học sinh, audio hoặc AI provider.

## Cách cập nhật decision

Mỗi quyết định cần ghi owner, ngày, lựa chọn, lý do, ảnh hưởng contract, migration
và rollback. Nếu quyết định làm thay đổi payload hợp lệ hoặc semantics, tăng
schema/contract version theo Bước 3–5; không sửa lặng lẽ file `1.0.0`.

