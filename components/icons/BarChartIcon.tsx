import React from 'react';
import { Icon } from './Icon';

export const BarChartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </Icon>
);
