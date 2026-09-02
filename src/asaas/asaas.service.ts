import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { CreateSubaccountDto } from './dto/create-subaccount.dto';
import { CreatePaymentSplitDto } from './dto/create-payment-split.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: this.config.get<string>('ASAAS_API_URL'),
      headers: {
        'Content-Type': 'application/json',
        access_token: this.config.get<string>('ASAAS_API_KEY'),
      },
      timeout: 15000,
    });
  }

  private handleError(context: string, error: unknown): never {
    const err = error as AxiosError<any>;
    const asaasMessage = err.response?.data?.errors?.[0]?.description;
    this.logger.error(`[Asaas] Falha em ${context}: ${asaasMessage || err.message}`, err.stack);
    throw new HttpException(
      asaasMessage || `Falha ao comunicar com a Asaas (${context}).`,
      err.response?.status || 502,
    );
  }

  /**
   * Cria (ou reaproveita) um cliente Asaas para representar o atleta/pagador
   * de uma cobrança. Necessário antes de gerar qualquer payment/subscription.
   */
  async createCustomer(data: { name: string; email: string; cpfCnpj?: string; phone?: string; externalReference?: string }) {
    try {
      const { data: customer } = await this.http.post('/customers', data);
      return customer;
    } catch (error) {
      this.handleError('createCustomer', error);
    }
  }

  /**
   * Cria a subconta Asaas de uma arena (whitelabel/onboarding), necessária
   * pra receber o valor líquido do split das reservas e das mensalidades.
   */
  async createSubaccount(arenaData: CreateSubaccountDto) {
    try {
      const { data: subaccount } = await this.http.post('/accounts', arenaData);
      return subaccount;
    } catch (error) {
      this.handleError('createSubaccount', error);
    }
  }

  /**
   * Gera uma cobrança avulsa (Pix ou Cartão) com split automático entre a
   * carteira master da Setto (comissão) e a subconta da arena (valor líquido).
   */
  async createSplitPayment(paymentData: CreatePaymentSplitDto) {
    try {
      const { data: payment } = await this.http.post('/payments', paymentData);
      return payment;
    } catch (error) {
      this.handleError('createSplitPayment', error);
    }
  }

  /**
   * Busca o QR Code Pix (imagem base64 + copia-e-cola) de uma cobrança já criada.
   */
  async getPixQrCode(paymentId: string) {
    try {
      const { data } = await this.http.get(`/payments/${paymentId}/pixQrCode`);
      return data as { encodedImage: string; payload: string; expirationDate: string };
    } catch (error) {
      this.handleError('getPixQrCode', error);
    }
  }

  /**
   * Cria uma assinatura recorrente. Usada tanto pra planos da plataforma
   * Setto (sem split) quanto pra mensalidades de atletas na arena (sem split
   * de comissão da Setto, mas ainda cobrada na subconta correta via `customer`).
   */
  async createSubscription(subscriptionData: CreateSubscriptionDto) {
    try {
      const { data: subscription } = await this.http.post('/subscriptions', subscriptionData);
      return subscription;
    } catch (error) {
      this.handleError('createSubscription', error);
    }
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const { data } = await this.http.delete(`/subscriptions/${subscriptionId}`);
      return data;
    } catch (error) {
      this.handleError('cancelSubscription', error);
    }
  }
}
