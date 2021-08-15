const vite = require('vite')
const { resolve } = require('path')
const { promisify } = require('util')
const glob = promisify(require('glob'))
const { readFile } = require('fs').promises

async function getConfigFile() {
  for (const ext of ['js', 'mjs', 'ts']) {
    try {
      const path = resolve(process.cwd(), `vite.config.${ext}`)
      const contents = (await readFile(path)).toString()
      return { path, contents }
    } catch { /* if this fails, try the next ext */ }
  }
  
  return { path: false }
}

async function serve({ input, port }) {
  // TODO: allow user vite.config to override these settings
  // Currently *our* settings override any *user* settings
  const configFile = await getConfigFile()

  const options = {
    configFile: configFile.path,
    root: resolve(process.cwd(), input),
    clearScreen: false,
  }
  if (port) {
    options.port = port
  }

  const server = await vite.createServer(options)
  await server.listen()
}

async function build({ input, output }) {
  const inputFiles = await glob(`${input}/**/*.html`, { absolute: true })
  if (inputFiles.length) {
    await vite.build({
      root: input,
      configFile: (await getConfigFile()).path,
      build: {
        outDir: output,
        emptyOutDir: true,
        rollupOptions: {
          input: inputFiles,
        },
      },
    })
  }
}

module.exports = { serve, build }
