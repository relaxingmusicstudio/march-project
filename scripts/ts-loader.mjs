import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const tryResolveTs = async (specifier, parentURL) => {
  if (!specifier.endsWith(".js")) return null;
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;

  const candidateUrl = new URL(specifier, parentURL);
  const candidatePath = fileURLToPath(candidateUrl);
  const tsPath = candidatePath.replace(/\.js$/, ".ts");

  try {
    await access(tsPath);
    return pathToFileURL(tsPath).href;
  } catch {
    return null;
  }
};

export const resolve = async (specifier, context, nextResolve) => {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const parentURL = context.parentURL ?? pathToFileURL(`${process.cwd()}/`).href;
    const tsUrl = await tryResolveTs(specifier, parentURL);
    if (tsUrl) {
      return { url: tsUrl, shortCircuit: true };
    }
    throw error;
  }
};
