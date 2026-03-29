/// <reference types="vite/client" />

declare module "*.woff" {
  const src: string;
  export default src;
}

declare module "opentype.js";
