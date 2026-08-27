# VOXYN Automation Dashboard

This public repository contains only sanitized operational dashboard data for VOXYN automation
monitoring. The static dashboard is designed for GitHub Pages and refreshes `status.json` and
`history.json` every 45 seconds.

It does **not** contain:

- automation source code;
- API credentials or access tokens;
- Slack channel, message, or file identifiers;
- LinkedIn member identities, post IDs, or authentication credentials;
- private production configuration, environment variables, histories, claims, or workflow IDs.

Both JSON files are intentionally public and use separate strict allowlists. `status.json` is the
small current operational snapshot. Compact `history.json` contains one sanitized record per
generated dated slot, with no POST_ID or platform identifier. Upcoming captions can be visible when
the private production setting `PUBLIC_DASHBOARD_SHOW_READY_CAPTIONS=true` is enabled.

The analytics selector uses buyer-local calendar dates for Today, 3D, 7D, 30D, and All Time.
Publishing success rate is `POSTED / (POSTED + MISSED + FAILED + AUTH_REQUIRED)`. Future work,
PROCESSING items, and CANCELLED items are excluded from that denominator.
Historical reporting begins with the first durable publisher record, so older content created before
publisher observability is not falsely classified as missed.

The premium light theme is the default. The optional dark preference is the only value stored in
browser `localStorage`; operational dashboard data is never stored there.

## GitHub Pages

In repository **Settings → Pages**, select **GitHub Actions** as the source. The included
`Deploy GitHub Pages` workflow publishes the static root without a build system or external
dependency.

## Local preview

Serve the directory with any static HTTP server, for example:

```text
python -m http.server 8080
```

Then open `http://127.0.0.1:8080`. Do not open `index.html` directly from the filesystem because
browsers restrict `fetch()` for local files.
