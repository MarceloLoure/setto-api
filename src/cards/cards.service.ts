import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import { CreateCardDto } from './dto/create-card.dto';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  async create(userId: string, dto: CreateCardDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (!user.cpf) {
      throw new BadRequestException('Usuário precisa ter um CPF cadastrado para tokenizar cartão.');
    }

    // 1. Garante que o cliente possui ID de Customer no Asaas
    let asaasCustomerId = user.asaasCustomerId;

    if (!asaasCustomerId) {
      const customerData = {
        name: user.name,
        email: user.email,
        cpfCnpj: user.cpf,
        phone: user.phone || undefined,
        externalReference: user.id,
      };

      const customer = await this.asaasService.createCustomer(customerData);
      asaasCustomerId = customer.id;

      await this.prisma.user.update({
        where: { id: userId },
        data: { asaasCustomerId },
      });
    }

    if (!asaasCustomerId) {
      throw new BadRequestException('Não foi possível gerar a identificação do cliente no Asaas.');
    }

    // 2. Chama o Asaas para tokenizar
    const tokenizedData = await this.asaasService.tokenizeCreditCard({
      customer: asaasCustomerId,
      creditCard: dto.creditCard,
      creditCardHolderInfo: { ...dto.creditCardHolderInfo, phone: dto.creditCardHolderInfo.phone || '' },
    });

    if (!tokenizedData?.creditCardToken) {
      throw new BadRequestException('Não foi possível tokenizar o cartão junto ao provedor.');
    }

    // 3. Verifica se o usuário já possui outros cartões para definir 'isDefault'
    const existingCardsCount = await this.prisma.creditCard.count({
      where: { userId },
    });

    const cardToken = tokenizedData.creditCardToken;

    // 4. Salva ou Atualiza no banco local usando UPSERT para evitar o erro P2002
    return await this.prisma.creditCard.upsert({
      where: {
        asaasToken: cardToken,
      },
      update: {
        userId,
        brand: tokenizedData.creditCardBrand || 'UNKNOWN',
        lastFourDigits: tokenizedData.creditCardNumber || dto.creditCard.number.slice(-4),
        holderName: dto.creditCard.holderName,
        expiryMonth: dto.creditCard.expiryMonth,
        expiryYear: dto.creditCard.expiryYear,
      },
      create: {
        userId,
        asaasToken: cardToken,
        brand: tokenizedData.creditCardBrand || 'UNKNOWN',
        lastFourDigits: tokenizedData.creditCardNumber || dto.creditCard.number.slice(-4),
        holderName: dto.creditCard.holderName,
        expiryMonth: dto.creditCard.expiryMonth,
        expiryYear: dto.creditCard.expiryYear,
        isDefault: existingCardsCount === 0,
      },
      select: {
        id: true,
        brand: true,
        lastFourDigits: true,
        holderName: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.creditCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        brand: true,
        lastFourDigits: true,
        holderName: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  async remove(userId: string, cardId: string) {
    const card = await this.prisma.creditCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new NotFoundException('Cartão não encontrado.');
    }

    await this.prisma.creditCard.delete({ where: { id: cardId } });

    return { message: 'Cartão removido com sucesso.' };
  }
}