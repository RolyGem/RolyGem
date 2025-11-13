import React from 'react';
import { Icon } from './Icon';

export const PinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5.76" />
    <path d="M9 3v2" />
    <path d="M15 3v2" />
  </Icon>
);
