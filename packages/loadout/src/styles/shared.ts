// Shared component styles. Colours and fonts come from tokens.css.
import { css } from 'lit';

/** Base rules every component adopts. */
export const base = css`
  :host {
    box-sizing: border-box;
    font-family: var(--font-ui);
    color: var(--fg-2);
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  svg.i {
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.8em;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition: none !important;
      animation-duration: 2s !important;
    }
  }
`;

export const buttons = css`
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.5rem 1rem;
    border-radius: 0.45rem;
    font-weight: 600;
    font-size: 0.875rem;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--fg);
    transition:
      background 0.15s,
      border-color 0.15s;
    white-space: nowrap;
    text-decoration: none;
  }
  .btn:hover {
    border-color: var(--muted);
  }
  .btn.primary {
    background: var(--accent-strong);
    border-color: var(--accent);
    color: #fff;
  }
  .btn.primary:hover {
    background: var(--accent);
  }
  .btn.sm {
    padding: 0.3rem 0.65rem;
    font-size: 0.8rem;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

export const spinner = css`
  .spin {
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    flex: none;
    border: 2px solid currentColor;
    border-right-color: transparent;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
