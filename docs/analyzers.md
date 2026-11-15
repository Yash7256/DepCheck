# Analyzers

Core analyzers detect unused, missing, and duplicate resolved dependency versions. Advanced
analyzers inspect outdated registry metadata, OSV vulnerability data, and npm dependency trees.

Registry and OSV failures produce diagnostics and incomplete analysis; they are never interpreted
as a clean result. npm is the only dependency-tree provider currently implemented. Built-ins and
local imports are excluded from missing-dependency findings.
