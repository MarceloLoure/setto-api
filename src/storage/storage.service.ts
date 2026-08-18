import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { initializeFirebaseAdmin } from '../firebase/firebase-admin.config';

export type StorageFolder =
  | 'avatars'
  | 'covers'
  | 'arenas'
  | 'courts'
  | 'receipts'
  | 'arenas/logos'
  | 'arenas/covers'
  | 'arenas/photos'
  | 'courts/photos';

export interface UploadedFileResult {
  name: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class FirebaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseStorageService.name);

  onModuleInit() {
    initializeFirebaseAdmin();
  }

  async uploadPhoto(
    file: Express.Multer.File,
    folder: StorageFolder | string,
    ownerId: string,
  ): Promise<UploadedFileResult> {
    this.logger.log(`📥 [Firebase Storage] Upload | Pasta: [${folder}] | Owner: ${ownerId}`);
    this.logger.log(`📄 Arquivo: "${file?.originalname}" | Mime: "${file?.mimetype}" | Tamanho: ${file?.size} bytes`);

    const bucketName =
      process.env.FIREBASE_STORAGE_BUCKET ||
      'beach-social-club-mock.firebasestorage.app';
    const bucket = getStorage().bucket(bucketName);

    const token = uuidv4();
    const fileExt = file.originalname.split('.').pop() || 'png';
    const uniqueFileName = `${uuidv4()}.${fileExt}`;
    // Organiza por subdiretório: ex: arenas/logos/{ownerId}/{uniqueFileName}
    const destinationPath = `${folder}/${ownerId}/${uniqueFileName}`;
    const blob = bucket.file(destinationPath);

    this.logger.log(`🚀 Gravando no Bucket: "${bucketName}" -> Caminho: "${destinationPath}"`);

    return new Promise((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      blobStream.on('error', (error) => {
        this.logger.error(`❌ [Erro na Stream do Firebase Storage]: ${error.message}`);
        reject(error);
      });

      blobStream.on('finish', () => {
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
          destinationPath,
        )}?alt=media&token=${token}`;

        this.logger.log(`✅ [Firebase Storage] Upload concluído! URL: ${publicUrl}`);

        resolve({
          name: file.originalname,
          path: publicUrl,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
      });

      blobStream.end(file.buffer);
    });
  }

  async deletePhotoByUrl(publicUrl: string): Promise<boolean> {
    try {
      const bucketName =
        process.env.FIREBASE_STORAGE_BUCKET ||
        'beach-social-club-mock.firebasestorage.app';
      const bucket = getStorage().bucket(bucketName);

      // Extrai o caminho relativo codificado da URL do Firebase
      const matches = publicUrl.match(/\/o\/(.*?)\?alt=media/);
      if (!matches || !matches[1]) {
        return false;
      }

      const filePath = decodeURIComponent(matches[1]);
      await bucket.file(filePath).delete();
      this.logger.log(`🗑️ [Firebase Storage] Arquivo deletado com sucesso: ${filePath}`);
      return true;
    } catch (error: any) {
      this.logger.warn(`⚠️ [Firebase Storage] Erro ao deletar arquivo do bucket: ${error.message}`);
      return false;
    }
  }
}