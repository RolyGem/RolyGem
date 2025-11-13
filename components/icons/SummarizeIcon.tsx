import React from 'react';
import { Icon } from './Icon';

export const SummarizeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z" />
    <path d="M8 12h8" />
    <path d="M8 16h4" />
    <path d="M8 8h8" />
  </Icon>
);