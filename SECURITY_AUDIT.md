# Historical security audit — 2026-11-18

> Superseded by [`SECURITY_AUDIT_2026-11-25.md`](SECURITY_AUDIT_2026-11-25.md). This file records the earlier state and should not be used as the current assessment.

## Scope and limitations

Reviewed the browser app (`app.js`, `index.html`, `sw.js`), Apps Script backend (`apps-script-final.js`), deployment helpers, and available local files. This folder is **not a Git repository**, has no `package.json` or dependency lockfile, and no production Google Drive/Sheet sharing settings were available for inspection. Therefore this is not a full infrastructure or Git-history audit.

There is no honest way to promise “100% security” or “zero vulnerabilities.” The application currently uses a publicly callable Apps Script web app as its API, so security must be enforced by the backend on every action.

## Findings

### Critical — admin authorization trusts a client-supplied name

Several privileged routes authorize with `isSupervisorName(data.requesterName || data.by)`. The browser supplies that value; it is not proof of identity. Other administrative routes (for example member approval/role changes, bans, some delete actions, and settings writes) have no equivalent server-side identity check. A caller who knows the public web-app URL can forge a supervisor name or call those actions directly.

**Effect:** unauthorized account/role changes, content deletion, settings changes, and access to pending-registration details may be possible. Do not treat the current supervisor checks as a security boundary.

### Critical — private/admin API reads are publicly callable

Examples include pending-registration data, notification data, mail diagnostics, and user-specific data endpoints that accept a caller-provided member ID. The pending-registration route exposes one-time codes and contact information after the spoofable name check. The mail diagnostic route previously returned member email addresses and verification codes from its log.

### High — provider credentials were saved in browser `localStorage`

The notification-settings UI serialized the complete settings payload, including Mailjet/Telegram/provider secrets, to `localStorage`. A browser extension or any same-origin script/XSS could read them. I changed the current source to store only a whitelist of non-secret preferences, purge legacy secret fields at app startup, and leave secret inputs blank while showing whether a secret is configured server-side. **This fix is not active until the frontend bundle is deployed.** Rotate provider keys that may have been exposed in browser storage.

### High — one-time verification codes in the mail log

The mail log stored sent verification codes, and the public mail-status route returned them. The current source now stops writing codes into that log, clears legacy code-column values when the diagnostic runs, and no longer returns recent logs, email addresses, BCC or account identity. **This requires a backend deployment.** Assume old codes in the log may have been readable until that deployment/cleanup.

### High — weak password hashing and no admin 2FA

Passwords use a custom repeated-SHA-256 construction (10,000 rounds), not a standard password KDF such as Argon2id, scrypt or PBKDF2 with a reviewed configuration. There is no second factor for administrators. A safe migration needs a staged hash upgrade and a deliberate admin 2FA enrollment/recovery flow; changing this in place risks locking out members.

### High — no effective API rate limiting or spending cap

Registration has limited per-email resend/verification controls, but login, password reset, and file upload do not have robust per-account/IP throttles. Apps Script/Drive quotas are not an application spending cap. Public upload endpoints can be abused for storage/quota exhaustion.

### Medium — Drive files are shared to anyone with the link

Image/PDF upload helpers set Drive sharing to `ANYONE_WITH_LINK`. This may be suitable for public book covers and public reports, but is inappropriate for private member photos or any sensitive document. Drive folder ACL and content inventory still need owner-side review.

### Medium — no Git history or dependency audit possible

There is no `.git` directory, `package.json`, or lockfile here, so Git history and third-party dependency vulnerabilities could not be checked. A scan of current source files found no credential-shaped hardcoded key/private-key literals; this does not cover GitHub history, Apps Script properties, browser storage on existing devices, or external service dashboards.

### Platform-specific items

- **RLS:** Google Sheets has no PostgreSQL-style Row-Level Security. The equivalent control must be server-side authorization on every Apps Script read/write action, plus restrictive Sheet/Drive sharing.
- **Environment variables:** Apps Script uses Script Properties, not `.env`. Keep secrets only in Script Properties; never include them in frontend settings/local storage.
- **Input safety:** the UI has an HTML escaping helper and backend validations in several forms, but a full action-by-action validation and Google Sheets formula-injection review remains necessary.

## Changes made in this audit

- Frontend source no longer persists provider secrets in `localStorage`; legacy values are scrubbed at startup.
- Mail diagnostic output no longer returns recent member details or verification codes; code logging is disabled and old code-column entries are cleared when the diagnostic runs.
- Added regression assertions to the auth test for not exposing email/code logs.

These are containment fixes only. They do **not** solve the critical spoofable-admin authorization issue, admin 2FA, or full rate limiting.

## Required next steps before calling this secure

1. Rotate Mailjet and Telegram credentials; set the new values only in Apps Script Script Properties. Revoke old keys/tokens in their provider dashboards.
2. Implement server-issued, signed, expiring sessions and verify them server-side. Bind every member action to the authenticated member ID; require an authenticated supervisor role for every admin read/write route. Remove trust in `requesterName`/`by` as authorization.
3. Add admin 2FA (prefer TOTP with recovery codes; email OTP is weaker) and rate-limit login, registration, reset, verification, and uploads.
4. Remove public access to private APIs; return only minimum public fields. Review OAuth/deployment access and Google Sheet/Drive ACLs.
5. Stop exposing one-time codes in admin notifications/logs, clear old codes from the mail log and pending-registration properties, and review whether reset/registration records have expired.
6. Decide whether each uploaded file is public. Keep private photos/documents private or serve them through an authenticated download path.
7. Add Google Cloud budget/quota alerts, Apps Script/Drive usage alerts, and security event monitoring.
8. Enable Git and run secret scanning against **all history** (e.g. Gitleaks), then use a dependency scanner if dependencies are introduced.
9. Deploy the backend and frontend containment fixes; then run a dedicated authorization regression suite against every action.

## Current status

**Not security-audited to a deploy-ready standard.** The critical authorization issue must be fixed before claiming that admin routes or member data are protected. Do not describe this application as “100% secure.”
