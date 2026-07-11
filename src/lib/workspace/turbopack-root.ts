import path from "node:path";

export function resolveTurbopackRoot(configDirectory: string) {
  const parent = path.dirname(configDirectory);

  return path.basename(parent) === ".worktree"
    ? path.dirname(parent)
    : configDirectory;
}
