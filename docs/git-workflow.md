# Git Workflow

How changes move from an idea to production. Contributor basics are in
[`CONTRIBUTING.md`](../CONTRIBUTING.md); the checks referenced below are in
[`testing.md`](testing.md).

## Branches

| Branch | Role |
| ------ | ---- |
| `main` | Production branch. Holds only released, production-ready code |
| `develop` | Integration branch. Reviewed work from all streams lands here first |
| `feature/identity`, `feature/organizations`, `feature/ideas`, `feature/reviews`, `feature/projects` | Long-lived domain branches, one per business domain |
| `chore/<name>`, `fix/<name>`, other short-lived branches | Temporary task branches, for example the Sprint 0 foundation work (`chore/sprint-0-ci`) |

Branch off `develop`, name the branch after the work, and delete temporary
branches after they are merged.

`main` and `develop` are never committed to directly. All changes reach them
through a pull request.

## Flow for a change

```
Issue → branch → implementation → local validation → commit → push
      → Pull Request → GitHub Actions CI → review → merge into develop
```

1. **Issue.** Start from an issue (bug report or feature request template) or a
   Sprint task so the change has a defined scope.
2. **Branch.** Create a branch from an up-to-date `develop`, or work on the
   relevant domain branch.
3. **Implementation.** Keep the change scoped to one task.
4. **Local validation.** Run the checks in
   [`development.md`](development.md#checks-before-opening-a-pull-request).
5. **Commit.** Write a message that explains why the change was made, not just
   what changed.
6. **Push** the branch to `origin`.
7. **Pull Request** into `develop`, filling in the
   [pull request template](../.github/PULL_REQUEST_TEMPLATE.md).
8. **CI.** GitHub Actions runs the Backend and Frontend jobs on the pull
   request ([details](testing.md#continuous-integration)). Fix failures on the
   branch; do not merge with a red check.
9. **Review.** Address review feedback with further commits.
10. **Merge into `develop`.**

## Releases

```
develop → staging / UAT → main → production
```

- Work is validated on `develop`, then promoted to a production-like staging
  environment for QA/UAT.
- Once validated, the release is merged into `main` through a pull request,
  and `main` is what is deployed to production.
- CI runs on `main` as well as `develop`.

The environments themselves are described in
[`environments.md`](environments.md). No deployment automation exists yet:
CI validates code and does not deploy.

## Domain branches

A domain branch (for example `feature/identity`) collects the work for one
business domain over several tasks. Merge `develop` into it regularly so it
does not drift, and merge it back into `develop` through a pull request when
a reviewed piece of work is ready. Business domains are not implemented yet;
Identity is the first, planned for Sprint 1.

## Rules

- Do not push directly to `develop` or `main`.
- Do not rewrite shared history. No force-pushes to `main`, `develop`, or any
  branch other people are using, and no rebasing of shared branches. Rewriting
  your own unpushed or personal branch is fine.
- To undo a change that has already been merged, use `git revert` and open a
  pull request.
- Keep pull requests scoped to a single task.
- Never commit secrets; see
  [`environments.md`](environments.md#never-commit).
