import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthOrApiKeyGuard } from '../../common/auth-or-api-key.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateCustomerTagDto } from './dto/create-customer-tag.dto';
import { QueryCrmCustomersDto } from './dto/query-crm-customers.dto';
import { CrmService } from './crm.service';

@Controller('crm/customers')
@UseGuards(AuthOrApiKeyGuard, PermissionsGuard)
@Permissions('reporting.read')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  list(@Query() query: QueryCrmCustomersDto) {
    return this.crmService.listCustomers(query);
  }

  @Get('export')
  export(@Query() query: QueryCrmCustomersDto) {
    return this.crmService.exportCustomers(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.crmService.detail(id);
  }

  @Post(':id/notes')
  createNote(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() body: CreateCustomerNoteDto,
  ) {
    return this.crmService.addNote(request.user!.sub, id, body);
  }

  @Delete(':id/notes/:noteId')
  deleteNote(@Param('id') id: string, @Param('noteId') noteId: string) {
    return this.crmService.deleteNote(id, noteId);
  }

  @Post(':id/tags')
  createTag(@Param('id') id: string, @Body() body: CreateCustomerTagDto) {
    return this.crmService.addTag(id, body);
  }

  @Delete(':id/tags/:tagId')
  removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.crmService.removeTag(id, tagId);
  }
}
