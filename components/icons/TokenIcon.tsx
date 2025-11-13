
import React from 'react';
import { Icon } from './Icon';

export const TokenIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M8.5 18.5 4 16V8l4.5-2.5L13 8v8l-4.5 2.5z"></path>
    <path d="m13.5 18.5 4.5-2.5V8L13.5 5.5"></path>
    <path d="M4 12h14"></path>
    <path d="m8.5 5.5 4.5 2.5"></path>
  </Icon>
);
