const { readFile } = require('fs').promises
const { stringify } = require('javascript-stringify')
const { join, relative } = require('path')
const { parse } = require('node-html-parser')
const toCommonJSModule = require('./toCommonJSModule')
const addShortcode = require('./addShortcode')
const toRendererHtml = require('./toRendererHtml')
const toFormattedDataForProps = require('./toFormattedDataForProps')
const { writeFileRec } = require('../../utils/fileHelpers')
const toHtmlAttrString = require('../../utils/toHtmlAttrString')
const toUnixPath = require('../../utils/toUnixPath')
const { SLINKITY_ATTRS, SLINKITY_REACT_MOUNT_POINT } = require('../../utils/consts')

const SLINKITY_REACT_MOUNT_POINT_PATH =
  'slinkity/lib/plugin/reactPlugin/_slinkity-react-mount-point.js'

module.exports = function reactPlugin(eleventyConfig, { dir }) {
  eleventyConfig.addTemplateFormats('jsx')
  eleventyConfig.addPassthroughCopy(join(dir.input, dir.includes, 'components'))

  const componentToPropsMap = {}

  addShortcode(eleventyConfig, { componentToPropsMap, dir })

  eleventyConfig.addExtension('jsx', {
    read: false,
    getData: async (inputPath) => {
      const { frontMatter = {} } = await toCommonJSModule({
        inputPath,
        shouldHaveDefaultExport: false,
      })
      return frontMatter
    },
    compile: (_, inputPath) =>
      async function (data) {
        const jsxImportPath = relative(dir.input, inputPath)

        // TODO: make this more efficient with caching
        // We already build the component in getData!
        // See https://github.com/11ty/eleventy-plugin-vue/blob/master/.eleventy.js
        const {
          default: Component = () => null,
          getProps = () => ({}),
          frontMatter = {},
        } = await toCommonJSModule({ inputPath })

        const props = await getProps(
          toFormattedDataForProps({
            ...data,
            shortcodes: eleventyConfig.javascriptFunctions ?? {},
          }),
        )
        componentToPropsMap[jsxImportPath] = props

        return toRendererHtml({
          Component,
          componentPath: jsxImportPath,
          props,
          render: frontMatter.render ?? 'eager',
          type: 'page',
          innerHTML: data.content,
        })
      },
  })

  eleventyConfig.addTransform('add-react-renderer-script', async function (content, outputPath) {
    if (!outputPath.endsWith('.html')) return content

    const root = parse(content)
    const mountPoints = [...root.querySelectorAll(SLINKITY_REACT_MOUNT_POINT)]

    if (mountPoints.length > 0) {
      // 1. Record the "instance" index for each mount point on the page
      // This is used to match up scripts to mount points later
      mountPoints.forEach((mountPoint, index) => {
        mountPoint.setAttribute(SLINKITY_ATTRS.instance, `${index}`)
      })

      // 2. Get the attributes for all mount points on the page
      const rendererAttrs = mountPoints.map((mountPoint) => ({
        [SLINKITY_ATTRS.path]: mountPoint.getAttribute(SLINKITY_ATTRS.path) || '',
        [SLINKITY_ATTRS.instance]: mountPoint.getAttribute(SLINKITY_ATTRS.instance) || '',
        [SLINKITY_ATTRS.lazy]: mountPoint.getAttribute(SLINKITY_ATTRS.lazy) === 'true',
      }))

      // 3. Copy the associated component file to the output dir
      await Promise.all(
        rendererAttrs.map(async ({ [SLINKITY_ATTRS.path]: componentPath }) => {
          const jsxInputPath = join(dir.input, componentPath)
          const jsxOutputPath = join(dir.output, componentPath)
          await writeFileRec(jsxOutputPath, await readFile(jsxInputPath))
        }),
      )

      // 4. Generate scripts to hydrate our mount points
      const componentScripts = rendererAttrs.map(
        ({
          [SLINKITY_ATTRS.path]: componentPath,
          [SLINKITY_ATTRS.instance]: instance,
          [SLINKITY_ATTRS.lazy]: isLazy = false,
        }) => {
          // TODO: abstract "props" to some other file, instead of stringifying in-place
          // We could be generating identical, large prop blobs
          const loadScript = `<script type="module">
            import { renderComponent } from ${JSON.stringify(SLINKITY_REACT_MOUNT_POINT_PATH)};
            import Component from ${JSON.stringify('/' + toUnixPath(componentPath))};
            renderComponent({
              Component,
              componentPath: ${JSON.stringify(toUnixPath(componentPath))},
              instance: "${instance}",
              props: ${stringify(componentToPropsMap[componentPath] ?? {})},
            });
          </script>`
          if (isLazy) {
            const attrs = toHtmlAttrString({
              [SLINKITY_ATTRS.path]: componentPath,
              [SLINKITY_ATTRS.instance]: instance,
            })
            // wrap "lazy" components in a template so we can load them later
            return `<template ${attrs}>${loadScript}</template>`
          } else {
            return loadScript
          }
        },
      )

      root.querySelector('body').insertAdjacentHTML(
        'beforeend',
        `
		  <script type="module">
		    import MountPoint from ${JSON.stringify(SLINKITY_REACT_MOUNT_POINT_PATH)};
		    window.customElements.define("${SLINKITY_REACT_MOUNT_POINT}", MountPoint);
		  </script>
		  ${componentScripts.join('')}
		`,
      )
      return root.outerHTML
    } else return content
  })
}
