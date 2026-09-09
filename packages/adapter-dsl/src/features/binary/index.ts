import { defineFeature } from '../types';

export const binaryFeature = defineFeature('binary', {
  createBinaryPort: 'CREATE_BINARY_PORT',
  postBinaryMessage: 'POST_BINARY_MESSAGE',
  readBinaryMessage: 'READ_BINARY_MESSAGE',
  closeBinaryPort: 'CLOSE_BINARY_PORT',
});
export default binaryFeature;

