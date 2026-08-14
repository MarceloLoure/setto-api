import { getApps, initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';

export const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) return;

  const serviceAccountPath = path.resolve(
    process.cwd(),
    'firebase-service-account.json',
  );

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    'beach-social-club-mock.firebasestorage.app';

  // 1. Arquivo JSON de credenciais
  if (fs.existsSync(serviceAccountPath)) {
    try {
      initializeApp({
        credential: cert(serviceAccountPath),
        storageBucket: bucketName,
      });
      console.log('🔥 ✅ Firebase Admin inicializado via arquivo JSON de credenciais.');
      return;
    } catch (error) {
      console.error('❌ Erro ao inicializar o Firebase com JSON:', error);
    }
  }

  // 2. Variáveis de Ambiente no .env
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (privateKey && clientEmail && projectId) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey
            .trim()
            .replace(/^["']|["']$/g, '')
            .replace(/\\n/g, '\n'),
        }),
        storageBucket: bucketName,
      });
      console.log('🔥 ✅ Firebase Admin inicializado via Variáveis de Ambiente (.env).');
      return;
    } catch (error) {
      console.error('❌ Erro ao inicializar o Firebase via ENV:', error);
    }
  }

  // 3. Fallback Mock para desenvolvimento local
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    try {
      initializeApp({
        projectId: 'beach-social-club-mock',
        storageBucket: bucketName,
      });
      console.log('🧪 Firebase Admin inicializado em MODO MOCK para desenvolvimento local.');
    } catch (error) {
      console.error('❌ Erro ao inicializar o Firebase Mock:', error);
    }
  } else {
    console.error('❌ Credenciais do Firebase não configuradas para o ambiente atual.');
  }
};