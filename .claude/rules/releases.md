## RELEASES / VERSIONS: ONLY WHEN THE OWNER ASKS. NEVER OTHERWISE. (EXTREMELY STRICT)

**Never bump `package.json` "version", never write or publish an `app_updates` (What's New) row, never
touch `active_app_version`, never commit "release: vX", never run the `/ship` release steps, never run
`publish-update*.mjs` unless the owner, in chat, explicitly asked to release a version.**

- The version is completely disconnected from code changes, features, fixes, commits, pushes and deploys.
  Finishing work, small changes, "ship it", "push", "deploy" and time since the last release are NEVER a reason.
- No permission carries over: one approved release does not approve the next.
- Release notes NEVER mention employee-only things (employee portal, team chat, support desk, staff tools).
- `publish-update*.mjs` refuse to run without env `OWNER_ASKED_RELEASE=yes`; set it only after the owner asked.

Why: v1.23 was launched unasked on 2026-11-12 and listed employee-only chat changes publicly. Withdrawn 2026-11-13.
