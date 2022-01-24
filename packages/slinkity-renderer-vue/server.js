import { h, createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import StaticHtml from './StaticHtml'

export default async function server({ toCommonJSModule, componentPath, props, children }) {
  const { default: Component } = await toCommonJSModule(componentPath)
  const slots = {}
  if (children) {
    slots.default = () => h(StaticHtml, { value: children })
  }
  const app = createSSRApp({ render: () => h(Component, props, slots) })
  const html = await renderToString(app)
  return { html }
}
