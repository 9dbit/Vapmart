import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database';

export const categories = ['home', 'lifestyle', 'decor', 'accessories', 'electronics', 'other'] as const;
type Category = typeof categories[number];

export interface Product {
  id: string;
  slug: string;
  sku: string | null;
  brand_id: string | null;
  brand_name?: string | null;
  gallery_urls: string[];
  name: string;
  description: string;
  category: Category;
  price_idr: number;
  stock_qty: number;
  image_url: string | null;
  is_active: boolean;
}

type Payload = Record<string, unknown>;
const restricted = /\b(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig(?:arette)?|e-liquid)\b/i;
function asObject(body: unknown): Payload {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Expected a product object');
  }
  return body as Payload;
}

export function cleanProduct(body: unknown, partial = false): Partial<Product> {
  const input = asObject(body);
  const allowed = ['slug', 'sku', 'name', 'description', 'category', 'price_idr', 'stock_qty', 'image_url', 'is_active', 'brand_id', 'gallery_urls'];
  if (Object.keys(input).some(k => !allowed.includes(k))) {
    throw new BadRequestException('Unknown product field');
  }
  if (!partial && ['slug','name','category','price_idr','stock_qty'].some(k => !(k in input))) {
    throw new BadRequestException('Missing required product fields');
  }
  const out: Record<string, unknown> = {};
  if ('slug' in input) {
    if (typeof input.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 120)
      throw new BadRequestException('Invalid slug');
    out.slug = input.slug;
  }
  if ('sku' in input) {
    const sku=input.sku;
    if(sku===null || sku==='')out.sku=null;
    else {
      if(typeof sku!=='string'||!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(sku))
        throw new BadRequestException('Invalid SKU');
      out.sku=sku;
    }
  }
  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 140)
      throw new BadRequestException('Invalid name');
    out.name = input.name.trim();
  }
  if ('description' in input) {
    if (typeof input.description !== 'string' || input.description.length > 3000)
      throw new BadRequestException('Invalid description');
    out.description = input.description;
  } else if (!partial) {
    out.description = '';
  }
  if ('category' in input) {
    if (typeof input.category !== 'string' || !categories.includes(input.category as Category))
      throw new BadRequestException('Unsupported category');
    out.category = input.category;
  }
  for (const field of ['price_idr', 'stock_qty'] as const) {
    if (field in input) {
      const number = input[field];
      if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0 || number > 2000000000)
        throw new BadRequestException(`Invalid ${field}`);
      out[field] = number;
    }
  }
  if ('image_url' in input) {
    const url = input.image_url;
    if (url === null || url === '') out.image_url = null;
    else {
      if (typeof url !== 'string' || url.length > 500 || !/^https:\/\//i.test(url))
        throw new BadRequestException('Image URL must be HTTPS');
      out.image_url = url;
    }
  }
  if ('brand_id' in input) {
    if(input.brand_id===null)out.brand_id=null;
    else if(typeof input.brand_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.brand_id))
      throw new BadRequestException('Invalid brand ID');
    else out.brand_id=input.brand_id;
  }
  if ('gallery_urls' in input) {
    if(!Array.isArray(input.gallery_urls)||input.gallery_urls.length>8||
      input.gallery_urls.some(u=>typeof u!=='string'||u.length>600||!/^https:\/\//i.test(u)))
      throw new BadRequestException('Invalid image gallery (maximum 8 HTTPS photos)');
    if(new Set(input.gallery_urls).size!==input.gallery_urls.length)
      throw new BadRequestException('Duplicate gallery image');
    out.gallery_urls=input.gallery_urls;
  }
  if ('is_active' in input) {
    if (typeof input.is_active !== 'boolean') throw new BadRequestException('Invalid is_active');
    out.is_active = input.is_active;
  }
  if ([out.name,out.description,out.slug,out.sku].some(v=>restricted.test(String(v||'')))) {
    throw new BadRequestException('This catalog cannot contain nicotine or tobacco products');
  }
  if (!partial) out.is_active ??= false;
  return out as Partial<Product>;
}

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<Product[]> {
    // A new installation has no invented products or unsafe placeholder orders.
    if (!this.db.configured) return [];
    const result = await this.db.query<Product>(
      'SELECT p.id, p.sku, p.slug, p.brand_id, b.name AS brand_name, p.gallery_urls, p.name, p.description, p.category, p.price_idr::integer AS price_idr, p.stock_qty, p.image_url, p.is_active FROM product.products p LEFT JOIN product.brands b ON p.brand_id=b.id WHERE p.is_active = true ORDER BY p.created_at DESC LIMIT 48'
    );
    return result.rows;
  }

  async bySlug(slug: string): Promise<Product> {
    if (!this.db.configured) throw new NotFoundException('Product not found');
    const result = await this.db.query<Product>(
      'SELECT p.id, p.sku, p.slug, p.brand_id, b.name AS brand_name, p.gallery_urls, p.name, p.description, p.category, p.price_idr::integer AS price_idr, p.stock_qty, p.image_url, p.is_active FROM product.products p LEFT JOIN product.brands b ON p.brand_id=b.id WHERE p.slug = $1 AND p.is_active = true',
      [slug]
    );
    if (!result.rows[0]) throw new NotFoundException('Product not found');
    return result.rows[0];
  }

  async listAdmin(): Promise<Product[]> {
    const result = await this.db.query<Product>(
      'SELECT p.id, p.sku, p.slug, p.brand_id, b.name AS brand_name, p.gallery_urls, p.name, p.description, p.category, p.price_idr::integer AS price_idr, p.stock_qty, p.image_url, p.is_active FROM product.products p LEFT JOIN product.brands b ON p.brand_id=b.id ORDER BY p.updated_at DESC LIMIT 150'
    );
    return result.rows;
  }

  async create(body: unknown): Promise<Product> {
    const product = cleanProduct(body);
    const columns = Object.keys(product);
    const result = await this.db.query<Product>(
      `INSERT INTO product.products (${columns.join(', ')}) VALUES (${columns.map((_, index) => '$' + (index + 1)).join(', ')}) RETURNING id, sku, slug, brand_id, gallery_urls, name, description, category, price_idr::integer AS price_idr, stock_qty, image_url, is_active`,
      columns.map(key => (product as Record<string, unknown>)[key])
    );
    return result.rows[0];
  }

  async update(id: string, body: unknown): Promise<Product> {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new BadRequestException('Invalid ID');
    const product = cleanProduct(body, true);
    const columns = Object.keys(product);
    if (!columns.length) throw new BadRequestException('No changes supplied');
    const result = await this.db.query<Product>(
      `UPDATE product.products SET ${columns.map((key, index) => key + ' = $' + (index + 1)).join(', ')}, updated_at = now() WHERE id = $${columns.length + 1} RETURNING id, sku, slug, brand_id, gallery_urls, name, description, category, price_idr::integer AS price_idr, stock_qty, image_url, is_active`,
      [...columns.map(key => (product as Record<string, unknown>)[key]), id]
    );
    if (!result.rows[0]) throw new NotFoundException('Product not found');
    return result.rows[0];
  }
}
