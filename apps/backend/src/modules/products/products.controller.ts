import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { JwtGuard } from '../../common/jwt.guard';
import { PermissionsGuard } from '../../common/permissions.guard';
import { AddProductMediaDto } from './dto/add-product-media.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.service.findAll(query);
  }

  @Get('export')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  exportProducts() {
    return this.service.exportProducts();
  }

  @Get('categories')
  async categories() {
    return { data: await this.service.listCategories() };
  }

  @Post('categories')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  createCategory(@Body() body: CreateCategoryDto) {
    return this.service.createCategory(body);
  }

  @Get('brands')
  async brands() {
    return { data: await this.service.listBrands() };
  }

  @Post('brands')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  createBrand(@Body() body: CreateBrandDto) {
    return this.service.createBrand(body);
  }

  @Post()
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  create(@Body() body: CreateProductDto, @Req() _request: RequestWithUser) {
    return this.service.createProduct(body);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.service.updateProduct(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  archive(@Param('id') id: string) {
    return this.service.archiveProduct(id);
  }

  @Post('import')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  import(@Body() body: ImportProductsDto) {
    return this.service.importProducts(body);
  }

  @Post(':id/media')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('catalog.write')
  addMedia(@Param('id') id: string, @Body() body: AddProductMediaDto) {
    return this.service.addMedia(id, body);
  }

  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.service.findOne(idOrSlug);
  }
}
