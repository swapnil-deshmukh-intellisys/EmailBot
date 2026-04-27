# Project Structure

## Final Root Structure

```text
Email Bot/
├── campaign_engine/
├── dashboard-next/
├── legacy/
│   ├── legacy-dashboard/
│   └── python-mail-automation/
├── .venv/
├── .gitignore
└── README.md
```

## Final `dashboard-next` Structure

```text
dashboard-next/
├── app/
│   ├── api/
│   ├── components/
│   │   ├── dashboard/
│   │   └── role-dashboard/
│   ├── dashboard/
│   │   ├── admin/
│   │   ├── components/
│   │   ├── manager/
│   │   ├── DashboardNavigationLayoutConfig.js
│   │   └── DashboardViewConstants.js
│   ├── lib/
│   │   ├── adminLiveData.js
│   │   ├── authDefaults.js
│   │   ├── dashboardRoles.js
│   │   ├── roleDashboardData.js
│   │   ├── roleNavigation.js
│   │   ├── roleRouting.js
│   │   └── UiClassNameUtility.js
│   └── <feature routes>/
├── modules/
│   ├── admin-module/
│   ├── analytics-module/
│   ├── campaign-module/
│   ├── draft-module/
│   ├── lead-module/
│   └── template-module/
├── shared-components/
│   ├── common-components/
│   │   └── workspace-components/
│   ├── layout-components/
│   └── ui-components/
├── core-lib/
│   ├── auth-config/
│   ├── campaign-engine/
│   ├── constants/
│   ├── database-config/
│   ├── logging/
│   └── mail-engine/
├── database-models/
├── aws/
├── public/
├── scripts/
├── global-styles/
├── static-assets/
├── project-config/
├── jsconfig.json
├── package.json
└── README.md
```

## Shared Components Tree

```text
shared-components/
├── common-components/
│   └── workspace-components/
│       ├── WorkspaceComponentExports.js
│       ├── WorkspaceDashboardShell.jsx
│       ├── WorkspacePageConfigurationMap.js
│       └── WorkspaceSectionTemplate.jsx
├── layout-components/
│   ├── LayoutComponentExports.js
│   ├── SharedAppLayoutShell.jsx
│   ├── SharedPageContainer.jsx
│   ├── SharedSidebarNavigation.jsx
│   ├── SharedThemeToggleControl.jsx
│   └── SharedTopbarNavigation.jsx
└── ui-components/
    ├── UiActionButton.jsx
    ├── UiComponentExports.js
    ├── UiContentCard.jsx
    ├── UiDataTable.jsx
    ├── UiDialogModal.jsx
    ├── UiEmptyStatePanel.jsx
    ├── UiLoadingSpinner.jsx
    ├── UiPageSectionBlock.jsx
    ├── UiSelectField.jsx
    ├── UiStatusBadge.jsx
    └── UiTextInputField.jsx
```

## Feature Modules Tree

```text
modules/
├── admin-module/
│   └── admin-components/
├── analytics-module/
│   ├── analytics-components/
│   └── analytics-hooks/
├── campaign-module/
│   ├── campaign-components/
│   ├── campaign-hooks/
│   └── campaign-utils/
├── draft-module/
│   ├── draft-components/
│   └── draft-utils/
├── lead-module/
│   └── lead-components/
└── template-module/
    └── template-services/
```

## Backend Core Tree

```text
core-lib/
├── auth-config/
├── campaign-engine/
├── constants/
├── database-config/
├── logging/
└── mail-engine/
```
