import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendCheckoutEmailParams {
  toEmail: string;
  userName: string;
  arenaName: string;
  billingType: 'PIX' | 'CREDIT_CARD' | string;
  invoiceUrl?: string;
  pixPayload?: string;
}

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendArenaInviteEmail(toEmail: string, token: string, planName: string) {
    const registerUrl = `${process.env.FRONTEND_URL}register/arena?token=${token}`;

    try {
      await this.resend.emails.send({
        from: 'Setto Arenas <nao-responda@settoarenas.com.br>',
        to: [toEmail],
        subject: 'Bem-vindo! Complete o cadastro da sua Arena',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Sua assinatura do plano ${planName} foi confirmada! 🎉</h2>
            <p>Você está a um passo de começar a gerenciar sua arena na nossa plataforma.</p>
            <p>Clique no botão abaixo para criar a sua conta e registrar os dados da sua arena:</p>
            <a href="${registerUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
              Completar Cadastro
            </a>
            <p style="color: #666; font-size: 14px;">Ou copie e cole este link no seu navegador: <br/> ${registerUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">Este convite expira em 7 dias.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Erro ao enviar e-mail via Resend:', error);
      throw new InternalServerErrorException('Falha ao enviar e-mail de convite.');
    }
  }

  async sendPasswordResetEmail(toEmail: string, userName: string, resetToken: string) {
    const resetUrl = `${process.env.FRONTEND_URL}reset-password?token=${resetToken}`;

    try {
      await this.resend.emails.send({
        from: 'Setto Arenas <nao-responda@settoarenas.com.br>',
        to: [toEmail],
        subject: 'Recuperação de Senha - Setto Arenas',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Olá, ${userName}!</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no Setto Arenas.</p>
            <p>Clique no botão abaixo para cadastrar uma nova senha. Este link é válido por <strong>30 minutos</strong>:</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">
              Redefinir Minha Senha
            </a>
            <p style="color: #666; font-size: 14px;">Ou copie e cole este link no seu navegador: <br/> ${resetUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">Se você não solicitou a alteração, por favor ignore este e-mail.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Erro ao enviar e-mail de redefinição via Resend:', error);
      throw new InternalServerErrorException('Falha ao enviar e-mail de recuperação de senha.');
    }
  }

  async sendCheckoutConfirmationEmail(params: SendCheckoutEmailParams) {
    const { toEmail, userName, arenaName, billingType, invoiceUrl, pixPayload } = params;

    const isPix = billingType === 'PIX';
    const subject = isPix
      ? `Pagamento Pendente (PIX) - Assinatura ${arenaName}`
      : `Confirmação de Assinatura - ${arenaName}`;

    const paymentBlockHtml = isPix
      ? `
        <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #18181b;">Instruções para Pagamento via PIX</h3>
          <p style="color: #3f3f46; font-size: 14px;">Utilize o código PIX Copia e Cola abaixo no aplicativo do seu banco:</p>
          <div style="background-color: #ffffff; padding: 12px; border: 1px dashed #d4d4d8; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 12px; color: #09090b;">
            ${pixPayload || 'Código PIX disponível no link da fatura.'}
          </div>
          ${
            invoiceUrl
              ? `
            <a href="${invoiceUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; font-size: 14px;">
              Visualizar QR Code e Fatura
            </a>
          `
              : ''
          }
        </div>
      `
      : `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #065f46;">Pagamento no Cartão de Crédito</h3>
          <p style="color: #047857; font-size: 14px; margin: 0;">Sua assinatura foi processada no cartão informado e está em fase de confirmação pela operadora.</p>
          ${
            invoiceUrl
              ? `
            <a href="${invoiceUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; font-size: 14px;">
              Acessar Fatura/Comprovante
            </a>
          `
              : ''
          }
        </div>
      `;

    try {
      await this.resend.emails.send({
        from: 'Setto Arenas <nao-responda@settoarenas.com.br>',
        to: [toEmail],
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <h2>Olá, ${userName}!</h2>
            <p>Obrigado por registrar a arena <strong>${arenaName}</strong> na plataforma Setto!</p>
            
            ${paymentBlockHtml}

            <p style="color: #52525b; font-size: 14px; margin-top: 25px;">
              Assim que a confirmação do pagamento for concluída pelo gateway, o acesso completo da sua arena estará totalmente ativo no seu painel de gestão.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;" />
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">Setto Arenas — Gestão inteligente para complexos esportivos.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Erro ao enviar e-mail de checkout via Resend:', error);
      // Loga o erro sem interromper o fluxo da API
    }
  }
}