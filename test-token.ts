import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

const app = initializeApp({ projectId: firebaseConfig.projectId });
getAuth(app).createCustomToken('server_admin')
  .then(token => console.log('Token:', token))
  .catch(e => console.error('Token fail:', e));
