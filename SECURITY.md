# Security

## Reporting a vulnerability

Please report privately through GitHub: **Security > Report a vulnerability** on
https://github.com/harshaldevvv/project-valley. Do not open a public issue for it. You should get a reply within a
week.

## Design notes

- The game is static files with no backend. It runs in the browser sandbox, needs no permissions, and loads
  nothing from third-party servers (it is served with cross-origin isolation, which blocks that).
- Saves and settings never leave the browser.
