import { defineFeature } from '../types';
import { NAVIGATION_ACTIONS, UNBACKED_NAVIGATION } from '../../navigation';

export const navigationFeature = defineFeature(
  'navigation',
  NAVIGATION_ACTIONS,
  UNBACKED_NAVIGATION
);
export default navigationFeature;

