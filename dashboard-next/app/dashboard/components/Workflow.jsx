'use client';

const STEP_META = {
  1: { name: 'Upload List', action: 'Upload List', icon: 'ti-upload' },
  2: { name: 'Review', action: 'Review List', icon: 'ti-users' },
  3: { name: 'Campaign', action: 'Campaign', icon: 'ti-speakerphone' },
  4: { name: 'Drafts', action: 'Select Draft', icon: 'ti-file-text' },
  5: { name: 'Draft Summary', action: 'Summary', icon: 'ti-layout-list' },
  6: { name: 'Test Email', action: 'Test', icon: 'ti-test-pipe' },
  7: { name: 'Schedule', action: 'Schedule', icon: 'ti-calendar-event' }
};

function getStepStatus(index, completedWorkflowSteps = [], activeWorkflowStep = 1) {
  if (completedWorkflowSteps[index - 1]) return 'done';
  if (Number(index) === Number(activeWorkflowStep)) return 'active';
  return '';
}

function WorkflowStep({ step, status = '', onAction }) {
  const index = Number(step?.index) || 0;
  const meta = STEP_META[index] || { name: step?.title || `Step ${index}`, action: step?.action || 'Open', icon: 'ti-circle' };
  const iconClass = status === 'done' ? 'ti-check' : meta.icon;

  return (
    <div className={`step-item ${status}`}>
      <div className="step-circle">
        <i className={`ti ${iconClass}`}></i>
        <div className="step-num">{index}</div>
      </div>
      <div className="step-content">
        <div className="step-name">{meta.name}</div>
      <button
        type="button"
          className="step-action"
        onClick={(event) => onAction?.(step, event)}
      >
          {meta.action}
      </button>
      </div>
    </div>
  );
}

export default function Workflow({
  workflowSteps = [],
  completedWorkflowSteps = [],
  activeWorkflowStep = 1,
  handleWorkflowAction,
  workflowShellRef
}) {
  return (
    <div className="workflow-card" ref={workflowShellRef}>
      <div className="section-header" style={{ marginBottom: 18 }}>
        <div>
          <div className="section-title">Campaign Workflow</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            Complete each step to launch your campaign
          </div>
        </div>
        <button className="btn-ghost" type="button" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="ti ti-help-circle" style={{ fontSize: 14 }}></i> How it works
        </button>
      </div>
      <div className="workflow-steps" style={{ position: 'relative' }}>
        <div className="workflow-connector"></div>
        {workflowSteps.map((step) => (
          <WorkflowStep
            key={step.index || step.title}
            step={step}
            status={getStepStatus(step.index, completedWorkflowSteps, activeWorkflowStep)}
            onAction={handleWorkflowAction}
          />
        ))}
      </div>
    </div>
  );
}
