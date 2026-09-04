import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Matches,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WebhookConfigDto {
  @ApiProperty({
    description: 'Nome de identificação do Webhook',
    example: 'Webhook Cobranças - Arena Central',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'URL de destino para o disparo de eventos do Asaas',
    example: 'https://api.suaplataforma.com.br/payments/webhook/asaas',
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'E-mail para notificações do Webhook',
    example: 'admin@arenacentral.com.br',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Modo de envio das requisições',
    example: 'SEQUENTIALLY',
    default: 'SEQUENTIALLY',
  })
  @IsString()
  @IsOptional()
  sendType?: string = 'SEQUENTIALLY';

  @ApiPropertyOptional({
    description: 'Indica se a fila de envio está interrompida',
    example: false,
    default: false,
  })
  @IsOptional()
  interrupted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Habilita ou desabilita o Webhook',
    example: true,
    default: true,
  })
  @IsOptional()
  enabled?: boolean = true;

  @ApiPropertyOptional({
    description: 'Versão da API do Asaas para o payload',
    example: 3,
    default: 3,
  })
  @IsNumber()
  @IsOptional()
  apiVersion?: number = 3;

  @ApiProperty({
    description: 'Token de autenticação enviado no cabeçalho `asaas-access-token`',
    example: 'segredo-webhook-32-caracteres-minimo',
  })
  @IsString()
  @IsNotEmpty()
  authToken: string;

  @ApiProperty({
    description: 'Lista de eventos que disparam este Webhook',
    example: ['PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  events: string[];
}

export class CreateSubAccountDto {
  @ApiProperty({
    description: 'Token de convite gerado na fase de registro/checkout da arena',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @IsString()
  @IsNotEmpty({ message: 'O token de convite é obrigatório.' })
  token?: string;

  @ApiProperty({
    description: 'Nome da arena ou razão social do estabelecimento',
    example: 'Arena Central de Beach Tennis',
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome da arena é obrigatório.' })
  name: string;

  @ApiProperty({
    description: 'E-mail principal do responsável ou da subconta',
    example: 'contato@arenacentral.com.br',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email: string;

  @ApiPropertyOptional({
    description: 'CNPJ ou CPF do responsável/arena (apenas números ou formatado)',
    example: '12345678000195',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{11}|\d{14}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/, {
    message: 'CPF ou CNPJ inválido.',
  })
  cpfCnpj?: string;

  @ApiPropertyOptional({
    description: 'Tipo de empresa no Asaas (MEI, LIMITED, INDIVIDUAL, ASSOCIATION, etc.)',
    example: 'LIMITED',
  })
  @IsOptional()
  @IsString()
  companyType?: string;

  @ApiPropertyOptional({
    description: 'Telefone comercial/fixo com DDD',
    example: '1133334444',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Telefone celular/WhatsApp com DDD',
    example: '11999998888',
  })
  @IsOptional()
  @IsString()
  mobilePhone?: string;

  @ApiPropertyOptional({
    description: 'Faturamento ou renda mensal estimada em R$',
    example: 15000,
    default: 10000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'A renda/faturamento deve ser um valor numérico.' })
  incomeValue?: number;

  @ApiProperty({
    description: 'Logradouro (Rua, Avenida, etc.)',
    example: 'Av. Paulista',
  })
  @IsString()
  @IsNotEmpty({ message: 'O endereço é obrigatório.' })
  address: string;

  @ApiProperty({
    description: 'Número do endereço',
    example: '1000',
  })
  @IsString()
  @IsNotEmpty({ message: 'O número do endereço é obrigatório.' })
  addressNumber: string;

  @ApiPropertyOptional({
    description: 'Complemento do endereço',
    example: 'Bloco B - Sala 201',
  })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({
    description: 'Bairro/Província',
    example: 'Bela Vista',
  })
  @IsString()
  @IsNotEmpty({ message: 'O bairro é obrigatório.' })
  province: string;

  @ApiProperty({
    description: 'CEP do endereço (com ou sem hífen)',
    example: '01310100',
  })
  @IsString()
  @IsNotEmpty({ message: 'O CEP é obrigatório.' })
  postalCode: string;

  @ApiProperty({
    description: 'Cidade',
    example: 'São Paulo',
  })
  @IsString()
  @IsNotEmpty({ message: 'A cidade é obrigatória.' })
  city?: string;

  @ApiProperty({
    description: 'Sigla do Estado (UF com 2 letras)',
    example: 'SP',
  })
  @IsString()
  @Length(2, 2, { message: 'O Estado deve conter exatamente 2 caracteres (ex: SP).' })
  @IsNotEmpty({ message: 'O Estado é obrigatório.' })
  state?: string;

  @ApiPropertyOptional({
    description: 'Configuração dos Webhooks para a subconta no Asaas BaaS',
    type: [WebhookConfigDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookConfigDto)
  webhooks?: WebhookConfigDto[];
}