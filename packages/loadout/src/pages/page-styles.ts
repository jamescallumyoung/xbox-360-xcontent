import { css } from 'lit';

/** Layout shared by every page. */
export const pageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.5rem 2rem 4rem;
  }
  .page-title {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .page-title h1 {
    margin: 0;
    color: var(--fg);
    font-size: 1.85rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .page-title .sub {
    color: var(--muted);
    margin-top: 0.2rem;
  }
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 0.8rem;
  }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .section-head h2 {
    margin: 0;
    color: var(--fg);
    font-size: 1.25rem;
    font-weight: 700;
  }
  .section-head .note {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    white-space: nowrap;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--fg-2);
  }
  .pill svg {
    width: 0.8rem;
    height: 0.8rem;
  }
  .pill.ok {
    background: var(--ok-soft);
    color: var(--ok-text);
    border-color: rgba(34, 197, 94, 0.4);
  }
  .pill.q {
    background: var(--accent-soft);
    color: var(--accent-text);
    border-color: rgba(99, 102, 241, 0.5);
  }
  .pill.warn {
    background: var(--warn-soft);
    color: var(--warn-text);
    border-color: rgba(234, 179, 8, 0.4);
  }
  .pill.bad {
    background: var(--bad-soft);
    color: var(--bad-text);
    border-color: rgba(239, 68, 68, 0.45);
  }
  .pill.dim {
    color: var(--faint);
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--muted);
  }
  .empty-state svg {
    width: 2rem;
    height: 2rem;
    color: var(--faint);
  }
  .empty-state b {
    color: var(--fg);
    font-size: 1.05rem;
  }
  .btn.danger {
    background: var(--bad-soft);
    border-color: rgba(239, 68, 68, 0.5);
    color: var(--bad-text);
  }
  .btn.danger:hover {
    border-color: var(--bad);
  }
  .btn.ghost {
    background: none;
  }
  @media (max-width: 760px) {
    :host {
      padding: 1.25rem 1rem 3rem;
      gap: 1.6rem;
    }
    .page-title h1 {
      font-size: 1.5rem;
    }
  }
`;
