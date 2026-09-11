import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

// Aumentado para 20MB para suportar fotos de alta resolução enviadas por smartphones
export const MAX_FILE_SIZE = 20 * 1024 * 1024; 

export const multerImageFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file) {
    return callback(null, true);
  }

  // Checa se o MIME type começa com "image/" (cobre jpeg, png, webp, heic, heif, avif, gif, etc.)
  const isImageMime = file.mimetype && file.mimetype.startsWith('image/');
  
  // Extrai a extensão do arquivo e converte para lowercase
  const extension = file.originalname?.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'bmp'];
  const isAllowedExtension = extension ? allowedExtensions.includes(extension) : false;

  if (isImageMime || isAllowedExtension) {
    return callback(null, true);
  }

  return callback(
    new BadRequestException(
      `Tipo de arquivo não suportado (${file.mimetype || 'desconhecido'}). Envie apenas imagens.`,
    ),
    false,
  );
};