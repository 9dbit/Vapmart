import {createHash,randomBytes} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import {uuidPattern,membershipRoles} from './brand-portal';
import type {Principal} from './auth';
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function parseInvitation(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Undangan tidak valid');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(x=>!['email','role'].includes(x))||typeof b.email!=='string'||typeof b.role!=='string'||
  !membershipRoles.includes(b.role as typeof membershipRoles[number]))throw new BadRequestException('Email atau role tidak valid');
 const email=b.email.toLowerCase().trim();
 if(email.length>254||email.length<5||!emailPattern.test(email))throw new BadRequestException('Alamat email tidak valid');
 return {email,role:b.role as 'owner'|'manager'|'viewer'};
}
export function parseAcceptInvitation(raw:unknown):string{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Token undangan tidak valid');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).length!==1||typeof b.token!=='string'||! /^[A-Za-z0-9_-]{40,80}$/.test(b.token))
  throw new BadRequestException('Token undangan tidak valid');
 return b.token;
}
@Injectable()
export class BrandInvitationsService {
 constructor(private readonly db:DatabaseService){}
 async list(brandId:string){
  if(!uuidPattern.test(brandId))throw new BadRequestException('Brand ID tidak valid');
  const r=await this.db.query(
   'SELECT id,email,role,created_at,expires_at,accepted_at,revoked_at,accepted_by FROM product.brand_invitations WHERE brand_id=$1 ORDER BY created_at DESC LIMIT 100',[brandId]);
  return {items:r.rows,tokenStored:false};
 }
 async create(actor:Principal,brandId:string,body:unknown){
  if(!uuidPattern.test(brandId))throw new BadRequestException('Brand ID tidak valid');
  if(!actor.emailVerified)throw new ForbiddenException('Akun admin harus terverifikasi');
  const invite=parseInvitation(body);
  const token=randomBytes(32).toString('base64url');
  const hash=createHash('sha256').update(token).digest('hex');
  return this.db.transaction(async client=>{
   const brand=await client.query('SELECT id FROM product.brands WHERE id=$1 AND is_active=true FOR SHARE',[brandId]);
   if(!brand.rows.length)throw new NotFoundException('Brand aktif tidak ditemukan');
   const quota=await client.query<{count:string}>(
    "SELECT count(*)::text count FROM product.brand_invitations WHERE created_by=$1 AND created_at > now()-interval '24 hours'",[actor.id]);
   if(Number(quota.rows[0]?.count||0)>=40)throw new ConflictException('Batas 40 undangan per 24 jam tercapai');
   await client.query(
    'UPDATE product.brand_invitations SET revoked_at=now() WHERE brand_id=$1 AND email=$2 AND accepted_at IS NULL AND revoked_at IS NULL',
    [brandId,invite.email]);
   const r=await client.query<{id:string;email:string;role:string;expires_at:string}>(
    "INSERT INTO product.brand_invitations(brand_id,email,role,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '48 hours') RETURNING id,email,role,expires_at",
    [brandId,invite.email,invite.role,hash,actor.id]);
   return {...r.rows[0],token,delivery:'manual_only'};
  });
 }
 async revoke(actor:Principal,brandId:string,inviteId:string){
  if(!uuidPattern.test(brandId)||!uuidPattern.test(inviteId))throw new BadRequestException('ID undangan tidak valid');
  const r=await this.db.query(
   'UPDATE product.brand_invitations SET revoked_at=now() WHERE id=$1 AND brand_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id,revoked_at',
   [inviteId,brandId]);
  if(!r.rows[0])throw new NotFoundException('Undangan aktif tidak ditemukan');
  return {revoked:true,id:inviteId,actor:actor.id};
 }
 async accept(actor:Principal,body:unknown){
  if(!actor.email||!actor.emailVerified)throw new ForbiddenException('Verifikasi email wajib diselesaikan');
  const token=parseAcceptInvitation(body);
  const hash=createHash('sha256').update(token).digest('hex');
  return this.db.transaction(async client=>{
   const r=await client.query<{id:string;brand_id:string;email:string;role:string;created_by:string;expires_at:string;accepted_at:string|null;revoked_at:string|null}>(
    'SELECT id,brand_id,email,role,created_by,expires_at,accepted_at,revoked_at FROM product.brand_invitations WHERE token_hash=$1 FOR UPDATE',[hash]);
   const invite=r.rows[0];
   if(!invite||invite.accepted_at||invite.revoked_at||new Date(invite.expires_at).getTime()<=Date.now())
    throw new ForbiddenException('Undangan tidak tersedia atau sudah kedaluwarsa');
   if(invite.email!==actor.email.toLowerCase().trim())
    throw new ForbiddenException('Undangan ini untuk email lain');
   const brand=await client.query('SELECT id FROM product.brands WHERE id=$1 AND is_active=true',[invite.brand_id]);
   if(!brand.rows[0])throw new ForbiddenException('Brand sudah tidak aktif');
   const assigned=await client.query(
    'INSERT INTO product.brand_memberships(brand_id,user_id,role,is_active,added_by) VALUES($1,$2,$3,true,$4) ON CONFLICT(brand_id,user_id) DO UPDATE SET role=excluded.role,is_active=true,updated_at=now() RETURNING brand_id,role,is_active',
    [invite.brand_id,actor.id,invite.role,invite.created_by]);
   await client.query('INSERT INTO product.brand_access_audit(brand_id,user_id,actor_id,role,is_active) VALUES($1,$2,$3,$4,true)',
    [invite.brand_id,actor.id,actor.id,invite.role]);
   await client.query('UPDATE product.brand_invitations SET accepted_at=now(),accepted_by=$2 WHERE id=$1',[invite.id,actor.id]);
   return {brandId:assigned.rows[0].brand_id,role:assigned.rows[0].role,accepted:true};
  });
 }
}
