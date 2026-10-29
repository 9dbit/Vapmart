import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanProduct, categories } from '../src/products';
import { readBearer } from '../src/auth';

const good = { slug: 'lifestyle-item', name: 'Lifestyle Item', category: 'lifestyle', price_idr: 150000, stock_qty: 2 };

test('accepts a non-nicotine product in an explicit category', () => {
  assert.equal(cleanProduct(good).price_idr, 150000);
  assert.ok(categories.includes('lifestyle'));
});
test('does not trust browser-submitted pricing fields', () => {
  assert.throws(() => cleanProduct({ ...good, browser_price: 1 }), /Unknown product field/);
});
test('does not accept negative integer money', () => {
  assert.throws(() => cleanProduct({ ...good, price_idr: -1 }), /Invalid price_idr/);
});
test('does not accept fractional stock', () => {
  assert.throws(() => cleanProduct({ ...good, stock_qty: 1.5 }), /Invalid stock_qty/);
});
test('does not permit nicotine products', () => {
  assert.throws(() => cleanProduct({ ...good, name: 'Vape Nicotine Kit' }), /cannot contain nicotine/);
});
test('does not permit arbitrary categories', () => {
  assert.throws(() => cleanProduct({ ...good, category: 'restricted' }), /Unsupported category/);
});
test('does not permit javascript image links', () => {
  assert.throws(() => cleanProduct({ ...good, image_url: 'javascript:alert(1)' }), /HTTPS/);
});
test('rejects admin authorization without bearer', () => {
  assert.throws(() => readBearer('role: admin'), /Bearer token required/);
});
test('does not allow unrecognized fields in product patch', () => {
  assert.throws(() => cleanProduct({ customer_id: 'other' }, true), /Unknown product field/);
});
test('requires all product fields for new products', () => {
  assert.throws(() => cleanProduct({ slug: 'a' }), /Missing required/);
});
