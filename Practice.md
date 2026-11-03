# How we work on this project

Read SPEC.md before making any change.

## On every request
1. **Review.** Confirm the request fits SPEC.md and name the feature (Must / Should / Later).
   If it is on the "is not" list, say so and stop. Anything unclear: ask.
2. **Plan.** Write a short plan (3-5 lines). Wait for approval.
3. **Branch.** One request = one branch: `git switch -c feat/<short-name>` (or `fix/<name>`).
4. **Build.** Make only the change in the plan.
5. **Test.** Run all tests: `node --test`. Add at least one test for the new behaviour,
   taken from "Done means" in SPEC.md. Never commit with a failing test.
6. **Commit.** One request, one commit. First line = what. Body = details. Last line =
   `Spec: <section / feature>`. Keep README.md up to date in the same commit.

## Saving and updating GitHub
7. Push the branch: `git push -u origin feat/<short-name>`
8. Open a Pull Request: `gh pr create --fill`. The PR description says what changed and
   which "Done means" lines it covers.
9. Review the diff on GitHub, then merge: `gh pr merge --merge --delete-branch`.
10. Back to main: `git switch main && git pull`.
11. GitHub Pages publishes `main` automatically. Check the live site after each merge.

## Rules
- Never work directly on `main`; everything reaches `main` through a Pull Request.
- No secrets in the repo: no API keys, passwords or real customer data. Mock data only.
- A bug outside the request: open a GitHub Issue (`gh issue create`) with title, steps,
  expected, actual. Never fix it silently. Close it with `Fixes #N` in a commit.
- When Claude skips a step, fix this file, not the chat.
