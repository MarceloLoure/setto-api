import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { initializeFirebaseAdmin } from './firebase-admin.config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    initializeFirebaseAdmin();
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return getAuth().verifyIdToken(idToken);
  }
}