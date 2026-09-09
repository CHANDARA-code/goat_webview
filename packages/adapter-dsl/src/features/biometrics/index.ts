import { defineFeature } from '../types';

export const biometricsFeature = defineFeature(
  'biometrics',
  {
    startSoterAuthentication: 'BIOMETRIC_AUTH',
    checkIsSupportSoterAuthentication: 'CHECK_BIOMETRIC_SUPPORT',
    checkIsSoterEnrolledInDevice: 'CHECK_BIOMETRIC_SUPPORT',
  },
  {
    prepareSoterKey: 'PREPARE_SOTER_KEY',
    verifySoterSignature: 'VERIFY_SOTER_SIGNATURE',
  }
);
export default biometricsFeature;
