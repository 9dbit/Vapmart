import assert from 'node:assert/strict';
import test from 'node:test';
import {parseInvitation,parseAcceptInvitation} from '../src/brand-invitations';
test('brand invitations validate email+role, reject arbitrary privilege or field',()=>{
 assert.deepEqual(parseInvitation({email:'  Partner@Example.COM ',role:'viewer'}),{email:'partner@example.com',role:'viewer'});
 for(const data of [{email:'bad',role:'viewer'},{email:'hi@example.com',role:'admin'},
 {email:'a@b.com',role:'owner',isAdmin:true}])assert.throws(()=>parseInvitation(data));
});
test('invitation accept only permits opaque one-time token',()=>{
 assert.equal(parseAcceptInvitation({token:'x'.repeat(43)}),'x'.repeat(43));
 assert.throws(()=>parseAcceptInvitation({token:'a'}));
 assert.throws(()=>parseAcceptInvitation({token:'x'.repeat(43),userId:'fake'}));
});
