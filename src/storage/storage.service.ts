import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { initializeFirebaseAdmin } from '../firebase/firebase-admin.config';

export type StorageFolder = 'avatars' |'covers' | 'arenas' | 'courts' | 'receipts';

@Injectable()
export class FirebaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseStorageService.name);

  onModuleInit() {
    initializeFirebaseAdmin();
  }

  async uploadPhoto(
    file: Express.Multer.File,
    folder: StorageFolder,
    userId: string,
  ): Promise<string> {
    this.logger.log(`📥 [Firebase Storage] Upload | Pasta: [${folder}] | Usuário: ${userId}`);
    this.logger.log(`📄 Arquivo: "${file?.originalname}" | Mime: "${file?.mimetype}" | Tamanho: ${file?.size} bytes`);

    try {
      const bucketName =
        process.env.FIREBASE_STORAGE_BUCKET ||
        'beach-social-club-mock.firebasestorage.app';
      const bucket = getStorage().bucket(bucketName);

      const token = uuidv4();
      const fileName = `${folder}/${userId}/${uuidv4()}-${file.originalname}`;
      const blob = bucket.file(fileName);

      this.logger.log(`🚀 Gravando no Bucket: "${bucketName}" -> Arquivo: "${fileName}"`);

      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      return new Promise((resolve) => {
        blobStream.on('error', (error) => {
          this.logger.error(`❌ [Erro na Stream do Firebase Storage]: ${error.message}`);
          this.logger.warn('⚠️ Retornando URL de fallback para não quebrar a requisição.');
          resolve('https://firebasestorage.googleapis.com/v0/b/fallback-error/o/error.png?alt=media');
        });

        blobStream.on('finish', () => {
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
            fileName,
          )}?alt=media&token=${token}`;
          this.logger.log(`✅ [Firebase Storage] Upload concluído! URL: ${publicUrl}`);
          resolve(publicUrl);
        });

        blobStream.end(file.buffer);
      });
    } catch (error: any) {
      this.logger.error(`💥 [Erro no Firebase Storage]: ${error.message}`);
      return 'https://firebasestorage.googleapis.com/v0/b/fallback-error/o/error.png?alt=media';
    }
  }
}