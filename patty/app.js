const cfg=window.PATTY_CONFIG||{};
const sb=(cfg.supabaseUrl&&cfg.supabaseAnonKey&&cfg.supabaseUrl.startsWith('http'))?supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
let profile=null, media=[], viewerIndex=0, viewerItems=[], socialLinks=[], videoCategories=[], photoCategories=[], videoLists=[], activeVideoCategory=null, activePhotoCategory=null, activeVideoList=null, entertainmentLists=[], entertainmentThemes=[], activeEntertainmentTheme=null, activeEntertainmentList=null, fullMoviesLists=[], activeFullMoviesList=null, favorites=new Set(), historyItems=[];
let viewerScale=1, pinchStartDistance=0, pinchStartScale=1, securityTimer=null;
const PHOTO_PAGE_SIZE=100;
const CONTENT_PAGE_SIZE=100;
let photoPage=1, videoPage=1, videoListPage=1, entertainmentPage=1, fullMoviesPage=1;
const $=id=>document.getElementById(id); const msg=(el,t)=>el.textContent=t||'';
function requireClient(){if(!sb){msg($('authMsg'),'Falta configurar Supabase en config.js.');return false}return true}
const AGE_KEY='patty_age_verified';
function ageVerified(){return localStorage.getItem(AGE_KEY)==='true'}
function showAuth(){if(!ageVerified())return;$('ageGate')?.classList.add('hidden');$('authScreen')?.classList.remove('hidden')}
function acceptAge(){localStorage.setItem(AGE_KEY,'true');$('ageMsg').textContent='';showAuth()}
function declineAge(){localStorage.removeItem(AGE_KEY);$('ageMsg').textContent='Debes tener al menos 18 años para acceder a este sitio.'}
$('ageAccept')?.addEventListener('click',acceptAge);$('ageDecline')?.addEventListener('click',declineAge);
if(ageVerified())showAuth()
async function loadProfile(user){const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;if(data.access_enabled===false){profile=data;throw new Error('ACCESS_BLOCKED');}profile=data;}
function setRoleUI(){const admin=profile?.role==='admin';document.querySelectorAll('.admin-only').forEach(e=>e.classList.toggle('hidden',!admin));$('profileName').textContent=profile?.full_name||'Usuario';$('profileRole').textContent=admin?'Administrador':'Usuario';$('avatar').textContent=(profile?.full_name||'U')[0].toUpperCase()}
async function boot(){if(!requireClient())return; const {data:{session}}=await sb.auth.getSession(); if(session){try{await loadProfile(session.user);openApp()}catch(e){console.error(e);msg($('authMsg'),e.message==='ACCESS_BLOCKED'?'Tu acceso está bloqueado comunicate a nefertisexvip@gmail.com.':'No se pudo cargar el perfil.');await sb.auth.signOut();}} sb.auth.onAuthStateChange(async(_e,s)=>{if(s){try{await loadProfile(s.user);openApp()}catch(err){console.error(err);msg($('authMsg'),err.message==='ACCESS_BLOCKED'?'Tu acceso está bloqueado comunicate a nefertisexvip@gmail.com.':(err.message||'No se pudo cargar el perfil.'));await sb.auth.signOut()}}else closeApp()})}
function openApp(){if(!ageVerified()){closeApp();return}$('ageGate')?.classList.add('hidden');$('authScreen').classList.add('hidden');$('app').classList.remove('hidden');setRoleUI();loadMedia();startSecurityCheck()}
function closeApp(){$('app').classList.add('hidden');if(ageVerified())$('authScreen').classList.remove('hidden');else{$('authScreen').classList.add('hidden');$('ageGate')?.classList.remove('hidden')}}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('loginForm').classList.toggle('hidden',b.dataset.tab!=='login');$('registerForm').classList.toggle('hidden',b.dataset.tab!=='register');msg($('authMsg'),'')});
$('loginForm').onsubmit=async e=>{e.preventDefault();if(!requireClient())return;msg($('authMsg'),'Entrando…');const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)msg($('authMsg'),error.message);};
$('registerForm').onsubmit=async e=>{e.preventDefault();if(!requireClient())return;msg($('authMsg'),'Creando cuenta…');const {data,error}=await sb.auth.signUp({email:$('regEmail').value,password:$('regPassword').value,options:{data:{full_name:$('regName').value}}});if(error)msg($('authMsg'),error.message);else msg($('authMsg'),'Cuenta creada. Revisa tu correo si la confirmación está activada.')};
$('logoutBtn').onclick=()=>sb?.auth.signOut();
$('uploadBtn').onclick=()=>{$('uploadModal').classList.remove('hidden');msg($('uploadMsg'),'')};$('closeModal').onclick=()=>{$('uploadModal').classList.add('hidden')};
async function loadMedia(){const {data,error}=await sb.from('media').select('*').order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true});if(error){console.error(error);return}media=data||[];await loadUserData();await loadVideoCategories();await loadVideoLists();await loadEntertainmentLists();await loadFullMoviesLists();renderGallery();renderVideos();renderFavorites();renderHistory();renderVideoLists();renderEntertainmentLists();renderFullMoviesLists();await loadSocialLinks()}
async function loadUserData(){
  if(!profile?.id)return;
  const [favRes,histRes]=await Promise.all([
    sb.from('user_favorites').select('media_id').eq('user_id',profile.id),
    sb.from('user_history').select('media_id,viewed_at').eq('user_id',profile.id).order('viewed_at',{ascending:false}).limit(50)
  ]);
  favorites=new Set((favRes.data||[]).map(x=>x.media_id));
  historyItems=histRes.data||[];
}
async function toggleFavorite(mediaId){
  if(!profile?.id)return;
  if(favorites.has(mediaId)){
    const {error}=await sb.from('user_favorites').delete().eq('user_id',profile.id).eq('media_id',mediaId);
    if(error){alert(error.message);return}
    favorites.delete(mediaId);
  }else{
    const {error}=await sb.from('user_favorites').insert({user_id:profile.id,media_id:mediaId});
    if(error){alert(error.message);return}
    favorites.add(mediaId);
  }
  renderGallery();renderVideos();renderFavorites();
}
window.toggleFavorite=toggleFavorite;
async function recordHistory(mediaId){
  if(!profile?.id||!mediaId)return;
  const {error}=await sb.from('user_history').upsert({user_id:profile.id,media_id:mediaId,viewed_at:new Date().toISOString()},{onConflict:'user_id,media_id'});
  if(!error){historyItems=[{media_id:mediaId,viewed_at:new Date().toISOString()},...historyItems.filter(x=>x.media_id!==mediaId)].slice(0,50);renderHistory();}
}
function favoriteButton(m){return `<button class="favorite-btn ${favorites.has(m.id)?'active':''}" onclick="event.stopPropagation();toggleFavorite('${m.id}')">${favorites.has(m.id)?'♥ Favorito':'♡ Favorito'}</button>`}
function renderFavorites(){const box=$('favoritesGallery');if(!box)return;const items=media.filter(m=>favorites.has(m.id));box.innerHTML=items.length?items.map((m,i)=>mediaCard(m,media.indexOf(m),-1,0)).join(''):'<div class="empty">Aún no tienes contenido en favoritos.</div>'}
function renderHistory(){const box=$('historyGallery');if(!box)return;const ids=historyItems.map(x=>x.media_id);const items=ids.map(id=>media.find(m=>m.id===id)).filter(Boolean);box.innerHTML=items.length?items.map(m=>mediaCard(m,media.indexOf(m),-1,0)).join(''):'<div class="empty">Todavía no has visto contenido.</div>'}
function publicUrl(path){return sb.storage.from('media').getPublicUrl(path).data.publicUrl}
function mediaUrl(m){return String(m.mime_type||'').startsWith('video/external')||/^https?:\/\//i.test(m.storage_path)?m.storage_path:publicUrl(m.storage_path)}
function isVideo(m){return String(m.mime_type||'').startsWith('video/')}
function imageMedia(){return media.filter(m=>!isVideo(m))}
function videoMedia(){return media.filter(m=>isVideo(m))}
function filteredVideoMedia(){const vids=videoMedia();return activeVideoCategory?vids.filter(m=>m.category_id===activeVideoCategory):vids}
function filteredPhotoMedia(){const imgs=imageMedia();return activePhotoCategory?imgs.filter(m=>m.photo_category_id===activePhotoCategory):imgs}

async function loadVideoCategories(){
  if(!sb)return;
  const [vr,pr]=await Promise.all([
    sb.from('video_categories').select('*').order('sort_order',{ascending:true}).order('name',{ascending:true}),
    sb.from('photo_categories').select('*').order('sort_order',{ascending:true}).order('name',{ascending:true})
  ]);
  if(vr.error){console.error(vr.error);videoCategories=[]}else videoCategories=vr.data||[];
  if(pr.error){console.error(pr.error);photoCategories=[]}else photoCategories=pr.data||[];
  renderVideoCategoryTabs(); renderPhotoCategoryTabs(); renderVideoCategoryAdmin(); renderPhotoCategoryAdmin();
}
function renderVideoCategoryTabs(){const box=$('videoCategories');if(!box)return;box.innerHTML=videoCategories.map(c=>`<button class="category-tab ${activeVideoCategory===c.id?'active':''}" onclick="selectVideoCategory('${c.id}')">${esc(c.name)}</button>`).join('');}
function renderPhotoCategoryTabs(){const box=$('photoCategories');if(!box)return;box.innerHTML=photoCategories.map(c=>`<button class="category-tab ${activePhotoCategory===c.id?'active':''}" onclick="selectPhotoCategory('${c.id}')">${esc(c.name)}</button>`).join('');}
function renderVideoCategoryAdmin(){const box=$('videoCategoryAdminList');if(!box)return;box.innerHTML=videoCategories.map((c,i)=>`<div class="category-admin-row"><input id="vcat_${c.id}" value="${escAttr(c.name)}"><button class="small-btn" onclick="moveVideoCategory('${c.id}',-1)" ${i===0?'disabled':''}>↑</button><button class="small-btn" onclick="moveVideoCategory('${c.id}',1)" ${i===videoCategories.length-1?'disabled':''}>↓</button><button class="small-btn" onclick="saveVideoCategory('${c.id}')">Guardar</button><button class="small-btn delete" onclick="deleteVideoCategory('${c.id}')">Eliminar</button></div>`).join('');}
function renderPhotoCategoryAdmin(){const box=$('photoCategoryAdminList');if(!box)return;box.innerHTML=photoCategories.map((c,i)=>`<div class="category-admin-row"><input id="pcat_${c.id}" value="${escAttr(c.name)}"><button class="small-btn" onclick="movePhotoCategory('${c.id}',-1)" ${i===0?'disabled':''}>↑</button><button class="small-btn" onclick="movePhotoCategory('${c.id}',1)" ${i===photoCategories.length-1?'disabled':''}>↓</button><button class="small-btn" onclick="savePhotoCategory('${c.id}')">Guardar</button><button class="small-btn delete" onclick="deletePhotoCategory('${c.id}')">Eliminar</button></div>`).join('');}
function selectVideoCategory(id){activeVideoCategory=id;videoPage=1;renderVideos()} window.selectVideoCategory=selectVideoCategory;
function selectPhotoCategory(id){activePhotoCategory=id;photoPage=1;renderGallery()} window.selectPhotoCategory=selectPhotoCategory;
function changePhotoPage(delta){const imgs=filteredPhotoMedia();const total=Math.max(1,Math.ceil(imgs.length/PHOTO_PAGE_SIZE));photoPage=Math.min(total,Math.max(1,photoPage+delta));renderGallery();window.scrollTo({top:0,behavior:'smooth'})} window.changePhotoPage=changePhotoPage;
function changeVideoPage(delta){const vids=filteredVideoMedia();const total=Math.max(1,Math.ceil(vids.length/CONTENT_PAGE_SIZE));videoPage=Math.min(total,Math.max(1,videoPage+delta));renderVideos();window.scrollTo({top:0,behavior:'smooth'})} window.changeVideoPage=changeVideoPage;

function openViewer(index){if(!media.length)return;viewerScale=1;const selected=media[index];viewerItems=selected&&isVideo(selected)?[selected]:imageMedia();const localIndex=viewerItems.findIndex(m=>m.id===selected?.id);if(!viewerItems.length)return;viewerIndex=localIndex>=0?localIndex:0;recordHistory(selected?.id);renderViewer();$('photoViewer').classList.remove('hidden');$('photoViewer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeViewer(){$('photoViewer').classList.add('hidden');$('photoViewer').setAttribute('aria-hidden','true');document.body.style.overflow='';$('viewerImage').classList.remove('zoomed');$('viewerImage').parentElement.classList.remove('is-zoomed');$('viewerImage').style.width='auto';$('viewerImage').style.transform='scale(1)';viewerScale=1;$('viewerVideo').pause();if(viewerHls){try{viewerHls.destroy()}catch(e){}viewerHls=null}clearHlsStatus();$('viewerVideo').removeAttribute('src');$('viewerVideo').load()}
function isM3U8Url(url){return /\.m3u8(?:$|[?#])/i.test(String(url||''))}
let viewerHls=null;
function hlsStatus(text,kind='info'){const el=document.getElementById('hlsStatus');if(!el)return;el.textContent=text;el.className='hls-status '+kind;el.classList.remove('hidden')}
function clearHlsStatus(){const el=document.getElementById('hlsStatus');if(el){el.textContent='';el.className='hls-status hidden'}}
function explainHLSError(data,url){const d=String(data?.details||'');const msg=String(data?.error?.message||data?.reason||'');if(location.protocol==='https:'&&/^http:\//i.test(url)){hlsStatus('No se puede reproducir este M3U8 porque el enlace usa HTTP y Patty está en HTTPS. El navegador bloquea este contenido por seguridad. Necesitas una URL HTTPS o un proxy HLS seguro.','error');return}if(/MANIFEST_LOAD_ERROR|LEVEL_LOAD_ERROR|FRAG_LOAD_ERROR|NETWORK_ERROR/i.test(d)){hlsStatus('No se pudo cargar el stream M3U8. El servidor puede estar rechazando la conexión o no permitir CORS. Revisa también que la URL siga activa.','error');return}if(/CORS|cross.origin|Access-Control-Allow-Origin/i.test(msg)){hlsStatus('El servidor M3U8 no permite CORS. Debe enviar Access-Control-Allow-Origin para que Patty pueda reproducirlo.','error');return}hlsStatus('HLS informó un error de reproducción: '+(d||msg||'error desconocido'),'error')}
function attachHLS(video,url){if(viewerHls){try{viewerHls.destroy()}catch(e){}viewerHls=null}clearHlsStatus();video.removeAttribute('src');video.load();if(isM3U8Url(url)){if(location.protocol==='https:'&&/^http:\//i.test(url)){hlsStatus('Este enlace M3U8 usa HTTP. Si Patty está en HTTPS, el navegador lo bloqueará. Usa HTTPS o un proxy HLS.','error');return false}if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;video.load();video.addEventListener('error',()=>hlsStatus('El navegador no pudo cargar el stream HLS. Revisa que la URL esté activa y que el servidor permita CORS.','error'),{once:true});return true}if(window.Hls&&Hls.isSupported()){viewerHls=new Hls({enableWorker:true});viewerHls.on(Hls.Events.MANIFEST_PARSED,()=>hlsStatus('Stream M3U8 conectado. Reproduciendo…','ok'));viewerHls.on(Hls.Events.ERROR,(event,data)=>{if(data.fatal)explainHLSError(data,url)});viewerHls.attachMedia(video);viewerHls.loadSource(url);return true}hlsStatus('Este navegador no soporta reproducción HLS/M3U8.','error');return false}video.src=url;video.load();return true}
function renderViewer(){const m=viewerItems[viewerIndex];const video=isVideo(m);$('viewerPrev').classList.toggle('hidden',video);$('viewerNext').classList.toggle('hidden',video);$('viewerImage').classList.toggle('hidden',video);$('viewerVideo').classList.toggle('hidden',!video);if(video){attachHLS($('viewerVideo'),mediaUrl(m));$('viewerVideo').poster=''}else{$('viewerImage').src=mediaUrl(m);$('viewerImage').alt=m.title||'Foto';$('viewerImage').style.width='auto';$('viewerImage').style.transform='scale(1)';$('viewerImage').classList.remove('zoomed');$('viewerImage').parentElement.classList.remove('is-zoomed')}$('viewerCaption').textContent=isVideo(m)?(m.title||'Sin título'):`${m.title||'Sin título'} · ${viewerIndex+1} de ${viewerItems.length}`}
function viewerMove(delta){if(!viewerItems.length||isVideo(viewerItems[viewerIndex]))return;viewerIndex=(viewerIndex+delta+viewerItems.length)%viewerItems.length;renderViewer()}
function mediaCard(m,i,orderIndex=-1,orderCount=0){const video=isVideo(m);const cats=video?videoCategories:photoCategories;const categoryId=video?m.category_id:m.photo_category_id;const category=cats.find(c=>c.id===categoryId);const reorder=profile?.role==='admin'?`<div class="card-actions ${video?'video-order-actions':'photo-order-actions'}">${video?`<button class="small-btn" onclick="moveVideo('${m.id}',-1)" ${orderIndex<=0?'disabled':''}>↑ Antes</button><button class="small-btn" onclick="moveVideo('${m.id}',1)" ${orderIndex>=orderCount-1?'disabled':''}>↓ Después</button>`:`<button class="small-btn" onclick="movePhoto('${m.id}',-1)" ${orderIndex<=0?'disabled':''}>↑ Antes</button><button class="small-btn" onclick="movePhoto('${m.id}',1)" ${orderIndex>=orderCount-1?'disabled':''}>↓ Después</button>`}<button class="small-btn delete" onclick="deleteMedia('${m.id}','${escAttr(m.storage_path)}')">Eliminar</button></div>`:'';return `<article class="card media-card">${video?`<div class="video-thumb"><video src="${escAttr(mediaUrl(m))}" preload="metadata" muted playsinline onclick="openViewer(${media.indexOf(m)})"></video><span class="video-badge">▶ VIDEO</span></div>`:`<img src="${escAttr(mediaUrl(m))}" alt="${esc(m.title||'Foto')}" loading="lazy" onclick="openViewer(${media.indexOf(m)})">`}<div class="card-body"><div class="card-title">${esc(m.title||'Sin título')}</div>${category?`<div class="card-category">${esc(category.name)}</div>`:''}${profile?.role==='admin'?`<div class="media-category-edit"><select onchange="setMediaCategory('${m.id}',this.value)"><option value="">Sin tema</option>${cats.map(c=>`<option value="${c.id}" ${categoryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>`:''}<div class="card-date">${new Date(m.created_at).toLocaleString('es-MX')}</div>${reorder}<div class="card-actions user-actions">${favoriteButton(m)}</div></div></article>`}
function renderGallery(){const g=$('gallery');renderPhotoCategoryTabs();const imgs=filteredPhotoMedia();if(!imgs.length){g.innerHTML='<div class="empty">Aún no hay fotografías en este tema.</div>';return}const totalPages=Math.max(1,Math.ceil(imgs.length/PHOTO_PAGE_SIZE));if(photoPage>totalPages)photoPage=totalPages;const start=(photoPage-1)*PHOTO_PAGE_SIZE;const pageItems=imgs.slice(start,start+PHOTO_PAGE_SIZE);g.innerHTML=pageItems.map((m,i)=>mediaCard(m,i+start,i+start,imgs.length)).join('')+`<div class="photo-pagination"><button class="small-btn" onclick="changePhotoPage(-1)" ${photoPage<=1?'disabled':''}>← Anterior</button><span>Página ${photoPage} de ${totalPages} · ${imgs.length} fotos · 100 por página</span><button class="small-btn" onclick="changePhotoPage(1)" ${photoPage>=totalPages?'disabled':''}>Siguiente →</button></div>`}
function renderVideos(){const g=$('videos');renderVideoCategoryTabs();const vids=filteredVideoMedia();const totalPages=Math.max(1,Math.ceil(vids.length/CONTENT_PAGE_SIZE));videoPage=Math.min(totalPages,Math.max(1,videoPage));if(!vids.length){g.innerHTML='<div class="empty">Aún no hay videos en este tema.</div>';return}const start=(videoPage-1)*CONTENT_PAGE_SIZE;const pageItems=vids.slice(start,start+CONTENT_PAGE_SIZE);g.innerHTML=pageItems.map((m,i)=>mediaCard(m,media.indexOf(m),start+i,vids.length)).join('')+`<div class="content-pagination"><button class="small-btn" onclick="changeVideoPage(-1)" ${videoPage<=1?'disabled':''}>← Anterior</button><span>Página ${videoPage} de ${totalPages} · ${vids.length} videos · 100 por página</span><button class="small-btn" onclick="changeVideoPage(1)" ${videoPage>=totalPages?'disabled':''}>Siguiente →</button></div>`}
$('addPhotoCategoryBtn')?.addEventListener('click',addPhotoCategory);$('addVideoCategoryBtn')?.addEventListener('click',addVideoCategory);$('newPhotoCategoryName')?.addEventListener('keydown',e=>{if(e.key==='Enter')addPhotoCategory()});$('newVideoCategoryName')?.addEventListener('keydown',e=>{if(e.key==='Enter')addVideoCategory()});
async function addVideoCategory(){if(profile?.role!=='admin')return;const input=$('newVideoCategoryName'),name=input.value.trim();if(!name){alert('Escribe el nombre del tema.');return}const next=(videoCategories.reduce((m,c)=>Math.max(m,c.sort_order||0),0)||0)+1;const {error}=await sb.from('video_categories').insert({name,sort_order:next});if(error){alert(error.message);return}input.value='';await loadVideoCategories();renderVideos()}
async function addPhotoCategory(){if(profile?.role!=='admin')return;const input=$('newPhotoCategoryName'),name=input.value.trim();if(!name){alert('Escribe el nombre del tema.');return}const next=(photoCategories.reduce((m,c)=>Math.max(m,c.sort_order||0),0)||0)+1;const {error}=await sb.from('photo_categories').insert({name,sort_order:next});if(error){alert(error.message);return}input.value='';await loadVideoCategories();renderGallery()}
async function saveVideoCategory(id){if(profile?.role!=='admin')return;const input=$(`vcat_${id}`),name=input.value.trim();if(!name){alert('El nombre no puede quedar vacío.');return}const {error}=await sb.from('video_categories').update({name}).eq('id',id);if(error){alert(error.message);return}await loadVideoCategories();renderVideos()}
async function savePhotoCategory(id){if(profile?.role!=='admin')return;const input=$(`pcat_${id}`),name=input.value.trim();if(!name){alert('El nombre no puede quedar vacío.');return}const {error}=await sb.from('photo_categories').update({name}).eq('id',id);if(error){alert(error.message);return}await loadVideoCategories();renderGallery()}
async function deleteVideoCategory(id){if(profile?.role!=='admin')return;if(!confirm('¿Eliminar este tema de Videos? Los videos conservarán su contenido y quedarán sin tema.'))return;const {error}=await sb.from('video_categories').delete().eq('id',id);if(error){alert(error.message);return}if(activeVideoCategory===id)activeVideoCategory=null;await loadMedia()}
async function deletePhotoCategory(id){if(profile?.role!=='admin')return;if(!confirm('¿Eliminar este tema de Fotos? Las fotos conservarán su contenido y quedarán sin tema.'))return;const {error}=await sb.from('photo_categories').delete().eq('id',id);if(error){alert(error.message);return}if(activePhotoCategory===id)activePhotoCategory=null;await loadMedia()}
async function moveVideoCategory(id,delta){if(profile?.role!=='admin')return;const index=videoCategories.findIndex(c=>c.id===id),targetIndex=index+delta;if(index<0||targetIndex<0||targetIndex>=videoCategories.length)return;const current=videoCategories[index],target=videoCategories[targetIndex],a=current.sort_order??index+1,b=target.sort_order??targetIndex+1;let r=await sb.from('video_categories').update({sort_order:b}).eq('id',current.id);if(r.error){alert(r.error.message);return}r=await sb.from('video_categories').update({sort_order:a}).eq('id',target.id);if(r.error){alert(r.error.message);return}await loadVideoCategories();renderVideos()}
async function movePhotoCategory(id,delta){if(profile?.role!=='admin')return;const index=photoCategories.findIndex(c=>c.id===id),targetIndex=index+delta;if(index<0||targetIndex<0||targetIndex>=photoCategories.length)return;const current=photoCategories[index],target=photoCategories[targetIndex],a=current.sort_order??index+1,b=target.sort_order??targetIndex+1;let r=await sb.from('photo_categories').update({sort_order:b}).eq('id',current.id);if(r.error){alert(r.error.message);return}r=await sb.from('photo_categories').update({sort_order:a}).eq('id',target.id);if(r.error){alert(r.error.message);return}await loadVideoCategories();renderGallery()}
window.addVideoCategory=addVideoCategory;window.addPhotoCategory=addPhotoCategory;window.saveVideoCategory=saveVideoCategory;window.savePhotoCategory=savePhotoCategory;window.deleteVideoCategory=deleteVideoCategory;window.deletePhotoCategory=deletePhotoCategory;window.moveVideoCategory=moveVideoCategory;window.movePhotoCategory=movePhotoCategory;
async function setMediaCategory(id,categoryId){if(profile?.role!=='admin')return;const item=media.find(m=>m.id===id);if(!item)return;const field=isVideo(item)?'category_id':'photo_category_id';const {error}=await sb.from('media').update({[field]:categoryId||null}).eq('id',id);if(error){alert(error.message);return}await loadMedia()}
window.setMediaCategory=setMediaCategory;
async function deleteMedia(id,path){if(profile?.role!=='admin')return;if(!confirm('¿Eliminar este contenido?'))return;const {error}=await sb.from('media').delete().eq('id',id);if(error){alert(error.message);return}if(!/^https?:\/\//i.test(path))await sb.storage.from('media').remove([path]);await loadMedia()};window.deleteMedia=deleteMedia;
async function moveVideo(id,delta){
  if(profile?.role!=='admin')return;
  const vids=videoMedia();
  const index=vids.findIndex(v=>v.id===id);
  const targetIndex=index+delta;
  if(index<0||targetIndex<0||targetIndex>=vids.length)return;
  const current=vids[index], target=vids[targetIndex];
  const a=current.sort_order ?? index+1, b=target.sort_order ?? targetIndex+1;
  const first=await sb.from('media').update({sort_order:b}).eq('id',current.id);
  if(first.error){alert(first.error.message);return}
  const second=await sb.from('media').update({sort_order:a}).eq('id',target.id);
  if(second.error){alert(second.error.message);return}
  await loadMedia();
}
window.moveVideo=moveVideo;
async function movePhoto(id,delta){
  if(profile?.role!=='admin')return;
  const photos=imageMedia();
  const index=photos.findIndex(p=>p.id===id);
  const targetIndex=index+delta;
  if(index<0||targetIndex<0||targetIndex>=photos.length)return;
  const current=photos[index],target=photos[targetIndex];
  const a=current.sort_order ?? index+1,b=target.sort_order ?? targetIndex+1;
  const first=await sb.from('media').update({sort_order:b}).eq('id',current.id);
  if(first.error){alert(first.error.message);return}
  const second=await sb.from('media').update({sort_order:a}).eq('id',target.id);
  if(second.error){alert(second.error.message);return}
  await loadMedia();
}
window.movePhoto=movePhoto;

$('doUpload').onclick=async()=>{if(profile?.role!=='admin')return;const files=$('files').files;if(!files.length){msg($('uploadMsg'),'Selecciona al menos una foto o video.');return}msg($('uploadMsg'),'Subiendo…');for(const file of files){const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${profile.id}/${crypto.randomUUID()}.${ext}`;const video=isVideo({mime_type:file.type});let r=await sb.storage.from('media').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(r.error){msg($('uploadMsg'),`No se pudo subir el archivo: ${r.error.message}`);return}const row={title:$('photoTitle').value.trim()||file.name,storage_path:path,mime_type:file.type,uploaded_by:profile.id};if(video)row.category_id=$('videoCategorySelect').value||null;else row.photo_category_id=$('photoCategorySelect').value||null;r=await sb.from('media').insert(row);if(r.error){await sb.storage.from('media').remove([path]);msg($('uploadMsg'),`El archivo se subió al almacenamiento, pero no pudo registrarse: ${r.error.message}`);return}}$('files').value='';$('photoTitle').value='';$('videoUrl').value='';$('videoCategorySelect').value='';$('photoCategorySelect').value='';$('uploadModal').classList.add('hidden');await loadMedia()};
$('addVideoUrl').onclick=async()=>{if(profile?.role!=='admin')return;const url=$('videoUrl').value.trim();if(!url){msg($('uploadMsg'),'Escribe un enlace de video.');return}if(!/^https?:\/\//i.test(url)){msg($('uploadMsg'),'El enlace debe comenzar con http:// o https://');return}if(!/\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/i.test(url)){msg($('uploadMsg'),'Usa un enlace directo a un video (MP4, WebM, OGG, MOV o M3U8). Enlaces de páginas como YouTube no funcionan como video directo.');return}msg($('uploadMsg'),'Guardando enlace…');const {error}=await sb.from('media').insert({title:$('photoTitle').value.trim()||'Video por enlace',storage_path:url,mime_type:'video/external',uploaded_by:profile.id,category_id:$('videoCategorySelect').value||null});if(error){msg($('uploadMsg'),error.message);return}$('videoUrl').value='';$('photoTitle').value='';$('videoCategorySelect').value='';$('photoCategorySelect').value='';$('uploadModal').classList.add('hidden');await loadMedia()};
$('addPhotoUrl').onclick=async()=>{if(profile?.role!=='admin')return;const url=$('photoUrl').value.trim();if(!url){msg($('uploadMsg'),'Escribe un enlace de foto.');return}if(!/^https?:\/\//i.test(url)){msg($('uploadMsg'),'El enlace debe comenzar con http:// o https://');return}msg($('uploadMsg'),'Guardando foto por enlace…');const {error}=await sb.from('media').insert({title:$('photoTitle').value.trim()||'Foto por enlace',storage_path:url,mime_type:'image/external',uploaded_by:profile.id,photo_category_id:$('photoCategorySelect').value||null});if(error){msg($('uploadMsg'),error.message);return}$('photoUrl').value='';$('photoTitle').value='';$('videoCategorySelect').value='';$('photoCategorySelect').value='';$('uploadModal').classList.add('hidden');await loadMedia()};
document.querySelectorAll('.nav[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));function showView(v){document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));const view=$(`${v}View`);if(view)view.classList.remove('hidden');document.querySelectorAll('.nav[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));const titles={gallery:['Fotos','Fotos publicadas por Patty'],videos:['Videos','Videos publicados por Patty'],videoLists:['Videos Listas','Videos Listas publicados por Patty'],entertainment:['Entretenimiento','Entretenimiento publicado por Patty'],fullMovies:['Full Movies','Full Movies publicados por Patty'],social:['Redes Sociales','Redes sociales de Patty'],favorites:['Favoritos','Tu contenido favorito'],history:['Historial','Contenido visto recientemente'],dashboard:['Panel de administración','Resumen de Patty'],users:['Usuarios','Cuentas registradas']};$('viewTitle').textContent=titles[v]?.[0]||'Patty';$('viewSub').textContent=titles[v]?.[1]||'';if(v==='users')loadUsers();if(v==='dashboard')loadDashboard();if(v==='social')loadSocialLinks();if(v==='videoLists'){loadVideoLists();renderVideoLists()}if(v==='entertainment'){loadEntertainmentLists();renderEntertainmentLists()}if(v==='fullMovies'){loadFullMoviesLists();renderFullMoviesLists()}if(v==='gallery'){loadVideoCategories();renderGallery()}if(v==='videos'){loadVideoCategories();renderVideos()}if(v==='favorites')renderFavorites();if(v==='history')renderHistory()}

async function loadVideoLists(){
  if(!sb)return;
  const {data,error}=await sb.from('video_lists').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true});
  if(error){console.error(error);videoLists=[];$('videoListTabs').innerHTML='';$('videoListPlayer').classList.add('hidden');$('videoListEmpty').classList.remove('hidden');if(profile?.role==='admin')renderVideoListAdmin();return}
  videoLists=data||[];
  if(activeVideoList && !videoLists.some(x=>x.id===activeVideoList && x.active))activeVideoList=null;
  renderVideoLists();
  if(profile?.role==='admin')renderVideoListAdmin();
}
function getVideoListCover(list){
  const html=list?.html_content||'';
  const poster=html.match(/\bposter\s*[:=]\s*["\']([^"\']+)["\']/i);
  if(poster?.[1])return poster[1];
  const img=html.match(/<img[^>]+src\s*=\s*["\']([^"\']+)["\']/i);
  if(img?.[1])return img[1];
  return 'LogoPatty.png';
}
function renderVideoLists(){
  const tabs=$('videoListTabs'),player=$('videoListPlayer'),empty=$('videoListEmpty');
  if(!tabs||!player||!empty)return;
  const active=videoLists.filter(x=>x.active);
  if(activeVideoList){
    const selected=videoLists.find(x=>x.id===activeVideoList && x.active);
    if(selected){
      tabs.classList.add('hidden');
      empty.classList.add('hidden');
      player.classList.remove('hidden');
      player.innerHTML=`<div class="video-list-player-head"><button class="small-btn" onclick="closeVideoList()">← Regresar a Video Listas</button><h3>${esc(selected.name)}</h3><button class="small-btn" onclick="toggleVideoListFullscreen()">⛶ Pantalla completa</button></div><iframe id="videoListFrame" class="video-list-frame" title="${escAttr(selected.name)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
      const frame=$('videoListFrame');
      if(frame)frame.srcdoc=selected.html_content||'';
      return;
    }
    activeVideoList=null;
  }
  tabs.classList.remove('hidden');
  player.innerHTML='';
  player.classList.add('hidden');
  empty.classList.toggle('hidden',active.length>0);
  const totalPages=Math.max(1,Math.ceil(active.length/CONTENT_PAGE_SIZE));videoListPage=Math.min(totalPages,Math.max(1,videoListPage));const start=(videoListPage-1)*CONTENT_PAGE_SIZE;const pageItems=active.slice(start,start+CONTENT_PAGE_SIZE);tabs.innerHTML=active.length?`<div class="video-list-grid">${pageItems.map(x=>`<div class="video-list-card" role="button" tabindex="0" onclick="openVideoList('${x.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openVideoList('${x.id}')}" ><span class="video-list-cover-wrap"><img class="video-list-cover" src="${escAttr(x.cover_url||'LogoPatty.png')}" alt="${escAttr(x.name)}" loading="lazy" onerror="this.onerror=null;this.src='LogoPatty.png'"/></span><span class="video-list-card-title">${esc(x.name)}</span></div>`).join('')} </div><div class="content-pagination"><button class="small-btn" onclick="changeVideoListPage(-1)" ${videoListPage<=1?'disabled':''}>← Anterior</button><span>Página ${videoListPage} de ${totalPages} · ${active.length} Video Listas · 100 por página</span><button class="small-btn" onclick="changeVideoListPage(1)" ${videoListPage>=totalPages?'disabled':''}>Siguiente →</button></div>`:'';
}
function openVideoList(id){
  const selected=videoLists.find(x=>x.id===id && x.active);
  if(!selected)return;
  const html=selected.html_content||'';
  if(!html.trim()){alert('Esta Video Lista todavía no tiene HTML configurado.');return}
  activeVideoList=id;
  renderVideoLists();
  $('videoListsView')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeVideoList(){
  activeVideoList=null;
  renderVideoLists();
}
async function toggleVideoListFullscreen(){
  const frame=$('videoListFrame');
  if(!frame)return;
  try{
    if(document.fullscreenElement){await document.exitFullscreen();return}
    if(frame.requestFullscreen)await frame.requestFullscreen();
    else if(frame.webkitRequestFullscreen)frame.webkitRequestFullscreen();
    else alert('Tu navegador no permite pantalla completa en este reproductor.');
  }catch(e){console.error(e);alert('No se pudo activar la pantalla completa. Intenta nuevamente.')}
}
window.openVideoList=openVideoList;window.closeVideoList=closeVideoList;window.toggleVideoListFullscreen=toggleVideoListFullscreen;

function renderVideoListAdmin(){
  const panel=$('videoListAdmin'),box=$('videoListAdminList');
  if(!panel||!box)return;
  if(profile?.role!=='admin'){panel.classList.add('hidden');return}
  panel.classList.remove('hidden');
  box.innerHTML=videoLists.map((x,i)=>`<div class="video-list-admin-row"><div class="video-list-admin-head"><input id="vlist_name_${x.id}" value="${escAttr(x.name)}"><label class="social-check"><input id="vlist_active_${x.id}" type="checkbox" ${x.active?'checked':''}> Activa</label></div><label class="video-list-cover-label">Imagen de portada (URL de Google Sites, Google Photos u otra imagen pública)<input id="vlist_cover_${x.id}" value="${escAttr(x.cover_url||'')}" placeholder="https://.../imagen.jpg"></label><textarea id="vlist_html_${x.id}" placeholder="Pega aquí el HTML completo de la VideoLista">${esc(x.html_content||'')}</textarea><div class="video-list-actions"><button class="small-btn" onclick="saveVideoList('${x.id}')">Guardar</button><button class="small-btn" onclick="moveVideoList('${x.id}',-1)" ${i===0?'disabled':''}>↑ Antes</button><button class="small-btn" onclick="moveVideoList('${x.id}',1)" ${i===videoLists.length-1?'disabled':''}>↓ Después</button><button class="small-btn delete" onclick="deleteVideoList('${x.id}')">Eliminar</button></div></div>`).join('')||'<div class="empty">Aún no hay VideoListas. Agrega la primera arriba.</div>';
}
$('addVideoListBtn').onclick=async()=>{if(profile?.role!=='admin')return;const name=$('newVideoListName').value.trim();if(!name){alert('Escribe el nombre de la VideoLista.');return}const next=(videoLists.reduce((m,x)=>Math.max(m,x.sort_order||0),0)||0)+1;const {data,error}=await sb.from('video_lists').insert({name,cover_url:'',html_content:'',active:true,sort_order:next}).select('*').single();if(error){alert(error.message);return}$('newVideoListName').value='';activeVideoList=null;await loadVideoLists();showView('videoLists')};
async function saveVideoList(id){if(profile?.role!=='admin')return;const name=$(`vlist_name_${id}`).value.trim(),cover=$(`vlist_cover_${id}`).value.trim(),html=$(`vlist_html_${id}`).value;if(!name){alert('El nombre no puede quedar vacío.');return}const active=$(`vlist_active_${id}`).checked;const {error}=await sb.from('video_lists').update({name,cover_url:cover,html_content:html,active,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}activeVideoList=null;await loadVideoLists()}
async function deleteVideoList(id){if(profile?.role!=='admin')return;if(!confirm('¿Eliminar esta VideoLista?'))return;const {error}=await sb.from('video_lists').delete().eq('id',id);if(error){alert(error.message);return}if(activeVideoList===id)activeVideoList=null;await loadVideoLists()}
async function moveVideoList(id,delta){if(profile?.role!=='admin')return;const index=videoLists.findIndex(x=>x.id===id),targetIndex=index+delta;if(index<0||targetIndex<0||targetIndex>=videoLists.length)return;const a=videoLists[index].sort_order??index+1,b=videoLists[targetIndex].sort_order??targetIndex+1;let r=await sb.from('video_lists').update({sort_order:b}).eq('id',videoLists[index].id);if(r.error){alert(r.error.message);return}r=await sb.from('video_lists').update({sort_order:a}).eq('id',videoLists[targetIndex].id);if(r.error){alert(r.error.message);return}await loadVideoLists()}
window.saveVideoList=saveVideoList;window.deleteVideoList=deleteVideoList;window.moveVideoList=moveVideoList;
const SOCIAL_META={onlyfans:{icon:'OF',className:'onlyfans'},onlyfansvip:{icon:'OF+',className:'onlyfansvip'},xvideos:{icon:'XV',className:'xvideos'},xhamster:{icon:'XH',className:'xhamster'},facebook:{icon:'f',className:'facebook'},instagram:{icon:'◎',className:'instagram'},tiktok:{icon:'♪',className:'tiktok'},youtube:{icon:'▶',className:'youtube'},whatsapp:{icon:'◉',className:'whatsapp'},reddit:{icon:'R',className:'reddit'},redgifs:{icon:'RG',className:'redgifs'},chaturbate:{icon:'CB',className:'chaturbate'},cam4:{icon:'C4',className:'cam4'},twitter:{icon:'X',className:'twitter'},email:{icon:'@',className:'email'}};
async function loadSocialLinks(){if(!sb)return;const {data,error}=await sb.from('social_links').select('*').order('sort_order',{ascending:true});if(error){console.error(error);$('socialPublic').innerHTML=`<div class="empty">${esc(error.message)}</div>`;return}socialLinks=data||[];renderSocialPublic();if(profile?.role==='admin')renderSocialAdmin()}
function validUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)}catch{return false}}
function renderSocialPublic(){const active=socialLinks.filter(x=>x.active&&((x.platform==='email'&&x.url.trim())||validUrl(x.url)));const box=$('socialPublic');if(!active.length){box.innerHTML='<div class="empty">Aún no hay redes sociales configuradas.</div>';return}box.innerHTML=active.map(x=>{const m=SOCIAL_META[x.platform]||{icon:'🔗',className:'generic'};const href=x.platform==='email'?(x.url.startsWith('mailto:')?x.url:`mailto:${x.url}`):x.url;const target=x.platform==='email'?'':' target="_blank" rel="noopener noreferrer"';return `<a class="social-card ${m.className}" href="${escAttr(href)}"${target}><span class="social-icon">${m.icon}</span><span><b>${esc(x.label)}</b><small>${x.platform==='email'?'Enviar correo':'Visitar'}</small></span></a>`}).join('')}

async function loadEntertainmentThemes(){
  const {data,error}=await sb.from('entertainment_themes').select('*').order('sort_order',{ascending:true,nullsFirst:false}).order('name',{ascending:true});
  if(error){console.error(error);entertainmentThemes=[];}
  else entertainmentThemes=data||[];
  if(activeEntertainmentTheme && !entertainmentThemes.some(x=>x.id===activeEntertainmentTheme && x.active)) activeEntertainmentTheme=null;
}
async function loadEntertainmentLists(){
  const [lr]=await Promise.all([
    sb.from('entertainment_lists').select('*').order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true}),
    loadEntertainmentThemes()
  ]);
  const {data,error}=lr;
  if(error){console.error(error);entertainmentLists=[];$('entertainmentTabs').innerHTML='';$('entertainmentPlayer').classList.add('hidden');$('entertainmentEmpty').classList.remove('hidden');if(profile?.role==='admin')renderEntertainmentAdmin();return}
  entertainmentLists=data||[];
  if(activeEntertainmentList && !entertainmentLists.some(x=>x.id===activeEntertainmentList && x.active))activeEntertainmentList=null;
  renderEntertainmentLists();
  if(profile?.role==='admin')renderEntertainmentAdmin();
}
function renderEntertainmentThemeTabs(){
  const box=$('entertainmentThemeTabs');if(!box)return;
  const activeThemes=entertainmentThemes.filter(x=>x.active);
  box.innerHTML=`<button class="category-tab ${activeEntertainmentTheme===null?'active':''}" onclick="selectEntertainmentTheme(null)">Todos</button>`+
    activeThemes.map(t=>`<button class="category-tab ${activeEntertainmentTheme===t.id?'active':''}" onclick="selectEntertainmentTheme('${t.id}')">${esc(t.name)}</button>`).join('');
}
function filteredEntertainmentLists(){
  const active=entertainmentLists.filter(x=>x.active);
  return activeEntertainmentTheme?active.filter(x=>x.theme_id===activeEntertainmentTheme):active;
}
function selectEntertainmentTheme(id){activeEntertainmentTheme=id;entertainmentPage=1;activeEntertainmentList=null;renderEntertainmentLists();renderEntertainmentAdmin();}
window.selectEntertainmentTheme=selectEntertainmentTheme;
function renderEntertainmentLists(){
  const tabs=$('entertainmentTabs'),player=$('entertainmentPlayer'),empty=$('entertainmentEmpty');
  if(!tabs||!player||!empty)return;
  renderEntertainmentThemeTabs();
  const active=filteredEntertainmentLists();
  if(activeEntertainmentList){
    const selected=entertainmentLists.find(x=>x.id===activeEntertainmentList && x.active);
    if(!selected){activeEntertainmentList=null;return renderEntertainmentLists()}
    tabs.innerHTML='';empty.classList.add('hidden');player.classList.remove('hidden');
    player.innerHTML=`<div class="video-list-player-head"><button class="small-btn" onclick="closeEntertainmentList()">← Regresar a Entretenimiento</button><h3>${esc(selected.name)}</h3><button class="small-btn" onclick="toggleEntertainmentFullscreen()">⛶ Pantalla completa</button></div><iframe id="entertainmentFrame" class="video-list-frame" title="${escAttr(selected.name)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
    const frame=$('entertainmentFrame');if(frame)frame.srcdoc=selected.html_content||'';return;
  }
  player.classList.add('hidden');empty.classList.toggle('hidden',active.length>0);
  const totalPages=Math.max(1,Math.ceil(active.length/CONTENT_PAGE_SIZE));entertainmentPage=Math.min(totalPages,Math.max(1,entertainmentPage));
  const start=(entertainmentPage-1)*CONTENT_PAGE_SIZE,pageItems=active.slice(start,start+CONTENT_PAGE_SIZE);
  tabs.innerHTML=active.length?`<div class="video-list-grid">${pageItems.map(x=>`<div class="video-list-card" role="button" tabindex="0" onclick="openEntertainmentList('${x.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openEntertainmentList('${x.id}')}" ><span class="video-list-cover-wrap"><img class="video-list-cover" src="${escAttr(x.cover_url||'LogoPatty.png')}" alt="${escAttr(x.name)}" loading="lazy" onerror="this.onerror=null;this.src='LogoPatty.png'"/></span><span class="video-list-card-title">${esc(x.name)}</span></div>`).join('')}</div><div class="content-pagination"><button class="small-btn" onclick="changeEntertainmentPage(-1)" ${entertainmentPage<=1?'disabled':''}>← Anterior</button><span>Página ${entertainmentPage} de ${totalPages} · ${active.length} secciones · 100 por página</span><button class="small-btn" onclick="changeEntertainmentPage(1)" ${entertainmentPage>=totalPages?'disabled':''}>Siguiente →</button></div>`:'';
}
function openEntertainmentList(id){const selected=entertainmentLists.find(x=>x.id===id&&x.active);if(!selected)return;if(!selected.html_content?.trim()){alert('Esta sección de Entretenimiento todavía no tiene HTML configurado.');return}activeEntertainmentList=id;renderEntertainmentLists();$('entertainmentView')?.scrollIntoView({behavior:'smooth',block:'start'})}
function closeEntertainmentList(){activeEntertainmentList=null;renderEntertainmentLists()}
async function toggleEntertainmentFullscreen(){const el=$('entertainmentPlayer');if(!el)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen()}catch(e){console.error(e);alert('El navegador no permitió activar pantalla completa. Puedes usar el botón de pantalla completa del reproductor.')}}
function renderEntertainmentThemeAdmin(){
  const box=$('entertainmentThemeAdminList');if(!box)return;
  box.innerHTML=entertainmentThemes.map((t,i)=>`<div class="category-admin-row"><input id="etheme_${t.id}" value="${escAttr(t.name)}"><label class="social-check"><input id="etheme_active_${t.id}" type="checkbox" ${t.active?'checked':''}> Activo</label><button class="small-btn" onclick="moveEntertainmentTheme('${t.id}',-1)" ${i===0?'disabled':''}>↑</button><button class="small-btn" onclick="moveEntertainmentTheme('${t.id}',1)" ${i===entertainmentThemes.length-1?'disabled':''}>↓</button><button class="small-btn" onclick="saveEntertainmentTheme('${t.id}')">Guardar</button><button class="small-btn delete" onclick="deleteEntertainmentTheme('${t.id}')">Eliminar</button></div>`).join('')||'<div class="empty">Aún no hay temas de Entretenimiento.</div>';
}
function entertainmentThemeOptions(selected){return '<option value="">Sin tema</option>'+entertainmentThemes.filter(t=>t.active).map(t=>`<option value="${t.id}" ${selected===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}
function renderEntertainmentAdmin(){
  const box=$('entertainmentAdminList');if(!box)return;if(profile?.role!=='admin'){box.innerHTML='';$('entertainmentAdmin')?.classList.add('hidden');return}$('entertainmentAdmin')?.classList.remove('hidden');
  renderEntertainmentThemeAdmin();
  box.innerHTML=entertainmentLists.map((x,i)=>`<div class="video-list-admin-row"><div class="video-list-admin-head"><input id="elist_name_${x.id}" value="${escAttr(x.name)}"><label class="social-check"><input id="elist_active_${x.id}" type="checkbox" ${x.active?'checked':''}> Activa</label></div><label class="video-list-cover-label">Tema de Entretenimiento<select id="elist_theme_${x.id}" class="entertainment-theme-select">${entertainmentThemeOptions(x.theme_id)}</select></label><label class="video-list-cover-label">Imagen de portada (URL de Google Sites, Google Photos u otra imagen pública)<input id="elist_cover_${x.id}" value="${escAttr(x.cover_url||'')}" placeholder="https://.../imagen.jpg"></label><textarea id="elist_html_${x.id}" placeholder="Pega aquí el HTML completo de Entretenimiento">${esc(x.html_content||'')}</textarea><div class="video-list-actions"><button class="small-btn" onclick="saveEntertainmentList('${x.id}')">Guardar</button><button class="small-btn" onclick="moveEntertainmentList('${x.id}',-1)" ${i===0?'disabled':''}>↑ Antes</button><button class="small-btn" onclick="moveEntertainmentList('${x.id}',1)" ${i===entertainmentLists.length-1?'disabled':''}>↓ Después</button><button class="small-btn delete" onclick="deleteEntertainmentList('${x.id}')">Eliminar</button></div></div>`).join('')||'<div class="empty">Aún no hay secciones de Entretenimiento. Agrega la primera arriba.</div>';
}
$('addEntertainmentThemeBtn').onclick=async()=>{if(profile?.role!=='admin')return;const input=$('newEntertainmentThemeName'),name=input.value.trim();if(!name){alert('Escribe el nombre del tema.');return}const next=(entertainmentThemes.reduce((m,x)=>Math.max(m,x.sort_order||0),0)||0)+1;const {error}=await sb.from('entertainment_themes').insert({name,active:true,sort_order:next});if(error){alert(error.message);return}input.value='';await loadEntertainmentLists()};
async function saveEntertainmentTheme(id){if(profile?.role!=='admin')return;const name=$(`etheme_${id}`).value.trim(),active=$(`etheme_active_${id}`).checked;if(!name){alert('El nombre no puede quedar vacío.');return}const {error}=await sb.from('entertainment_themes').update({name,active,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}await loadEntertainmentLists()}
async function deleteEntertainmentTheme(id){if(profile?.role!=='admin')return;if(!confirm('¿Eliminar este tema de Entretenimiento? Las secciones conservarán su contenido y quedarán sin tema.'))return;const {error}=await sb.from('entertainment_themes').delete().eq('id',id);if(error){alert(error.message);return}if(activeEntertainmentTheme===id)activeEntertainmentTheme=null;await loadEntertainmentLists()}
async function moveEntertainmentTheme(id,delta){if(profile?.role!=='admin')return;const index=entertainmentThemes.findIndex(t=>t.id===id),targetIndex=index+delta;if(index<0||targetIndex<0||targetIndex>=entertainmentThemes.length)return;const a=entertainmentThemes[index].sort_order??index+1,b=entertainmentThemes[targetIndex].sort_order??targetIndex+1;let r=await sb.from('entertainment_themes').update({sort_order:b}).eq('id',entertainmentThemes[index].id);if(r.error){alert(r.error.message);return}r=await sb.from('entertainment_themes').update({sort_order:a}).eq('id',entertainmentThemes[targetIndex].id);if(r.error){alert(r.error.message);return}await loadEntertainmentLists()}
$('addEntertainmentListBtn').onclick=async()=>{if(profile?.role!=='admin')return;const name=$('newEntertainmentListName').value.trim();if(!name){alert('Escribe el nombre de la sección.');return}const next=(entertainmentLists.reduce((m,x)=>Math.max(m,x.sort_order||0),0)||0)+1;const {data,error}=await sb.from('entertainment_lists').insert({name,cover_url:'',html_content:'',active:true,sort_order:next,theme_id:activeEntertainmentTheme}).select('*').single();if(error){alert(error.message);return}$('newEntertainmentListName').value='';activeEntertainmentList=null;await loadEntertainmentLists();showView('entertainment')};
async function saveEntertainmentList(id){if(profile?.role!=='admin')return;const name=$(`elist_name_${id}`).value.trim(),cover=$(`elist_cover_${id}`).value.trim(),html=$(`elist_html_${id}`).value,theme_id=$(`elist_theme_${id}`).value||null;if(!name){alert('El nombre no puede quedar vacío.');return}const active=$(`elist_active_${id}`).checked;const {error}=await sb.from('entertainment_lists').update({name,cover_url:cover,html_content:html,active,theme_id,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}activeEntertainmentList=null;await loadEntertainmentLists()}
async function deleteEntertainmentList(id){if(profile?.role!=='admin')return;if(!confirm('¿Eliminar esta sección de Entretenimiento?'))return;const {error}=await sb.from('entertainment_lists').delete().eq('id',id);if(error){alert(error.message);return}if(activeEntertainmentList===id)activeEntertainmentList=null;await loadEntertainmentLists()}
async function moveEntertainmentList(id,delta){if(profile?.role!=='admin')return;const index=entertainmentLists.findIndex(x=>x.id===id),targetIndex=index+delta;if(index<0||targetIndex<0||targetIndex>=entertainmentLists.length)return;const a=entertainmentLists[index].sort_order??index+1,b=entertainmentLists[targetIndex].sort_order??targetIndex+1;let r=await sb.from('entertainment_lists').update({sort_order:b}).eq('id',entertainmentLists[index].id);if(r.error){alert(r.error.message);return}r=await sb.from('entertainment_lists').update({sort_order:a}).eq('id',entertainmentLists[targetIndex].id);if(r.error){alert(r.error.message);return}await loadEntertainmentLists()}

async function loadFullMoviesLists(){
  const {data,error}=await sb.from('full_movies_lists').select('*').order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true});
  if(error){console.error(error);fullMoviesLists=[];$('fullMoviesTabs').innerHTML='';$('fullMoviesPlayer').classList.add('hidden');$('fullMoviesEmpty').classList.remove('hidden');if(profile?.role==='admin')renderFullMoviesAdmin();return}
  fullMoviesLists=data||[];
  if(activeFullMoviesList && !fullMoviesLists.some(x=>x.id===activeFullMoviesList && x.active))activeFullMoviesList=null;
  renderFullMoviesLists();
  if(profile?.role==='admin')renderFullMoviesAdmin();
}
function renderFullMoviesLists(){
  const tabs=$('fullMoviesTabs'),player=$('fullMoviesPlayer'),empty=$('fullMoviesEmpty');
  if(!tabs||!player||!empty)return;
  const active=fullMoviesLists.filter(x=>x.active);
  empty.classList.toggle('hidden',active.length>0);
  if(activeFullMoviesList){
    const selected=fullMoviesLists.find(x=>x.id===activeFullMoviesList&&x.active);
    if(!selected){activeFullMoviesList=null;return renderFullMoviesLists()}
    tabs.innerHTML='';empty.classList.add('hidden');player.classList.remove('hidden');
    player.innerHTML=`<div class="video-list-player-head"><button class="small-btn" onclick="closeFullMoviesList()">← Regresar a Full Movies</button><h3>${esc(selected.name)}</h3><button class="small-btn" onclick="toggleFullMoviesFullscreen()">⛶ Pantalla completa</button></div><iframe id="fullMoviesFrame" class="video-list-frame" title="${escAttr(selected.name)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
    const frame=$('fullMoviesFrame'); if(frame)frame.srcdoc=selected.html_content||''; return;
  }
  player.classList.add('hidden');
  const totalPages=Math.max(1,Math.ceil(active.length/CONTENT_PAGE_SIZE));fullMoviesPage=Math.min(totalPages,Math.max(1,fullMoviesPage));const start=(fullMoviesPage-1)*CONTENT_PAGE_SIZE;const pageItems=active.slice(start,start+CONTENT_PAGE_SIZE);tabs.innerHTML=active.length?`<div class="video-list-grid">${pageItems.map(x=>`<div class="video-list-card" role="button" tabindex="0" onclick="openFullMoviesList('${x.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFullMoviesList('${x.id}')}" ><span class="video-list-cover-wrap"><img class="video-list-cover" src="${escAttr(x.cover_url||'LogoPatty.png')}" alt="${escAttr(x.name)}" loading="lazy" onerror="this.onerror=null;this.src='LogoPatty.png'"/></span><span class="video-list-card-title">${esc(x.name)}</span></div>`).join('')} </div><div class="content-pagination"><button class="small-btn" onclick="changeFullMoviesPage(-1)" ${fullMoviesPage<=1?'disabled':''}>← Anterior</button><span>Página ${fullMoviesPage} de ${totalPages} · ${active.length} secciones · 100 por página</span><button class="small-btn" onclick="changeFullMoviesPage(1)" ${fullMoviesPage>=totalPages?'disabled':''}>Siguiente →</button></div>`:'';
}
function openFullMoviesList(id){const selected=fullMoviesLists.find(x=>x.id===id&&x.active);if(!selected)return;if(!selected.html_content?.trim()){alert('Esta sección de Full Movies todavía no tiene HTML configurado.');return}activeFullMoviesList=id;renderFullMoviesLists();$('fullMoviesView')?.scrollIntoView({behavior:'smooth',block:'start'})}
function closeFullMoviesList(){activeFullMoviesList=null;renderFullMoviesLists()}
async function toggleFullMoviesFullscreen(){const el=$('fullMoviesPlayer');if(!el)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen()}catch(e){console.error(e);alert('El navegador no permitió activar pantalla completa. Puedes usar el botón de pantalla completa del reproductor.')}}
function renderFullMoviesAdmin(){const box=$('fullMoviesAdminList');if(!box)return;if(profile?.role!=='admin'){box.innerHTML='';$('fullMoviesAdmin')?.classList.add('hidden');return}$('fullMoviesAdmin')?.classList.remove('hidden');box.innerHTML=fullMoviesLists.map((x,i)=>`<div class="video-list-admin-row"><div class="video-list-admin-head"><input id="fmlist_name_${x.id}" value="${escAttr(x.name)}"><label class="social-check"><input id="fmlist_active_${x.id}" type="checkbox" ${x.active?'checked':''}> Activa</label></div><label class="video-list-cover-label">Imagen de portada (URL de Google Sites, Google Photos u otra imagen pública)<input id="fmlist_cover_${x.id}" value="${escAttr(x.cover_url||'')}" placeholder="https://.../imagen.jpg"></label><textarea id="fmlist_html_${x.id}" placeholder="Pega aquí el HTML completo de Full Movies">${esc(x.html_content||'')}</textarea><div class="video-list-actions"><button class="small-btn" onclick="saveFullMoviesList('${x.id}')">Guardar</button><button class="small-btn" onclick="moveFullMoviesList('${x.id}',-1)" ${i===0?'disabled':''}>↑ Antes</button><button class="small-btn" onclick="moveFullMoviesList('${x.id}',1)" ${i===fullMoviesLists.length-1?'disabled':''}>↓ Después</button><button class="small-btn delete" onclick="deleteFullMoviesList('${x.id}')">Eliminar</button></div></div>`).join('')||'<div class="empty">Aún no hay secciones de Full Movies. Agrega la primera arriba.</div>'}
$('addFullMoviesListBtn').onclick=async()=>{if(profile?.role!=='admin')return;const name=$('newFullMoviesListName').value.trim();if(!name){alert('Escribe el nombre de la sección.');return}const next=(fullMoviesLists.reduce((m,x)=>Math.max(m,x.sort_order||0),0)||0)+1;const {error}=await sb.from('full_movies_lists').insert({name,cover_url:'',html_content:'',active:true,sort_order:next});if(error){alert(error.message);return}$('newFullMoviesListName').value='';activeFullMoviesList=null;await loadFullMoviesLists();showView('fullMovies')};
async function saveFullMoviesList(id){if(profile?.role!=='admin')return;const name=$(`fmlist_name_${id}`).value.trim(),cover=$(`fmlist_cover_${id}`).value.trim(),html=$(`fmlist_html_${id}`).value;if(!name){alert('El nombre no puede quedar vacío.');return}const active=$(`fmlist_active_${id}`).checked;const {error}=await sb.from('full_movies_lists').update({name,cover_url:cover,html_content:html,active,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}activeFullMoviesList=null;await loadFullMoviesLists()}
async function deleteFullMoviesList(id){if(profile?.role!=='admin')return;if(!confirm('¿Eliminar esta sección de Full Movies?'))return;const {error}=await sb.from('full_movies_lists').delete().eq('id',id);if(error){alert(error.message);return}if(activeFullMoviesList===id)activeFullMoviesList=null;await loadFullMoviesLists()}
async function moveFullMoviesList(id,delta){if(profile?.role!=='admin')return;const index=fullMoviesLists.findIndex(x=>x.id===id),targetIndex=index+delta;if(index<0||targetIndex<0||targetIndex>=fullMoviesLists.length)return;const a=fullMoviesLists[index].sort_order??index+1,b=fullMoviesLists[targetIndex].sort_order??targetIndex+1;let r=await sb.from('full_movies_lists').update({sort_order:b}).eq('id',fullMoviesLists[index].id);if(r.error){alert(r.error.message);return}r=await sb.from('full_movies_lists').update({sort_order:a}).eq('id',fullMoviesLists[targetIndex].id);if(r.error){alert(r.error.message);return}await loadFullMoviesLists()}
function changeVideoListPage(delta){const active=videoLists.filter(x=>x.active);const totalPages=Math.max(1,Math.ceil(active.length/CONTENT_PAGE_SIZE));videoListPage=Math.min(totalPages,Math.max(1,videoListPage+delta));renderVideoLists();window.scrollTo({top:0,behavior:'smooth'})}
window.changeVideoListPage=changeVideoListPage
function changeEntertainmentPage(delta){const active=entertainmentLists.filter(x=>x.active);const totalPages=Math.max(1,Math.ceil(active.length/CONTENT_PAGE_SIZE));entertainmentPage=Math.min(totalPages,Math.max(1,entertainmentPage+delta));renderEntertainmentLists();window.scrollTo({top:0,behavior:'smooth'})}
window.changeEntertainmentPage=changeEntertainmentPage
function changeFullMoviesPage(delta){const active=fullMoviesLists.filter(x=>x.active);const totalPages=Math.max(1,Math.ceil(active.length/CONTENT_PAGE_SIZE));fullMoviesPage=Math.min(totalPages,Math.max(1,fullMoviesPage+delta));renderFullMoviesLists();window.scrollTo({top:0,behavior:'smooth'})}
window.changeFullMoviesPage=changeFullMoviesPage
function renderSocialAdmin(){const box=$('socialAdminList');$('socialAdmin').classList.remove('hidden');box.innerHTML=socialLinks.map(x=>`<div class="social-admin-row"><div class="social-admin-label"><b>${esc(x.label)}</b><small>${esc(x.platform)}</small></div><input id="socialUrl_${x.id}" type="${x.platform==='email'?'email':'url'}" value="${escAttr(x.url||'')}" placeholder="${x.platform==='email'?'correo@ejemplo.com':'https://...'}"><label class="social-check"><input id="socialActive_${x.id}" type="checkbox" ${x.active?'checked':''}> Activa</label><button class="small-btn" onclick="saveSocial('${x.id}')">Guardar</button></div>`).join('')}
async function saveSocial(id){if(profile?.role!=='admin')return;const row=socialLinks.find(x=>x.id===id);if(!row)return;const url=$(`socialUrl_${id}`).value.trim();const active=$(`socialActive_${id}`).checked;if(url&&(row.platform!=='email'&&!validUrl(url))){alert('La URL debe comenzar con http:// o https://');return}if(row.platform==='email'&&url&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.replace(/^mailto:/i,''))){alert('Escribe un correo electrónico válido.');return}const {error}=await sb.from('social_links').update({url,active,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}await loadSocialLinks()}window.saveSocial=saveSocial;

async function loadUsers(){if(profile?.role!=='admin')return;const {data,error}=await sb.from('profiles').select('id,full_name,email,role,access_enabled,created_at').order('created_at',{ascending:false});$('usersList').innerHTML=error?`<div class="empty">${esc(error.message)}</div>`:(data||[]).map(u=>`<div class="user-row"><div><b>${esc(u.full_name||'Sin nombre')}</b><div>${esc(u.email||'')}</div></div><div class="user-role-control"><select onchange="changeUserRole('${u.id}',this.value)" ${u.id===profile?.id?'disabled':''}><option value="user" ${u.role==='user'?'selected':''}>Usuario</option><option value="admin" ${u.role==='admin'?'selected':''}>Administrador</option></select><label class="social-check"><input type="checkbox" ${u.access_enabled!==false?'checked':''} ${u.id===profile?.id?'disabled':''} onchange="changeUserAccess('${u.id}',this.checked)"> Acceso permitido</label></div></div>`).join('')}
async function changeUserRole(userId,role){if(profile?.role!=='admin')return;if(userId===profile.id){alert('No puedes cambiar tu propio rol desde aquí.');await loadUsers();return}if(!['user','admin'].includes(role))return;const action=role==='admin'?'convertir esta cuenta en administrador':'quitarle el rol de administrador a esta cuenta';if(!confirm(`¿Confirmas ${action}?`)){await loadUsers();return}const {error}=await sb.from('profiles').update({role}).eq('id',userId);if(error){alert(error.message);await loadUsers();return}await loadUsers()}
async function changeUserAccess(userId,enabled){if(profile?.role!=='admin')return;if(userId===profile.id){alert('No puedes bloquear tu propia cuenta desde aquí.');await loadUsers();return}const action=enabled?'habilitar el acceso de esta cuenta':'bloquear el acceso de esta cuenta';if(!confirm(`¿Confirmas ${action}?`)){await loadUsers();return}const {error}=await sb.from('profiles').update({access_enabled:enabled}).eq('id',userId);if(error){alert(error.message);await loadUsers();return}await loadUsers()}window.changeUserRole=changeUserRole;window.changeUserAccess=changeUserAccess;function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}function escAttr(s){return esc(s)}
async function loadDashboard(){
  if(profile?.role!=='admin')return;
  const box=$('dashboardStats');if(!box)return;
  const {data:users,error}=await sb.from('profiles').select('id,full_name,email,role,access_enabled,created_at').order('created_at',{ascending:false});
  if(error){box.innerHTML=`<div class="empty">${esc(error.message)}</div>`;return}
  const photos=imageMedia().length,videos=videoMedia().length,blocked=(users||[]).filter(u=>u.access_enabled===false).length,admins=(users||[]).filter(u=>u.role==='admin').length;
  box.innerHTML=[['Usuarios registrados',(users||[]).length],['Administradores',admins],['Usuarios bloqueados',blocked],['Fotografías',photos],['Videos',videos],['Video Listas',videoLists.filter(x=>x.active).length],['Entretenimiento',entertainmentLists.filter(x=>x.active).length],['Full Movies',fullMoviesLists.filter(x=>x.active).length]].map(x=>`<div class="stat-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  const recent=(users||[]).slice(0,8);$('dashboardRecent').innerHTML=`<h3>Usuarios recientes</h3>`+(recent.length ? recent.map(u=>`<div class="user-row"><div><b>${esc(u.full_name||'Sin nombre')}</b><div>${esc(u.email||'')}</div></div><span class="muted">${u.access_enabled===false?'Bloqueado':u.role==='admin'?'Administrador':'Usuario'}</span></div>`).join('') : '<div class="empty">No hay usuarios.</div>');
}
function enforceAccess(){
  if(!profile?.id||profile?.role==='admin')return;
  sb.from('profiles').select('access_enabled').eq('id',profile.id).single().then(({data,error})=>{if(!error&&data?.access_enabled===false){alert('Tu acceso está bloqueado comunicate a nefertisexvip@gmail.com.');sb.auth.signOut()}});
}
function startSecurityCheck(){clearInterval(securityTimer);securityTimer=setInterval(enforceAccess,60000);}

function setViewerScale(scale){viewerScale=Math.min(4,Math.max(1,scale));const img=$('viewerImage');if(!img)return;if(viewerScale===1){img.style.width='auto';img.style.transform='scale(1)';img.classList.remove('zoomed');img.parentElement.classList.remove('is-zoomed')}else{img.classList.add('zoomed');img.parentElement.classList.add('is-zoomed');img.style.width=(Math.round(viewerScale*100))+'%';img.style.transform='none'}}
boot();

$('viewerClose').onclick=closeViewer;
$('viewerPrev').onclick=()=>viewerMove(-1);
$('viewerNext').onclick=()=>viewerMove(1);
$('viewerImage').onclick=()=>setViewerScale(viewerScale===1?2:1);$('viewerZoomIn').onclick=()=>setViewerScale(viewerScale+0.5);$('viewerZoomOut').onclick=()=>setViewerScale(viewerScale-0.5);$('viewerZoomFit').onclick=()=>setViewerScale(1);$('viewerImage').addEventListener('wheel',e=>{if($('photoViewer').classList.contains('hidden'))return;e.preventDefault();setViewerScale(viewerScale+(e.deltaY<0?0.25:-0.25))},{passive:false});$('viewerImage').addEventListener('touchstart',e=>{if(e.touches.length===2){pinchStartDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);pinchStartScale=viewerScale}},{passive:true});$('viewerImage').addEventListener('touchmove',e=>{if(e.touches.length===2&&pinchStartDistance){e.preventDefault();const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);setViewerScale(pinchStartScale*(d/pinchStartDistance))}},{passive:false});$('viewerImage').addEventListener('touchend',()=>{pinchStartDistance=0},{passive:true});
$('photoViewer').onclick=e=>{if(e.target===$('photoViewer')||e.target===$('viewerImage').parentElement)closeViewer()};
document.addEventListener('keydown',e=>{
  if($('photoViewer').classList.contains('hidden'))return;
  if(e.key==='Escape')closeViewer();
  else if(e.key==='ArrowLeft')viewerMove(-1);
  else if(e.key==='ArrowRight')viewerMove(1);
});
window.openViewer=openViewer;
