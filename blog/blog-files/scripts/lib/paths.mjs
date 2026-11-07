import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FILES_DIR = "blog-files";
export const BLOG_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const FILES_ROOT = resolve(BLOG_ROOT, FILES_DIR);
