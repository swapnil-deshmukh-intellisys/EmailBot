'use client';

function joinClassNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function GlassPanel({ as: Component = 'section', className = '', children, ...props }) {
  return (
    <Component className={joinClassNames('ui-glass-panel', className)} {...props}>
      {children}
    </Component>
  );
}

export function SectionCard({ className = '', eyebrow, title, actions, children, ...props }) {
  return (
    <section className={joinClassNames('ui-section-card', className)} {...props}>
      {(eyebrow || title || actions) ? (
        <header className="ui-section-card-head">
          <div>
            {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions ? <div className="ui-section-card-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ className = '', label, value, meta, tone = 'default', icon, children, ...props }) {
  return (
    <article className={joinClassNames('ui-stat-card', `ui-stat-card-${tone}`, className)} {...props}>
      <div className="ui-stat-card-copy">
        {icon ? <span className="ui-stat-card-icon">{icon}</span> : null}
        {label ? <p>{label}</p> : null}
        {value !== undefined ? <strong>{value}</strong> : null}
        {meta ? <span>{meta}</span> : null}
      </div>
      {children}
    </article>
  );
}

export function StatusBadge({ className = '', tone = 'info', children, ...props }) {
  return (
    <span className={joinClassNames('ui-status-badge', `ui-status-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export function IconButton({ className = '', label, children, ...props }) {
  return (
    <button className={joinClassNames('ui-icon-button', className)} aria-label={label} title={label} type="button" {...props}>
      {children}
    </button>
  );
}

export function PrimaryButton({ className = '', children, ...props }) {
  return (
    <button className={joinClassNames('ui-primary-button', className)} type="button" {...props}>
      {children}
    </button>
  );
}

export function EmptyState({ className = '', icon, title, description, action, ...props }) {
  return (
    <div className={joinClassNames('ui-empty-state', className)} {...props}>
      {icon ? <span className="ui-empty-state-icon">{icon}</span> : null}
      {title ? <strong>{title}</strong> : null}
      {description ? <p>{description}</p> : null}
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </div>
  );
}
