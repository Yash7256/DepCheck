import type { DependencyTreeNode, DependencyTreeProvider } from './duplicates.js';
import type { AnalyzerDiagnostic } from './types.js';

export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  depth: number;
  direct: boolean;
}
export interface DependencyEdge {
  from: string;
  to: string;
}
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  paths: Map<string, string[][]>;
}
export interface DependencyTreeStatistics {
  totalResolvedInstances: number;
  uniquePackageNames: number;
  uniquePackageVersions: number;
  directDependencyCount: number;
  transitiveDependencyCount: number;
  duplicatePackageCount: number;
  maximumDepth: number;
}
export interface DependencyTreeAnalysis {
  graph: DependencyGraph;
  statistics: DependencyTreeStatistics;
  diagnostics: AnalyzerDiagnostic[];
  tree: DependencyTreeNode | null;
}

export function buildDependencyGraph(tree: DependencyTreeNode): DependencyGraph {
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const paths = new Map<string, string[][]>();
  const visited = new WeakSet<object>();
  const visit = (
    parent: string,
    entries: Record<string, DependencyTreeNode>,
    depth: number,
    path: string[],
  ): void => {
    for (const [name, child] of Object.entries(entries)) {
      if (child.version === undefined) continue;
      const id = `${path.join('>')}>${name}@${child.version}`;
      const direct = depth === 1;
      nodes.push({ id, name, version: child.version, depth, direct });
      edges.push({ from: parent, to: id });
      const childPath = [...path, `${name}@${child.version}`];
      const existingPaths = paths.get(id) ?? [];
      existingPaths.push(childPath);
      paths.set(id, existingPaths);
      if (!visited.has(child)) {
        visited.add(child);
        visit(id, child.dependencies ?? {}, depth + 1, childPath);
      }
    }
  };
  visit('project', tree.dependencies ?? {}, 1, ['project']);
  return { nodes, edges, paths };
}

export async function analyzeDependencyTree(
  projectRoot: string,
  packageManager: string,
  provider: DependencyTreeProvider,
): Promise<DependencyTreeAnalysis> {
  if (packageManager !== 'npm')
    return {
      tree: null,
      graph: { nodes: [], edges: [], paths: new Map() },
      statistics: {
        totalResolvedInstances: 0,
        uniquePackageNames: 0,
        uniquePackageVersions: 0,
        directDependencyCount: 0,
        transitiveDependencyCount: 0,
        duplicatePackageCount: 0,
        maximumDepth: 0,
      },
      diagnostics: [
        {
          code: 'TREE_ANALYSIS_UNSUPPORTED_PACKAGE_MANAGER',
          message: `Dependency-tree analysis currently supports npm only; detected ${packageManager}.`,
          severity: 'error',
        },
      ],
    };
  const result = await provider.getDependencyTree(projectRoot);
  if (result.tree === null)
    return {
      tree: null,
      graph: { nodes: [], edges: [], paths: new Map() },
      statistics: {
        totalResolvedInstances: 0,
        uniquePackageNames: 0,
        uniquePackageVersions: 0,
        directDependencyCount: 0,
        transitiveDependencyCount: 0,
        duplicatePackageCount: 0,
        maximumDepth: 0,
      },
      diagnostics: result.diagnostics,
    };
  const graph = buildDependencyGraph(result.tree);
  const names = new Set(graph.nodes.map((node) => node.name));
  const versions = new Set(graph.nodes.map((node) => `${node.name}@${node.version}`));
  const counts = new Map<string, number>();
  for (const node of graph.nodes) counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
  return {
    tree: result.tree,
    graph,
    statistics: {
      totalResolvedInstances: graph.nodes.length,
      uniquePackageNames: names.size,
      uniquePackageVersions: versions.size,
      directDependencyCount: graph.nodes.filter((node) => node.direct).length,
      transitiveDependencyCount: graph.nodes.filter((node) => !node.direct).length,
      duplicatePackageCount: [...counts.values()].filter((count) => count > 1).length,
      maximumDepth: graph.nodes.reduce((max, node) => Math.max(max, node.depth), 0),
    },
    diagnostics: result.diagnostics,
  };
}
