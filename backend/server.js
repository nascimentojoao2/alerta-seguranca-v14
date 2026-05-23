const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const PORT = Number(process.env.PORT || 3333);
const DB_PATH = path.join(__dirname, 'db.json');
const GCM_DOMAIN = '@gcm.sp.gov.br';
const VORTEX_MASTER_EMAIL = 'painel@vortex7.com.br';
const VORTEX_MASTER_PASSWORD = 'vortex7';

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function publicSchoolForUser(school) {
  return school;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function checkPassword(user, password) {
  // MVP: senha em texto para o Painel Vortex7 conseguir visualizar.
  // Produção: trocar por hash + tela de reset, sem exibir senha real.
  return String(user.password || '123456') === String(password || '');
}

function makeOfficerFromPayload(payload, existing = {}) {
  return {
    id: existing.id || makeId('gcm'),
    name: payload.name || existing.name || 'Operador GCM',
    email: normalizeEmail(payload.email || existing.email),
    password: payload.password || existing.password || '123456',
    badge: existing.badge || `GCM-${String(Date.now()).slice(-5)}`,
    rank: payload.department || payload.rank || existing.rank || 'Operador da GCM',
    unit: existing.unit || 'Base Integrada de Monitoramento',
    phone: payload.phone || existing.phone || '',
    bloodType: existing.bloodType || 'Não informado',
    birthDate: existing.birthDate || 'Não informado',
    cpf: existing.cpf || 'Não informado',
    rg: existing.rg || 'Não informado',
    serviceNumber: existing.serviceNumber || `ESC-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
    shift: existing.shift || 'Não informado',
    address: existing.address || 'Não informado',
    emergencyContact: existing.emergencyContact || 'Não informado',
    qualification: existing.qualification || 'Monitoramento operacional',
    medicalNotes: existing.medicalNotes || 'Sem observações',
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/web', express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Alerta Segurança Backend V14 Fixo', port: PORT, now: new Date().toISOString() });
});

app.get('/api/bootstrap', (req, res) => {
  const db = readDb();
  res.json({
    schools: db.schools.map(publicSchoolForUser),
    teachers: db.teachers || [],
    officers: db.officers || [],
    incidents: db.incidents || [],
  });
});

app.post('/api/auth/login', (req, res) => {
  const db = readDb();
  const role = req.body.role;
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const schoolId = req.body.schoolId;

  if (!role || !name || !email) {
    return res.status(400).json({ message: 'Informe perfil, nome e email.' });
  }

  if (role === 'vortex') {
    if (email !== VORTEX_MASTER_EMAIL || password !== VORTEX_MASTER_PASSWORD) {
      return res.status(401).json({ message: 'Acesso Vortex7 negado.' });
    }
    return res.json({
      token: 'demo-token-vortex7-master',
      role: 'vortex',
      user: { id: 'vortex-master', name: 'Administrador Vortex7', email: VORTEX_MASTER_EMAIL },
    });
  }

  if (role === 'teacher') {
    const school = db.schools.find((item) => item.id === schoolId);
    if (!school) return res.status(404).json({ message: 'Escola não encontrada.' });
    if (!email.endsWith(school.domain)) {
      return res.status(401).json({ message: `Use um email institucional com o domínio ${school.domain}.` });
    }

    const teacher = (db.teachers || []).find((item) => item.email.toLowerCase() === email && item.schoolId === school.id);
    if (!teacher) {
      return res.status(401).json({ message: 'Login não encontrado. Peça para a Vortex7 criar este acesso.' });
    }
    if (!checkPassword(teacher, password)) {
      return res.status(401).json({ message: 'Senha incorreta.' });
    }

    return res.json({
      token: `demo-token-${teacher.id}`,
      role: 'teacher',
      user: { id: teacher.id, name: teacher.name, email: teacher.email, schoolId: teacher.schoolId },
      teacher,
    });
  }

  if (role === 'gcm') {
    if (!email.endsWith(GCM_DOMAIN)) {
      return res.status(401).json({ message: `Use um email com o domínio ${GCM_DOMAIN}.` });
    }

    const officer = (db.officers || []).find((item) => item.email.toLowerCase() === email);
    if (!officer) {
      return res.status(401).json({ message: 'Login da GCM não encontrado. Crie o acesso no Painel Vortex7.' });
    }
    if (!checkPassword(officer, password)) {
      return res.status(401).json({ message: 'Senha incorreta.' });
    }

    return res.json({
      token: `demo-token-${officer.id}`,
      role: 'gcm',
      user: { id: officer.id, name: officer.name, email: officer.email },
      officer,
    });
  }

  return res.status(400).json({ message: 'Perfil inválido.' });
});


app.get('/api/admin/full', (req, res) => {
  const db = readDb();
  res.json({ schools: db.schools || [], teachers: db.teachers || [], officers: db.officers || [], incidents: db.incidents || [] });
});

app.post('/api/admin/schools', (req, res) => {
  const db = readDb();
  const name = String(req.body.name || '').trim();
  const domain = String(req.body.domain || '').trim().toLowerCase();
  if (!name || !domain || !domain.startsWith('@')) return res.status(400).json({ message: 'Informe nome e domínio institucional começando com @.' });
  if ((db.schools || []).some((item) => item.domain === domain)) return res.status(409).json({ message: 'Domínio já cadastrado.' });
  const school = {
    id: makeId('sch'),
    name,
    address: req.body.address || 'Endereço não informado',
    domain,
    phone: req.body.phone || '',
    principal: req.body.principal || 'Direção não informada',
    coords: { latitude: Number(req.body.latitude || -21.175), longitude: Number(req.body.longitude || -47.809) },
    contacts: ['Portaria', 'Direção'],
    cameras: [],
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.schools = [school, ...(db.schools || [])];
  writeDb(db);
  res.status(201).json(school);
});

app.put('/api/admin/schools/:id', (req, res) => {
  const db = readDb();
  const idx = (db.schools || []).findIndex((item) => item.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: 'Escola não encontrada.' });
  const current = db.schools[idx];
  db.schools[idx] = {
    ...current,
    name: req.body.name || current.name,
    address: req.body.address || current.address,
    domain: req.body.domain || current.domain,
    phone: req.body.phone || current.phone,
    principal: req.body.principal || current.principal,
    active: req.body.active === undefined ? current.active : Boolean(req.body.active),
  };
  writeDb(db);
  res.json(db.schools[idx]);
});

app.delete('/api/admin/schools/:id', (req, res) => {
  const db = readDb();
  db.schools = (db.schools || []).filter((item) => item.id !== req.params.id);
  db.teachers = (db.teachers || []).filter((item) => item.schoolId !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/schools/:schoolId/cameras', (req, res) => {
  const db = readDb();
  const school = db.schools.find((item) => item.id === req.params.schoolId);
  if (!school) return res.status(404).json({ message: 'Escola não encontrada.' });
  res.json({ schoolId: school.id, cameras: school.cameras || [] });
});

app.post('/api/schools/:schoolId/cameras', (req, res) => {
  const db = readDb();
  const school = db.schools.find((item) => item.id === req.params.schoolId);
  if (!school) return res.status(404).json({ message: 'Escola não encontrada.' });

  const camera = {
    id: makeId('cam'),
    name: req.body.name || 'Nova câmera',
    zone: req.body.zone || 'Área não informada',
    status: req.body.status || 'online',
    isRealCamera: Boolean(req.body.streamUrl),
    streamUrl: req.body.streamUrl || '',
    ip: req.body.ip || '',
    protocol: req.body.protocol || 'RTSP → go2rtc → WebRTC',
  };
  school.cameras = [camera, ...(school.cameras || [])];
  writeDb(db);
  res.status(201).json(camera);
});


app.put('/api/schools/:schoolId/cameras/:cameraId', (req, res) => {
  const db = readDb();
  const school = db.schools.find((item) => item.id === req.params.schoolId);
  if (!school) return res.status(404).json({ message: 'Escola não encontrada.' });
  const idx = (school.cameras || []).findIndex((item) => item.id === req.params.cameraId);
  if (idx < 0) return res.status(404).json({ message: 'Câmera não encontrada.' });
  school.cameras[idx] = {
    ...school.cameras[idx],
    name: req.body.name || school.cameras[idx].name,
    zone: req.body.zone || school.cameras[idx].zone,
    status: req.body.status || school.cameras[idx].status,
    streamUrl: req.body.streamUrl === undefined ? school.cameras[idx].streamUrl : req.body.streamUrl,
    ip: req.body.ip === undefined ? school.cameras[idx].ip : req.body.ip,
    protocol: req.body.protocol || school.cameras[idx].protocol,
    isRealCamera: Boolean(req.body.streamUrl || school.cameras[idx].streamUrl),
  };
  writeDb(db);
  res.json(school.cameras[idx]);
});

app.delete('/api/schools/:schoolId/cameras/:cameraId', (req, res) => {
  const db = readDb();
  const school = db.schools.find((item) => item.id === req.params.schoolId);
  if (!school) return res.status(404).json({ message: 'Escola não encontrada.' });
  school.cameras = (school.cameras || []).filter((item) => item.id !== req.params.cameraId);
  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/admin/users', (req, res) => {
  const db = readDb();
  res.json({ teachers: db.teachers || [], officers: db.officers || [], schools: db.schools || [] });
});

app.post('/api/admin/users', (req, res) => {
  const db = readDb();
  const role = req.body.role;
  const email = normalizeEmail(req.body.email);
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '123456').trim() || '123456';

  if (!['teacher', 'gcm'].includes(role)) return res.status(400).json({ message: 'Tipo de usuário inválido.' });
  if (!name || !email) return res.status(400).json({ message: 'Informe nome e email.' });

  if (role === 'teacher') {
    const school = db.schools.find((item) => item.id === req.body.schoolId);
    if (!school) return res.status(404).json({ message: 'Escola não encontrada.' });
    if (!email.endsWith(school.domain)) return res.status(400).json({ message: `Email precisa usar ${school.domain}.` });
    if ((db.teachers || []).some((item) => item.email.toLowerCase() === email)) return res.status(409).json({ message: 'Email já cadastrado.' });
    const teacher = {
      id: makeId('teacher'),
      name,
      email,
      password,
      schoolId: school.id,
      phone: req.body.phone || '',
      department: req.body.department || 'Direção Escolar',
      emergencyContact: req.body.emergencyContact || 'Não informado',
    };
    db.teachers = [teacher, ...(db.teachers || [])];
    writeDb(db);
    return res.status(201).json({ role: 'teacher', user: teacher });
  }

  if (!email.endsWith(GCM_DOMAIN)) return res.status(400).json({ message: `Email precisa usar ${GCM_DOMAIN}.` });
  if ((db.officers || []).some((item) => item.email.toLowerCase() === email)) return res.status(409).json({ message: 'Email já cadastrado.' });
  const officer = makeOfficerFromPayload({ ...req.body, email, name, password });
  db.officers = [officer, ...(db.officers || [])];
  writeDb(db);
  return res.status(201).json({ role: 'gcm', user: officer });
});

app.put('/api/admin/users/:role/:id', (req, res) => {
  const db = readDb();
  const { role, id } = req.params;
  const email = normalizeEmail(req.body.email);

  if (role === 'teacher') {
    const idx = (db.teachers || []).findIndex((item) => item.id === id);
    if (idx < 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
    const school = db.schools.find((item) => item.id === req.body.schoolId);
    if (!school) return res.status(404).json({ message: 'Escola não encontrada.' });
    if (!email.endsWith(school.domain)) return res.status(400).json({ message: `Email precisa usar ${school.domain}.` });
    db.teachers[idx] = {
      ...db.teachers[idx],
      name: req.body.name || db.teachers[idx].name,
      email,
      password: req.body.password || db.teachers[idx].password || '123456',
      schoolId: school.id,
      phone: req.body.phone || '',
      department: req.body.department || 'Direção Escolar',
    };
    writeDb(db);
    return res.json(db.teachers[idx]);
  }

  if (role === 'gcm') {
    const idx = (db.officers || []).findIndex((item) => item.id === id);
    if (idx < 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (!email.endsWith(GCM_DOMAIN)) return res.status(400).json({ message: `Email precisa usar ${GCM_DOMAIN}.` });
    db.officers[idx] = makeOfficerFromPayload({ ...req.body, email }, db.officers[idx]);
    writeDb(db);
    return res.json(db.officers[idx]);
  }

  return res.status(400).json({ message: 'Tipo de usuário inválido.' });
});

app.delete('/api/admin/users/:role/:id', (req, res) => {
  const db = readDb();
  const { role, id } = req.params;
  if (role === 'teacher') {
    db.teachers = (db.teachers || []).filter((item) => item.id !== id);
    writeDb(db);
    return res.json({ ok: true });
  }
  if (role === 'gcm') {
    db.officers = (db.officers || []).filter((item) => item.id !== id);
    writeDb(db);
    return res.json({ ok: true });
  }
  return res.status(400).json({ message: 'Tipo de usuário inválido.' });
});

app.get('/', (req, res) => res.redirect('/vortex'));
app.get('/vortex', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vortex.html')));
app.get('/gcm', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gcm.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Alerta Segurança Backend V11 rodando em http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
