# File Rename Report

## Required Renames Completed

```text
dashboard-next/app/components/dashboard/index.js
→ dashboard-next/app/components/dashboard/DashboardComponentExports.js

dashboard-next/app/components/layout/index.js
→ dashboard-next/shared-components/layout-components/LayoutComponentExports.js

dashboard-next/app/components/ui/index.js
→ dashboard-next/shared-components/ui-components/UiComponentExports.js

dashboard-next/app/components/workspace/index.js
→ dashboard-next/shared-components/common-components/workspace-components/WorkspaceComponentExports.js

dashboard-next/app/dashboard/draftTemplates.js
→ dashboard-next/modules/template-module/template-services/DashboardDraftTemplateLibrary.js

dashboard-next/app/dashboard/dashboardLayoutConfig.js
→ dashboard-next/app/dashboard/DashboardNavigationLayoutConfig.js

dashboard-next/app/dashboard/dashboardConstants.js
→ dashboard-next/app/dashboard/DashboardViewConstants.js

dashboard-next/app/dashboard/components/DashboardUiBits.js
→ dashboard-next/app/dashboard/components/DashboardUiPrimitives.js

dashboard-next/app/lib/utils.js
→ dashboard-next/app/lib/UiClassNameUtility.js

dashboard-next/lib/activityLog.js
→ dashboard-next/core-lib/logging/ActivityLogService.js

dashboard-next/models/ActivityLog.js
→ dashboard-next/database-models/ActivityLogModel.js

dashboard-next/lib/draftCategories.js
→ dashboard-next/core-lib/constants/DraftCategoryConstants.js
```

## Shared UI Renames

```text
app/components/ui/Badge.jsx
→ shared-components/ui-components/UiStatusBadge.jsx

app/components/ui/Button.jsx
→ shared-components/ui-components/UiActionButton.jsx

app/components/ui/Card.jsx
→ shared-components/ui-components/UiContentCard.jsx

app/components/ui/EmptyState.jsx
→ shared-components/ui-components/UiEmptyStatePanel.jsx

app/components/ui/Input.jsx
→ shared-components/ui-components/UiTextInputField.jsx

app/components/ui/Modal.jsx
→ shared-components/ui-components/UiDialogModal.jsx

app/components/ui/PageSection.jsx
→ shared-components/ui-components/UiPageSectionBlock.jsx

app/components/ui/Select.jsx
→ shared-components/ui-components/UiSelectField.jsx

app/components/ui/Spinner.jsx
→ shared-components/ui-components/UiLoadingSpinner.jsx

app/components/ui/Table.jsx
→ shared-components/ui-components/UiDataTable.jsx
```

## Layout Renames

```text
app/components/layout/AppLayout.jsx
→ shared-components/layout-components/SharedAppLayoutShell.jsx

app/components/layout/PageContainer.jsx
→ shared-components/layout-components/SharedPageContainer.jsx

app/components/layout/Sidebar.jsx
→ shared-components/layout-components/SharedSidebarNavigation.jsx

app/components/layout/ThemeToggle.jsx
→ shared-components/layout-components/SharedThemeToggleControl.jsx

app/components/layout/Topbar.jsx
→ shared-components/layout-components/SharedTopbarNavigation.jsx
```

## Workspace Renames

```text
app/components/DashboardPlaceholderShell.jsx
→ shared-components/common-components/workspace-components/WorkspaceDashboardShell.jsx

app/components/WorkspaceSectionPage.jsx
→ shared-components/common-components/workspace-components/WorkspaceSectionTemplate.jsx

app/components/workspacePageConfigs.js
→ shared-components/common-components/workspace-components/WorkspacePageConfigurationMap.js
```

## Feature Component Renames

```text
app/dashboard/components/CampaignTable.jsx
→ modules/campaign-module/campaign-components/CampaignExecutionTable.jsx

app/dashboard/components/LeadList.jsx
→ modules/lead-module/lead-components/LeadUploadPreviewList.jsx

app/dashboard/components/DashboardStats.jsx
→ modules/analytics-module/analytics-components/DashboardStatsOverview.jsx

app/dashboard/components/ActivityPanel.jsx
→ modules/analytics-module/analytics-components/DashboardActivityPanel.jsx

app/dashboard/components/RichTextEditor.js
→ modules/draft-module/draft-components/RichTextDraftEditor.js

app/dashboard/admin/AdminCampaignsTable.jsx
→ modules/admin-module/admin-components/AdminCampaignManagementTable.jsx

app/dashboard/admin/AdminDashboardView.jsx
→ modules/admin-module/admin-components/AdminDashboardOverview.jsx

app/dashboard/admin/AdminEmployeeManager.jsx
→ modules/admin-module/admin-components/AdminEmployeeManagementPanel.jsx

app/dashboard/manager/TargetApprovalPanel.jsx
→ modules/admin-module/admin-components/AdminTargetApprovalPanel.jsx
```

## Feature Hook / Utility Renames

```text
app/dashboard/hooks/useCampaigns.js
→ modules/campaign-module/campaign-hooks/UseCampaignCollection.js

app/dashboard/hooks/useStats.js
→ modules/analytics-module/analytics-hooks/UseDashboardStatsCollection.js

app/dashboard/utils/schedule.js
→ modules/campaign-module/campaign-utils/CampaignScheduleHelper.js

app/dashboard/utils/wordPad.js
→ modules/draft-module/draft-utils/DraftWordPadTableBuilder.js
```
