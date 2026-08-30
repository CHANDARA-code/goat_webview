/**
 * @goat/devtools - Runtime Host Container Component
 * Dual-thread sandbox runtime container hosting AppService Web Worker + AppView DOM Renderer.
 */

import React from 'react';
import { DualThreadContainer, DualThreadContainerProps } from './DualThreadContainer.tsx';

export interface RuntimeHostContainerProps extends DualThreadContainerProps {}

export const RuntimeHostContainer: React.FC<RuntimeHostContainerProps> = (props) => {
  return <DualThreadContainer {...props} />;
};
