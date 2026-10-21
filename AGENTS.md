# SyncOra repository instructions

For every UI change, read and follow [DESIGN.md](DESIGN.md) first. It defines the Blissora palette, shadcn components, mobile layouts, validation and accessibility requirements. Reuse `src/components/ui` primitives and semantic tokens in `src/app/styles.css`; do not introduce parallel feature-specific component styles or another UI kit. Preserve existing Supabase authorization and historical data rules. Record verification in `docs/verification.md`.
