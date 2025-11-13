
import React from 'react';
import { Icon } from './Icon';

export const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </Icon>
);
