'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';
import {ImagesField} from './catalog-editor-fields';

type Category={
 id:string;name:string;slug:string;parent_id:string|null;
 image_url:string|null;description:string;is_active:boolean;
 edit_version:number;product_count:number;is_default?:boolean;promotion_count?:number;
};
const blank={id:'',name:'',slug:'',parentId:'',image_url:'',description:'',active:true,expectedVersion:1};

export function CatalogCategories(){
 const {request}=useCatalogAdmin();
 const [items,setItems]=useState<Category[]>([]),[form,setForm]=useState(blank);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let live=true;setLoading(true);
  request<{items:Category[]}>('categories').then(d=>{if(live)setItems(d.items)})
   .catch(e=>{if(live)setError(e.message)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[revision]);
 async function save(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const {id,...body}=form;
   await request(id?'categories/'+id:'categories',{...body,parentId:body.parentId||null,image_url:body.image_url||null},id?'PATCH':'POST');
   setForm(blank);setRevision(x=>x+1);setNotice('Kategori tersimpan.');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function archive(c:Category){
  if(!window.confirm('Nonaktifkan kategori '+c.name+'? Produk tidak dihapus. Kategori yang masih terpakai harus dipindahkan terlebih dahulu.'))return;
  setBusy(true);setError('');setNotice('');
  try{await request('categories/'+c.id+'/archive',{expectedVersion:c.edit_version,confirm:true});
   setRevision(x=>x+1);setNotice('Kategori dinonaktifkan tanpa menghapus produk.');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function remove(c:Category){
  if(!canDelete(c))return;
  const children=items.filter(child=>child.parent_id===c.id).length;
  const parent=items.find(item=>item.id===c.parent_id)?.name;
  if(!window.confirm('Hapus kategori "'+c.name+'" secara permanen? Semua produk di kategori ini otomatis masuk ke Accessories; kategori produk lainnya tetap dipertahankan. Produk, stok, dan riwayat transaksi tidak dihapus.'+
   (children?' '+children+' subkategori akan dipindahkan '+(parent?'ke induk "'+parent+'".':'menjadi kategori tanpa induk.'):'')+' Tindakan ini tidak dapat dibatalkan.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request<{movedProducts:number;movedSubcategories:number}>('categories/'+c.id,{expectedVersion:c.edit_version,confirm:true},'DELETE');
   if(form.id===c.id)setForm(blank);
   setRevision(x=>x+1);setNotice('Kategori berhasil dihapus. '+result.movedProducts+' produk dipindahkan ke Accessories.'+
    (result.movedSubcategories?' '+result.movedSubcategories+' subkategori tetap tersimpan dan telah dipindahkan ke induk sebelumnya.':''));
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function isDefault(c:Category){return c.is_default===true||c.slug==='accessories'}
 function canDelete(c:Category){return !isDefault(c)&&!c.promotion_count}
 const editingDefault=items.some(c=>c.id===form.id&&isDefault(c));
 function edit(c:Category){
  setForm({id:c.id,name:c.name,slug:c.slug,parentId:c.parent_id||'',image_url:c.image_url||'',description:c.description||'',active:c.is_active,expectedVersion:c.edit_version});
  window.scrollTo({top:0,behavior:'smooth'});
 }
 return <>
  <CatalogNotice error={error} message={notice}/>
  <form className="vc-panel vc-category-editor" onSubmit={save}>
   <div className="vc-toolbar"><div><h2>{form.id?'Edit kategori':'Tambah kategori'}</h2><p className="vc-muted">Kelola struktur kategori dan gambar tanpa mengubah data produk.</p></div></div>
   <div className="vc-grid">
    <label>Nama kategori<input required maxLength={100} disabled={editingDefault} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Slug kategori<input required maxLength={120} disabled={editingDefault} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label>
    <label>Kategori induk<select disabled={editingDefault} value={form.parentId} onChange={e=>setForm({...form,parentId:e.target.value})}>
     <option value="">Tanpa induk</option>
     {items.filter(c=>c.id!==form.id&&c.is_active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <label className="vc-check"><input type="checkbox" disabled={editingDefault} checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Kategori aktif</label>
    {editingDefault&&<p className="vc-muted vc-wide">Accessories adalah kategori default yang selalu aktif. Gambar dan deskripsinya tetap bisa diubah.</p>}
    <label className="vc-wide">Deskripsi kategori<textarea maxLength={1500} rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <div className="vc-wide"><ImagesField value={form.image_url?[form.image_url]:[]} onChange={v=>setForm({...form,image_url:v[0]||''})}/></div>
   </div>
   <div className="vc-actions"><button type="submit" className="vc-primary" disabled={busy}>{busy?'Menyimpan…':'Simpan kategori'}</button>
    {form.id&&<button type="button" onClick={()=>setForm(blank)}>Batal edit</button>}
   </div>
  </form>
  <section className="vc-panel vc-category-table">
   <div className="vc-toolbar"><div><h2>Daftar kategori</h2>
    <p className="vc-muted">Produk dari kategori yang dihapus otomatis masuk ke Accessories. Subkategori tetap tersimpan. Accessories adalah kategori default dan tidak bisa dihapus.</p></div>
    <span className="vc-category-count">{items.length} kategori</span>
   </div>
   {loading?<p role="status">Memuat kategori...</p>:items.length===0?<p className="vc-empty">Belum ada kategori. Tambahkan kategori pertama di atas.</p>:
    <div className="vc-table-wrap"><table className="vc-table">
     <thead><tr><th>Gambar</th><th>Nama / slug</th><th>Induk</th><th>Produk</th><th>Status</th><th>Aksi</th></tr></thead>
     <tbody>{items.map(c=><tr key={c.id}>
      <td>{c.image_url&&<img src={c.image_url} width={54} height={54} alt={c.name} style={{objectFit:'contain'}}/>}</td>
      <td><strong>{c.name}</strong>{isDefault(c)&&<> <span className="vc-status-chip is-active">Default</span></>}<br/><small>{c.slug}</small>
       {Boolean(c.promotion_count)&&<p className="vc-muted">Digunakan {c.promotion_count} promosi. Hapus dari cakupan promosi sebelum menghapus kategori.</p>}
      </td>
      <td>{items.find(x=>x.id===c.parent_id)?.name||'−'}</td>
      <td>{c.product_count}</td>
      <td><span className={'vc-status-chip'+(c.is_active?' is-active':'')}>{c.is_active?'Aktif':'Nonaktif'}</span></td>
      <td><div className="vc-actions vc-category-actions">
       <button type="button" disabled={busy} onClick={()=>edit(c)}>Edit</button>
       <button type="button" className="vc-danger" disabled={busy||!c.is_active||isDefault(c)} title={isDefault(c)?'Kategori default selalu aktif':undefined} onClick={()=>void archive(c)}>Nonaktifkan</button>
       <button type="button" className="vc-danger" disabled={busy||!canDelete(c)} title={isDefault(c)?'Kategori default tidak dapat dihapus':c.promotion_count?'Hapus kategori dari cakupan promosi terlebih dahulu':'Hapus kategori dan pindahkan produk ke Accessories'} onClick={()=>void remove(c)}>Hapus</button>
      </div></td>
     </tr>)}</tbody>
    </table></div>}
  </section>
 </>;
}
