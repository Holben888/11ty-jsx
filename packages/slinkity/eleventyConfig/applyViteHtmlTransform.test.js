const { applyViteHtmlTransform, handleSSRComments } = require('./applyViteHtmlTransform')
const { toComponentAttrStore } = require('./componentAttrStore')
const { SLINKITY_HEAD_STYLES, toSSRComment } = require('../utils/consts')

/** @param {Partial<import('./componentAttrStore').ComponentAttrs>[]} componentAttrs */
function toComponentAttrsWithDefaults(componentAttrs) {
  const componentAttrStore = toComponentAttrStore()
  for (const componentAttr of componentAttrs) {
    componentAttrStore.push({
      path: 'not-important.jsx',
      hydrate: 'eager',
      props: {},
      pageOutputPath: 'default.html',
      rendererName: 'react',
      ...componentAttr,
    })
  }
  return componentAttrStore
}

function toConvincingUrl(fileName) {
  return `/@fs/Users/person/project/${fileName}`
}

describe('applyViteHtmlTransform', () => {
  const environments = ['prod', 'dev']
  it.each(environments)(
    'should not try and parse files that are not html for %s',
    async (environment) => {
      const componentAttrStore = toComponentAttrStore()
      const content = '<?xml version="1.0" encoding="utf-8"?>'
      const actual = await applyViteHtmlTransform({
        content,
        outputPath: 'feed.xml',
        componentAttrStore,
        environment,
      })
      expect(actual).toBe(content)
    },
  )
  describe('handleSSRComments', () => {
    const outputPath = '/handle/ssr/comments.html'
    /** @type {import('../cli/types').Renderer[]} */
    const renderers = [
      {
        name: 'react',
        extensions: ['jsx'],
        client: '@slinkity/example/client',
        server: '@slinkity/example/server',
        injectImportedStyles: true,
      },
      {
        name: 'vue',
        extensions: ['vue'],
        client: '@slinkity/vue/client',
        server: '@slinkity/vue/server',
        injectImportedStyles: true,
      },
      {
        name: 'svelte',
        extensions: ['svelte'],
        client: '@slinkity/svelte/client',
        server: '@slinkity/svelte/server',
        injectImportedStyles: true,
      },
    ]
    const componentPathsToMeta = {
      'nice.jsx': {
        importedStyles: [toConvincingUrl('styles.scss'), toConvincingUrl('more-styles.scss')],
        rendererName: 'react',
        ssr: {
          html: '<react>Content</react>',
        },
      },
      'cool.svelte': {
        importedStyles: [toConvincingUrl('nested/global.module.scss')],
        rendererName: 'svelte',
        ssr: {
          html: '<svelte>Content</svelte>',
        },
      },
      'neat.vue': {
        importedStyles: [toConvincingUrl('excellent.css'), toConvincingUrl('neato.stylus')],
        rendererName: 'vue',
        ssr: {
          html: '<vue>Content</vue>',
        },
      },
    }
    const viteSSR = {
      async toCommonJSModule(componentPath) {
        const matchingRenderer = renderers.find((renderer) => renderer.server === componentPath)
        if (matchingRenderer) {
          return {
            default({ componentPath }) {
              const { ssr } = componentPathsToMeta[componentPath]
              return {
                // insert the server renderer name into the snapshot
                // to ensure we're using the correct renderer for a given component
                html: `${ssr.html}\n  <p>rendered by ${matchingRenderer.name}</p>`,
                css: ssr.css,
              }
            },
          }
        } else {
          return {
            default: () => null,
            __importedStyles: componentPathsToMeta[componentPath].importedStyles,
          }
        }
      },
    }
    const componentAttrStore = toComponentAttrsWithDefaults(
      Object.entries(componentPathsToMeta).map(([componentPath, { rendererName }]) => ({
        path: componentPath,
        pageOutputPath: outputPath,
        rendererName,
      })),
    )

    it('should inject styles into head', async () => {
      const content = `
<html>
<head>
  <title>It's hydration time</title>
  ${SLINKITY_HEAD_STYLES}
</head>
<body>
</body>
</html>`
      const actual = await handleSSRComments({
        content,
        outputPath,
        componentAttrStore,
        viteSSR,
        renderers,
      })
      expect(actual).toMatchSnapshot()
    })

    it('should replace SSR comments with server rendered content', async () => {
      const content = `
<html>
<head>
  <title>It's hydration time</title>
</head>
<body>
  ${componentAttrStore
    .getAllByPage(outputPath)
    .map(({ id }) => toSSRComment(id))
    .join('\n')}
</body>
</html>`
      const actual = await handleSSRComments({
        content,
        outputPath,
        componentAttrStore,
        viteSSR,
        renderers,
      })
      expect(actual).toMatchSnapshot()
    })
  })
})
