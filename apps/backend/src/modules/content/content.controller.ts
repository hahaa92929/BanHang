import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { CreateContentPageDto } from './dto/create-content-page.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { ConfirmNewsletterDto } from './dto/confirm-newsletter.dto';
import { QueryBlogPostsDto } from './dto/query-blog-posts.dto';
import { QueryContentPagesDto } from './dto/query-content-pages.dto';
import { QueryPromotionsDto } from './dto/query-promotions.dto';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { UpdateContentPageDto } from './dto/update-content-page.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { UnsubscribeNewsletterDto } from './dto/unsubscribe-newsletter.dto';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Get('pages')
  pages(@Query() query: QueryContentPagesDto) {
    return this.service.listPages(query);
  }

  @Get('pages/:slug')
  page(@Param('slug') slug: string) {
    return this.service.page(slug);
  }

  @Post('pages')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  createPage(@Body() body: CreateContentPageDto) {
    return this.service.createPage(body);
  }

  @Patch('pages/:id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  updatePage(@Param('id') id: string, @Body() body: UpdateContentPageDto) {
    return this.service.updatePage(id, body);
  }

  @Get('blog')
  blog(@Query() query: QueryBlogPostsDto) {
    return this.service.listBlog(query);
  }

  @Get('blog/:slug')
  blogDetail(@Param('slug') slug: string) {
    return this.service.blog(slug);
  }

  @Post('blog')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  createBlog(@Body() body: CreateBlogPostDto) {
    return this.service.createBlogPost(body);
  }

  @Patch('blog/:id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  updateBlog(@Param('id') id: string, @Body() body: UpdateBlogPostDto) {
    return this.service.updateBlogPost(id, body);
  }

  @Get('promotions')
  promotions(@Query() query: QueryPromotionsDto) {
    return this.service.listPromotions(query);
  }

  @Post('newsletter/subscribe')
  subscribeNewsletter(@Body() body: SubscribeNewsletterDto) {
    return this.service.subscribeNewsletter(body);
  }

  @Post('newsletter/confirm')
  confirmNewsletter(@Body() body: ConfirmNewsletterDto) {
    return this.service.confirmNewsletter(body);
  }

  @Post('newsletter/unsubscribe')
  unsubscribeNewsletter(@Body() body: UnsubscribeNewsletterDto) {
    return this.service.unsubscribeNewsletter(body);
  }

  @Post('promotions')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  createPromotion(@Body() body: CreatePromotionDto) {
    return this.service.createPromotion(body);
  }

  @Patch('promotions/:id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  updatePromotion(@Param('id') id: string, @Body() body: UpdatePromotionDto) {
    return this.service.updatePromotion(id, body);
  }
}
