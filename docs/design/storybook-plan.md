# Storybook Integration Plan

**Last Updated**: 2026-03-01  
**Status**: Planning  
**Estimated Effort**: 1-2 days initial setup + ongoing maintenance

## Overview

Add Storybook to judgesdirectory.org for interactive component documentation, visual testing, and design system reference.

## Why Storybook

- **Component isolation**: Develop and test components outside the app context
- **Visual documentation**: Living style guide for developers and designers
- **Accessibility testing**: Built-in a11y addon catches issues early
- **Design handoff**: Stakeholders can review components without running the app
- **Regression testing**: Visual snapshots catch unintended changes

## Installation Steps

```bash
# 1. Initialize Storybook (auto-detects Next.js)
npx storybook@latest init

# 2. Install recommended addons
npm install -D @storybook/addon-a11y @storybook/addon-designs

# 3. Start Storybook dev server
npm run storybook
```

## Configuration

### `.storybook/main.ts`

```typescript
import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-onboarding",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
};

export default config;
```

### `.storybook/preview.ts`

```typescript
import type { Preview } from "@storybook/react";
import "../src/app/theme-vars.css"; // Import theme variables

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#111827" },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: "Theme for components",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: ["light", "dark", "system"],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
```

## Components to Document

### Priority 1 — Core Components

| Component     | Location                         | Stories Needed                         |
| ------------- | -------------------------------- | -------------------------------------- |
| `ThemeToggle` | `src/components/ThemeToggle.tsx` | Default, Hovered, Focused, All 3 modes |
| `Disclaimer`  | `src/components/Disclaimer.tsx`  | Light theme, Dark theme                |
| `StateGrid`   | `src/components/StateGrid.tsx`   | With data, Loading, Empty              |

### Priority 2 — Admin Components

| Component           | Location                                     | Stories Needed                           |
| ------------------- | -------------------------------------------- | ---------------------------------------- |
| `CsvUploader`       | `src/components/admin/CsvUploader.tsx`       | Default, Dragging, Error, Success        |
| `ColumnMapper`      | `src/components/admin/ColumnMapper.tsx`      | Unmapped, Partially mapped, Fully mapped |
| `ImportSummary`     | `src/components/admin/ImportSummary.tsx`     | Success, Partial, Errors                 |
| `VerificationQueue` | `src/components/admin/VerificationQueue.tsx` | With data, Empty, Loading                |
| `ProgressDashboard` | `src/components/admin/ProgressDashboard.tsx` | 0%, 50%, 100%, Milestone reached         |
| `BulkCourtForm`     | `src/components/admin/BulkCourtForm.tsx`     | Default, Submitting, Success             |

### Priority 3 — SEO Components

| Component | Location                        | Stories Needed           |
| --------- | ------------------------------- | ------------------------ |
| `JsonLd`  | `src/components/seo/JsonLd.tsx` | ItemList, Person schemas |

## Story Example

```typescript
// src/components/ThemeToggle.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import ThemeToggle from "./ThemeToggle";

const meta: Meta<typeof ThemeToggle> = {
  title: "Components/ThemeToggle",
  component: ThemeToggle,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  decorators: [
    (Story) => {
      document.documentElement.dataset.theme = "light";
      return <Story />;
    },
  ],
};

export const Dark: Story = {
  decorators: [
    (Story) => {
      document.documentElement.dataset.theme = "dark";
      return <Story />;
    },
  ],
};

export const System: Story = {};
```

## Package.json Scripts

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build -o storybook-static"
  }
}
```

## Directory Structure After Setup

```
.storybook/
├── main.ts
├── preview.ts
└── theme.ts (optional dark mode decorator)

src/
├── components/
│   ├── ThemeToggle.tsx
│   ├── ThemeToggle.stories.tsx    # NEW
│   ├── Disclaimer.tsx
│   ├── Disclaimer.stories.tsx     # NEW
│   └── ...
```

## CI/CD Integration (Optional)

```yaml
# .github/workflows/storybook.yml
name: Storybook

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build-storybook
      - uses: actions/upload-artifact@v4
        with:
          name: storybook
          path: storybook-static
```

## Dependencies Added

```json
{
  "devDependencies": {
    "@storybook/addon-a11y": "^8.x",
    "@storybook/addon-essentials": "^8.x",
    "@storybook/addon-interactions": "^8.x",
    "@storybook/addon-onboarding": "^8.x",
    "@storybook/blocks": "^8.x",
    "@storybook/nextjs": "^8.x",
    "@storybook/react": "^8.x",
    "@storybook/test": "^8.x",
    "storybook": "^8.x"
  }
}
```

## Success Criteria

- [ ] Storybook runs locally at `localhost:6006`
- [ ] All 9 existing components have basic stories
- [ ] Light/dark theme switching works in Storybook
- [ ] Accessibility addon shows no critical issues
- [ ] Documentation pages render correctly

## Blockers / Prerequisites

- **New color palette**: Wait for finalized colors before writing stories with color documentation
- **shadcn/ui migration**: Stories may need updates after component library migration

## Related Documents

- [shadcn-migration-plan.md](shadcn-migration-plan.md)
- `color-tokens.md` (pending)
