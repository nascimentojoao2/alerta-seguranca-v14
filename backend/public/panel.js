const API = location.origin;
const $ = (id)=>document.getElementById(id);
const state = {data:null, session:null, editingUser:null, editingSchool:null, editingCamera:null};
async function req(path, opts={}){const r=await fetch(API+path,{headers:{'Content-Type':'application/json'},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Erro');return d}
function toast(msg){alert(msg)}
function schoolName(id){return (state.data?.schools||[]).find(s=>s.id===id)?.name||'--'}
function esc(v){return String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
async function load(){state.data=await req('/api/admin/full');render()}
async function login(role){
 const name=$('loginName')?.value||'Usuário'; const email=$('loginEmail').value.trim(); const password=$('loginPassword').value.trim();
 const body={role,name,email,password,schoolId:'sch-1'};
 const auth=await req('/api/auth/login',{method:'POST',body:JSON.stringify(body)});
 state.session=auth; localStorage.setItem('as_session_'+role,JSON.stringify(auth));
 $('loginView').classList.add('hidden'); $('panelView').classList.remove('hidden'); await load();
}
function restore(role){try{state.session=JSON.parse(localStorage.getItem('as_session_'+role)||'null')}catch{} if(state.session){$('loginView').classList.add('hidden');$('panelView').classList.remove('hidden');load()} }
function logout(role){localStorage.removeItem('as_session_'+role); location.reload()}
function openCam(url,title){if(!url)return toast('Essa câmera ainda não possui URL de player.');$('camTitle').textContent=title;$('camFrame').src=url;$('camModal').classList.add('show')}
function closeCam(){$('camFrame').src='about:blank';$('camModal').classList.remove('show')}
function fillSelect(){const options=(state.data.schools||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join(''); const sel=$('schoolId'); if(sel)sel.innerHTML=options; const cam=$('cameraSchoolId'); if(cam)cam.innerHTML=options;}
function dashboardCards(){return `<div class="grid cols-4"><div class="card stat"><span class="muted">Escolas</span><strong>${state.data.schools.length}</strong></div><div class="card stat"><span class="muted">Diretoras/Escola</span><strong>${state.data.teachers.length}</strong></div><div class="card stat"><span class="muted">GCM</span><strong>${state.data.officers.length}</strong></div><div class="card stat"><span class="muted">Câmeras</span><strong>${state.data.schools.reduce((a,s)=>a+(s.cameras||[]).length,0)}</strong></div></div>`}
function renderUsers(){
 const teachers=(state.data.teachers||[]).map(u=>`<div class="item"><div class="item-head"><div><b>${esc(u.name)}</b><div class="muted">${esc(u.email)} • ${esc(schoolName(u.schoolId))}</div><div class="pill">Senha: ${esc(u.password||'123456')}</div></div><div class="actions"><button class="btn small secondary" onclick='editUser("teacher",${JSON.stringify(u)})'>Editar</button><button class="btn small danger" onclick='delUser("teacher","${u.id}")'>Excluir</button></div></div></div>`).join('')||'<p class="muted">Nenhuma diretora cadastrada.</p>';
 const officers=(state.data.officers||[]).map(u=>`<div class="item"><div class="item-head"><div><b>${esc(u.name)}</b><div class="muted">${esc(u.email)} • ${esc(u.rank||'GCM')}</div><div class="pill">Senha: ${esc(u.password||'123456')}</div></div><div class="actions"><button class="btn small secondary" onclick='editUser("gcm",${JSON.stringify(u)})'>Editar</button><button class="btn small danger" onclick='delUser("gcm","${u.id}")'>Excluir</button></div></div></div>`).join('')||'<p class="muted">Nenhum operador GCM cadastrado.</p>';
 $('usersList').innerHTML=`<h3>Diretoras e responsáveis</h3><div class="list">${teachers}</div><h3 style="margin-top:18px">Operadores GCM</h3><div class="list">${officers}</div>`;
}
function renderSchools(){
 const html=(state.data.schools||[]).map(s=>`<div class="item"><div class="item-head"><div><b>${esc(s.name)}</b><div class="muted">${esc(s.address)} • ${esc(s.domain)} • ${esc(s.phone||'sem telefone')}</div><span class="pill ${s.active!==false?'ok':''}">${s.active!==false?'Ativa':'Inativa'}</span></div><div class="actions"><button class="btn small secondary" onclick='editSchool(${JSON.stringify(s)})'>Editar</button><button class="btn small danger" onclick='delSchool("${s.id}")'>Excluir</button></div></div></div>`).join('')||'<p class="muted">Nenhuma escola.</p>';
 $('schoolsList').innerHTML=html;
}
function renderCameras(){
 const cards=(state.data.schools||[]).flatMap(s=>(s.cameras||[]).map(c=>`<div class="card camera"><div class="item-head"><div><h3>${esc(c.name)}</h3><div class="muted">${esc(s.name)} • ${esc(c.zone||'Área')}</div></div><span class="pill ${c.status==='online'?'ok':''}">${esc(c.status||'online')}</span></div>${c.streamUrl?`<iframe class="camera-frame" src="${esc(c.streamUrl)}"></iframe>`:`<div class="camera-frame"></div>`}<div class="actions" style="margin-top:12px"><button class="btn small" onclick='openCam("${esc(c.streamUrl||'')}","${esc(c.name)}")'>Abrir</button><button class="btn small secondary" onclick='editCamera("${s.id}",${JSON.stringify(c)})'>Editar</button><button class="btn small danger" onclick='delCamera("${s.id}","${c.id}")'>Excluir</button></div></div>`)).join('')||'<p class="muted">Nenhuma câmera cadastrada.</p>';
 $('camerasList').innerHTML=cards;
}
function render(){if($('stats'))$('stats').innerHTML=dashboardCards(); fillSelect(); if($('usersList'))renderUsers(); if($('schoolsList'))renderSchools(); if($('camerasList'))renderCameras(); if(window.renderGcm)window.renderGcm()}
function editUser(role,u){state.editingUser={role,id:u.id};$('userRole').value=role;$('userName').value=u.name||'';$('userEmail').value=u.email||'';$('userPassword').value=u.password||'123456';$('userPhone').value=u.phone||'';$('userDepartment').value=role==='gcm'?(u.rank||'Operador da GCM'):(u.department||'Direção Escolar');$('schoolId').value=u.schoolId||state.data.schools[0]?.id||''; window.scrollTo({top:0,behavior:'smooth'})}
function clearUser(){state.editingUser=null;['userName','userEmail','userPhone'].forEach(id=>$(id).value='');$('userPassword').value='123456';$('userDepartment').value='Direção Escolar'}
async function saveUser(){const payload={role:$('userRole').value,name:$('userName').value,email:$('userEmail').value,password:$('userPassword').value,phone:$('userPhone').value,department:$('userDepartment').value,schoolId:$('schoolId').value}; if(state.editingUser){await req(`/api/admin/users/${state.editingUser.role}/${state.editingUser.id}`,{method:'PUT',body:JSON.stringify(payload)})}else{await req('/api/admin/users',{method:'POST',body:JSON.stringify(payload)})} clearUser(); await load(); toast('Login salvo.')}
async function delUser(role,id){if(confirm('Excluir login?')){await req(`/api/admin/users/${role}/${id}`,{method:'DELETE'});await load()}}
function editSchool(s){state.editingSchool=s.id;$('schoolName').value=s.name||'';$('schoolDomain').value=s.domain||'';$('schoolAddress').value=s.address||'';$('schoolPhone').value=s.phone||'';$('schoolPrincipal').value=s.principal||''}
function clearSchool(){state.editingSchool=null;['schoolName','schoolDomain','schoolAddress','schoolPhone','schoolPrincipal'].forEach(id=>$(id).value='')}
async function saveSchool(){const payload={name:$('schoolName').value,domain:$('schoolDomain').value,address:$('schoolAddress').value,phone:$('schoolPhone').value,principal:$('schoolPrincipal').value}; if(state.editingSchool){await req(`/api/admin/schools/${state.editingSchool}`,{method:'PUT',body:JSON.stringify(payload)})}else{await req('/api/admin/schools',{method:'POST',body:JSON.stringify(payload)})} clearSchool(); await load(); toast('Escola salva.')}
async function delSchool(id){if(confirm('Excluir escola e seus logins?')){await req(`/api/admin/schools/${id}`,{method:'DELETE'});await load()}}
function editCamera(schoolId,c){state.editingCamera={schoolId,id:c.id};$('cameraSchoolId').value=schoolId;$('cameraName').value=c.name||'';$('cameraZone').value=c.zone||'';$('cameraIp').value=c.ip||'';$('cameraUrl').value=c.streamUrl||'';$('cameraStatus').value=c.status||'online'}
function clearCamera(){state.editingCamera=null;['cameraName','cameraZone','cameraIp','cameraUrl'].forEach(id=>$(id).value='');$('cameraStatus').value='online'}
async function saveCamera(){const sid=$('cameraSchoolId').value;const payload={name:$('cameraName').value,zone:$('cameraZone').value,ip:$('cameraIp').value,streamUrl:$('cameraUrl').value,status:$('cameraStatus').value,protocol:'RTSP → go2rtc → Cloud/Tailscale → WebRTC'}; if(state.editingCamera){await req(`/api/schools/${state.editingCamera.schoolId}/cameras/${state.editingCamera.id}`,{method:'PUT',body:JSON.stringify(payload)})}else{await req(`/api/schools/${sid}/cameras`,{method:'POST',body:JSON.stringify(payload)})} clearCamera(); await load(); toast('Câmera salva.')}
async function delCamera(sid,cid){if(confirm('Excluir câmera?')){await req(`/api/schools/${sid}/cameras/${cid}`,{method:'DELETE'});await load()}}
