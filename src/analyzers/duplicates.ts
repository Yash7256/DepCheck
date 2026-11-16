import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

import type { PackageManager } from '../scanner/types.js';
import type { AnalyzerDiagnostic, Finding } from './types.js';

export interface DependencyTreeNode {
  name?: string;
  version?: string;
  dependencies?: Record<string, DependencyTreeNode>;
}

export interface DependencyTreeResult {
  tree: DependencyTreeNode | null;
  diagnostics: AnalyzerDiagnostic[];
}

export interface DependencyTreeProvider {
  getDependencyTree(projectRoot: string): Promise<DependencyTreeResult>;
}

type SpawnProcess = typeof spawn;
const NPM_TIMEOUT_MS = 10_000;

function diagnostic(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): AnalyzerDiagnostic {
  return {
    code,
    message,
    severity: 'error',
    packageManager: 'npm',
    ...(details === undefined ? {} : { details }),
  };
}

function isTreeNode(value: unknown): value is DependencyTreeNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const version = Reflect.get(value, 'version');
  const dependencies = Reflect.get(value, 'dependencies');
  return (
    (version === undefined || typeof version === 'string') &&
    (dependencies === undefined ||
      (typeof dependencies === 'object' && dependencies !== null && !Array.isArray(dependencies)))
  );
}

function parseTree(stdout: string): DependencyTreeNode | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    return isTreeNode(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export class NpmDependencyTreeProvider implements DependencyTreeProvider {
  constructor(
    private readonly spawnProcess: SpawnProcess = spawn,
    private readonly timeoutMs = NPM_TIMEOUT_MS,
  ) {}

  getDependencyTree(projectRoot: string): Promise<DependencyTreeResult> {
    return new Promise((resolve) => {
      const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      let child: ChildProcess;
      try {
        child = this.spawnProcess(executable, ['ls', '--all', '--json'], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
        });
      } catch (error) {
        resolve({
          tree: null,
          diagnostics: [
            diagnostic('DUPLICATE_TREE_SPAWN_FAILED', `Unable to run npm ls: ${String(error)}`),
          ],
        });
        return;
      }

      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (result: DependencyTreeResult): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      const timer = setTimeout(() => {
        child.kill();
        finish({
          tree: null,
          diagnostics: [
            diagnostic('DUPLICATE_TREE_TIMEOUT', `npm ls timed out after ${this.timeoutMs}ms.`),
          ],
        });
      }, this.timeoutMs);

      child.once('error', (error) => {
        clearTimeout(timer);
        finish({
          tree: null,
          diagnostics: [
            diagnostic('DUPLICATE_TREE_PROCESS_ERROR', `npm ls failed: ${String(error)}`),
          ],
        });
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        const tree = parseTree(stdout);
        if (tree !== null) {
          finish({ tree, diagnostics: [] });
          return;
        }
        finish({
          tree: null,
          diagnostics: [
            diagnostic(
              'DUPLICATE_TREE_INVALID_JSON',
              'npm ls did not return a valid dependency tree.',
              {
                exitCode: code,
                stderr: stderr.trim(),
              },
            ),
          ],
        });
      });
    });
  }
}

function collectVersions(
  node: DependencyTreeNode,
  path: string,
  versions: Map<string, Map<string, string[]>>,
): void {
  for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
    const version = dependency.version;
    if (version !== undefined) {
      const packageVersions = versions.get(name) ?? new Map<string, string[]>();
      const locations = packageVersions.get(version) ?? [];
      locations.push(path === '' ? name : `${path} > ${name}`);
      packageVersions.set(version, locations);
      versions.set(name, packageVersions);
    }
    collectVersions(dependency, path === '' ? name : `${path} > ${name}`, versions);
  }
}

export function analyzeDuplicateDependencyVersions(
  projectRoot: string,
  packageManager: PackageManager,
  provider: DependencyTreeProvider = new NpmDependencyTreeProvider(),
): Promise<{ findings: Finding[]; diagnostics: AnalyzerDiagnostic[] }> {
  if (packageManager !== 'npm') {
    return Promise.resolve({
      findings: [],
      diagnostics: [
        {
          code: 'DUPLICATE_ANALYSIS_UNSUPPORTED_PACKAGE_MANAGER',
          message: `Duplicate resolved-version analysis is currently supported only for npm; detected ${packageManager}.`,
          severity: 'error',
          packageManager,
        },
      ],
    });
  }

  return provider.getDependencyTree(projectRoot).then((result) => {
    if (result.tree === null) return { findings: [], diagnostics: result.diagnostics };
    const versions = new Map<string, Map<string, string[]>>();
    collectVersions(result.tree, '', versions);
    const findings: Finding[] = [];
    for (const [packageName, packageVersions] of versions) {
      if (packageVersions.size < 2) continue;
      findings.push({
        id: `DUPLICATE_DEPENDENCY_VERSION:${projectRoot}:${packageName}`,
        code: 'DUPLICATE_DEPENDENCY_VERSION',
        analyzer: 'duplicates',
        packageName,
        severity: 'warning',
        confidence: 'high',
        message: `${packageName} resolves to multiple versions in the dependency tree.`,
        manifestPath: join(projectRoot, 'package.json'),
        details: {
          versions: [...packageVersions.entries()].map(([version, locations]) => ({
            version,
            locations,
          })),
        },
      });
    }
    return { findings, diagnostics: result.diagnostics };
  });
}
