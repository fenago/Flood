# Spec: Agent Console "Approve and deploy" confirmation

Owner: Wren. Based on console-ux and proposal-approval-flow skills and
docs/04-agent-console.md section 3. Security behaviour belongs to agent-console-engineer
and security-engineer; this spec covers what the owner sees and does.

## User goal
"Ship this change only if I'm sure what goes live, and know right away if it worked."

## Entry
Proposal review screen: summary, file list with +/- counts, diff (side-by-side with a
unified toggle), warnings. Primary button names the exact effect.

> [APV-BTN] Approve and Deploy {n} Files to Production
> [APV-REJECT] Reject

Warnings shown above the button (each with text, not colour only):
> [APV-WARN-NET] This change adds a new web address: {domain}. Check that you trust it.
> [APV-WARN-SCRIPT] This change adds or edits a script file. Read it before you approve.

## Confirmation sheet (not an alert: it needs a file list)
- Large detent sheet, title, what will happen, file list (paths + counts), checkbox,
  password field if re-auth is enabled, Cancel (leading) and Deploy (trailing,
  prominent). Deploy disabled until the checkbox is ticked.
- Deploy is the primary action but is not styled destructive: it is the action the owner
  chose deliberately (HIG: destructive style is for loss people did not choose). It is
  still confirmed because it is hard to undo and affects every user.

> [CONF-TITLE] Deploy to production?
> [CONF-BODY] This commits {n} files to the main branch on GitHub. Netlify then updates the live site for everyone.
> [CONF-FILES] Files in this change
> [CONF-CHECK] I read the changes and want them live.
> [CONF-PASS] Type your console password to go on.
> [CONF-CANCEL] Cancel
> [CONF-DEPLOY] Deploy

## Progress and results
| State | What shows | Copy |
|---|---|---|
| Committing | Deploy button shows spinner, label changes, all buttons disabled, sheet can't be swiped away | [PROG-COMMIT] |
| Committed | Sheet closes; status card with commit link | [DONE-COMMIT], [DONE-LINK] |
| Deploying | Status card polls; indeterminate indicator | [PROG-DEPLOY] |
| Live | Status card success | [DONE-LIVE] |
| Stale proposal | `role="alert"` in sheet; Deploy disabled | [ERR-STALE], [ERR-STALE-BTN] |
| Commit failed | `role="alert"`; nothing changed on the site | [ERR-COMMIT] |
| Rate limited | `role="alert"` with wait time | [ERR-RATE] |
| Session expired | Return to login after Cancel, proposal kept | [ERR-SESSION] |
| Wrong password | Inline under the field, field keeps focus | [ERR-PASS] |
| Already approved (double submit) | Show the existing result, no second commit | [ERR-DUP] |

> [PROG-COMMIT] Committing to GitHub…
> [DONE-COMMIT] Committed. Netlify is building the new version.
> [DONE-LINK] View commit on GitHub
> [PROG-DEPLOY] Deploying… This usually takes a minute or two.
> [DONE-LIVE] Live. The site now runs this change.
> [ERR-STALE] The main branch changed since this proposal was made. Ask the agent to update it.
> [ERR-STALE-BTN] Ask Agent to Update
> [ERR-COMMIT] The commit failed, so nothing changed on the live site. Try again in a minute.
> [ERR-RATE] Too many requests. Wait {seconds} seconds, then try again.
> [ERR-SESSION] Your session ended. Sign in again. This proposal is saved.
> [ERR-PASS] That password didn't match. Try again.
> [ERR-DUP] This proposal was already approved. Here is the result.

## Accessibility
- Sheet: `role="dialog"`, `aria-modal`, labelled by [CONF-TITLE]; initial focus on the
  title, not on Deploy (avoids an accidental Enter).
- Diff and file list use "+"/"−" and the words "added"/"removed".
- Progress text in `role="status"`; errors in `role="alert"`.
- All buttons >= 44 x 44 CSS px; Cancel and Deploy at least 8 px apart.

## Acceptance criteria
1. AC1 The review button label contains the exact file count ("2 Files").
2. AC2 Deploy is disabled until the checkbox is ticked (and password entered when
   re-auth is on).
3. AC3 Pressing Enter right after the sheet opens does not deploy.
4. AC4 One click on Deploy sends exactly one approve request; a double-click or second
   tab still yields one commit (mock GitHub) and the second shows [ERR-DUP].
5. AC5 While committing, Cancel, Deploy and swipe-to-dismiss are disabled.
6. AC6 Stale `baseSha` fixture -> [ERR-STALE] in `role="alert"`, Deploy disabled.
7. AC7 Commit failure fixture -> [ERR-COMMIT]; no "Live" state appears.
8. AC8 Success fixture -> [DONE-COMMIT] with a link whose href is the commit URL, then
   [DONE-LIVE] after the mocked deploy status reports ready.
9. AC9 axe-core: 0 violations on review, sheet open, committing and error states.
10. AC10 All copy lines pass grade <= 8 in `readability.mjs`, or are listed as exceptions.

## Handoff
- agent-console-engineer: states, idempotent approve, deploy status polling.
- security-engineer: review re-auth, CSRF and double-submit behaviour.
- qa-engineer: AC1-AC10 with mocked GitHub and Netlify.
