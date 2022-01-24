import type { UserConfigExport, ViteDevServer } from 'vite'

type ToCommonJSModuleOptions = {
  /** Whether to (attempt to) use the in-memory cache for fetching a build result. Defaults to true in production */
  useCache: boolean;
}

export type ViteSSR = {
  /**
   * Turn the given file into a Node-friendly module 
   * uses Vite under-the-hood on the dev server and production builds
   * see https://vitejs.dev/guide/ssr.html#setting-up-the-dev-server
   */
  toCommonJSModule(filePath: string, options: ToCommonJSModuleOptions): Promise<object>
  /** Get instance of the Vite development server (always null for production envs) */
  getServer(): ViteDevServer | null;
  /** Start the Vite development server (has no effect for production envs) */
  createServer(): void;
}

type HydrationMode = 'eager' | 'lazy' | 'none'

export type Hydrate = HydrationMode | {
  mode: HydrationMode;
  props?(data: object): object | Promise<object>;
}

type PageReturn = {
  /**
   * whether to format collections for better clientside parsing
   * @see https://github.com/slinkity/slinkity/blob/main/packages/slinkity/utils/toFormattedDataForProps.js
   */
  useFormatted11tyData: boolean;
  /**
   * To retrieve frontmatter data from the component page
   * We recommend using the "toCommonJSModule" param
   * Passed to your page config function
   * @param inputPath Input path for the given template
   */
  getData(inputPath: string): Promise<Object>;
}

export type Renderer = {
  /** name of renderer - used for shortcodes */
  name: string;
  /**
   * file extensions this renderer can handle
   * - used for component pages
   * - used to autocomplete file extensions on component shortcodes
   */
  extensions: string[];
  /** path to module used for clientside hydration - browser code */
  client: string;
  /** path to module used for server rendering - NodeJS code */
  server: string;
  /** inject CSS imported by component module into document head */
  injectImportedStyles: boolean;
  /** config to append to Vite server and production builds */
  viteConfig?(): UserConfigExport | Promise<UserConfigExport>;
  /** config to render as a component page */
  page({ toCommonJSModule }: {
    toCommonJSModule: ViteSSR['toCommonJSModule'];
  }): PageReturn | Promise<PageReturn>;
  /** TODO: Adds polyfills to Node's global object */
  polyfills: never;
  /** TODO: List of imports to add as scripts on the client */
  hydrationPolyfills: never;
}

export type UserSlinkityConfig = {
  /** All renderers to apply */
  renderers: Renderer[];
  /**
   * All files (or globs) Slinkity will ask 11ty to ignore during builds and live reload events.
   * Override this property to add and remove ignored files from our defaults.
   * Also see 11ty's ignore documentation here: https://www.11ty.dev/docs/ignores/
  */
  eleventyIgnores: string[] | ((ignores: string[]) => string[]);
};