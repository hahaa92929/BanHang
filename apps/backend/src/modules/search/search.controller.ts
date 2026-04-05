import { Controller, Delete, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthOrApiKeyGuard } from '../../common/auth-or-api-key.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { QuerySearchAnalyticsDto } from './dto/query-search-analytics.dto';
import { QuerySearchDto } from './dto/query-search.dto';
import { QuerySearchRecentDto } from './dto/query-search-recent.dto';
import { QuerySearchSuggestionsDto } from './dto/query-search-suggestions.dto';
import { QuerySearchTrendingDto } from './dto/query-search-trending.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Req() request: RequestWithUser, @Query() query: QuerySearchDto) {
    return this.searchService.search(query, request.user?.sub);
  }

  @Get('suggestions')
  suggestions(@Query() query: QuerySearchSuggestionsDto) {
    return this.searchService.suggestions(query.q, query.limit);
  }

  @Get('trending')
  trending(@Query() query: QuerySearchTrendingDto) {
    return this.searchService.trending(query.limit, query.days);
  }

  @Get('recent')
  @UseGuards(JwtGuard)
  recent(@Req() request: RequestWithUser, @Query() query: QuerySearchRecentDto) {
    return this.searchService.recent(request.user!.sub, query.limit);
  }

  @Delete('recent')
  @UseGuards(JwtGuard)
  clearRecent(@Req() request: RequestWithUser) {
    return this.searchService.clearRecent(request.user!.sub);
  }

  @Get('analytics')
  @UseGuards(AuthOrApiKeyGuard, PermissionsGuard)
  @Permissions('reporting.read')
  analytics(@Query() query: QuerySearchAnalyticsDto) {
    return this.searchService.analytics(query);
  }
}
