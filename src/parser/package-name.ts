import { builtinModules } from 'node:module';

const BUILTIN_MODULES = new Set(builtinModules);

export function extractPackageName(moduleSpecifier: string): string | null {
  if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) return null;
  if (moduleSpecifier.startsWith('node:') || BUILTIN_MODULES.has(moduleSpecifier)) return null;

  const segments = moduleSpecifier.split('/');
  if (segments[0]?.startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }

  return segments[0] ?? null;
}
