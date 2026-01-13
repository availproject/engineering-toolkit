# GitHub Project Management Guidelines (Template)

> **Purpose:** Define how we plan work, manage issues/PRs, review code, and ship changes in GitHub for both public and private repositories.  
> **Audience:** Anyone contributing to this repository.  
> **Scope:** Issues, PRs, branching, reviews, releases, and repository settings.

---

## 1) Repository Basics

### 1.1 Ownership & Roles
- **Code Owners:** Define who reviews/owns areas of the codebase via `CODEOWNERS`.
- **Maintainers:** People responsible for triage, releases, and enforcing standards.
- **Contributors:** Anyone submitting issues or pull requests.

**Recommended files:**
- `README.md` (what/how/why + quickstart)
- `CONTRIBUTING.md` (how to contribute)
- `CODE_OF_CONDUCT.md` (public repos)
- `SECURITY.md` (public repos; private optional)
- `LICENSE` (public repos required; private optional but recommended)

---

## 2) Visibility: Public vs Private

### 2.1 Public Repositories
- Avoid committing secrets (ever). Assume everything is permanent.
- Use `SECURITY.md` for vulnerability reporting.
- Prefer discussions/issue templates to reduce noise.
- Be mindful of sensitive internal references (customers, infrastructure, names).

### 2.2 Private Repositories
- Still follow the same hygiene rules: no secrets, clear history, good reviews.
- Use internal channels for incident/security topics where appropriate.
- Restrict admin permissions and protect default branches.

---

## 3) Work Planning & Tracking

### 3.1 Issues
Use issues for:
- Bugs, enhancements, tasks, investigations, proposals.

**Issue best practices:**
- Use clear titles (actionable, specific).
- Provide expected behavior, actual behavior, and reproduction steps for bugs.
- Link related issues/PRs.
- Add labels and assign an owner when work starts.

### 3.2 Labels (Suggested)
- `type:bug`, `type:feature`, `type:chore`, `type:docs`, `type:security`
- `priority:p0`, `priority:p1`, `priority:p2`
- `status:blocked`, `status:needs-info`
- `area:<name>` (optional; e.g. `area:rust`, `area:ts`, `area:docs`)

### 3.3 Milestones / Projects
Use GitHub Projects (or milestones) for:
- Roadmaps, release scopes, cross-team initiatives.

**Recommended columns (simple):**
- Backlog → Ready → In Progress → In Review → Done

---

## 4) Branching Strategy

### 4.1 Default Branch
- Default branch: `main` (recommended).
- All changes come through Pull Requests (no direct pushes).

### 4.2 Branch Naming
Use one of:
- `feature/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`
- `docs/<short-description>`

Optionally prefix with issue number:
- `feature/123-add-login-rate-limit`

### 4.3 Keep Branches Small
- Prefer small PRs that are easier to review and safer to ship.
- Split large work into stacked PRs or incremental PRs.

---

## 5) Pull Requests (PRs)

### 5.1 When to Open a PR
Open a PR when:
- You want feedback early (mark as Draft).
- You have a meaningful unit of change ready for review.
- You want CI to validate the work.

### 5.2 PR Description Template
Include:
- **What:** What changed.
- **Why:** The motivation.
- **How:** Implementation notes.
- **Testing:** How it was verified.
- **Screenshots/Logs:** If relevant.
- **Risks:** Potential impact and rollback plan.
- **Links:** Related issues/docs.

Example:

- What: …
- Why: …
- How: …
- Testing: …
- Risks / Rollback: …
- Issue: Closes #…

### 5.3 PR Size & Scope
Guideline:
- Aim for PRs that can be reviewed in **~15–30 minutes**.
- If larger, explain why and provide a review guide.

---

## 6) Code Review Standards

### 6.1 Review Expectations
- At least **1 approval** for low-risk changes; **2 approvals** for high-risk areas (define if needed).
- Review for:
  - Correctness and edge cases
  - Security and privacy
  - Observability (logs/metrics where applicable)
  - Maintainability and clarity
  - Tests

### 6.2 Author Responsibilities
- Keep PR focused and readable.
- Respond to comments with either changes or rationale.
- Resolve conversations before merging (unless explicitly deferred).

### 6.3 Reviewer Responsibilities
- Be timely and constructive.
- Approve when it meets the bar—don’t bikeshed.
- Request changes when there are correctness/security/maintainability issues.

---

## 7) Merging Strategy (Recommended: Squash & Merge)

### 7.1 We Use: **Squash and Merge**
**Default:** Use **Squash & Merge** for merging PRs into `main`.

**Why:**
- Keeps `main` history clean and readable.
- Ensures each PR becomes one coherent commit.
- Prevents “WIP”/fixup commits from cluttering history.
- Makes revert operations simpler (one commit per PR).

### 7.2 Squash Commit Message Format
Use:
- `type(scope): summary` (optional scope)
- Body includes context and references.

Examples:
- `feat(rust): add kb CLI subcommand for init`
- `fix(ts): prevent crash on empty config`
- `docs: add release checklist`

Include issue references where relevant:
- `Closes #123`

### 7.3 When NOT to Squash
Rare exceptions (only if you explicitly agree as a team):
- You need preserved commit history for a long-running branch (uncommon).
- You’re merging a release branch (see release section).

Otherwise, squash.

---

## 8) CI, Checks, and Quality Gates

### 8.1 Required Checks
Before merge:
- Build passes
- Tests pass
- Lint/format checks pass
- Security checks (if configured) pass

### 8.2 Branch Protection (Recommended Settings)
Protect `main`:
- Require PRs (no direct pushes)
- Require approvals
- Require status checks
- Require conversation resolution
- Restrict who can push (optional)
- Require signed commits (optional, if your org uses it)
- Require linear history (optional; compatible with squash)

---

## 9) Releases & Versioning

### 9.1 Release Cadence
Define:
- On-demand / weekly / biweekly / monthly
- Who is responsible

### 9.2 Versioning
Choose one:
- SemVer (`MAJOR.MINOR.PATCH`)
- Date-based (`YYYY.MM.DD`)
- Internal build numbers

### 9.3 Release Process (High Level)
- Update changelog / release notes
- Tag a release
- Publish artifacts (if any)
- Announce in relevant channel(s)

**Optional files:**
- `CHANGELOG.md`
- `RELEASE.md` (detailed steps)

---

## 10) Security & Secrets

### 10.1 Secrets Policy
- No secrets in git history.
- Use GitHub Secrets / your secret manager for CI and deployments.
- Rotate secrets if exposure is suspected.

### 10.2 Vulnerability Reporting (Public)
- Add `SECURITY.md` with reporting instructions.
- Consider enabling Dependabot alerts/updates.

---

## 11) Documentation Standards

- Keep docs close to the code only when tightly coupled.
- Otherwise, document in `/docs`.
- For significant changes: update docs in the same PR.

---

## 12) Decision Records (Optional but Recommended)
Use ADRs for meaningful decisions.

- Location: `docs/adr/`
- Format: `NNNN-title.md`
- Include context, decision, alternatives, and consequences.

---

## 13) Maintenance: Triage & Hygiene

### 13.1 Triage Routine
- Weekly issue triage:
  - Close stale issues (with explanation)
  - Label new issues
  - Assign owners or request info

### 13.2 Stale Policy (Optional)
If enabled:
- Mark stale after N days with no activity
- Close after M additional days

Be careful in public repos—don’t auto-close legitimate issues too aggressively.

---

## 14) Appendix

### 14.1 Suggested Repository Files
- `README.md`
- `CONTRIBUTING.md`
- `CODEOWNERS`
- `SECURITY.md` (public strongly recommended)
- `CODE_OF_CONDUCT.md` (public recommended)
- `LICENSE` (public required)
- `.github/ISSUE_TEMPLATE/*`
- `.github/PULL_REQUEST_TEMPLATE.md`

### 14.2 PR Checklist (Copy/Paste)
- [ ] Linked issue (if applicable)
- [ ] Tests added/updated
- [ ] Docs updated (if applicable)
- [ ] CI passing
- [ ] Security considerations reviewed
- [ ] Ready to squash & merge
