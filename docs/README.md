# Judges Directory Documentation

This folder contains project documentation organized by category.

## Structure

```text
docs/
├── README.md              # This file
├── business/               # Business analysis, ICP, monetization
├── research/              # Technology evaluations and decision records
│   └── web-scraping-tools.md
├── architecture/          # System design and technical documentation
│   └── data-harvesting.md
│   └── pillar-pages-vs-programmatic-seo.md
└── Judge Directory/       # (Legacy Obsidian vault - can be removed)
```

## Documentation Standards

### Research Documents (`research/`)

Research documents capture technology evaluations, tool comparisons, and decision rationale. They should include:

- **Last Updated** date
- **Status** (Active Research, Decided, Deprecated)
- Executive summary
- Comparison matrices where applicable
- Decision framework or recommendation
- Changelog

### Architecture Documents (`architecture/`)

Architecture documents describe how systems are built and why. They should include:

- **Last Updated** date
- **Status** (Proposed, Implemented, Deprecated)
- Overview and diagrams
- Component responsibilities
- Key design decisions with rationale
- Configuration reference
- Related documents

## Adding New Documentation

1. Choose the appropriate category folder
2. Use kebab-case filenames (e.g., `state-expansion-plan.md`)
3. Include metadata header (Last Updated, Status)
4. Link to related specs in `specs/` folder
5. Update this README if adding a new category

## Cross-References

- **Specs**: Feature specifications live in `specs/` at project root
- **Code**: Implementation details reference source in `src/` and `scripts/`
- **Research → Architecture**: Research informs architecture decisions
- **Architecture → Specs**: Architecture implements spec requirements
