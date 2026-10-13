# zeimoto Panel

`zeimoto/panel` provides a persistent active-content-language indicator and red
tab highlights for failed field validation, alongside Kirby's change-count badges.
It owns general Panel UX; field editors, icons, and frontend styling belong to
other plugins or the host project. No separate build is required.

## Installation

Requires PHP 8.5 and Kirby 5.6.1 or later within Kirby 5.
The Composer package is `zeimoto/panel` and installs into
`site/plugins/zeimoto-panel`. Release versions come from Git tags.

Once published on Packagist:

```sh
composer require zeimoto/panel
```

For manual installation, copy this plugin into `site/plugins/zeimoto-panel`.
See the integration requirements below before using its public surfaces.
The plugin is distributed under the MIT license; see [LICENSE](LICENSE).

## Validation highlights

The plugin wraps `window.fetch` and inspects only POST requests to the current
model's `changes/save` or `changes/publish` endpoint under `panel.api.endpoint`.
The request's `x-language` header must match the active content language.
Unrelated writes, reads, and requests for other models or languages do not clear
or replace highlights.

Validation responses with an object-valued `details` payload emit
`zeimoto.form.errors` with `{ api, language, details }`. A successful matching
save or publish emits empty details. Other failures leave existing highlights
in place. The latest matching request wins; responses from an older request,
another view's props, or another active language are ignored. Responses are
inspected through a clone, leaving the original available to Kirby.

The `k-model-tabs` extension accepts events only for its current model/language,
resets errors when either changes, and computes badges from
`columns → sections → fields`. It returns copied tabs, preserves existing
non-error themes, and adds `theme: "negative"` for invalid fields. All tab shapes
are checked before applying changes. Unexpected shapes return untouched tabs
without plugin-computed badges and issue one console warning.

## Language indicator

The `k-topbar` extension mirrors Kirby's menu button, breadcrumbs, spacer, and
signals region, adding the current content-language name and code. It follows
reactive language changes and is hidden for single-language installations.

## Compatibility checks

The overrides were checked against installed Kirby 5.6.1. They depend on Panel
internals and must be reviewed after Kirby upgrades:

- Content saves/publishes use POST to `<model-api>/changes/save` and
  `<model-api>/changes/publish`, with `x-language` carrying the content language.
- `panel.api.endpoint` and `panel.view.props.api` identify the API base and current
  model; view props identity is used to reject stale navigation responses.
- Failed validation has `{ details: { fieldName: { label, message } } }` shape.
- Model tabs expose `columns → sections → fields`; the core badge computation
  still counts changed field names against lowercased blueprint field names.
- The top bar still exposes the template structure and computed `crumbs` used
  by this extension.

A tab-shape mismatch warns once. Endpoint or error-payload changes may instead
stop highlights without a warning, so a live smoke test remains necessary.

## Manual smoke test

Open `/io` and save/publish content that fails a blueprint validation rule.
Confirm the appropriate tab turns red and its change-count badge remains.
Perform an unrelated action and confirm the highlight stays. Correct the field
and save/publish again; confirm the red theme clears. Switch content languages
and models; confirm the language indicator updates and old errors do not carry
over. Check normal top-bar controls, light/dark themes, and the browser console.

## Development environment

Open `kirby.code-workspace` while this plugin is installed under the zeimoto Kirby
Kit's `site/plugins/` directory. The workspace uses the kit's Composer and npm
dependencies, shared formatting rules, and Kirby classes for autocomplete. IDE
stubs are included; local editor settings, caches, private notes, and `.env` are
ignored. The formatter launcher currently requires Herd's PHP 8.5 on macOS.

Install Composer and npm dependencies at the kit root. From that root, check this
plugin with:

```sh
node tools/check-style.mjs --plugin site/plugins/zeimoto-panel
```
