# Reporting

Reports are available as terminal text, JSON, or self-contained HTML:

```sh
depcheck scan --format terminal
depcheck scan --format json --output depcheck-report.json
depcheck scan --format html --output depcheck-report.html
```

JSON contains tool/project metadata, status, summary, findings, diagnostics, and analyzer status.
HTML embeds its CSS and escapes report content. Output files are written with UTF-8 filesystem APIs.
