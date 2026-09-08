export function hasPermission(perms: Set<string> | undefined, key: string): boolean {
  if (!perms) return false;
  if (perms.has("*")) return true;
  if (perms.has(key)) return true;
  const [category] = key.split(".");
  return perms.has(`${category}.*`);
}