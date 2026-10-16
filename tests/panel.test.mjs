// ==========================================================
// Tests :: Panel Validation
// ==========================================================
//
// Exercises public JavaScript behavior without a live project.
//
// ==========================================================

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const source = readFileSync(new URL("../index.js", import.meta.url), "utf8")
const setup = (fetch = async () => Response.json({ details: { heroTitle: { message: "Required" } } }, { status: 422 })) => {
  const events = []
  let extension
  const panel = {
    view: { props: { api: "/pages/about" } }, language: { code: "en" }, api: { endpoint: "http://localhost/api" },
    events: { emit: (...args) => events.push(args) }, plugin: (_name, config) => { extension = config },
  }
  const window = { fetch, location: { href: "http://localhost/io" } }
  vm.runInNewContext(source, { window, panel, URL, Request, Headers, console })
  return { panel, window, events, tabs: extension.components["k-model-tabs"] }
}
const submit = (window, url = "http://localhost/api/pages/about/changes/save", language = "en") =>
  window.fetch(url, { method: "POST", headers: { "x-language": language } })

test("matching validation emits fields and preserves the readable response", async () => {
  const { window, events } = setup()
  const response = await submit(window)
  assert.equal(events.length, 1)
  assert.equal(events[0][0], "zeimoto.form.errors")
  assert.ok(events[0][1].details.heroTitle)
  assert.ok((await response.json()).details.heroTitle)
})

test("unrelated models and languages do not alter highlights", async () => {
  const { window, events } = setup()
  await submit(window, "http://localhost/api/pages/other/changes/save")
  await submit(window, undefined, "de")
  assert.equal(events.length, 0)
})

test("successful matching saves clear errors", async () => {
  const { window, events } = setup(async () => Response.json({ status: "ok" }))
  await submit(window)
  assert.equal(Object.keys(events[0][1].details).length, 0)
})

test("late responses cannot replace the newer save result", async () => {
  const pending = []
  const { window, events } = setup(() => new Promise((resolve) => pending.push(resolve)))
  const old = submit(window)
  const latest = submit(window)
  pending[1](Response.json({ details: { email: {} } }, { status: 422 }))
  await latest
  pending[0](Response.json({ details: { name: {} } }, { status: 422 }))
  await old
  assert.equal(events.length, 1)
  assert.ok(events[0][1].details.email)
})

test("navigation prevents an old response from changing the new editor", async () => {
  let complete
  const { window, panel, events } = setup(() => new Promise((resolve) => { complete = resolve }))
  const pending = submit(window)
  panel.view.props = { api: "/pages/other" }
  complete(Response.json({ details: { title: {} } }, { status: 422 }))
  await pending
  assert.equal(events.length, 0)
})

test("error themes preserve source tabs and existing change counts", () => {
  const { tabs } = setup()
  const original = [{ theme: "positive", columns: { left: { sections: { fields: { type: "fields", fields: { heroTitle: {} } } } } } }]
  const context = { tabs: original, diff: { herotitle: "changed" }, errorFields: ["herotitle"], ...tabs.methods }
  const result = tabs.computed.withBadges.call(context)
  assert.equal(result[0].theme, "negative")
  assert.equal(result[0].badge, 1)
  assert.equal(original[0].theme, "positive")
})
