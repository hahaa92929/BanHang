import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryProductsDto } from './dto/query-products.dto';
import { ProductsService } from './products.service';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.service.findAll(query);
  }

  @Get('categories')
  categories() {
    return { data: this.service.listCategories() };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
