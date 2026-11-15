export type ImportReferenceType = 'import' | 'dynamic-import' | 'commonjs' | 're-export';

export type ImportKind =
  | 'default'
  | 'named'
  | 'namespace'
  | 'side-effect'
  | 'dynamic'
  | 'commonjs'
  | 'destructured'
  | 'wildcard';

export interface SourceLocation {
  filePath: string;
  line: number;
  column: number;
}

export interface ImportReference {
  filePath: string;
  moduleSpecifier: string;
  packageName: string | null;
  referenceType: ImportReferenceType;
  importKind: ImportKind;
  isTypeOnly: boolean;
  location: SourceLocation;
}

export interface ParseDiagnostic {
  filePath: string;
  message: string;
  category: 'error' | 'warning';
  line: number;
  column: number;
}

export interface ParserSummary {
  filesParsed: number;
  totalReferences: number;
  staticImports: number;
  dynamicImports: number;
  commonjsImports: number;
  reExports: number;
  typeOnlyImports: number;
}

export interface ParseProjectResult {
  references: ImportReference[];
  diagnostics: ParseDiagnostic[];
  summary: ParserSummary;
}
