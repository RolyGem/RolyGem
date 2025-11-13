import React from 'react';
import { Icon } from './Icon';

export const ArchiveIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="2" y="5" width="20" height="5" rx="1" />
    <path d="M4 10v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10" />
    <path d="M10 15h4" />
  </Icon>
);