import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { CreatePaymentSplitDto } from './dto/create-payment-split.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubAccountDto } from 'src/arenas/dto/create-arena-request.dto';

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
  async createSubaccount(arenaData: CreateSubAccountDto) {
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

  /**
   * Busca os detalhes de uma assinatura específica no Asaas pelo ID (ex: sub_xxx).
   */
  async getSubscription(subscriptionId: string) {
    try {
      const { data } = await this.http.get(`/subscriptions/${subscriptionId}`);
      return data;
    } catch (error) {
      this.handleError('getSubscription', error);
    }
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const { data } = await this.http.delete(`/subscriptions/${subscriptionId}`);
      return data;
    } catch (error) {
      // Se for 404 (já deletado no Asaas), tratamos graciosamente
      const err = error as AxiosError<any>;
      if (err.response?.status === 404) {
        this.logger.warn(`Assinatura ${subscriptionId} não foi encontrada no Asaas ao tentar cancelar.`);
        return { deleted: true, message: 'Assinatura já cancelada no gateway.' };
      }
      this.handleError('cancelSubscription', error);
    }
  }

  async updateCustomer(id: string, data: any) {
    try {
      const { data: customer } = await this.http.post(`/customers/${id}`, data);
      return customer;
    } catch (error) {
      this.handleError('updateCustomer', error);
    }
  }

  async findCustomerByCpfCnpj(cpfCnpj: string) {
    try {
      const { data } = await this.http.get('/customers', {
        params: { cpfCnpj },
      });
      return data;
    } catch (error) {
      this.handleError('findCustomerByCpfCnpj', error);
    }
  }

  async findCustomerByEmail(email: string) {
    try {
      const { data } = await this.http.get('/customers', {
        params: { email },
      });
      return data;
    } catch (error) {
      this.handleError('findCustomerByEmail', error);
    }
  }

  /**
   * Cancela/remove uma cobrança pendente no Asaas.
   */
  async cancelPayment(paymentId: string) {
    try {
      const { data } = await this.http.delete(`/payments/${paymentId}`);
      return data;
    } catch (error) {
      this.handleError('cancelPayment', error);
    }
  }

  async tokenizeCreditCard(payload: {
    customer: string;
    creditCard: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    };
    creditCardHolderInfo: {
      name: string;
      email: string;
      cpfCnpj: string;
      postalCode: string;
      addressNumber: string;
      phone: string;
      mobilePhone?: string;
    };
  }) {
    try {
      const { data } = await this.http.post('/creditCard/tokenize', payload);
      
      // O Asaas retorna: creditCardToken, creditCardBrand, creditCardNumber (últimos 4 dígitos)
      return data as {
        creditCardToken: string;
        creditCardBrand: string;
        creditCardNumber: string;
      };
    } catch (error) {
      this.handleError('tokenizeCreditCard', error);
    }
  }

  /**
   * Consulta o saldo disponível e a receber de uma subconta (arena) no Asaas.
   */
  async getAccountBalance(asaasAccountId: string) {
    try {
      // Quando for subconta, passamos a API Key do Asaas do master
      // e informamos o ID da subconta no header ou acessamos pela chave da subconta.
      // A API v3 do Asaas permite ler saldo via GET /finance/balance
      const { data } = await this.http.get('/finance/balance', {
        headers: {
          // Caso utilize chaves individuais por subconta ou o recurso de 'impersonation':
          'asaas-account-id': asaasAccountId,
        },
      });

      return data as {
        balance: number; // Saldo disponível para saque
        totalBalance: number; // Saldo total
        retainedBalance?: number;
      };
    } catch (error) {
      this.handleError('getAccountBalance', error);
    }
  }

  /**
   * Realiza a solicitação de transferência / saque de valores acumulados na subconta da arena
   * para a chave Pix cadastrada ou conta bancária vinculada.
   */
  async transferFunds(
    asaasAccountId: string,
    value: number,
    pixKey?: string,
  ) {
    try {
      const payload: Record<string, any> = {
        value,
      };

      if (pixKey) {
        payload.pixAddressKey = pixKey;
        payload.scheduleDate = null;
      }

      const { data } = await this.http.post('/transfers', payload, {
        headers: {
          'asaas-account-id': asaasAccountId,
        },
      });

      return data as {
        id: string;
        dateCreated: string;
        status: string;
        effectiveDate: string;
        value: number;
        netValue: number;
        transferFee: number;
      };
    } catch (error) {
      this.handleError('transferFunds', error);
    }
  }
}
