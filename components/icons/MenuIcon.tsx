import React from 'react';
import { Icon } from './Icon';

export const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </Icon>
);
