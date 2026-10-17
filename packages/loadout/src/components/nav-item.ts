// One page link in the sidebar and the tab bar.

import type { IconName } from '../styles/icons.js';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  badge?: number;
}
