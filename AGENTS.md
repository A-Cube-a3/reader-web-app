# Reader app contributor instructions

1. Read `docs/roadmap.md` before starting roadmap work.
2. Inspect `git status`, current branches, recent history, merged PRs, architecture documents, and current source. Determine the last completed and merged phase from repository evidence; never infer it from conversation history alone.
3. Work only on the next incomplete phase. Use its documented `phase/*` branch, based on the newly fetched and pulled `main` that contains the previous phase merge.
4. Keep each phase in its own PR. Make multiple coherent commits where scope naturally permits, add/update tests with behavior changes, and update affected documentation in the same PR.
5. Validate relevant lint, tests, builds, migrations, offline behavior, and security-sensitive paths before pushing. Record actual results; never claim checks that did not run.
6. Preserve unrelated work and credentials. Do not commit real `.env` files, secrets, signing material, generated books/storage, or accidental build artifacts.
7. Push the phase branch and open a PR targeting `main`. Never merge it or enable auto-merge. Hand off the PR with commits, validation, migrations/configuration, limitations, and manual checks, then stop.
8. If context is incomplete or plans change, reconstruct state from this file, `docs/roadmap.md`, architecture docs, Git history, merged PRs, and source. Update `docs/roadmap.md` in the same PR as any approved roadmap change.
