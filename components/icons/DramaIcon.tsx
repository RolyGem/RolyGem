import React from 'react';
import { Icon } from './Icon';

export const DramaIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M14.23,3.05a4.5,4.5,0,0,0-5.46,0" />
    <path d="M12,18.33a5.29,5.29,0,0,0,3.5-1.42" />
    <path d="M8.5,16.91A5.29,5.29,0,0,0,12,18.33" />
    <path d="M15.71,6.29a1.5,1.5,0,1,0-2.12-2.12" />
    <path d="M8.29,6.29a1.5,1.5,0,1,1,2.12-2.12" />
    <circle cx="12" cy="12" r="10" />
  </Icon>
);