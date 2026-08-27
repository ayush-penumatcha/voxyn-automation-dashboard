# VOXYN Automation Dashboard

This public repository contains only sanitized operational dashboard data for VOXYN automation
monitoring. The static dashboard is designed for GitHub Pages and refreshes `status.json` every
45 seconds.

It does **not** contain:

- automation source code;
- API credentials or access tokens;
- Slack channel, message, or file identifiers;
- LinkedIn member identities, post IDs, or authentication credentials;
- private production configuration, environment variables, histories, claims, or workflow IDs.

`status.json` is intentionally public. Upcoming captions can be visible before publication when
the private production setting `PUBLIC_DASHBOARD_SHOW_READY_CAPTIONS=true` is enabled.

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
