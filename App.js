import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const STORAGE_KEYS = {
  SESSION: 'ac_v6_session',
  TEACHERS: 'ac_v6_teachers',
  INCIDENTS: 'ac_v6_incidents',
  OFFICERS: 'ac_v6_officers',
  THEME: 'ac_v6_theme',
};

const DARK_THEME = {
  mode: 'dark',
  bg: '#0B0D10',
  bgSoft: '#111418',
  card: '#171B21',
  cardAlt: '#202630',
  text: '#F4F7FB',
  muted: '#9AA6B2',
  line: '#2B323C',
  primary: '#E1062C',
  primarySoft: '#2A0F16',
  red: '#E1062C',
  amber: '#f59e0b',
  blue: '#38bdf8',
  purple: '#8b5cf6',
  slate: '#64748b',
  shadow: 'rgba(0,0,0,0.34)',
  overlay: 'rgba(2, 6, 12, 0.82)',
  input: '#11161D',
};

const LIGHT_THEME = {
  mode: 'light',
  bg: '#F4F6F8',
  bgSoft: '#E6EAEE',
  card: '#FFFFFF',
  cardAlt: '#F7F8FA',
  text: '#141820',
  muted: '#5E6A75',
  line: '#D3D9E0',
  primary: '#E1062C',
  primarySoft: '#FFE6EB',
  red: '#E1062C',
  amber: '#d97706',
  blue: '#0284c7',
  purple: '#7c3aed',
  slate: '#64748b',
  shadow: 'rgba(15, 23, 42, 0.10)',
  overlay: 'rgba(15, 23, 42, 0.28)',
  input: '#F7F8FA',
};

const GCM_DOMAIN = '@gcm.sp.gov.br';
const VORTEX_MASTER_EMAIL = 'painel@vortex7.com.br';
const VORTEX_MASTER_PASSWORD = 'vortex7';

const INITIAL_REGION = {
  latitude: -21.175,
  longitude: -47.809,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

// Servidor remoto do go2rtc via Cloudflare Tunnel fixo.
// Produção: https://cam-aurora.vortex7.com.br
// Para trocar sem editar código, use EXPO_PUBLIC_CAMERA_STREAM_SERVER no .env.
const CAMERA_STREAM_SERVER = process.env.EXPO_PUBLIC_CAMERA_STREAM_SERVER || 'https://cam-aurora.vortex7.com.br';
const INTELBRAS_TEST_STREAM = `${CAMERA_STREAM_SERVER}/stream.html?src=intelbras_vip_3230`;
const VORTEX_LOGO = require('./assets/logo-horizontal.png');
const VORTEX_SYMBOL = require('./assets/logo-symbol.png');

// API do Alerta Segurança em cloud.
// Produção: https://api.vortex7.com.br
// Para trocar sem editar código, use EXPO_PUBLIC_API_BASE_URL no .env.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.vortex7.com.br';

async function apiRequest(path, options = {}) {
  const timeoutMs = options.timeoutMs || 6000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || 'Erro de comunicação com o backend.');
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo esgotado ao conectar no backend cloud. Verifique se o túnel/backend estão ligados.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const SCHOOLS = [
  {
    id: 'sch-1',
    name: 'Escola Municipal Aurora',
    address: 'Rua das Flores, 120 - Centro',
    domain: '@aurora.edu.br',
    phone: '(16) 3333-1001',
    principal: 'Marina Lopes',
    coords: { latitude: -21.1704, longitude: -47.8103 },
    contacts: ['Portaria', 'Direção', 'Coordenação'],
    cameras: [
      {
        id: 'cam-aurora-1',
        name: 'Intelbras VIP 3230 B SL',
        zone: 'Acesso remoto • Cloudflare Tunnel cloud HTTPS',
        status: 'online',
        isRealCamera: true,
        streamUrl: INTELBRAS_TEST_STREAM,
        ip: '192.168.1.18',
        protocol: 'RTSP → go2rtc → Cloudflare Tunnel → WebRTC',
      },
      { id: 'cam-aurora-2', name: 'Pátio Interno', zone: 'Pátio', status: 'online' },
      { id: 'cam-aurora-3', name: 'Corredor Bloco A', zone: 'Bloco A', status: 'online' },
      { id: 'cam-aurora-4', name: 'Quadra', zone: 'Área esportiva', status: 'offline' },
    ],
  },
  {
    id: 'sch-2',
    name: 'Escola Estadual Horizonte',
    address: 'Av. Brasil, 845 - Jardim América',
    domain: '@horizonte.edu.br',
    phone: '(16) 3333-1002',
    principal: 'Eduardo Silva',
    coords: { latitude: -21.1762, longitude: -47.8072 },
    contacts: ['Portaria', 'Coordenação', 'Equipe pedagógica'],
    cameras: [
      { id: 'cam-horizonte-1', name: 'Entrada 01', zone: 'Portaria', status: 'online' },
      { id: 'cam-horizonte-2', name: 'Biblioteca', zone: 'Biblioteca', status: 'online' },
      { id: 'cam-horizonte-3', name: 'Corredor Central', zone: 'Prédio Principal', status: 'online' },
      { id: 'cam-horizonte-4', name: 'Área Externa', zone: 'Lateral', status: 'online' },
    ],
  },
  {
    id: 'sch-3',
    name: 'Escola Cívica Nova Geração',
    address: 'Rua da Paz, 55 - Vila Esperança',
    domain: '@novageracao.edu.br',
    phone: '(16) 3333-1003',
    principal: 'Patrícia Ramos',
    coords: { latitude: -21.1828, longitude: -47.8136 },
    contacts: ['Recepção', 'Direção', 'Apoio'],
    cameras: [
      { id: 'cam-nova-1', name: 'Recepção', zone: 'Recepção', status: 'online' },
      { id: 'cam-nova-2', name: 'Pátio Coberto', zone: 'Pátio', status: 'online' },
      { id: 'cam-nova-3', name: 'Saída dos alunos', zone: 'Portão lateral', status: 'offline' },
      { id: 'cam-nova-4', name: 'Laboratório', zone: 'Laboratório', status: 'online' },
    ],
  },
];

const DEFAULT_TEACHERS = [
  {
    id: 'director-aurora-1',
    name: 'Marina Lopes',
    email: 'diretora@aurora.edu.br',
    schoolId: 'sch-1',
    phone: '(16) 99999-0001',
    department: 'Direção Escolar',
    emergencyContact: 'Central administrativa • (16) 3333-1001',
  },
  {
    id: 'teacher-1',
    name: 'Helena Martins',
    email: 'helena@aurora.edu.br',
    schoolId: 'sch-1',
    phone: '(16) 99999-1010',
    department: 'Coordenação',
    emergencyContact: 'Carlos Martins • (16) 99988-2020',
  },
  {
    id: 'teacher-2',
    name: 'Rafael Nunes',
    email: 'rafael@horizonte.edu.br',
    schoolId: 'sch-2',
    phone: '(16) 99999-2020',
    department: 'Matemática',
    emergencyContact: 'Ana Nunes • (16) 99888-9898',
  },
];

const DEFAULT_OFFICERS = [
  {
    id: 'gcm-1',
    name: 'Marcos Vinícius Lima',
    email: 'operador@gcm.sp.gov.br',
    badge: 'GCM-01472',
    rank: 'Inspetor Operacional',
    unit: 'Base Central Escolar',
    phone: '(16) 3333-4400',
    bloodType: 'O+',
    birthDate: '14/02/1988',
    cpf: '***.***.***-40',
    rg: '**.***.***-1',
    serviceNumber: 'ESC-2026-014',
    shift: 'Diurno • 06:00 às 18:00',
    address: 'Base GCM • Centro Integrado de Monitoramento',
    emergencyContact: 'Luciana Lima • (16) 99911-5544',
    qualification: 'Monitoramento, despacho operacional e gestão de ocorrências',
    medicalNotes: 'Sem restrições operacionais cadastradas',
  },
];

const DEFAULT_INCIDENTS = [
  {
    id: 'inc-v6-1',
    protocol: 'AC-2026-0101',
    schoolId: 'sch-1',
    schoolName: 'Escola Municipal Aurora',
    personName: 'Helena Martins',
    personEmail: 'helena@aurora.edu.br',
    type: 'Ameaça verbal',
    priority: 'Alta',
    status: 'Viatura enviada',
    description: 'Discussão intensa próxima ao portão principal.',
    silentMode: false,
    createdAt: Date.now() - 1000 * 60 * 18,
    updatedAt: Date.now() - 1000 * 60 * 4,
    latitude: -21.1701,
    longitude: -47.8099,
    note: 'Equipe em deslocamento com apoio da gestão escolar.',
    unitSent: 'VTR 07',
    eta: 4,
    route: [
      { latitude: -21.1704, longitude: -47.8103 },
      { latitude: -21.1702, longitude: -47.8101 },
      { latitude: -21.1701, longitude: -47.8099 },
    ],
  },
  {
    id: 'inc-v6-2',
    protocol: 'AC-2026-0100',
    schoolId: 'sch-2',
    schoolName: 'Escola Estadual Horizonte',
    personName: 'Rafael Nunes',
    personEmail: 'rafael@horizonte.edu.br',
    type: 'Movimentação suspeita',
    priority: 'Alta',
    status: 'Encerrado',
    description: 'Pessoa desconhecida rondando a lateral do prédio.',
    silentMode: true,
    createdAt: Date.now() - 1000 * 60 * 90,
    updatedAt: Date.now() - 1000 * 60 * 50,
    latitude: -21.1767,
    longitude: -47.8067,
    note: 'Abordagem realizada. Sem risco adicional.',
    unitSent: 'MOTO 03',
    eta: 0,
    route: [
      { latitude: -21.1762, longitude: -47.8072 },
      { latitude: -21.1764, longitude: -47.8070 },
      { latitude: -21.1767, longitude: -47.8067 },
    ],
  },
];

const INCIDENT_TYPES = [
  { label: 'Ameaça verbal', priority: 'Alta', icon: 'warning-outline' },
  { label: 'Movimentação suspeita', priority: 'Alta', icon: 'search-outline' },
  { label: 'Invasão', priority: 'Crítica', icon: 'shield-outline' },
  { label: 'Violência física', priority: 'Crítica', icon: 'alert-circle-outline' },
  { label: 'Emergência médica', priority: 'Alta', icon: 'medkit-outline' },
  { label: 'Botão silencioso', priority: 'Crítica', icon: 'volume-mute-outline' },
];

const PROFESSOR_TABS = [
  { key: 'home', label: 'Início', icon: 'home-outline' },
  { key: 'alerts', label: 'Alertas', icon: 'alert-circle-outline' },
  { key: 'school', label: 'Escola', icon: 'business-outline' },
  { key: 'profile', label: 'Perfil', icon: 'person-outline' },
];

const GCM_TABS = [
  { key: 'dashboard', label: 'Central', icon: 'grid-outline' },
  { key: 'schools', label: 'Escolas', icon: 'school-outline' },
  { key: 'occurrences', label: 'Ocorrências', icon: 'list-outline' },
  { key: 'cameras', label: 'Câmeras', icon: 'videocam-outline' },
  { key: 'profile', label: 'Perfil', icon: 'shield-checkmark-outline' },
];

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeProtocol(nextNumber) {
  return `AC-2026-${String(nextNumber).padStart(4, '0')}`;
}

function randomUnit() {
  const units = ['VTR 07', 'VTR 12', 'MOTO 03', 'ALFA 01', 'BRAVO 02'];
  return units[Math.floor(Math.random() * units.length)];
}

function randomEta() {
  return 3 + Math.floor(Math.random() * 6);
}

function formatDateTime(value) {
  if (!value) return '--';
  return new Date(value).toLocaleString('pt-BR');
}

function timeAgo(value) {
  const diff = Date.now() - value;
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  return `${days} dia(s) atrás`;
}

function getSchoolById(schoolId) {
  return SCHOOLS.find((school) => school.id === schoolId) || null;
}

function getTypeMeta(label) {
  return INCIDENT_TYPES.find((item) => item.label === label) || INCIDENT_TYPES[0];
}

function statusColor(status, theme) {
  if (status === 'Novo') return theme.red;
  if (status === 'Em análise') return theme.amber;
  if (status === 'Viatura enviada') return theme.primary;
  return theme.slate;
}

function BottomTabs({ items, current, onChange, styles, theme }) {
  return (
    <View style={styles.bottomTabs}>
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Pressable key={item.key} style={styles.bottomTabItem} onPress={() => onChange(item.key)}>
            <View style={[styles.bottomTabIconWrap, active && styles.bottomTabIconWrapActive]}>
              <Ionicons name={item.icon} size={18} color={active ? theme.text : theme.muted} />
            </View>
            <Text style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HeaderBlock({ eyebrow, title, subtitle, action, styles }) {
  return (
    <View style={styles.headerBlock}>
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {action || null}
    </View>
  );
}

function ThemeAction({ mode, onToggle, styles, theme }) {
  return (
    <Pressable style={styles.themeAction} onPress={onToggle}>
      <Ionicons name={mode === 'light' ? 'moon-outline' : 'sunny-outline'} size={18} color={theme.text} />
      <Text style={styles.themeActionText}>{mode === 'light' ? 'Escuro' : 'Claro'}</Text>
    </Pressable>
  );
}

function StatCard({ icon, label, value, tone = 'default', styles, theme }) {
  const toneMap = {
    green: theme.primarySoft,
    red: `${theme.red}14`,
    amber: `${theme.amber}14`,
    blue: `${theme.blue}14`,
    default: theme.cardAlt,
  };
  return (
    <View style={[styles.statCard, { backgroundColor: toneMap[tone] || toneMap.default }]}>
      <View style={[styles.statIconWrap, { backgroundColor: theme.card }]}> 
        <Ionicons name={icon} size={20} color={theme.text} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Pill({ text, active, onPress, icon, styles, theme }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      {icon ? <Ionicons name={icon} size={14} color={active ? '#fff' : theme.muted} /> : null}
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{text}</Text>
    </Pressable>
  );
}

function SectionCard({ title, subtitle, children, right, styles }) {
  return (
    <View style={styles.sectionCard}>
      {(title || subtitle || right) && (
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            {!!title && <Text style={styles.sectionTitle}>{title}</Text>}
            {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
          </View>
          {right || null}
        </View>
      )}
      {children}
    </View>
  );
}

function InfoRow({ label, value, styles }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EmptyState({ icon, title, subtitle, styles, theme }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={26} color={theme.text} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function IncidentCard({ incident, onPress, compact, styles, theme }) {
  const typeMeta = getTypeMeta(incident.type);
  const tone = statusColor(incident.status, theme);
  return (
    <Pressable style={[styles.incidentCard, compact && styles.incidentCardCompact]} onPress={onPress}>
      <View style={styles.incidentTopRow}>
        <View style={styles.incidentTypeWrap}>
          <Ionicons name={typeMeta.icon} size={18} color={theme.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.incidentProtocol}>{incident.protocol}</Text>
          <Text style={styles.incidentSchool}>{incident.schoolName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${tone}16`, borderColor: `${tone}55` }]}>
          <Text style={[styles.statusBadgeText, { color: tone }]}>{incident.status}</Text>
        </View>
      </View>
      <Text style={styles.incidentTitle}>{incident.type}</Text>
      <Text style={styles.incidentBody}>{incident.description || 'Sem descrição adicional.'}</Text>
      <View style={styles.incidentMetaRow}>
        <Text style={styles.incidentMetaText}>{incident.personName}</Text>
        <Text style={styles.incidentMetaDot}>•</Text>
        <Text style={styles.incidentMetaText}>{timeAgo(incident.updatedAt || incident.createdAt)}</Text>
      </View>
      <View style={styles.incidentFooterRow}>
        <Text style={styles.incidentFooterText}>{incident.priority}</Text>
        {incident.unitSent ? <Text style={styles.incidentFooterText}>{incident.unitSent}</Text> : null}
        {incident.eta ? <Text style={styles.incidentFooterText}>ETA {incident.eta} min</Text> : null}
      </View>
    </Pressable>
  );
}

function SchoolCard({ school, openCount, onPress, onCameraPress, styles, theme }) {
  return (
    <View style={styles.schoolCard}>
      <Pressable onPress={onPress}>
        <View style={styles.schoolTopRow}>
          <View style={styles.schoolAvatar}>
            <Ionicons name="school-outline" size={20} color={theme.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolName}>{school.name}</Text>
            <Text style={styles.schoolAddress}>{school.address}</Text>
          </View>
          <View style={styles.schoolOpenCount}>
            <Text style={styles.schoolOpenCountText}>{openCount}</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.schoolInfoRow}>
        <Text style={styles.schoolInfoItem}>Direção: {school.principal}</Text>
        <Text style={styles.schoolInfoItem}>{school.phone}</Text>
      </View>
      <View style={styles.inlineRowWrap}>
        {school.contacts.map((contact) => (
          <View key={contact} style={styles.inlineTag}>
            <Text style={styles.inlineTagText}>{contact}</Text>
          </View>
        ))}
      </View>
      <View style={styles.schoolActionRow}>
        <Pressable style={styles.secondaryButton} onPress={onPress}>
          <Ionicons name="map-outline" size={16} color={theme.text} />
          <Text style={styles.secondaryButtonText}>Abrir escola</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCameraPress}>
          <Ionicons name="videocam-outline" size={16} color={theme.text} />
          <Text style={styles.secondaryButtonText}>Ver câmeras</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CameraCard({ camera, onPress, styles, theme }) {
  const online = camera.status === 'online';
  return (
    <Pressable style={styles.cameraCard} onPress={onPress}>
      <View style={styles.cameraPreview}>
        <View style={[styles.cameraLiveDot, { backgroundColor: online ? theme.red : theme.slate }]} />
        <Text style={styles.cameraPreviewText}>{online ? (camera.isRealCamera ? 'CÂMERA REAL' : 'STREAM AO VIVO') : 'SEM SINAL'}</Text>
        <Text style={styles.cameraZone}>{camera.zone}</Text>
      </View>
      <Text style={styles.cameraName}>{camera.name}</Text>
      <Text style={styles.cameraStatus}>{online ? 'Online' : 'Offline'}</Text>
    </Pressable>
  );
}

function LoginScreen({
  authRole,
  setAuthRole,
  selectedSchoolId,
  setSelectedSchoolId,
  loginName,
  setLoginName,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginLoading,
  handleLogin,
  schools,
  setDemoProfessor,
  setDemoGcm,
  setDemoVortex,
  mode,
  toggleTheme,
  styles,
  theme,
}) {
  return (
    <ScrollView contentContainerStyle={styles.authContainer}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.eyebrow}>MOBILE CLIENTE • V14 FIXA</Text>
          <ThemeAction mode={mode} onToggle={toggleTheme} styles={styles} theme={theme} />
        </View>
        <Image source={VORTEX_LOGO} style={styles.vortexLogo} resizeMode="contain" />
        <Text style={styles.heroTitle}>Alerta Segurança</Text>
        <Text style={styles.heroSubtitle}>
          Aplicativo exclusivo para diretoras e responsáveis autorizados. Acesso liberado somente para contas criadas pela Vortex7.
        </Text>
      </View>

      <SectionCard
        title="Acesso da escola"
        subtitle="Entre com a conta criada pela Vortex7. A diretora vê somente as câmeras e alertas da própria escola."
        styles={styles}
      >
        <View style={styles.filterRow}>
          {schools.map((school) => (
            <Pill
              key={school.id}
              text={school.name.split(' ').slice(-1)[0]}
              active={selectedSchoolId === school.id}
              onPress={() => setSelectedSchoolId(school.id)}
              styles={styles}
              theme={theme}
            />
          ))}
        </View>

        <View style={styles.demoRow}>
          <Pressable style={styles.secondaryButton} onPress={setDemoProfessor}>
            <Ionicons name="flash-outline" size={16} color={theme.text} />
            <Text style={styles.secondaryButtonText}>Entrar como Diretora Aurora</Text>
          </Pressable>
        </View>

        <TextInput value={loginName} onChangeText={setLoginName} placeholder="Nome completo" placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput
          value={loginEmail}
          onChangeText={setLoginEmail}
          autoCapitalize="none"
          placeholder="diretora@escola.edu.br"
          placeholderTextColor={theme.muted}
          style={styles.input}
        />
        <TextInput
          value={loginPassword}
          onChangeText={setLoginPassword}
          placeholder="Senha"
          placeholderTextColor={theme.muted}
          secureTextEntry
          style={styles.input}
        />
        <Pressable style={[styles.primaryButton, loginLoading && styles.disabledButton]} onPress={handleLogin} disabled={loginLoading}>
          <Ionicons name={loginLoading ? "hourglass-outline" : "log-in-outline"} size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>{loginLoading ? 'Entrando...' : 'Entrar no app'}</Text>
        </Pressable>
        <Text style={styles.bodyMuted}>Acesso mobile exclusivo para escola. Painel Vortex7 e Central GCM são web.</Text>
      </SectionCard>
    </ScrollView>
  );
}

function TeacherHome({
  school,
  teacher,
  activeIncident,
  currentAddress,
  selectedType,
  onSelectType,
  silentMode,
  setSilentMode,
  description,
  setDescription,
  onTrigger,
  holdProgress,
  permissionGranted,
  mode,
  toggleTheme,
  styles,
  theme,
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock
        eyebrow="Modo Gestor"
        title={`Olá, ${teacher?.name?.split(' ')[0] || 'Professor'}`}
        subtitle={school ? `${school.name} • ${school.address}` : 'Sem escola vinculada'}
        action={<ThemeAction mode={mode} onToggle={toggleTheme} styles={styles} theme={theme} />}
        styles={styles}
      />

      <View style={styles.statsGrid}>
        <StatCard icon="school-outline" label="Unidade" value={school ? school.name.split(' ')[0] : '--'} tone="blue" styles={styles} theme={theme} />
        <StatCard icon="navigate-outline" label="Localização" value={permissionGranted ? 'Ativa' : 'Pendente'} tone="amber" styles={styles} theme={theme} />
        <StatCard icon="radio-outline" label="Alerta atual" value={activeIncident ? activeIncident.status : 'Nenhum'} tone={activeIncident ? 'red' : 'green'} styles={styles} theme={theme} />
      </View>

      <SectionCard title="Sua localização" subtitle={currentAddress} styles={styles}>
        <Text style={styles.bodyMuted}>Em um acionamento, seu nome, sua escola e a posição atual seguem para a central da GCM.</Text>
      </SectionCard>

      <SectionCard title="Tipo de ocorrência" subtitle="Selecione o contexto mais próximo do que está acontecendo." styles={styles}>
        <View style={styles.inlineRowWrap}>
          {INCIDENT_TYPES.map((type) => (
            <Pill key={type.label} text={type.label} icon={type.icon} active={selectedType === type.label} onPress={() => onSelectType(type.label)} styles={styles} theme={theme} />
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title="Modo silencioso"
        subtitle="Quando ativo, o alerta é enviado com discrição e prioridade crítica."
        right={<Switch value={silentMode} onValueChange={setSilentMode} trackColor={{ false: theme.line, true: theme.primary }} thumbColor={theme.card} />}
        styles={styles}
      >
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Descreva rapidamente a situação para ajudar a central."
          placeholderTextColor={theme.muted}
          style={styles.textArea}
        />
      </SectionCard>

      <SectionCard title="Botão de pânico" subtitle="Pressione e segure por 2 segundos para disparar o alerta." styles={styles}>
        <View style={styles.panicWrap}>
          <View style={[styles.panicHaloOuter, { opacity: mode === 'light' ? 0.18 : 1 }]} />
          <View style={[styles.panicHaloInner, { transform: [{ scale: 1 + holdProgress * 0.002 }] }]} />
          <Pressable onPressIn={onTrigger.start} onPressOut={onTrigger.stop} style={[styles.panicButton, activeIncident && styles.panicButtonActive]}>
            <Ionicons name="warning" size={34} color="#fff" />
            <Text style={styles.panicButtonText}>{activeIncident ? 'ALERTA ATIVO' : 'SEGURE PARA ACIONAR'}</Text>
            <Text style={styles.panicButtonSubtext}>{Math.min(100, holdProgress)}%</Text>
          </Pressable>
        </View>
      </SectionCard>

      {activeIncident ? (
        <SectionCard title="Chamado em andamento" subtitle={`${activeIncident.protocol} • ${activeIncident.type}`} styles={styles}>
          <View style={styles.activeAlertBox}>
            <View style={styles.activeAlertRow}>
              <Text style={styles.activeAlertLabel}>Status</Text>
              <Text style={styles.activeAlertValue}>{activeIncident.status}</Text>
            </View>
            <View style={styles.activeAlertRow}>
              <Text style={styles.activeAlertLabel}>Prioridade</Text>
              <Text style={styles.activeAlertValue}>{activeIncident.priority}</Text>
            </View>
            <View style={styles.activeAlertRow}>
              <Text style={styles.activeAlertLabel}>Última atualização</Text>
              <Text style={styles.activeAlertValue}>{formatDateTime(activeIncident.updatedAt)}</Text>
            </View>
          </View>
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function TeacherAlerts({ incidents, onOpen, styles, theme }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock eyebrow="Histórico" title="Seus alertas" subtitle="Todos os chamados criados a partir desta conta." styles={styles} />
      {incidents.length ? incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} onPress={() => onOpen(incident)} styles={styles} theme={theme} />) : <EmptyState icon="time-outline" title="Nenhum chamado ainda" subtitle="Quando você acionar o botão de pânico, os registros aparecerão aqui." styles={styles} theme={theme} />}
    </ScrollView>
  );
}

function TeacherSchool({ school, incidents, onOpenCamera, styles, theme }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock eyebrow="Unidade escolar" title={school.name} subtitle={`${school.address} • ${school.phone}`} styles={styles} />
      <SectionCard title="Resumo da unidade" subtitle={`Direção: ${school.principal}`} styles={styles}>
        <View style={styles.statsGrid}>
          <StatCard icon="videocam-outline" label="Câmeras" value={String(school.cameras.length)} tone="blue" styles={styles} theme={theme} />
          <StatCard icon="alert-circle-outline" label="Abertos" value={String(incidents.filter((i) => i.status !== 'Encerrado').length)} tone="red" styles={styles} theme={theme} />
          <StatCard icon="people-outline" label="Contatos" value={String(school.contacts.length)} tone="green" styles={styles} theme={theme} />
        </View>
      </SectionCard>
      <SectionCard title="Setores e apoio" subtitle="Estrutura cadastrada para comunicação da central." styles={styles}>
        <View style={styles.inlineRowWrap}>
          {school.contacts.map((item) => (
            <View key={item} style={styles.inlineTag}>
              <Text style={styles.inlineTagText}>{item}</Text>
            </View>
          ))}
        </View>
      </SectionCard>
      <SectionCard title="Câmeras cadastradas" subtitle="Fluxo visual de integração por unidade." styles={styles}>
        <View style={styles.cameraGrid}>
          {school.cameras.map((camera) => (
            <CameraCard key={camera.id} camera={camera} onPress={() => onOpenCamera(school, camera)} styles={styles} theme={theme} />
          ))}
        </View>
      </SectionCard>
    </ScrollView>
  );
}

function TeacherProfile({ teacher, school, mode, toggleTheme, onLogout, styles, theme }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock eyebrow="Conta" title={teacher.name} subtitle={teacher.email} styles={styles} />
      <SectionCard title="Dados do vínculo" subtitle="Informações usadas para identificação da central." styles={styles}>
        <InfoRow label="Escola" value={school.name} styles={styles} />
        <InfoRow label="Setor" value={teacher.department || 'Não informado'} styles={styles} />
        <InfoRow label="Telefone" value={teacher.phone || 'Não informado'} styles={styles} />
        <InfoRow label="Contato de emergência" value={teacher.emergencyContact || 'Não informado'} styles={styles} />
        <InfoRow label="Domínio institucional" value={school.domain} styles={styles} />
      </SectionCard>
      <SectionCard title="Preferências" subtitle="Ajustes visuais do aplicativo." styles={styles}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Modo claro</Text>
            <Text style={styles.sectionSubtitle}>Alterne entre visual claro e escuro.</Text>
          </View>
          <Switch value={mode === 'light'} onValueChange={toggleTheme} trackColor={{ false: theme.line, true: theme.primary }} thumbColor={theme.card} />
        </View>
      </SectionCard>
      <SectionCard title="Sessão" subtitle="Use este botão para trocar de perfil ou testar outro fluxo." styles={styles}>
        <Pressable style={styles.primaryButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Sair da conta</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}

function GCMDashboard({ incidents, schools, onOpenIncident, onOpenSchool, onOpenCamera, currentCoords, mode, toggleTheme, styles, theme }) {
  const activeIncidents = incidents.filter((item) => item.status !== 'Encerrado');
  const urgentIncidents = activeIncidents.filter((item) => item.priority === 'Crítica');
  const schoolsWithOpen = schools.filter((school) => activeIncidents.some((item) => item.schoolId === school.id));

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock
        eyebrow="Central GCM"
        title="Painel operacional"
        subtitle="Visão rápida dos chamados escolares, escolas e câmeras."
        action={<ThemeAction mode={mode} onToggle={toggleTheme} styles={styles} theme={theme} />}
        styles={styles}
      />
      <View style={styles.statsGrid}>
        <StatCard icon="radio-outline" label="Ativos" value={String(activeIncidents.length)} tone="red" styles={styles} theme={theme} />
        <StatCard icon="warning-outline" label="Críticos" value={String(urgentIncidents.length)} tone="amber" styles={styles} theme={theme} />
        <StatCard icon="school-outline" label="Escolas" value={String(schoolsWithOpen.length)} tone="green" styles={styles} theme={theme} />
      </View>

      <SectionCard title="Mapa operacional" subtitle="Escolas e alertas em tempo real no painel da central." styles={styles}>
        <MapView style={styles.mapLarge} initialRegion={INITIAL_REGION} region={{ ...currentCoords, latitudeDelta: 0.03, longitudeDelta: 0.03 }}>
          {schools.map((school) => (
            <Marker key={school.id} coordinate={school.coords} title={school.name} description={school.address} pinColor={theme.blue} />
          ))}
          {activeIncidents.map((incident) => (
            <React.Fragment key={incident.id}>
              <Marker
                coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
                title={incident.protocol}
                description={`${incident.personName} • ${incident.schoolName}`}
                pinColor={incident.priority === 'Crítica' ? theme.red : theme.amber}
              />
              <Circle
                center={{ latitude: incident.latitude, longitude: incident.longitude }}
                radius={90}
                fillColor={incident.priority === 'Crítica' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.13)'}
                strokeColor={incident.priority === 'Crítica' ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.35)'}
              />
              {incident.route && incident.route.length > 1 ? <Polyline coordinates={incident.route} strokeColor={theme.primary} strokeWidth={3} /> : null}
            </React.Fragment>
          ))}
        </MapView>
      </SectionCard>

      <SectionCard title="Chamados ativos" subtitle="Toque para abrir os detalhes operacionais." styles={styles}>
        {activeIncidents.length ? activeIncidents.map((incident) => <IncidentCard key={incident.id} incident={incident} compact onPress={() => onOpenIncident(incident)} styles={styles} theme={theme} />) : <EmptyState icon="checkmark-done-outline" title="Sem chamados ativos" subtitle="A central está operando sem ocorrências abertas no momento." styles={styles} theme={theme} />}
      </SectionCard>

      <SectionCard title="Escolas com mais atenção" subtitle="Acesso rápido por unidade." styles={styles}>
        {schools.map((school) => (
          <SchoolCard
            key={school.id}
            school={school}
            openCount={activeIncidents.filter((item) => item.schoolId === school.id).length}
            onPress={() => onOpenSchool(school)}
            onCameraPress={() => onOpenCamera(school, school.cameras[0])}
            styles={styles}
            theme={theme}
          />
        ))}
      </SectionCard>
    </ScrollView>
  );
}

function GCMSchools({ schools, incidents, onOpenSchool, onOpenCamera, styles, theme }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock eyebrow="Unidades" title="Escolas monitoradas" subtitle="Cadastros usados na central da GCM." styles={styles} />
      {schools.map((school) => (
        <SchoolCard
          key={school.id}
          school={school}
          openCount={incidents.filter((item) => item.schoolId === school.id && item.status !== 'Encerrado').length}
          onPress={() => onOpenSchool(school)}
          onCameraPress={() => onOpenCamera(school, school.cameras[0])}
          styles={styles}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
}

function GCMOccurrences({ incidents, selectedFilter, setSelectedFilter, onOpenIncident, styles, theme }) {
  const filtered = incidents.filter((incident) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'open') return incident.status !== 'Encerrado';
    if (selectedFilter === 'critical') return incident.priority === 'Crítica';
    return true;
  });

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock eyebrow="Fila operacional" title="Ocorrências" subtitle="Acompanhe e filtre os chamados da rede escolar." styles={styles} />
      <View style={styles.filterRow}>
        <Pill text="Todas" active={selectedFilter === 'all'} onPress={() => setSelectedFilter('all')} styles={styles} theme={theme} />
        <Pill text="Abertas" active={selectedFilter === 'open'} onPress={() => setSelectedFilter('open')} styles={styles} theme={theme} />
        <Pill text="Críticas" active={selectedFilter === 'critical'} onPress={() => setSelectedFilter('critical')} styles={styles} theme={theme} />
      </View>
      {filtered.length ? filtered.map((incident) => <IncidentCard key={incident.id} incident={incident} onPress={() => onOpenIncident(incident)} styles={styles} theme={theme} />) : <EmptyState icon="list-outline" title="Nada para mostrar" subtitle="Nenhuma ocorrência corresponde ao filtro selecionado." styles={styles} theme={theme} />}
    </ScrollView>
  );
}

function GCMCameras({ schools, selectedSchool, onSelectSchool, onOpenCamera, styles, theme }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock eyebrow="Vídeo monitoramento" title="Câmeras das escolas" subtitle="Escolha uma unidade e abra o stream real da câmera quando o go2rtc estiver rodando." styles={styles} />
      <View style={styles.filterRow}>
        {schools.map((school) => (
          <Pill key={school.id} text={school.name.split(' ').slice(-1)[0]} active={selectedSchool?.id === school.id} onPress={() => onSelectSchool(school)} styles={styles} theme={theme} />
        ))}
      </View>
      {selectedSchool ? (
        <SectionCard title={selectedSchool.name} subtitle={`${selectedSchool.address} • ${selectedSchool.phone}`} styles={styles}>
          <View style={styles.cameraGrid}>
            {selectedSchool.cameras.map((camera) => (
              <CameraCard key={camera.id} camera={camera} onPress={() => onOpenCamera(selectedSchool, camera)} styles={styles} theme={theme} />
            ))}
          </View>
        </SectionCard>
      ) : null}
    </ScrollView>
  );
}

function GCMProfile({ officer, mode, toggleTheme, onLogout, openCount, styles, theme }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock eyebrow="Perfil operacional" title={officer.name} subtitle={`${officer.rank} • ${officer.badge}`} styles={styles} />
      <SectionCard title="Identificação funcional" subtitle="Dados exibidos para validação da central." styles={styles}>
        <InfoRow label="Matrícula" value={officer.badge} styles={styles} />
        <InfoRow label="Cargo / patente" value={officer.rank} styles={styles} />
        <InfoRow label="Base / unidade" value={officer.unit} styles={styles} />
        <InfoRow label="Escala" value={officer.shift} styles={styles} />
        <InfoRow label="Chamados abertos" value={String(openCount)} styles={styles} />
      </SectionCard>
      <SectionCard title="Dados pessoais e operacionais" subtitle="Ficha resumida do policial/operador." styles={styles}>
        <InfoRow label="Nome completo" value={officer.name} styles={styles} />
        <InfoRow label="Email" value={officer.email} styles={styles} />
        <InfoRow label="Telefone funcional" value={officer.phone} styles={styles} />
        <InfoRow label="Tipo sanguíneo" value={officer.bloodType} styles={styles} />
        <InfoRow label="Nascimento" value={officer.birthDate} styles={styles} />
        <InfoRow label="CPF" value={officer.cpf} styles={styles} />
        <InfoRow label="RG" value={officer.rg} styles={styles} />
        <InfoRow label="Registro de serviço" value={officer.serviceNumber} styles={styles} />
        <InfoRow label="Endereço/base" value={officer.address} styles={styles} />
        <InfoRow label="Contato de emergência" value={officer.emergencyContact} styles={styles} />
        <InfoRow label="Qualificação" value={officer.qualification} styles={styles} />
        <InfoRow label="Observação médica" value={officer.medicalNotes} styles={styles} />
      </SectionCard>
      <SectionCard title="Preferências" subtitle="Ajustes gerais do aplicativo." styles={styles}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Modo claro</Text>
            <Text style={styles.sectionSubtitle}>Alterne entre tema claro e escuro.</Text>
          </View>
          <Switch value={mode === 'light'} onValueChange={toggleTheme} trackColor={{ false: theme.line, true: theme.primary }} thumbColor={theme.card} />
        </View>
      </SectionCard>
      <SectionCard title="Sessão" subtitle="Volte para o login quando quiser trocar o perfil em teste." styles={styles}>
        <Pressable style={styles.primaryButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Sair da conta</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}


function VortexPanel({ schools, teachers, officers, userForm, setUserForm, editingUser, onSaveUser, onEditUser, onDeleteUser, onCancelEdit, onOpenCamera, mode, toggleTheme, onLogout, styles, theme }) {
  const allCameras = schools.flatMap((school) => (school.cameras || []).map((camera) => ({ ...camera, school })));
  const totalUsers = teachers.length + officers.length;
  const selectedRole = userForm.role || 'teacher';
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <HeaderBlock
        eyebrow="Painel Vortex7"
        title="Cérebro do Alerta Segurança"
        subtitle="Gerencie usuários, senhas, escolas e câmeras de todo o ecossistema. A diretora acessa apenas a própria escola; a Vortex7 enxerga tudo."
        action={<ThemeAction mode={mode} onToggle={toggleTheme} styles={styles} theme={theme} />}
        styles={styles}
      />

      <View style={styles.statsGrid}>
        <StatCard icon="school-outline" label="Escolas" value={String(schools.length)} tone="blue" styles={styles} theme={theme} />
        <StatCard icon="videocam-outline" label="Câmeras" value={String(allCameras.length)} tone="green" styles={styles} theme={theme} />
        <StatCard icon="people-outline" label="Logins" value={String(totalUsers)} tone="amber" styles={styles} theme={theme} />
      </View>

      <SectionCard title={editingUser ? 'Editar login' : 'Criar novo login'} subtitle="Crie a conta da diretora, gestor escolar ou operador da GCM. As senhas ficam visíveis somente neste painel administrativo." styles={styles}>
        <View style={styles.filterRow}>
          <Pill text="Diretora / Escola" active={selectedRole === 'teacher'} onPress={() => setUserForm((prev) => ({ ...prev, role: 'teacher' }))} styles={styles} theme={theme} />
          <Pill text="GCM" active={selectedRole === 'gcm'} onPress={() => setUserForm((prev) => ({ ...prev, role: 'gcm' }))} styles={styles} theme={theme} />
        </View>
        {selectedRole === 'teacher' ? (
          <View style={styles.filterRow}>
            {schools.map((school) => (
              <Pill key={school.id} text={school.name.split(' ').slice(-1)[0]} active={userForm.schoolId === school.id} onPress={() => setUserForm((prev) => ({ ...prev, schoolId: school.id }))} styles={styles} theme={theme} />
            ))}
          </View>
        ) : null}
        <TextInput value={userForm.name} onChangeText={(value) => setUserForm((prev) => ({ ...prev, name: value }))} placeholder="Nome completo" placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={userForm.email} onChangeText={(value) => setUserForm((prev) => ({ ...prev, email: value.toLowerCase() }))} autoCapitalize="none" placeholder={selectedRole === 'teacher' ? 'diretora@escola.edu.br' : `operador${GCM_DOMAIN}`} placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={userForm.password} onChangeText={(value) => setUserForm((prev) => ({ ...prev, password: value }))} placeholder="Senha visível no painel Vortex7" placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={userForm.phone} onChangeText={(value) => setUserForm((prev) => ({ ...prev, phone: value }))} placeholder="Telefone" placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput value={userForm.department} onChangeText={(value) => setUserForm((prev) => ({ ...prev, department: value }))} placeholder={selectedRole === 'teacher' ? 'Cargo / setor: Direção Escolar' : 'Cargo / patente'} placeholderTextColor={theme.muted} style={styles.input} />
        <Pressable style={styles.primaryButton} onPress={onSaveUser}>
          <Ionicons name={editingUser ? 'save-outline' : 'person-add-outline'} size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>{editingUser ? 'Salvar edição' : 'Criar login'}</Text>
        </Pressable>
        {editingUser ? (
          <Pressable style={[styles.secondaryButton, { marginTop: 10, justifyContent: 'center' }]} onPress={onCancelEdit}>
            <Ionicons name="close-circle-outline" size={16} color={theme.text} />
            <Text style={styles.secondaryButtonText}>Cancelar edição</Text>
          </Pressable>
        ) : null}
      </SectionCard>

      <SectionCard title="Logins das diretoras" subtitle="Cada diretora fica vinculada a uma escola e só vê as câmeras da unidade dela." styles={styles}>
        {teachers.map((user) => {
          const school = schools.find((item) => item.id === user.schoolId);
          return (
            <View key={user.id} style={styles.incidentCard}>
              <Text style={styles.incidentTitle}>{user.name}</Text>
              <InfoRow label="Email" value={user.email} styles={styles} />
              <InfoRow label="Senha" value={user.password || '123456'} styles={styles} />
              <InfoRow label="Escola" value={school?.name || 'Não vinculada'} styles={styles} />
              <View style={styles.modalActionsWrap}>
                <Pressable style={styles.secondaryButtonWide} onPress={() => onEditUser('teacher', user)}><Ionicons name="create-outline" size={18} color={theme.text} /><Text style={styles.secondaryButtonText}>Editar</Text></Pressable>
                <Pressable style={styles.dangerButtonWide} onPress={() => onDeleteUser('teacher', user)}><Ionicons name="trash-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Excluir</Text></Pressable>
              </View>
            </View>
          );
        })}
      </SectionCard>

      <SectionCard title="Logins da GCM" subtitle="Operadores da central que conseguem acompanhar ocorrências e câmeras cadastradas." styles={styles}>
        {officers.map((user) => (
          <View key={user.id} style={styles.incidentCard}>
            <Text style={styles.incidentTitle}>{user.name}</Text>
            <InfoRow label="Email" value={user.email} styles={styles} />
            <InfoRow label="Senha" value={user.password || '123456'} styles={styles} />
            <InfoRow label="Cargo" value={user.rank || user.department || 'Operador'} styles={styles} />
            <View style={styles.modalActionsWrap}>
              <Pressable style={styles.secondaryButtonWide} onPress={() => onEditUser('gcm', user)}><Ionicons name="create-outline" size={18} color={theme.text} /><Text style={styles.secondaryButtonText}>Editar</Text></Pressable>
              <Pressable style={styles.dangerButtonWide} onPress={() => onDeleteUser('gcm', user)}><Ionicons name="trash-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Excluir</Text></Pressable>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Todas as câmeras cadastradas" subtitle="Visão total da Vortex7. Aqui aparecem as câmeras de todas as escolas." styles={styles}>
        <View style={styles.cameraGrid}>
          {allCameras.map((camera) => (
            <CameraCard key={`${camera.school.id}-${camera.id}`} camera={{ ...camera, zone: `${camera.school.name} • ${camera.zone}` }} onPress={() => onOpenCamera(camera.school, camera)} styles={styles} theme={theme} />
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Sessão Vortex7" subtitle="Sair do painel administrativo." styles={styles}>
        <Pressable style={styles.primaryButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Sair do Painel Vortex7</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.bg },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadingTitle: { color: theme.text, fontSize: 28, fontWeight: '800' },
    loadingSubtitle: { color: theme.muted, marginTop: 10, textAlign: 'center' },
    authContainer: { padding: 18, paddingBottom: 28, gap: 14 },
    heroCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.line,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    heroTitle: { color: theme.text, fontSize: 30, fontWeight: '800', marginTop: 6 },
    heroSubtitle: { color: theme.muted, marginTop: 10, lineHeight: 20 },
    headerBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
    eyebrow: { color: theme.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    headerTitle: { color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
    headerSubtitle: { color: theme.muted, marginTop: 6, lineHeight: 20 },
    themeAction: {
      backgroundColor: theme.cardAlt,
      borderWidth: 1,
      borderColor: theme.line,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    themeActionText: { color: theme.text, fontWeight: '700', fontSize: 12 },
    modeSwitchWrap: { flexDirection: 'row', gap: 10 },
    modeButton: {
      flex: 1,
      backgroundColor: theme.cardAlt,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.line,
    },
    modeButtonActive: { backgroundColor: `${theme.primary}22`, borderColor: `${theme.primary}66` },
    modeButtonText: { color: theme.text, fontWeight: '700' },
    sectionCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.line,
      marginBottom: 14,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '800' },
    sectionSubtitle: { color: theme.muted, marginTop: 4, lineHeight: 18 },
    filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
    demoRow: { marginBottom: 10 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.bgSoft,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    pillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    pillText: { color: theme.muted, fontWeight: '700', fontSize: 12 },
    pillTextActive: { color: '#fff' },
    input: {
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.line,
      color: theme.text,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 10,
    },
    textArea: {
      minHeight: 96,
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.line,
      color: theme.text,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      textAlignVertical: 'top',
    },
    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    primaryButtonText: { color: '#fff', fontWeight: '800' },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: theme.cardAlt,
      borderWidth: 1,
      borderColor: theme.line,
    },
    secondaryButtonWide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: theme.cardAlt,
      borderWidth: 1,
      borderColor: theme.line,
    },
    dangerButtonWide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: theme.red,
    },
    secondaryButtonText: { color: theme.text, fontWeight: '700', fontSize: 12 },
    bodyMuted: { color: theme.muted, lineHeight: 20 },
    bodyText: { color: theme.text, lineHeight: 20 },
    scrollContent: { padding: 16, paddingBottom: 110 },
    appBody: { flex: 1 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    statCard: {
      flex: 1,
      minWidth: '30%',
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.line,
    },
    statIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.line,
    },
    statValue: { color: theme.text, fontWeight: '800', fontSize: 18 },
    statLabel: { color: theme.muted, marginTop: 4, fontSize: 12 },
    inlineRowWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    inlineTag: { backgroundColor: theme.cardAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: theme.line },
    inlineTagText: { color: theme.text, fontWeight: '700', fontSize: 12 },
    panicWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minHeight: 220 },
    panicHaloOuter: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: `${theme.red}20` },
    panicHaloInner: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: `${theme.red}28` },
    panicButton: {
      width: 160,
      height: 160,
      borderRadius: 80,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.red,
      gap: 8,
      shadowColor: theme.red,
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    panicButtonActive: { backgroundColor: theme.amber },
    panicButtonText: { color: '#fff', fontWeight: '800', textAlign: 'center', paddingHorizontal: 12 },
    panicButtonSubtext: { color: '#fff', opacity: 0.92, fontWeight: '700' },
    activeAlertBox: { backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.line, borderRadius: 16, padding: 12 },
    activeAlertRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.line },
    activeAlertLabel: { color: theme.muted, fontWeight: '700' },
    activeAlertValue: { color: theme.text, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
    incidentCard: { backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.line, borderRadius: 18, padding: 14, marginBottom: 10 },
    incidentCardCompact: { marginBottom: 8 },
    incidentTopRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    incidentTypeWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.line },
    incidentProtocol: { color: theme.text, fontWeight: '800' },
    incidentSchool: { color: theme.muted, marginTop: 2, fontSize: 12 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
    statusBadgeText: { fontWeight: '800', fontSize: 11 },
    incidentTitle: { color: theme.text, marginTop: 12, fontWeight: '800', fontSize: 16 },
    incidentBody: { color: theme.muted, lineHeight: 18, marginTop: 6 },
    incidentMetaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 },
    incidentMetaText: { color: theme.muted, fontSize: 12 },
    incidentMetaDot: { color: theme.muted },
    incidentFooterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
    incidentFooterText: { color: theme.text, fontSize: 12, fontWeight: '700', backgroundColor: theme.card, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.line },
    schoolCard: { backgroundColor: theme.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: theme.line, marginBottom: 12 },
    schoolTopRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    schoolAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.line },
    schoolName: { color: theme.text, fontWeight: '800', fontSize: 15 },
    schoolAddress: { color: theme.muted, marginTop: 2 },
    schoolOpenCount: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: `${theme.red}16`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${theme.red}44` },
    schoolOpenCountText: { color: theme.red, fontWeight: '800' },
    schoolInfoRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 },
    schoolInfoItem: { color: theme.muted, fontSize: 12 },
    schoolActionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    cameraGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    cameraCard: { width: '48.3%', backgroundColor: theme.cardAlt, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: theme.line },
    cameraPreview: { height: 100, borderRadius: 14, backgroundColor: theme.bgSoft, borderWidth: 1, borderColor: theme.line, padding: 10, justifyContent: 'space-between' },
    cameraLiveDot: { width: 10, height: 10, borderRadius: 5 },
    cameraPreviewText: { color: theme.text, fontWeight: '800', fontSize: 12 },
    cameraZone: { color: theme.muted, fontSize: 12 },
    cameraName: { color: theme.text, fontWeight: '800', marginTop: 10 },
    cameraStatus: { color: theme.muted, marginTop: 4, fontSize: 12 },
    mapLarge: { height: 260, borderRadius: 18 },
    modalMap: { height: 220, borderRadius: 18 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.line },
    infoLabel: { color: theme.muted, fontWeight: '700', flex: 1 },
    infoValue: { color: theme.text, flex: 1.2, textAlign: 'right', fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 10 },
    emptyIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.cardAlt, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    emptyTitle: { color: theme.text, fontWeight: '800', fontSize: 16 },
    emptySubtitle: { color: theme.muted, marginTop: 6, textAlign: 'center', lineHeight: 18 },
    bottomTabs: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      backgroundColor: theme.card,
      borderRadius: 20,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: theme.line,
      flexDirection: 'row',
      justifyContent: 'space-between',
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    bottomTabItem: { flex: 1, alignItems: 'center', gap: 6 },
    bottomTabIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    bottomTabIconWrapActive: { backgroundColor: `${theme.primary}20` },
    bottomTabLabel: { color: theme.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
    bottomTabLabelActive: { color: theme.text },
    modalOverlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: theme.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, maxHeight: '88%' },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    modalTitle: { color: theme.text, fontSize: 22, fontWeight: '800' },
    modalSubtitle: { color: theme.muted, marginTop: 4 },
    modalActionsWrap: { flexDirection: 'row', gap: 10, marginTop: 12 },
    cameraModalPreview: { height: 220, borderRadius: 20, backgroundColor: theme.bgSoft, borderWidth: 1, borderColor: theme.line, padding: 16, justifyContent: 'flex-end', marginBottom: 12 },
    cameraModalPreviewText: { color: theme.text, fontWeight: '800', fontSize: 20 },
    cameraModalPreviewSmall: { color: theme.muted, marginTop: 6 },
    cameraPlayerWrap: { height: 260, borderRadius: 20, overflow: 'hidden', backgroundColor: theme.bgSoft, borderWidth: 1, borderColor: theme.line, marginBottom: 12 },
    cameraWebView: { flex: 1, backgroundColor: theme.bgSoft },
    cameraLoadingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgSoft },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  });
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [schools, setSchools] = useState(SCHOOLS);
  const [teachers, setTeachers] = useState(DEFAULT_TEACHERS);
  const [incidents, setIncidents] = useState(DEFAULT_INCIDENTS);
  const [officers, setOfficers] = useState(DEFAULT_OFFICERS);
  const [themeMode, setThemeMode] = useState('dark');
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ role: 'teacher', name: '', email: '', password: '123456', schoolId: 'sch-1', phone: '', department: 'Direção Escolar' });

  const theme = themeMode === 'light' ? LIGHT_THEME : DARK_THEME;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [locationPermission, setLocationPermission] = useState('pending');
  const [currentCoords, setCurrentCoords] = useState(INITIAL_REGION);
  const [currentAddress, setCurrentAddress] = useState('Obtendo localização atual...');

  const [authRole, setAuthRole] = useState('teacher');
  const [selectedSchoolId, setSelectedSchoolId] = useState(SCHOOLS[0].id);
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [teacherTab, setTeacherTab] = useState('home');
  const [gcmTab, setGcmTab] = useState('dashboard');

  const [selectedType, setSelectedType] = useState(INCIDENT_TYPES[0].label);
  const [silentMode, setSilentMode] = useState(false);
  const [description, setDescription] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);

  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameraSchool, setCameraSchool] = useState(null);
  const [operatorNote, setOperatorNote] = useState('');
  const [occurrenceFilter, setOccurrenceFilter] = useState('all');

  const holdTimerRef = useRef(null);
  const watchRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const entries = await AsyncStorage.multiGet([
          STORAGE_KEYS.SESSION,
          STORAGE_KEYS.TEACHERS,
          STORAGE_KEYS.INCIDENTS,
          STORAGE_KEYS.OFFICERS,
          STORAGE_KEYS.THEME,
        ]);
        const values = Object.fromEntries(entries);
        if (!mounted) return;
        if (values[STORAGE_KEYS.SESSION]) setSession(JSON.parse(values[STORAGE_KEYS.SESSION]));
        if (values[STORAGE_KEYS.TEACHERS]) setTeachers(JSON.parse(values[STORAGE_KEYS.TEACHERS]));
        if (values[STORAGE_KEYS.INCIDENTS]) setIncidents(JSON.parse(values[STORAGE_KEYS.INCIDENTS]));
        if (values[STORAGE_KEYS.OFFICERS]) setOfficers(JSON.parse(values[STORAGE_KEYS.OFFICERS]));
        if (values[STORAGE_KEYS.THEME]) setThemeMode(values[STORAGE_KEYS.THEME]);
        try {
          const bootstrap = await apiRequest('/api/bootstrap');
          if (!mounted) return;
          if (Array.isArray(bootstrap.schools) && bootstrap.schools.length) {
            setSchools(bootstrap.schools);
            setSelectedSchoolId((current) => bootstrap.schools.some((school) => school.id === current) ? current : bootstrap.schools[0].id);
          }
          if (Array.isArray(bootstrap.teachers) && bootstrap.teachers.length) setTeachers(bootstrap.teachers);
          if (Array.isArray(bootstrap.officers) && bootstrap.officers.length) setOfficers(bootstrap.officers);
          if (Array.isArray(bootstrap.incidents)) setIncidents(bootstrap.incidents);
        } catch (apiError) {
          // Se o backend estiver offline, o app continua usando os dados demo locais.
        }
      } catch (error) {
        // mantém defaults
      } finally {
        if (mounted) setReady(true);
      }
    }

    async function initLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          setLocationPermission('denied');
          setCurrentAddress('Permissão de localização negada.');
          return;
        }
        setLocationPermission('granted');
        const current = await Location.getCurrentPositionAsync({});
        if (!mounted || !current?.coords) return;
        const nextCoords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setCurrentCoords(nextCoords);
        setCurrentAddress(`Lat ${current.coords.latitude.toFixed(5)} • Lon ${current.coords.longitude.toFixed(5)}`);
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10 },
          (position) => {
            const updated = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            };
            setCurrentCoords(updated);
            setCurrentAddress(`Lat ${position.coords.latitude.toFixed(5)} • Lon ${position.coords.longitude.toFixed(5)}`);
          }
        );
      } catch (error) {
        if (mounted) {
          setLocationPermission('denied');
          setCurrentAddress('Não foi possível obter sua localização.');
        }
      }
    }

    boot();
    initLocation();

    return () => {
      mounted = false;
      if (watchRef.current?.remove) watchRef.current.remove();
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.multiSet([
      [STORAGE_KEYS.SESSION, JSON.stringify(session)],
      [STORAGE_KEYS.TEACHERS, JSON.stringify(teachers)],
      [STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents)],
      [STORAGE_KEYS.OFFICERS, JSON.stringify(officers)],
      [STORAGE_KEYS.THEME, themeMode],
    ]).catch(() => {});
  }, [ready, session, teachers, incidents, officers, themeMode]);

  const teacher = useMemo(() => {
    if (session?.role !== 'teacher') return null;
    return teachers.find((item) => item.email.toLowerCase() === session.email?.toLowerCase()) || null;
  }, [session, teachers]);

  const officer = useMemo(() => {
    if (session?.role !== 'gcm') return null;
    return officers.find((item) => item.email.toLowerCase() === session.email?.toLowerCase()) || null;
  }, [session, officers]);

  const getSchoolByIdLocal = (schoolId) => schools.find((school) => school.id === schoolId) || null;

  const teacherSchool = useMemo(() => (teacher ? getSchoolByIdLocal(teacher.schoolId) : null), [teacher, schools]);

  const teacherIncidents = useMemo(() => {
    if (!teacher) return [];
    return incidents.filter((item) => item.personEmail.toLowerCase() === teacher.email.toLowerCase()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [teacher, incidents]);

  const activeTeacherIncident = useMemo(() => teacherIncidents.find((item) => item.status !== 'Encerrado') || null, [teacherIncidents]);

  const selectedSchoolIncidents = useMemo(() => {
    if (!selectedSchool) return [];
    return incidents.filter((item) => item.schoolId === selectedSchool.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [selectedSchool, incidents]);

  useEffect(() => {
    if (!teacher || !activeTeacherIncident) return;
    if (!currentCoords?.latitude || !currentCoords?.longitude) return;
    setIncidents((prev) =>
      prev.map((item) => {
        if (item.id !== activeTeacherIncident.id) return item;
        const route = [...(item.route || []), { latitude: currentCoords.latitude, longitude: currentCoords.longitude }].slice(-18);
        return {
          ...item,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          updatedAt: Date.now(),
          route,
        };
      })
    );
  }, [currentCoords.latitude, currentCoords.longitude]);

  useEffect(() => {
    if (!selectedIncident) return;
    const latest = incidents.find((item) => item.id === selectedIncident.id);
    if (latest) setSelectedIncident(latest);
  }, [incidents, selectedIncident?.id]);

  const toggleTheme = () => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const setDemoProfessor = () => {
    setSelectedSchoolId('sch-1');
    setLoginName('Marina Lopes');
    setLoginEmail('diretora@aurora.edu.br');
    setLoginPassword('123456');
  };

  const setDemoGcm = () => {
    setLoginName('Marcos Vinícius Lima');
    setLoginEmail('operador@gcm.sp.gov.br');
    setLoginPassword('123456');
  };

  const setDemoVortex = () => {
    setLoginName('Administrador Vortex7');
    setLoginEmail(VORTEX_MASTER_EMAIL);
    setLoginPassword(VORTEX_MASTER_PASSWORD);
  };

  const handleLogin = async () => {
    const trimmedName = loginName.trim();
    const trimmedEmail = loginEmail.trim().toLowerCase();
    const typedPassword = loginPassword.trim();

    if (!trimmedName || !trimmedEmail || !typedPassword) {
      Alert.alert('Dados incompletos', 'Preencha nome, email e senha para entrar.');
      return;
    }

    setLoginLoading(true);
    try {
      const auth = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role: 'teacher', name: trimmedName, email: trimmedEmail, password: typedPassword, schoolId: selectedSchoolId }),
        timeoutMs: 7000,
      });

      if (auth?.role === 'teacher' && auth?.user) {
        if (auth.teacher) {
          setTeachers((prev) => prev.some((item) => item.id === auth.teacher.id) ? prev : [auth.teacher, ...prev]);
        }
        setSession({ role: 'teacher', name: auth.user.name, email: auth.user.email, schoolId: auth.user.schoolId, token: auth.token });
        setTeacherTab('home');
        return;
      }

      Alert.alert('Acesso mobile bloqueado', 'Este aplicativo aceita somente contas de escola. GCM e Vortex7 acessam pelo painel web.');
      return;
    } catch (apiError) {
      // Se o backend estiver desligado ou inacessível no Expo Go, tenta o login local demo.
      const school = getSchoolByIdLocal(selectedSchoolId);
      if (!school) {
        Alert.alert('Escola não encontrada', 'Selecione uma escola válida para entrar.');
        return;
      }

      if (!trimmedEmail.endsWith(school.domain)) {
        Alert.alert('Email institucional inválido', `Use um email com o domínio ${school.domain}.`);
        return;
      }

      const existing = teachers.find((item) => item.email.toLowerCase() === trimmedEmail && item.schoolId === school.id);
      if (!existing) {
        Alert.alert('Login não encontrado', 'Crie este acesso no Painel Vortex7 web. Se o login já existe, confira se o backend está rodando.');
        return;
      }

      if (String(existing.password || '123456') !== typedPassword) {
        Alert.alert('Senha incorreta', 'Confira a senha criada no Painel Vortex7.');
        return;
      }

      setSession({ role: 'teacher', name: existing.name || trimmedName, email: trimmedEmail, schoolId: existing.schoolId });
      setTeacherTab('home');
    } finally {
      setLoginLoading(false);
    }
  };


  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({ role: 'teacher', name: '', email: '', password: '123456', schoolId: schools[0]?.id || 'sch-1', phone: '', department: 'Direção Escolar' });
  };

  const editPanelUser = (role, user) => {
    setEditingUser({ role, id: user.id });
    setUserForm({
      role,
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      password: user.password || '123456',
      schoolId: user.schoolId || schools[0]?.id || 'sch-1',
      phone: user.phone || '',
      department: role === 'gcm' ? (user.rank || user.department || 'Operador da GCM') : (user.department || 'Direção Escolar'),
    });
  };

  const savePanelUser = async () => {
    const payload = { ...userForm, name: userForm.name.trim(), email: userForm.email.trim().toLowerCase(), password: userForm.password.trim() || '123456' };
    if (!payload.name || !payload.email) {
      Alert.alert('Dados incompletos', 'Informe nome, email e senha do novo login.');
      return;
    }
    if (payload.role === 'teacher') {
      const school = getSchoolByIdLocal(payload.schoolId);
      if (!school) return Alert.alert('Escola inválida', 'Selecione uma escola para esta diretora.');
      if (!payload.email.endsWith(school.domain)) return Alert.alert('Email institucional inválido', `Use um email com o domínio ${school.domain}.`);
    }
    if (payload.role === 'gcm' && !payload.email.endsWith(GCM_DOMAIN)) {
      return Alert.alert('Email da GCM inválido', `Use um email com o domínio ${GCM_DOMAIN}.`);
    }

    try {
      if (editingUser) {
        const updated = await apiRequest(`/api/admin/users/${editingUser.role}/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (editingUser.role === 'teacher') setTeachers((prev) => prev.map((item) => item.id === editingUser.id ? updated : item));
        if (editingUser.role === 'gcm') setOfficers((prev) => prev.map((item) => item.id === editingUser.id ? updated : item));
      } else {
        const created = await apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
        if (created.role === 'teacher') setTeachers((prev) => [created.user, ...prev]);
        if (created.role === 'gcm') setOfficers((prev) => [created.user, ...prev]);
      }
    } catch (error) {
      // Fallback local para continuar testando mesmo sem backend.
      if (editingUser) {
        if (editingUser.role === 'teacher') setTeachers((prev) => prev.map((item) => item.id === editingUser.id ? { ...item, ...payload } : item));
        if (editingUser.role === 'gcm') setOfficers((prev) => prev.map((item) => item.id === editingUser.id ? { ...item, ...payload, rank: payload.department } : item));
      } else if (payload.role === 'teacher') {
        setTeachers((prev) => [{ id: makeId('teacher'), ...payload, emergencyContact: 'Não informado' }, ...prev]);
      } else {
        setOfficers((prev) => [{ id: makeId('gcm'), name: payload.name, email: payload.email, password: payload.password, rank: payload.department || 'Operador da GCM', badge: `GCM-${String(prev.length + 1200).padStart(5, '0')}`, unit: 'Base Integrada de Monitoramento', phone: payload.phone || '', bloodType: 'Não informado', birthDate: 'Não informado', cpf: 'Não informado', rg: 'Não informado', serviceNumber: `ESC-${new Date().getFullYear()}-${String(prev.length + 1).padStart(3, '0')}`, shift: 'Não informado', address: 'Não informado', emergencyContact: 'Não informado', qualification: 'Monitoramento operacional', medicalNotes: 'Sem observações' }, ...prev]);
      }
    }
    Alert.alert('Painel Vortex7', editingUser ? 'Login atualizado com sucesso.' : 'Novo login criado com sucesso.');
    resetUserForm();
  };

  const deletePanelUser = async (role, user) => {
    try {
      await apiRequest(`/api/admin/users/${role}/${user.id}`, { method: 'DELETE' });
    } catch (error) {
      // Fallback local.
    }
    if (role === 'teacher') setTeachers((prev) => prev.filter((item) => item.id !== user.id));
    if (role === 'gcm') setOfficers((prev) => prev.filter((item) => item.id !== user.id));
    Alert.alert('Login removido', `${user.name} foi removido do painel.`);
    if (editingUser?.id === user.id) resetUserForm();
  };

  const logout = () => {
    setSession(null);
    setLoginName('');
    setLoginEmail('');
    setLoginPassword('');
    setSelectedIncident(null);
    setSelectedSchool(null);
    setSelectedCamera(null);
    setCameraSchool(null);
    setTeacherTab('home');
    setGcmTab('dashboard');
  };

  const triggerAlert = () => {
    if (!teacher || !teacherSchool) return;
    if (activeTeacherIncident) {
      Alert.alert('Alerta já ativo', 'Este usuário já possui um chamado em andamento.');
      return;
    }
    const typeMeta = getTypeMeta(silentMode ? 'Botão silencioso' : selectedType);
    const nextNumber = incidents.length + 100;
    const now = Date.now();
    const newIncident = {
      id: makeId('incident'),
      protocol: makeProtocol(nextNumber),
      schoolId: teacherSchool.id,
      schoolName: teacherSchool.name,
      personName: teacher.name,
      personEmail: teacher.email,
      type: silentMode ? 'Botão silencioso' : selectedType,
      priority: silentMode ? 'Crítica' : typeMeta.priority,
      status: 'Novo',
      description: description.trim() || 'Alerta gerado pelo botão de pânico.',
      silentMode,
      createdAt: now,
      updatedAt: now,
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
      note: '',
      unitSent: '',
      eta: 0,
      route: [{ latitude: currentCoords.latitude, longitude: currentCoords.longitude }],
    };
    setIncidents((prev) => [newIncident, ...prev]);
    setDescription('');
    setSilentMode(false);
    setSelectedIncident(newIncident);
    Alert.alert('Alerta enviado', `O protocolo ${newIncident.protocol} foi encaminhado à central.`);
  };

  const startHold = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    let progress = 0;
    setHoldProgress(0);
    holdTimerRef.current = setInterval(() => {
      progress += 10;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        setHoldProgress(100);
        triggerAlert();
      }
    }, 200);
  };

  const stopHold = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
    setHoldProgress(0);
  };

  const openSchool = (school) => setSelectedSchool(school);
  const openCamera = (school, camera) => {
    setCameraSchool(school);
    setSelectedCamera(camera);
  };
  const openIncident = (incident) => {
    setSelectedIncident(incident);
    setOperatorNote(incident.note || '');
  };

  const updateIncident = (incidentId, partial) => {
    setIncidents((prev) => prev.map((item) => (item.id === incidentId ? { ...item, ...partial, updatedAt: Date.now() } : item)));
  };

  const handleAnalyzeIncident = () => {
    if (!selectedIncident) return;
    updateIncident(selectedIncident.id, { status: 'Em análise', note: operatorNote });
  };

  const handleDispatchUnit = () => {
    if (!selectedIncident) return;
    updateIncident(selectedIncident.id, {
      status: 'Viatura enviada',
      unitSent: selectedIncident.unitSent || randomUnit(),
      eta: selectedIncident.eta || randomEta(),
      note: operatorNote,
    });
  };

  const handleSaveNote = () => {
    if (!selectedIncident) return;
    updateIncident(selectedIncident.id, { note: operatorNote });
    Alert.alert('Observação salva', 'A ocorrência foi atualizada com a anotação da central.');
  };

  const handleCloseIncident = () => {
    if (!selectedIncident) return;
    updateIncident(selectedIncident.id, { status: 'Encerrado', eta: 0, note: operatorNote || 'Ocorrência encerrada pela central.' });
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ExpoStatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingTitle}>Alerta Segurança V14</Text>
          <Text style={styles.loadingSubtitle}>Inicializando app mobile da escola...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <StatusBar barStyle={themeMode === 'light' ? 'dark-content' : 'light-content'} />

      {!session ? (
        <LoginScreen
          authRole={authRole}
          setAuthRole={setAuthRole}
          selectedSchoolId={selectedSchoolId}
          setSelectedSchoolId={setSelectedSchoolId}
          loginName={loginName}
          setLoginName={setLoginName}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          loginLoading={loginLoading}
          handleLogin={handleLogin}
          schools={schools}
          setDemoProfessor={setDemoProfessor}
          setDemoGcm={setDemoGcm}
          setDemoVortex={setDemoVortex}
          mode={themeMode}
          toggleTheme={toggleTheme}
          styles={styles}
          theme={theme}
        />
      ) : session.role === 'teacher' && teacher && teacherSchool ? (
        <View style={styles.appBody}>
          {teacherTab === 'home' ? <TeacherHome school={teacherSchool} teacher={teacher} activeIncident={activeTeacherIncident} currentAddress={currentAddress} selectedType={selectedType} onSelectType={setSelectedType} silentMode={silentMode} setSilentMode={setSilentMode} description={description} setDescription={setDescription} onTrigger={{ start: startHold, stop: stopHold }} holdProgress={holdProgress} permissionGranted={locationPermission === 'granted'} mode={themeMode} toggleTheme={toggleTheme} styles={styles} theme={theme} /> : null}
          {teacherTab === 'alerts' ? <TeacherAlerts incidents={teacherIncidents} onOpen={openIncident} styles={styles} theme={theme} /> : null}
          {teacherTab === 'school' ? <TeacherSchool school={teacherSchool} incidents={teacherIncidents} onOpenCamera={openCamera} styles={styles} theme={theme} /> : null}
          {teacherTab === 'profile' ? <TeacherProfile teacher={teacher} school={teacherSchool} mode={themeMode} toggleTheme={toggleTheme} onLogout={logout} styles={styles} theme={theme} /> : null}
          <BottomTabs items={PROFESSOR_TABS} current={teacherTab} onChange={setTeacherTab} styles={styles} theme={theme} />
        </View>
      ) : (
        <View style={styles.appBody}>
          <SectionCard title="Acesso web necessário" subtitle="Painel Vortex7 e Central GCM foram removidos do app mobile. Use o navegador no computador." styles={styles}>
            <Image source={VORTEX_SYMBOL} style={styles.vortexSymbol} resizeMode="contain" />
            <Text style={styles.bodyText}>Painel Vortex7: https://api.vortex7.com.br/vortex</Text>
            <Text style={styles.bodyText}>Central GCM: https://api.vortex7.com.br/gcm</Text>
            <Pressable style={styles.primaryButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Voltar ao login</Text>
            </Pressable>
          </SectionCard>
        </View>
      )}

      <Modal visible={!!selectedIncident} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedIncident?.protocol}</Text>
                <Text style={styles.modalSubtitle}>{selectedIncident?.schoolName}</Text>
              </View>
              <Pressable onPress={() => setSelectedIncident(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedIncident ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                <InfoRow label="Pessoa" value={selectedIncident.personName} styles={styles} />
                <InfoRow label="Email" value={selectedIncident.personEmail} styles={styles} />
                <InfoRow label="Tipo" value={selectedIncident.type} styles={styles} />
                <InfoRow label="Prioridade" value={selectedIncident.priority} styles={styles} />
                <InfoRow label="Status" value={selectedIncident.status} styles={styles} />
                <InfoRow label="Criado em" value={formatDateTime(selectedIncident.createdAt)} styles={styles} />
                <InfoRow label="Última posição" value={`Lat ${selectedIncident.latitude.toFixed(5)} • Lon ${selectedIncident.longitude.toFixed(5)}`} styles={styles} />
                {selectedIncident.unitSent ? <InfoRow label="Viatura" value={selectedIncident.unitSent} styles={styles} /> : null}
                {selectedIncident.eta ? <InfoRow label="ETA" value={`${selectedIncident.eta} min`} styles={styles} /> : null}
                <SectionCard title="Descrição" styles={styles}>
                  <Text style={styles.bodyText}>{selectedIncident.description}</Text>
                </SectionCard>
                <SectionCard title="Rota registrada" subtitle="Últimos pontos enviados durante o alerta." styles={styles}>
                  <MapView style={styles.modalMap} initialRegion={{ latitude: selectedIncident.latitude, longitude: selectedIncident.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}>
                    <Marker coordinate={{ latitude: selectedIncident.latitude, longitude: selectedIncident.longitude }} title={selectedIncident.protocol} />
                    {selectedIncident.route && selectedIncident.route.length > 1 ? <Polyline coordinates={selectedIncident.route} strokeColor={theme.primary} strokeWidth={3} /> : null}
                  </MapView>
                </SectionCard>
                <SectionCard title="Anotação da central" styles={styles}>
                  <TextInput value={operatorNote} onChangeText={setOperatorNote} multiline placeholder="Registre o andamento da ocorrência." placeholderTextColor={theme.muted} style={styles.textArea} />
                </SectionCard>
                <View style={styles.modalActionsWrap}>
                  <Pressable style={styles.secondaryButtonWide} onPress={handleAnalyzeIncident}>
                    <Ionicons name="search-outline" size={18} color={theme.text} />
                    <Text style={styles.secondaryButtonText}>Em análise</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonWide} onPress={handleDispatchUnit}>
                    <Ionicons name="car-outline" size={18} color={theme.text} />
                    <Text style={styles.secondaryButtonText}>Enviar viatura</Text>
                  </Pressable>
                </View>
                <View style={styles.modalActionsWrap}>
                  <Pressable style={styles.secondaryButtonWide} onPress={handleSaveNote}>
                    <Ionicons name="save-outline" size={18} color={theme.text} />
                    <Text style={styles.secondaryButtonText}>Salvar nota</Text>
                  </Pressable>
                  <Pressable style={styles.dangerButtonWide} onPress={handleCloseIncident}>
                    <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                    <Text style={styles.primaryButtonText}>Encerrar</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedSchool} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedSchool?.name}</Text>
                <Text style={styles.modalSubtitle}>{selectedSchool?.address}</Text>
              </View>
              <Pressable onPress={() => setSelectedSchool(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedSchool ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                <InfoRow label="Direção" value={selectedSchool.principal} styles={styles} />
                <InfoRow label="Telefone" value={selectedSchool.phone} styles={styles} />
                <InfoRow label="Domínio" value={selectedSchool.domain} styles={styles} />
                <SectionCard title="Mapa da unidade" styles={styles}>
                  <MapView style={styles.modalMap} initialRegion={{ latitude: selectedSchool.coords.latitude, longitude: selectedSchool.coords.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}>
                    <Marker coordinate={selectedSchool.coords} title={selectedSchool.name} description={selectedSchool.address} pinColor={theme.blue} />
                    {selectedSchoolIncidents.filter((item) => item.status !== 'Encerrado').map((item) => (
                      <Marker key={item.id} coordinate={{ latitude: item.latitude, longitude: item.longitude }} title={item.protocol} description={item.personName} pinColor={item.priority === 'Crítica' ? theme.red : theme.amber} />
                    ))}
                  </MapView>
                </SectionCard>
                <SectionCard title="Ocorrências da escola" subtitle="Chamados ligados a esta unidade." styles={styles}>
                  {selectedSchoolIncidents.length ? selectedSchoolIncidents.map((incident) => <IncidentCard key={incident.id} incident={incident} compact onPress={() => openIncident(incident)} styles={styles} theme={theme} />) : <EmptyState icon="checkmark-circle-outline" title="Sem ocorrências" subtitle="Nenhum chamado ligado a esta escola até agora." styles={styles} theme={theme} />}
                </SectionCard>
                <SectionCard title="Câmeras da unidade" styles={styles}>
                  <View style={styles.cameraGrid}>
                    {selectedSchool.cameras.map((camera) => <CameraCard key={camera.id} camera={camera} onPress={() => openCamera(selectedSchool, camera)} styles={styles} theme={theme} />)}
                  </View>
                </SectionCard>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedCamera} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedCamera?.name}</Text>
                <Text style={styles.modalSubtitle}>{cameraSchool?.name} • {selectedCamera?.zone}</Text>
              </View>
              <Pressable onPress={() => setSelectedCamera(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            {selectedCamera ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                {selectedCamera.streamUrl && selectedCamera.status === 'online' ? (
                  <View style={styles.cameraPlayerWrap}>
                    <WebView
                      source={{ uri: selectedCamera.streamUrl }}
                      style={styles.cameraWebView}
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction={false}
                      javaScriptEnabled
                      domStorageEnabled
                      startInLoadingState
                      renderLoading={() => (
                        <View style={styles.cameraLoadingOverlay}>
                          <Text style={styles.cameraModalPreviewSmall}>Carregando câmera...</Text>
                        </View>
                      )}
                    />
                  </View>
                ) : (
                  <View style={styles.cameraModalPreview}>
                    <View style={[styles.cameraLiveDot, { backgroundColor: selectedCamera.status === 'online' ? theme.red : theme.slate }]} />
                    <Text style={styles.cameraModalPreviewText}>{selectedCamera.status === 'online' ? 'STREAM AO VIVO' : 'CÂMERA OFFLINE'}</Text>
                    <Text style={styles.cameraModalPreviewSmall}>Escola: {cameraSchool?.name}</Text>
                    <Text style={styles.cameraModalPreviewSmall}>Zona: {selectedCamera.zone}</Text>
                  </View>
                )}
                <InfoRow label="Status" value={selectedCamera.status === 'online' ? 'Online' : 'Offline'} styles={styles} />
                <InfoRow label="Escola" value={cameraSchool?.name || '--'} styles={styles} />
                <InfoRow label="Área" value={selectedCamera.zone} styles={styles} />
                <InfoRow label="IP da câmera" value={selectedCamera.ip || 'Não configurado'} styles={styles} />
                <InfoRow label="Protocolo" value={selectedCamera.protocol || 'RTSP/ONVIF'} styles={styles} />
                <InfoRow label="URL do player" value={selectedCamera.streamUrl || 'Não configurada'} styles={styles} />
                <InfoRow label="Última checagem" value={formatDateTime(Date.now())} styles={styles} />
                <SectionCard title="Integração real ativa" subtitle="O app agora abre o player WebRTC/HLS do go2rtc dentro da tela de câmeras." styles={styles}>
                  <Text style={styles.bodyText}>Para funcionar no celular fora da rede local, o gateway precisa estar ligado com go2rtc e Cloudflare Tunnel ativos. A câmera real fica protegida atrás do servidor de streaming; o app não acessa RTSP diretamente.</Text>
                </SectionCard>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
