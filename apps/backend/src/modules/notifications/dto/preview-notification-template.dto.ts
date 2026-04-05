import { IsObject, IsOptional } from 'class-validator';

export class PreviewNotificationTemplateDto {
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
