// ==========================================================
// Plugins :: zeimoto :: Panel
// ==========================================================
//
// Panel/Vue UX: a persistent active-content-language indicator,
// plus red tabs when one of their fields fails validation on
// save. Both component extensions mirror Kirby internals — see
// README.md for the assumptions to re-check after a Kirby update.
//
// ==========================================================

// Warn-once latch: a Kirby update that changes the tab shape
// should surface loudly on first Panel load, not silently.
let tabShapeWarned = false

// Observe only the current model's content saves and publishes. Request
// identity and ordering keep late responses from affecting another editor.
const originalFetch = window.fetch.bind(window)
let latestSave = 0

window.fetch = async (...args) => {
  const [input, init] = args
  const isRequest = input instanceof Request
  const method = (init?.method ?? (isRequest ? input.method : "GET")).toUpperCase()
  const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined))
  const api = panel.view?.props?.api
  const language = panel.language?.code ?? ""
  const viewProps = panel.view?.props
  const endpoint = panel.api?.endpoint
  let save = null

  if (api && endpoint && method === "POST") {
    const base = new URL(`${endpoint.replace(/\/$/, "")}/${api.replace(/^\/+/, "")}/changes/`, window.location.href)
    const target = new URL(isRequest ? input.url : input, window.location.href)
    if (
      target.origin === base.origin &&
      ["save", "publish"].some((action) => target.pathname === `${base.pathname}${action}`) &&
      (headers.get("x-language") ?? "") === language
    ) {
      save = { api, language, viewProps, sequence: ++latestSave }
    }
  }

  const response = await originalFetch(...args)
  if (!save) return response

  try {
    const body = await response.clone().json()
    if (
      save.sequence !== latestSave ||
      save.viewProps !== panel.view?.props ||
      save.api !== panel.view?.props?.api ||
      save.language !== (panel.language?.code ?? "")
    )
      return response

    const details = body?.details
    if (response.ok || (details && typeof details === "object" && !Array.isArray(details))) {
      panel.events?.emit("zeimoto.form.errors", {
        api: save.api,
        language: save.language,
        details: response.ok ? {} : details,
      })
    }
  } catch {
    // Non-JSON responses retain the Panel's native error handling.
  }

  return response
}

panel.plugin("zeimoto/panel", {
  components: {
    "k-topbar": {
      extends: "k-topbar",
      computed: {
        contentLanguageLabel() {
          return this.$panel.language.name ?? this.$panel.language.code?.toUpperCase()
        },
      },
      // Mirrors Kirby's top-bar template and adds the active content language
      // to its stable signals region. This is intentionally a small extension
      // rather than a separate floating UI so it follows every Panel view.
      render(h) {
        const language = this.$panel.language
        const indicator = this.$panel.multilang && language.code
          ? h("span", {
              class: "k-zeimoto-language-indicator",
              attrs: { title: "Editing content in " + this.contentLanguageLabel },
            }, [
              h("span", { class: "k-zeimoto-language-indicator-label" }, "Editing"),
              h("strong", this.contentLanguageLabel),
              h("span", { class: "k-zeimoto-language-indicator-code" }, language.code.toUpperCase()),
            ])
          : null
        return h("div", { class: "k-topbar" }, [
          h("k-button", {
            class: "k-panel-menu-proxy",
            props: { icon: "bars" },
            on: { click: () => this.$panel.menu.toggle() },
          }),
          h("k-breadcrumb", { class: "k-topbar-breadcrumb", props: { crumbs: this.crumbs } }),
          h("div", { class: "k-topbar-spacer" }),
          h("div", { class: "k-topbar-signals" }, [indicator, ...(this.$slots.default ?? [])]),
        ])
      },
    },
    "k-model-tabs": {
      extends: "k-model-tabs",
      data() {
        return {
          errorFields: [],
        }
      },
      created() {
        panel.events.on("zeimoto.form.errors", this.setErrorFields)
      },
      destroyed() {
        panel.events.off("zeimoto.form.errors", this.setErrorFields)
      },
      watch: {
        editorScope() {
          this.errorFields = []
        },
      },
      methods: {
        setErrorFields({ api, language, details }) {
          if (api !== this.$panel.view.props.api || language !== (this.$panel.language.code ?? "")) return
          this.errorFields = Object.keys(details ?? {}).map((field) => field.toLowerCase())
        },
        // Walks the documented tab → columns → sections → fields structure
        // and returns the flat list of field names, or null when a tab
        // doesn't have the shape we expect (i.e. Kirby restructured it) so
        // the caller can bail instead of silently producing empty badges.
        collectFieldNames(tab) {
          if (!tab || typeof tab.columns !== "object" || tab.columns === null) {
            return null
          }

          const fields = []

          for (const column in tab.columns) {
            const sections = tab.columns[column]?.sections
            if (typeof sections !== "object" || sections === null) {
              return null
            }
            for (const section in sections) {
              if (sections[section]?.type === "fields") {
                const sectionFields = sections[section].fields
                if (!sectionFields || typeof sectionFields !== "object") return null
                for (const field in sectionFields) {
                  fields.push(field)
                }
              }
            }
          }

          return fields
        },
        warnTabShapeOnce() {
          if (tabShapeWarned) {
            return
          }
          tabShapeWarned = true
          console.warn(
            "[zeimoto/panel] k-model-tabs tab structure changed — error-tab " +
              "highlighting and change badges are disabled. Re-check the " +
              "columns→sections→fields walk against this Kirby version."
          )
        },
      },
      computed: {
        editorScope() {
          return JSON.stringify([this.$panel.view.props.api, this.$panel.language.code ?? ""])
        },
        // Mirrors the installed Panel's field walk, adding error themes without
        // modifying the source tabs. Validate every tab before applying badges.
        withBadges() {
          const fieldSets = this.tabs.map((tab) => this.collectFieldNames(tab))
          if (fieldSets.some((fields) => fields === null)) {
            this.warnTabShapeOnce()
            return this.tabs
          }

          const changes = Object.keys(this.diff)
          return this.tabs.map((tab, index) => {
            const fields = fieldSets[index].map((field) => field.toLowerCase())
            return {
              ...tab,
              badge: fields.filter((field) => changes.includes(field)).length,
              ...(fields.some((field) => this.errorFields.includes(field)) ? { theme: "negative" } : {}),
            }
          })
        },
      },
    },
  },
})
