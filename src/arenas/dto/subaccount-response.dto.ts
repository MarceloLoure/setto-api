import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountNumberDto {
  @ApiProperty({ example: '0001' })
  agency: string;

  @ApiProperty({ example: '3514' })
  account: string;

  @ApiProperty({ example: '3' })
  accountDigit: string;
}

export class CommercialInfoExpirationDto {
  @ApiProperty({ example: false })
  isExpired: boolean;

  @ApiProperty({ example: '2025-05-05 00:00:00' })
  scheduledDate: string;
}

export class AccessTokenResponseDto {
  @ApiProperty({ example: 'b6bff0c5-38c6-496a-a3a8-105b31d5bcfe' })
  id: string;

  @ApiProperty({ example: 'My API Access Token' })
  name: string;

  @ApiProperty({ example: false })
  enabled: boolean;

  @ApiPropertyOptional({ example: 'MANUAL', enum: ['LACK_OF_USE', 'MANUAL', 'ACCOUNT_OWNER_ARRANGEMENT_TYPE_CHANGED_TO_INDICATION_PARTNER'] })
  disabledReason?: string;

  @ApiProperty({ example: '2026-12-31 12:30:50' })
  expirationDate: string;

  @ApiProperty({ example: '2026-01-01 08:00:00' })
  dateCreated: string;

  @ApiProperty({ example: '2026-06-01' })
  projectedExpirationDateByLackOfUse: string;

  @ApiProperty({ description: 'Chave de API da nova subconta (capture no retorno, pois não pode ser recuperada depois)', example: '$aact_hmlg_xxxxx' })
  apiKey: string;
}

export class SubAccountResponseDto {
  @ApiProperty({ example: 'account' })
  object: string;

  @ApiProperty({ example: '4f468235-cec3-482f-b3d0-348af4c7194' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@asaas.com.br' })
  email: string;

  @ApiProperty({ example: 'john.doe@asaas.com.br' })
  loginEmail: string;

  @ApiPropertyOptional({ example: null })
  phone?: string;

  @ApiPropertyOptional({ example: null })
  mobilePhone?: string;

  @ApiProperty({ example: 'Rua Fernando Orlandi' })
  address: string;

  @ApiProperty({ example: '544' })
  addressNumber: string;

  @ApiPropertyOptional({ example: null })
  complement?: string;

  @ApiProperty({ example: 'Jardim Pedra Branca' })
  province: string;

  @ApiProperty({ example: '14079-452' })
  postalCode: string;

  @ApiProperty({ example: '35381637000150' })
  cpfCnpj: string;

  @ApiPropertyOptional({ example: '1995-04-12' })
  birthDate?: string;

  @ApiProperty({ example: 'JURIDICA', enum: ['JURIDICA', 'FISICA'] })
  personType: string;

  @ApiPropertyOptional({ example: 'MEI', enum: ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'] })
  companyType?: string;

  @ApiProperty({ example: 15478 })
  city: number;

  @ApiProperty({ example: 'SP' })
  state: string;

  @ApiProperty({ example: 'Brasil' })
  country: string;

  @ApiPropertyOptional({ example: null })
  tradingName?: string;

  @ApiPropertyOptional({ example: 'https://www.example.com' })
  site?: string;

  @ApiProperty({ example: 'c0c1688f-636b-42c0-b6ee-7339182276b7' })
  walletId: string;

  @ApiProperty({ type: AccountNumberDto })
  accountNumber: AccountNumberDto;

  @ApiProperty({ type: CommercialInfoExpirationDto })
  commercialInfoExpiration: CommercialInfoExpirationDto;

  @ApiProperty({ type: AccessTokenResponseDto })
  accessToken: AccessTokenResponseDto;
}