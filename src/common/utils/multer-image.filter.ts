import { BadRequestException } from '@nestjs/common';

export const multerImageFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    return callback(
      new BadRequestException('Formato de arquivo inválido. Apenas JPG, PNG e WEBP são permitidos.'),
      false,
    );
  }
  callback(null, true);
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB