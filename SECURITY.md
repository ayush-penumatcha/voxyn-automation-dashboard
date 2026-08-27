# Public data security

Everything in this repository is public internet data. `status.json` and `history.json`
intentionally contain only their stable, independently validated allowlisted schemas exported by
the private production repository. They are not copies of raw production history.

This repository must never receive credentials, tokens, authorization headers, Slack identifiers,
LinkedIn URNs, private profile URLs, internal repository/run/claim IDs, raw state, raw configuration,
local paths, or raw provider errors.

Captions are rendered using DOM `textContent`; generated text is never inserted with `innerHTML`.
Source links are accepted only for external HTTP/HTTPS URLs and use `noopener noreferrer`.

If sensitive information is ever found, remove it from both current files and Git history, revoke
the affected credential immediately, and report the exposure through the repository owner's
private security contact. Do not include the secret in a public issue.
