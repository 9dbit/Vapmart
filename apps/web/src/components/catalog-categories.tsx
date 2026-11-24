'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';
import {ImagesField} from './catalog-editor-fields';

type Category={
 id:string;name:string;slug:string;parent_id:string|null;
 image_url:string|null;description:string;is_active:boolean;
 edit_version:number;product_count:number;
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
  if(!window.confirm('Hapus kategori "'+c.name+'" secara permanen? Tindakan ini tidak dapat dibatalkan dan hanya berlaku untuk kategori yang tidak digunakan.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('categories/'+c.id,{expectedVersion:c.edit_version,confirm:true},'DELETE');
   if(form.id===c.id)setForm(blank);
   setRevision(x=>x+1);setNotice('Kategori kosong berhasil dihapus.');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function canDelete(c:Category){return c.product_count===0&&!items.some(child=>child.parent_id===c.id)}
 function edit(c:Category){
  setForm({id:c.id,name:c.name,slug:c.slug,parentId:c.parent_id||'',image_url:c.image_url||'',description:c.description||'',active:c.is_active,expectedVersion:c.edit_version});
  window.scrollTo({top:0,behavior:'smooth'});
 }
 return <>
  <CatalogNotice error={error} message={notice}/>
  <form className="vc-panel vc-category-editor" onSubmit={save}>
   <div className="vc-toolbar"><div><h2>{form.id?'Edit kategori':'Tambah kategori'}</h2><p className="vc-muted">Kelola struktur kategori dan gambar tanpa mengubah data produk.</p></div></div>
   <div className="vc-grid">
    <label>Nama kategori<input required maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Slug kategori<input required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label>
    <label>Kategori induk<select value={form.parentId} onChange={e=>setForm({...form,parentId:e.target.value})}>
     <option value="">Tanpa induk</option>
     {items.filter(c=>c.id!==form.id&&c.is_active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <label className="vc-check"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Kategori aktif</label>
    <label className="vc-wide">Deskripsi kategori<textarea maxLength={1500} rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <div className="vc-wide"><ImagesField value={form.image_url?[form.image_url]:[]} onChange={v=>setForm({...form,image_url:v[0]||''})}/></div>
   </div>
   <div className="vc-actions"><button type="submit" className="vc-primary" disabled={busy}>{busy?'Menyimpan…':'Simpan kategori'}</button>
    {form.id&&<button type="button" onClick={()=>setForm(blank)}>Batal edit</button>}
   </div>
  </form>
  <section className="vc-panel vc-category-table">
   <div className="vc-toolbar"><div><h2>Daftar kategori</h2>
    <p className="vc-muted">Kategori yang masih memiliki produk atau subkategori tidak dapat dihapus. Pindahkan relasinya terlebih dahulu.</p></div>
    <span className="vc-category-count">{items.length} kategori</span>
   </div>
   {loading?<p role="status">Memuat kategori...</p>:items.length===0?<p className="vc-empty">Belum ada kategori. Tambahkan kategori pertama di atas.</p>:
    <div className="vc-table-wrap"><table className="vc-table">
     <thead><tr><th>Gambar</th><th>Nama / slug</th><th>Induk</th><th>Produk</th><th>Status</th><th>Aksi</th></tr></thead>
     <tbody>{items.map(c=><tr key={c.id}>
      <td>{c.image_url&&<img src={c.image_url} width={54} height={54} alt={c.name} style={{objectFit:'contain'}}/>}</td>
      <td><strong>{c.name}</strong><br/><small>{c.slug}</small></td>
      <td>{items.find(x=>x.id===c.parent_id)?.name||'−'}</td>
      <td>{c.product_count}</td>
      <td><span className={'vc-status-chip'+(c.is_active?' is-active':'')}>{c.is_active?'Aktif':'Nonaktif'}</span></td>
      <td><div className="vc-actions vc-category-actions">
       <button type="button" disabled={busy} onClick={()=>edit(c)}>Edit</button>
       <button type="button" className="vc-danger" disabled={busy||!c.is_active} onClick={()=>void archive(c)}>Nonaktifkan</button>
       <button type="button" className="vc-danger" disabled={busy||!canDelete(c)} title={canDelete(c)?'Hapus kategori kosong':'Pindahkan produk dan subkategori sebelum menghapus'} onClick={()=>void remove(c)}>Hapus</button>
      </div></td>
     </tr>)}</tbody>
    </table></div>}
  </section>
 </>;
}
