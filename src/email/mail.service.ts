import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

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
        from: 'Beach Social Club <nao-responda@settoarenas.com.br>',
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
        from: 'Beach Social Club <nao-responda@settoarenas.com.br>',
        to: [toEmail],
        subject: 'Recuperação de Senha - Beach Social Club',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Olá, ${userName}!</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no Beach Social Club.</p>
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
}