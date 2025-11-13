import React from 'react';
import { Icon } from './Icon';

export const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </Icon>
);
