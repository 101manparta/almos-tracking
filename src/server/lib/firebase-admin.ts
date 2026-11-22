import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };

export const adminAuth = {
  async verifyIdToken(idToken: string) {
    const { getApps, initializeApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    if (!getApps().length) {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
    return getAuth().verifyIdToken(idToken);
  },
};
