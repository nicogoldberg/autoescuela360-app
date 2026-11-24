// Autoescuela 360 — app interna (socios, vendedores e instructores)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');

// ---------------------------------------------------------------- utilidades
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  let valor;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') valor = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (['checked', 'selected', 'disabled', 'required', 'open'].includes(k)) el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : String(k));
  }
  if (valor !== undefined) el.value = valor;
  return el;
}
const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const $$ = n => fmt.format(Math.round(Number(n) || 0));
const num = v => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aFecha = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const hoy = () => iso(new Date());
const sumarDias = (s, n) => { const d = aFecha(s); d.setDate(d.getDate() + n); return iso(d); };
const lunesDe = s => { const d = aFecha(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const dm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const dmy = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : '');
const hm = t => (t || '').slice(0, 5);
const finClase = c => { const [H, M] = hm(c.hora).split(':').map(Number); const t = H * 60 + M + (c.duracion_min || 60); return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };
const nombreMes = ym => { const s = aFecha(ym + '-01').toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const agrupar = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
const poner = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
function chk({ data, error }) { if (error) throw error; return data; }
function telWa(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = '549' + d;            // ej. 351 1234567
  else if (d.startsWith('0')) d = '549' + d.replace(/^0/, '').replace(/^(\d{2,4})15/, '$1');
  return 'https://wa.me/' + d;
}

const CATEGORIAS = ['Pago instructor', 'Comisión vendedor', 'Combustible', 'Mantenimiento auto',
  'Seguro / patente', 'Publicidad', 'Alquiler / cochera', 'Otros'];
const MEDIOS = ['Efectivo', 'Transferencia', 'Mercado Pago'];
const LUGARES = ['Nueva Córdoba (Parque Sarmiento)', 'Zona Norte (Parque del Kempes)', 'Domicilio', 'Examen municipal'];
const ESTADOS = { agendada: ['Agendada', 'c-azul'], dada: ['Dada', 'c-verde'], ausente: ['Ausente', 'c-amarillo'], cancelada: ['Cancelada', 'c-gris'] };
const ROLES = { pendiente: 'Pendiente', socio: 'Socio', vendedor: 'Vendedor', instructor: 'Instructor' };

// ---------------------------------------------------------------- estado
const S = {
  user: null, perfil: null, perfiles: [], cursos: [], ajustes: {},
  tab: null, semana: lunesDe(hoy()), filtroInstr: '', periodo: 'mes',
  ventasQ: '', ventasEstado: 'todas',
};
const rol = () => S.perfil?.rol;
const tarifaClase = () => Number(S.ajustes.pago_instructor_clase || 5000);
const comisionVenta = () => Number(S.ajustes.comision_venta || 8000);
const socios = () => (S.ajustes.socios || '').split(',').map(s => s.trim()).filter(Boolean);
const perfilesDe = r => S.perfiles.filter(p => p.rol === r && p.activo);

function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
function errorMsg(e) {
  const m = e?.message || String(e);
  if (/Invalid login/i.test(m)) return 'Mail o contraseña incorrectos.';
  if (/already registered/i.test(m)) return 'Ese mail ya tiene una cuenta. Iniciá sesión.';
  if (/Password should be/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (/row-level security/i.test(m)) return 'No tenés permiso para hacer eso.';
  if (/Email not confirmed/i.test(m)) return 'Primero confirmá tu mail (revisá tu casilla).';
  return m;
}
async function intentar(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { alert(errorMsg(e)); return false; }
}

function modal(titulo, ...contenido) {
  const d = h('dialog', {},
    h('div', { class: 'm-cab' }, h('b', {}, titulo), h('button', { class: 'x', type: 'button', onclick: () => d.close() }, '×')),
    h('div', { class: 'm-cuerpo' }, ...contenido));
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}
const campo = (label, input) => h('label', {}, label, input);
const sel = (name, opciones, valor, extra = {}) =>
  h('select', { name, value: valor ?? '', ...extra },
    opciones.map(o => Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o)));
const datos = form => Object.fromEntries(new FormData(form).entries());

// ---------------------------------------------------------------- login
function pantallaLogin(modo = 'entrar', aviso = null) {
  const esReg = modo === 'registro';
  const msg = h('div');
  if (aviso) msg.append(h('div', { class: aviso.tipo }, aviso.texto));
  const form = h('form', { class: 'f' },
    esReg && campo('Nombre (como te conocen en la autoescuela)', h('input', { name: 'nombre', required: true, autocomplete: 'name' })),
    campo('Mail', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
    campo('Contraseña', h('input', { name: 'password', type: 'password', required: true, minlength: 6, autocomplete: esReg ? 'new-password' : 'current-password' })),
    h('button', { class: 'btn amarillo', type: 'submit' }, esReg ? 'Crear cuenta' : 'Entrar'));
  form.onsubmit = async ev => {
    ev.preventDefault();
    const d = datos(form);
    msg.replaceChildren();
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      if (esReg) {
        const r = chk(await sb.auth.signUp({ email: d.email, password: d.password, options: { data: { nombre: d.nombre.trim() } } }));
        if (!r.session) return pantallaLogin('entrar', { tipo: 'ok', texto: 'Cuenta creada. Revisá tu mail para confirmarla y después entrá.' });
      } else {
        chk(await sb.auth.signInWithPassword({ email: d.email, password: d.password }));
      }
    } catch (e) { msg.append(h('div', { class: 'error' }, errorMsg(e))); btn.disabled = false; }
  };
  const olvido = async () => {
    const email = form.querySelector('[name=email]').value;
    if (!email) { msg.replaceChildren(h('div', { class: 'error' }, 'Escribí tu mail arriba y tocá de nuevo.')); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg.replaceChildren(h('div', { class: error ? 'error' : 'ok' }, error ? errorMsg(error) : 'Te mandamos un mail para cambiar la contraseña.'));
  };
  app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'caja' },
    h('div', { class: 'logo-grande' }, '360'),
    h('h1', {}, 'Autoescuela 360'),
    h('p', { class: 'sub' }, esReg ? 'Creá tu usuario' : 'Ingresá con tu usuario'),
    msg, form,
    h('p', { class: 'ayuda', style: 'text-align:center;margin-top:16px' },
      esReg ? '¿Ya tenés cuenta? ' : '¿Primera vez? ',
      h('button', { class: 'link', type: 'button', onclick: () => pantallaLogin(esReg ? 'entrar' : 'registro') }, esReg ? 'Entrar' : 'Crear cuenta')),
    !esReg && h('p', { class: 'ayuda', style: 'text-align:center' },
      h('button', { class: 'link', type: 'button', onclick: olvido }, 'Olvidé mi contraseña')))));
}

function nuevaContrasena() {
  const form = h('form', { class: 'f' },
    campo('Nueva contraseña', h('input', { name: 'p', type: 'password', minlength: 6, required: true })),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar'));
  const d = modal('Cambiar contraseña', form);
  form.onsubmit = async ev => {
    ev.preventDefault();
    if (await intentar(async () => chk(await sb.auth.updateUser({ password: datos(form).p })), 'Contraseña cambiada')) d.close();
  };
}

// ---------------------------------------------------------------- arranque
async function cargarBase() {
  const [p, c, a] = await Promise.all([
    sb.from('perfiles').select('*').order('nombre'),
    sb.from('cursos').select('*').order('orden').order('id'),
    sb.from('ajustes').select('*'),
  ]);
  S.perfiles = chk(p); S.cursos = chk(c);
  S.ajustes = Object.fromEntries(chk(a).map(x => [x.clave, x.valor]));
}

async function entrar(session) {
  S.user = session.user;
  app.replaceChildren(h('div', { class: 'cargando' }, 'Cargando…'));
  try {
    let perfil = null;
    for (let i = 0; i < 3 && !perfil; i++) {
      perfil = chk(await sb.from('perfiles').select('*').eq('id', S.user.id).maybeSingle());
      if (!perfil) await new Promise(r => setTimeout(r, 700));
    }
    S.perfil = perfil;
    if (!perfil || perfil.rol === 'pendiente' || !perfil.activo) return pantallaPendiente();
    await cargarBase();
    const tabs = TABS[rol()];
    if (!S.tab || !tabs.some(t => t[0] === S.tab)) S.tab = tabs[0][0];
    render();
  } catch (e) {
    app.replaceChildren(h('main', {}, h('div', { class: 'error' }, 'No se pudo cargar: ' + errorMsg(e)),
      h('p', {}, h('button', { class: 'btn', onclick: () => location.reload() }, 'Reintentar'))));
  }
}

function pantallaPendiente() {
  app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'caja' },
    h('div', { class: 'logo-grande' }, '360'),
    h('h1', {}, `Hola${S.perfil ? ', ' + S.perfil.nombre : ''}`),
    h('p', { class: 'sub' }, 'Tu cuenta está creada. Falta que un socio te dé acceso (vendedor o instructor) desde la sección Equipo.'),
    h('div', { class: 'acciones', style: 'justify-content:center' },
      h('button', { class: 'btn', onclick: () => location.reload() }, 'Ya me dieron acceso'),
      h('button', { class: 'btn sec', onclick: () => sb.auth.signOut() }, 'Salir')))));
}

const TABS = {
  socio: [['resumen', 'Resumen'], ['calendario', 'Calendario'], ['ventas', 'Ventas'], ['gastos', 'Gastos'],
    ['pagos', 'Pagos a realizar'], ['cobros', 'Cobros'], ['retiros', 'Retiros'], ['equipo', 'Equipo'], ['ajustes', 'Ajustes']],
  vendedor: [['calendario', 'Calendario'], ['nueva', 'Nueva venta'], ['misventas', 'Mis ventas'], ['mispagos', 'Mis comisiones']],
  instructor: [['calendario', 'Mis clases'], ['mispagos', 'Mis pagos']],
};

async function render() {
  const tabs = TABS[rol()];
  const main = h('main', {}, h('div', { class: 'cargando' }, 'Cargando…'));
  app.replaceChildren(
    h('header', { class: 'top' },
      h('div', { class: 'top-fila' },
        h('div', { class: 'marca' }, h('div', { class: 'logo' }, '360'), 'Autoescuela 360'),
        h('div', { class: 'quien' }, `${S.perfil.nombre} · ${ROLES[rol()]}`, h('br'),
          h('button', { onclick: nuevaContrasena }, 'Contraseña'), ' · ',
          h('button', { onclick: () => sb.auth.signOut() }, 'Salir'))),
      h('nav', { class: 'tabs' }, tabs.map(([k, l]) =>
        h('button', { class: S.tab === k ? 'on' : '', onclick: () => { S.tab = k; render(); } }, l)))),
    main);
  document.querySelector('nav.tabs button.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  try { await VISTAS[S.tab](main); }
  catch (e) { poner(main, h('div', { class: 'error' }, 'Error: ' + errorMsg(e))); }
}
const recargar = () => render();

// ---------------------------------------------------------------- calendario
async function vCalendario(main) {
  const ini = S.semana, fin = sumarDias(ini, 6);
  const clases = chk(await sb.from('clases').select('*').gte('fecha', ini).lte('fecha', fin).order('fecha').order('hora'));
  const agenda = ['socio', 'vendedor'].includes(rol());
  const instrNombres = [...new Set([...perfilesDe('instructor').map(p => p.nombre), ...clases.map(c => c.instructor_nombre).filter(Boolean)])].sort();
  const visibles = clases.filter(c => !S.filtroInstr || c.instructor_nombre === S.filtroInstr);
  const porDia = agrupar(visibles, c => c.fecha);
  const lista = h('div');

  const dias = [...Array(7)].map((_, i) => sumarDias(ini, i));
  const chips = h('div', { class: 'dias' }, dias.map(d => {
    const n = (porDia[d] || []).filter(c => c.estado !== 'cancelada').length;
    return h('div', { class: 'dia-chip' + (d === hoy() ? ' hoy' : ''), onclick: () => document.getElementById('d' + d)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
      h('div', { class: 'd' }, aFecha(d).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')),
      h('div', { class: 'n' }, aFecha(d).getDate()),
      h('div', { class: 'c' }, n ? `${n} cl.` : ''));
  }));

  for (const d of dias) {
    const del = porDia[d] || [];
    lista.append(h('div', { class: 'dia-tit', id: 'd' + d, style: 'scroll-margin-top:120px' },
      aFecha(d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })));
    if (!del.length) lista.append(h('div', { class: 'ayuda', style: 'margin-bottom:6px' }, 'Sin clases'));
    for (const c of del) {
      lista.append(h('div', { class: 'clase ' + c.estado, onclick: () => agenda ? formClase(c) : modalEstadoClase(c) },
        h('div', { class: 'hora' }, hm(c.hora), h('small', {}, finClase(c))),
        h('div', { class: 'info' },
          h('b', {}, c.alumno),
          h('span', {}, [c.instructor_nombre || 'Sin instructor', c.lugar].filter(Boolean).join(' · '))),
        h('div', {}, h('span', { class: 'chip ' + ESTADOS[c.estado][1] }, ESTADOS[c.estado][0]))));
    }
  }

  poner(main, 
    h('div', { class: 'semana-nav' },
      h('button', { class: 'btn sec chico', onclick: () => { S.semana = sumarDias(S.semana, -7); recargar(); } }, '‹'),
      h('div', { class: 'tit' }, `${dm(ini)} al ${dm(fin)}`),
      h('button', { class: 'btn sec chico', onclick: () => { S.semana = sumarDias(S.semana, 7); recargar(); } }, '›'),
      h('button', { class: 'btn sec chico', onclick: () => { S.semana = lunesDe(hoy()); recargar(); } }, 'Hoy')),
    chips,
    agenda && instrNombres.length > 0 && h('div', { class: 'buscar' },
      sel('', [['', 'Todos los instructores'], ...instrNombres.map(n => [n, n])], S.filtroInstr,
        { onchange: e => { S.filtroInstr = e.target.value; recargar(); } })),
    rol() === 'instructor' && h('p', { class: 'ayuda' }, 'Tocá una clase para marcarla como dada o ausente.'),
    lista,
    agenda && h('button', { class: 'fab', onclick: () => formClase(null, { fecha: S.semana <= hoy() && hoy() <= fin ? hoy() : ini }) }, '+ Clase'));
}

async function formClase(clase, pre = {}) {
  const c = clase || { fecha: pre.fecha || hoy(), hora: '', duracion_min: 60, estado: 'agendada', lugar: '', alumno: pre.alumno || '', telefono: pre.telefono || '', venta_id: pre.venta_id || null };
  const ventas = chk(await sb.from('ventas').select('id,alumno,curso,telefono,clases,fecha').order('fecha', { ascending: false }).limit(400));
  const instructores = perfilesDe('instructor');
  const enLista = !c.instructor_nombre || instructores.some(p => p.id === c.instructor_id);
  const uso = h('div', { class: 'ayuda' });
  const otroInstr = h('input', { name: 'instr_otro', placeholder: 'Nombre del instructor', value: enLista ? '' : c.instructor_nombre, style: enLista ? 'display:none' : '' });

  const form = h('form', { class: 'f' },
    campo('Venta / alumno', sel('venta_id', [['', '— Sin venta asociada —'], ...ventas.map(v => [String(v.id), `${v.alumno} · ${v.curso}`])], c.venta_id ? String(c.venta_id) : '',
      { onchange: e => elegirVenta(e.target.value) })),
    uso,
    campo('Alumno', h('input', { name: 'alumno', required: true, value: c.alumno })),
    campo('Teléfono', h('input', { name: 'telefono', type: 'tel', value: c.telefono || '' })),
    h('div', { class: 'dos' },
      campo('Fecha', h('input', { name: 'fecha', type: 'date', required: true, value: c.fecha })),
      campo('Hora', h('input', { name: 'hora', type: 'time', required: true, step: 900, value: hm(c.hora) }))),
    h('div', { class: 'dos' },
      campo('Duración', sel('duracion_min', [['30', '30 min (1 clase)'], ['60', '1 hora (2 clases)'], ['90', '1 h 30'], ['120', '2 horas']], String(c.duracion_min))),
      campo('Lugar', sel('lugar', ['', ...new Set([...LUGARES, c.lugar].filter(Boolean))].map(l => [l, l || '—']), c.lugar))),
    campo('Instructor', sel('instructor', [['', '— Sin asignar —'], ...instructores.map(p => [p.id, p.nombre]), ['otro', 'Otro (escribir)']],
      c.instructor_id || (enLista ? '' : 'otro'), { onchange: e => { otroInstr.style.display = e.target.value === 'otro' ? '' : 'none'; } })),
    otroInstr,
    clase && campo('Estado', sel('estado', Object.entries(ESTADOS).map(([k, v]) => [k, v[0]]), c.estado)),
    campo('Notas', h('textarea', { name: 'notas', value: c.notas || '' })),
    h('div', { class: 'acciones' },
      h('button', { class: 'btn', type: 'submit' }, clase ? 'Guardar cambios' : 'Agendar clase'),
      clase && h('button', { class: 'btn peligro', type: 'button', onclick: borrar }, 'Borrar'),
      telWa(c.telefono) && h('a', { class: 'btn sec', href: telWa(c.telefono), target: '_blank', rel: 'noopener' }, 'WhatsApp')));

  async function elegirVenta(id) {
    uso.replaceChildren();
    const v = ventas.find(x => String(x.id) === id);
    if (!v) return;
    form.alumno.value = v.alumno;
    if (v.telefono) form.telefono.value = v.telefono;
    const cl = chk(await sb.from('clases').select('id,duracion_min,estado').eq('venta_id', v.id));
    const usadas = sum(cl.filter(x => x.estado !== 'cancelada' && x.id !== clase?.id), x => x.duracion_min) / 30;
    uso.append(`${v.curso}: ${usadas} de ${v.clases} clases de 30 min ya agendadas.`);
  }
  if (c.venta_id) elegirVenta(String(c.venta_id));

  async function borrar() {
    if (!confirm('¿Borrar esta clase del calendario?')) return;
    if (await intentar(async () => chk(await sb.from('clases').delete().eq('id', clase.id)), 'Clase borrada')) { d.close(); recargar(); }
  }

  const d = modal(clase ? 'Editar clase' : 'Agendar clase', form);
  form.onsubmit = async ev => {
    ev.preventDefault();
    const x = datos(form);
    const instrId = x.instructor && x.instructor !== 'otro' ? x.instructor : null;
    const instrNom = instrId ? (instructores.find(p => p.id === instrId)?.nombre || '') : (x.instructor === 'otro' ? x.instr_otro.trim() : '');
    const fila = {
      venta_id: x.venta_id ? Number(x.venta_id) : null, alumno: x.alumno.trim(), telefono: x.telefono.trim() || null,
      fecha: x.fecha, hora: x.hora, duracion_min: Number(x.duracion_min), lugar: x.lugar,
      instructor_id: instrId, instructor_nombre: instrNom, notas: x.notas.trim() || null,
    };
    if (clase) fila.estado = x.estado;
    // aviso de superposición del mismo instructor
    if (instrNom) {
      const mismas = chk(await sb.from('clases').select('id,alumno,hora,duracion_min,instructor_nombre,estado').eq('fecha', fila.fecha));
      const ini = toMin(fila.hora), fin = ini + fila.duracion_min;
      const choca = mismas.find(o => o.id !== clase?.id && o.estado !== 'cancelada' && o.instructor_nombre === instrNom &&
        toMin(o.hora) < fin && toMin(o.hora) + o.duracion_min > ini);
      if (choca && !confirm(`${instrNom} ya tiene clase con ${choca.alumno} a las ${hm(choca.hora)}. ¿Agendar igual?`)) return;
    }
    const ok = await intentar(async () => {
      if (clase) chk(await sb.from('clases').update(fila).eq('id', clase.id));
      else chk(await sb.from('clases').insert(fila));
    }, clase ? 'Clase actualizada' : 'Clase agendada');
    if (ok) {
      d.close();
      if (S.tab === 'calendario') { S.semana = lunesDe(fila.fecha); }
      recargar();
    }
  };
}
const toMin = t => { const [H, M] = hm(t).split(':').map(Number); return H * 60 + M; };

function modalEstadoClase(c) {
  const notas = h('textarea', { value: c.notas || '' });
  const guardar = async estado => {
    if (await intentar(async () => chk(await sb.from('clases').update({ estado, notas: notas.value.trim() || null }).eq('id', c.id)), 'Guardado')) { d.close(); recargar(); }
  };
  const d = modal(c.alumno,
    h('p', {}, h('b', {}, aFecha(c.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })), ` · ${hm(c.hora)} a ${finClase(c)}`),
    h('p', { class: 'ayuda' }, [c.lugar, c.telefono].filter(Boolean).join(' · ')),
    c.notas && h('p', {}, c.notas),
    h('form', { class: 'f', onsubmit: e => e.preventDefault() }, campo('Notas', notas)),
    h('div', { class: 'acciones' },
      h('button', { class: 'btn', onclick: () => guardar('dada') }, '✓ Dada'),
      h('button', { class: 'btn sec', onclick: () => guardar('ausente') }, 'Alumno ausente'),
      c.estado !== 'agendada' && h('button', { class: 'btn sec', onclick: () => guardar('agendada') }, 'Volver a agendada'),
      telWa(c.telefono) && h('a', { class: 'btn sec', href: telWa(c.telefono), target: '_blank', rel: 'noopener' }, 'WhatsApp')));
}

// ---------------------------------------------------------------- ventas
function opcionesRecibio() {
  return ['', ...new Set([...socios(), 'Cuenta empresa', ...(rol() === 'vendedor' ? [S.perfil.nombre] : [])])].map(x => [x, x || '—']);
}

function formVenta(onListo) {
  const esSocio = rol() === 'socio';
  const cursos = S.cursos.filter(c => c.activo);
  const vendedoresOpc = [...new Set([...socios(), ...perfilesDe('vendedor').map(p => p.nombre)])];
  const comInput = h('input', { name: 'comision', inputmode: 'numeric', value: '0' });
  const otroVend = h('input', { name: 'vend_otro', placeholder: 'Nombre del vendedor', style: 'display:none' });
  const ajustarComision = v => { comInput.value = (!v || socios().includes(v)) ? '0' : String(comisionVenta()); };
  const instructores = perfilesDe('instructor');

  const form = h('form', { class: 'f' },
    esSocio && campo('Fecha de venta', h('input', { name: 'fecha', type: 'date', value: hoy(), required: true })),
    campo('Nombre y apellido del alumno', h('input', { name: 'alumno', required: true, autocapitalize: 'words' })),
    campo('Teléfono', h('input', { name: 'telefono', type: 'tel', placeholder: '351 …' })),
    campo('Curso', sel('curso_id', [['', 'Elegí el curso…'], ...cursos.map(c => [String(c.id), `${c.nombre} — ${$$(c.precio)}`])], '', { required: true })),
    esSocio && h('div', { class: 'dos' },
      campo('Vendió', sel('vendedor', [['', '—'], ...vendedoresOpc.map(n => [n, n]), ['otro', 'Otro']], S.perfil.nombre,
        { onchange: e => { otroVend.style.display = e.target.value === 'otro' ? '' : 'none'; ajustarComision(e.target.value === 'otro' ? 'x' : e.target.value); } })),
      campo('Comisión', comInput)),
    esSocio && otroVend,
    h('hr', { class: 'sep' }),
    h('b', {}, 'Seña o pago (opcional)'),
    h('div', { class: 'tres' },
      campo('Monto', h('input', { name: 'sena', inputmode: 'numeric', placeholder: '0' })),
      campo('Medio', sel('medio', MEDIOS, 'Efectivo')),
      campo('Recibió', sel('recibio', opcionesRecibio(), ''))),
    h('hr', { class: 'sep' }),
    h('b', {}, 'Primer encuentro (opcional)'),
    h('div', { class: 'dos' },
      campo('Fecha', h('input', { name: 'c_fecha', type: 'date' })),
      campo('Hora', h('input', { name: 'c_hora', type: 'time', step: 900 }))),
    h('div', { class: 'dos' },
      campo('Instructor', sel('c_instr', [['', '— Sin asignar —'], ...instructores.map(p => [p.id, p.nombre])], '')),
      campo('Lugar', sel('c_lugar', ['', ...LUGARES].map(l => [l, l || '—']), ''))),
    campo('Notas', h('textarea', { name: 'notas', placeholder: 'Ej: paga en efectivo, prefiere mañanas…' })),
    h('button', { class: 'btn amarillo', type: 'submit' }, 'Guardar venta'));
  if (esSocio) ajustarComision(S.perfil.nombre);

  form.onsubmit = async ev => {
    ev.preventDefault();
    const x = datos(form);
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const venta = { alumno: x.alumno.trim(), telefono: x.telefono.trim() || null, curso_id: Number(x.curso_id), notas: x.notas.trim() || null };
      if (esSocio) {
        venta.fecha = x.fecha;
        const vnom = x.vendedor === 'otro' ? x.vend_otro.trim() : x.vendedor;
        const vp = perfilesDe('vendedor').find(p => p.nombre === vnom) || S.perfiles.find(p => p.nombre === vnom && p.rol === 'socio');
        venta.vendedor_id = vp?.id || null;
        venta.vendedor_nombre = vnom || '';
        venta.comision = num(x.comision);
      }
      const v = chk(await sb.from('ventas').insert(venta).select().single());
      const sena = num(x.sena);
      if (sena > 0) chk(await sb.from('cobros').insert({ venta_id: v.id, fecha: esSocio ? x.fecha : hoy(), monto: sena, medio: x.medio, recibio: x.recibio, nota: 'Seña' }));
      if (x.c_fecha && x.c_hora) {
        const ip = instructores.find(p => p.id === x.c_instr);
        chk(await sb.from('clases').insert({ venta_id: v.id, alumno: v.alumno, telefono: v.telefono, fecha: x.c_fecha, hora: x.c_hora,
          duracion_min: 60, instructor_id: ip?.id || null, instructor_nombre: ip?.nombre || '', lugar: x.c_lugar }));
      }
      toast('Venta guardada');
      form.reset();
      onListo?.(v);
    } catch (e) { alert(errorMsg(e)); }
    btn.disabled = false;
  };
  return form;
}

async function vNueva(main) {
  poner(main, h('h2', {}, 'Nueva venta'),
    h('div', { class: 'card' }, formVenta(() => { S.tab = 'misventas'; render(); })));
}

async function cargarVentas() {
  const [v, c, cl] = await Promise.all([
    sb.from('ventas').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }),
    sb.from('cobros').select('venta_id,monto'),
    sb.from('clases').select('venta_id,duracion_min,estado'),
  ]);
  const cob = agrupar(chk(c), x => x.venta_id), cla = agrupar(chk(cl).filter(x => x.venta_id), x => x.venta_id);
  return chk(v).map(x => {
    const cobrado = sum(cob[x.id] || [], y => y.monto);
    const saldo = Number(x.precio) - cobrado;
    const usadas = sum((cla[x.id] || []).filter(y => y.estado !== 'cancelada'), y => y.duracion_min) / 30;
    const dadas = sum((cla[x.id] || []).filter(y => y.estado === 'dada' || y.estado === 'ausente'), y => y.duracion_min) / 30;
    const estado = saldo <= 0 ? ['Pagado', 'c-verde'] : cobrado > 0 ? ['Pago parcial', 'c-amarillo'] : ['Sin cobrar', 'c-rojo'];
    return { ...x, cobrado, saldo, usadas, dadas, estado };
  });
}

function tarjetaVenta(v) {
  const esSocio = rol() === 'socio';
  return h('div', { class: 'card' },
    h('div', { class: 'fila' }, h('b', {}, v.alumno), h('span', { class: 'chip ' + v.estado[1] }, v.estado[0])),
    h('div', { class: 'ayuda' }, `${v.curso} · ${dmy(v.fecha)}${esSocio && v.vendedor_nombre ? ' · vendió ' + v.vendedor_nombre : ''}`),
    h('div', { class: 'fila', style: 'margin-top:8px;font-variant-numeric:tabular-nums' },
      h('span', {}, 'Precio ', h('b', {}, $$(v.precio))),
      h('span', {}, 'Cobrado ', h('b', {}, $$(v.cobrado))),
      h('span', {}, 'Saldo ', h('b', { class: v.saldo > 0 ? 'neg' : '' }, $$(v.saldo)))),
    h('div', { class: 'ayuda', style: 'margin-top:4px' },
      `Clases: ${v.usadas} de ${v.clases} agendadas · ${v.dadas} dadas`,
      Number(v.comision) > 0 ? ` · Comisión ${$$(v.comision)}` : ''),
    v.notas && h('div', { class: 'ayuda', style: 'margin-top:4px' }, '📝 ' + v.notas),
    h('div', { class: 'acciones' },
      v.saldo > 0 && h('button', { class: 'btn chico', onclick: () => modalCobro(v) }, '+ Cobro'),
      h('button', { class: 'btn sec chico', onclick: () => formClase(null, { venta_id: v.id, alumno: v.alumno, telefono: v.telefono }) }, 'Agendar clase'),
      telWa(v.telefono) && h('a', { class: 'btn sec chico', href: telWa(v.telefono), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
      esSocio && h('button', { class: 'btn sec chico', onclick: () => modalEditarVenta(v) }, 'Editar'),
      esSocio && h('button', { class: 'btn peligro chico', onclick: () => borrarVenta(v) }, 'Borrar')));
}

async function vVentas(main) {
  const ventas = await cargarVentas();
  const esSocio = rol() === 'socio';
  const lista = h('div');
  const pintar = () => {
    const q = S.ventasQ.toLowerCase();
    const f = ventas.filter(v => (!q || `${v.alumno} ${v.curso} ${v.vendedor_nombre} ${v.telefono || ''}`.toLowerCase().includes(q)) &&
      (S.ventasEstado === 'todas' || (S.ventasEstado === 'saldo' ? v.saldo > 0 : v.saldo <= 0)));
    lista.replaceChildren(...(f.length ? f.map(tarjetaVenta) : [h('div', { class: 'vacio' }, 'No hay ventas para mostrar.')]));
  };
  poner(main, 
    h('div', { class: 'fila' }, h('h2', {}, esSocio ? 'Ventas' : 'Mis ventas'),
      esSocio && h('button', { class: 'btn amarillo chico', onclick: () => { const d = modal('Nueva venta', formVenta(() => { d.close(); recargar(); })); } }, '+ Nueva venta')),
    h('div', { class: 'kpis', style: 'margin-bottom:12px' },
      kpi('Ventas', ventas.length), kpi('Facturado', $$(sum(ventas, v => v.precio))),
      kpi('Cobrado', $$(sum(ventas, v => v.cobrado))), kpi('Por cobrar', $$(sum(ventas, v => Math.max(v.saldo, 0))), true)),
    h('div', { class: 'buscar' },
      h('input', { placeholder: 'Buscar alumno, curso…', value: S.ventasQ, oninput: e => { S.ventasQ = e.target.value; pintar(); } }),
      sel('', [['todas', 'Todas'], ['saldo', 'Con saldo'], ['pagadas', 'Pagadas']], S.ventasEstado, { onchange: e => { S.ventasEstado = e.target.value; pintar(); } })),
    lista);
  pintar();
}

function modalCobro(v) {
  const form = h('form', { class: 'f' },
    h('p', { class: 'ayuda' }, `${v.alumno} · saldo ${$$(v.saldo)}`),
    h('div', { class: 'dos' },
      campo('Monto', h('input', { name: 'monto', inputmode: 'numeric', required: true, value: String(Math.max(v.saldo, 0)) })),
      campo('Fecha', h('input', { name: 'fecha', type: 'date', value: hoy(), required: true }))),
    h('div', { class: 'dos' }, campo('Medio', sel('medio', MEDIOS, 'Efectivo')), campo('Recibió', sel('recibio', opcionesRecibio(), ''))),
    campo('Nota', h('input', { name: 'nota' })),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar cobro'));
  const d = modal('Registrar cobro', form);
  form.onsubmit = async ev => {
    ev.preventDefault();
    const x = datos(form);
    if (num(x.monto) <= 0) return alert('Poné un monto.');
    if (await intentar(async () => chk(await sb.from('cobros').insert({ venta_id: v.id, monto: num(x.monto), fecha: x.fecha, medio: x.medio, recibio: x.recibio, nota: x.nota.trim() || null })), 'Cobro guardado')) { d.close(); recargar(); }
  };
}

function modalEditarVenta(v) {
  const form = h('form', { class: 'f' },
    h('div', { class: 'dos' },
      campo('Alumno', h('input', { name: 'alumno', value: v.alumno, required: true })),
      campo('Teléfono', h('input', { name: 'telefono', value: v.telefono || '' }))),
    h('div', { class: 'dos' },
      campo('Fecha', h('input', { name: 'fecha', type: 'date', value: v.fecha })),
      campo('Curso', sel('curso_id', S.cursos.map(c => [String(c.id), c.nombre]), String(v.curso_id || ''), {
        onchange: e => { const c = S.cursos.find(x => String(x.id) === e.target.value); if (c) { form.precio.value = c.precio; form.clases.value = c.clases; } } }))),
    h('div', { class: 'dos' },
      campo('Precio', h('input', { name: 'precio', inputmode: 'numeric', value: String(Number(v.precio)) })),
      campo('Clases (30 min)', h('input', { name: 'clases', inputmode: 'numeric', value: String(v.clases) }))),
    h('div', { class: 'dos' },
      campo('Vendió', h('input', { name: 'vendedor_nombre', value: v.vendedor_nombre })),
      campo('Comisión', h('input', { name: 'comision', inputmode: 'numeric', value: String(Number(v.comision)) }))),
    campo('Notas', h('textarea', { name: 'notas', value: v.notas || '' })),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar'));
  const d = modal('Editar venta', form);
  form.onsubmit = async ev => {
    ev.preventDefault();
    const x = datos(form);
    const c = S.cursos.find(y => String(y.id) === x.curso_id);
    const vp = S.perfiles.find(p => p.nombre === x.vendedor_nombre.trim() && ['vendedor', 'socio'].includes(p.rol));
    const fila = { alumno: x.alumno.trim(), telefono: x.telefono.trim() || null, fecha: x.fecha, curso_id: c?.id ?? null, curso: c?.nombre ?? v.curso,
      precio: num(x.precio), clases: num(x.clases), vendedor_nombre: x.vendedor_nombre.trim(), vendedor_id: vp?.id || null,
      comision: num(x.comision), notas: x.notas.trim() || null };
    if (await intentar(async () => chk(await sb.from('ventas').update(fila).eq('id', v.id)), 'Venta actualizada')) { d.close(); recargar(); }
  };
}

async function borrarVenta(v) {
  if (!confirm(`¿Borrar la venta de ${v.alumno}? También se borran sus cobros y clases.`)) return;
  if (await intentar(async () => chk(await sb.from('ventas').delete().eq('id', v.id)), 'Venta borrada')) recargar();
}

// ---------------------------------------------------------------- cobros (socios)
async function vCobros(main) {
  const cobros = chk(await sb.from('cobros').select('*, ventas(alumno)').order('fecha', { ascending: false }).order('id', { ascending: false }));
  poner(main, h('h2', {}, 'Cobros'),
    h('p', { class: 'ayuda' }, 'Los cobros se cargan desde cada venta (botón "+ Cobro").'),
    cobros.length ? h('div', { class: 'scroll-x' }, h('table', { class: 't' },
      h('tr', {}, h('th', {}, 'Fecha'), h('th', {}, 'Alumno'), h('th', { class: 'n' }, 'Monto'), h('th', {}, 'Medio'), h('th', {}, 'Recibió'), h('th', {})),
      cobros.map(c => h('tr', {},
        h('td', {}, dm(c.fecha)), h('td', {}, c.ventas?.alumno || '—', c.nota ? h('div', { class: 'ayuda' }, c.nota) : null),
        h('td', { class: 'n' }, $$(c.monto)), h('td', {}, c.medio || '—'), h('td', {}, c.recibio || '—'),
        h('td', {}, h('button', { class: 'btn peligro chico', onclick: async () => {
          if (confirm('¿Borrar este cobro?') && await intentar(async () => chk(await sb.from('cobros').delete().eq('id', c.id)), 'Cobro borrado')) recargar();
        } }, '×')))),
      h('tr', { class: 'tot' }, h('td', {}, 'Total'), h('td', {}), h('td', { class: 'n' }, $$(sum(cobros, c => c.monto))), h('td', {}), h('td', {}), h('td', {}))))
      : h('div', { class: 'vacio' }, 'Todavía no hay cobros.'));
}

// ---------------------------------------------------------------- gastos (socios)
function formGasto(pre = {}, onListo) {
  const beneficiarios = cat => cat === 'Pago instructor' ? perfilesDe('instructor').map(p => p.nombre)
    : cat === 'Comisión vendedor' ? perfilesDe('vendedor').map(p => p.nombre) : [];
  const benefWrap = h('div');
  const pintarBenef = cat => {
    const ops = [...new Set([...beneficiarios(cat), pre.beneficiario].filter(Boolean))];
    benefWrap.replaceChildren(...(cat === 'Pago instructor' || cat === 'Comisión vendedor' ? [
      campo(cat === 'Pago instructor' ? 'Instructor' : 'Vendedor',
        h('input', { name: 'beneficiario', list: 'benef-list', required: true, value: pre.beneficiario || '', placeholder: 'Nombre' })),
      h('datalist', { id: 'benef-list' }, ops.map(o => h('option', { value: o })))] : []));
  };
  const form = h('form', { class: 'f' },
    h('div', { class: 'dos' },
      campo('Fecha', h('input', { name: 'fecha', type: 'date', value: hoy(), required: true })),
      campo('Categoría', sel('categoria', CATEGORIAS, pre.categoria || 'Combustible', { onchange: e => pintarBenef(e.target.value) }))),
    benefWrap,
    campo('Descripción', h('input', { name: 'descripcion', value: pre.descripcion || '', placeholder: 'Ej: nafta, cambio de aceite…' })),
    h('div', { class: 'dos' },
      campo('Monto', h('input', { name: 'monto', inputmode: 'numeric', required: true, value: pre.monto ? String(Math.round(pre.monto)) : '' })),
      campo('Pagó', sel('pago', ['Cuenta empresa', ...socios()], 'Cuenta empresa'))),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar gasto'));
  pintarBenef(pre.categoria || 'Combustible');
  form.onsubmit = async ev => {
    ev.preventDefault();
    const x = datos(form);
    if (num(x.monto) <= 0) return alert('Poné un monto.');
    const bn = (x.beneficiario || '').trim();
    const bp = bn ? S.perfiles.find(p => p.nombre === bn) : null;
    const ok = await intentar(async () => chk(await sb.from('gastos').insert({
      fecha: x.fecha, categoria: x.categoria, descripcion: x.descripcion.trim(), monto: num(x.monto), pago: x.pago,
      beneficiario_nombre: bn, beneficiario_id: bp?.id || null })), 'Gasto guardado');
    if (ok) { form.reset(); onListo?.(); }
  };
  return form;
}

async function vGastos(main) {
  const gastos = chk(await sb.from('gastos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }));
  const mes = hoy().slice(0, 7);
  poner(main, 
    h('div', { class: 'fila' }, h('h2', {}, 'Gastos'),
      h('button', { class: 'btn amarillo chico', onclick: () => { const d = modal('Nuevo gasto', formGasto({}, () => { d.close(); recargar(); })); } }, '+ Gasto')),
    h('div', { class: 'kpis', style: 'margin-bottom:12px' },
      kpi('Este mes', $$(sum(gastos.filter(g => g.fecha.startsWith(mes)), g => g.monto))),
      kpi('Total', $$(sum(gastos, g => g.monto)))),
    gastos.length ? h('div', { class: 'scroll-x' }, h('table', { class: 't' },
      h('tr', {}, h('th', {}, 'Fecha'), h('th', {}, 'Detalle'), h('th', { class: 'n' }, 'Monto'), h('th', {}, 'Pagó'), h('th', {})),
      gastos.map(g => h('tr', {},
        h('td', {}, dm(g.fecha)),
        h('td', {}, g.categoria, h('div', { class: 'ayuda' }, [g.beneficiario_nombre, g.descripcion].filter(Boolean).join(' · '))),
        h('td', { class: 'n' }, $$(g.monto)), h('td', {}, g.pago),
        h('td', {}, h('button', { class: 'btn peligro chico', onclick: async () => {
          if (confirm('¿Borrar este gasto?') && await intentar(async () => chk(await sb.from('gastos').delete().eq('id', g.id)), 'Gasto borrado')) recargar();
        } }, '×'))))))
      : h('div', { class: 'vacio' }, 'Todavía no hay gastos.'));
}

// ---------------------------------------------------------------- cálculos de administración
async function cargarAdmin() {
  const [ventas, g, r, cl] = await Promise.all([
    cargarVentas(),
    sb.from('gastos').select('*'),
    sb.from('retiros').select('*').order('fecha', { ascending: false }),
    sb.from('clases').select('fecha,duracion_min,estado,instructor_nombre').in('estado', ['dada', 'ausente']),
  ]);
  const cobros = chk(await sb.from('cobros').select('*'));
  return { ventas, cobros, gastos: chk(g), retiros: chk(r), clasesDadas: chk(cl) };
}

function pendientes({ ventas, gastos, clasesDadas }) {
  // Instructores: por cada clase dada (o con alumno ausente) según la tarifa
  const porInstr = {};
  for (const c of clasesDadas) {
    const k = c.instructor_nombre || 'Sin asignar';
    (porInstr[k] ||= { minutos: 0, generado: 0, pagado: 0 });
    porInstr[k].minutos += c.duracion_min;
    porInstr[k].generado += (c.duracion_min / 30) * tarifaClase();
  }
  for (const g of gastos.filter(g => g.categoria === 'Pago instructor')) {
    const k = g.beneficiario_nombre || 'Sin asignar';
    (porInstr[k] ||= { minutos: 0, generado: 0, pagado: 0 }).pagado += Number(g.monto);
  }
  // Comisiones: se pagan cuando el alumno terminó de pagar el curso
  const porVend = {};
  for (const v of ventas.filter(v => Number(v.comision) > 0)) {
    const k = v.vendedor_nombre || 'Sin nombre';
    (porVend[k] ||= { generada: 0, exigible: 0, pagado: 0 });
    porVend[k].generada += Number(v.comision);
    if (v.saldo <= 0) porVend[k].exigible += Number(v.comision);
  }
  for (const g of gastos.filter(g => g.categoria === 'Comisión vendedor')) {
    const k = g.beneficiario_nombre || 'Sin nombre';
    (porVend[k] ||= { generada: 0, exigible: 0, pagado: 0 }).pagado += Number(g.monto);
  }
  const faltaInstr = sum(Object.values(porInstr), x => Math.max(x.generado - x.pagado, 0));
  const faltaCom = sum(Object.values(porVend), x => Math.max(x.exigible - x.pagado, 0));
  const comFutura = sum(Object.values(porVend), x => x.generada - x.exigible);
  return { porInstr, porVend, faltaInstr, faltaCom, comFutura };
}

const kpi = (l, v, dest) => h('div', { class: 'kpi' + (dest ? ' dest' : '') }, h('div', { class: 'l' }, l), h('div', { class: 'v' + (typeof v === 'string' && v.includes('-') ? ' neg' : '') }, v));
const tabla = (cab, filas, tot) => h('div', { class: 'scroll-x' }, h('table', { class: 't' },
  h('tr', {}, cab.map((c, i) => h('th', { class: i ? 'n' : '' }, c))),
  filas.map(f => h('tr', {}, f.map((c, i) => h('td', { class: i ? 'n' : '' }, c)))),
  tot && h('tr', { class: 'tot' }, tot.map((c, i) => h('td', { class: i ? 'n' : '' }, c)))));

function rangoPeriodo(p) {
  const m = hoy().slice(0, 7);
  if (p === 'todo') return ['0000-01-01', '9999-12-31', 'Todo'];
  if (p === 'mes') return [m + '-01', m + '-31', 'Este mes'];
  if (p === 'mesant') { const a = sumarDias(m + '-01', -1).slice(0, 7); return [a + '-01', a + '-31', 'Mes anterior']; }
  return [p + '-01', p + '-31', nombreMes(p)];
}

async function vResumen(main) {
  const A = await cargarAdmin();
  const { ventas, cobros, gastos, retiros } = A;
  const P = pendientes(A);
  const [desde, hasta] = rangoPeriodo(S.periodo);
  const en = f => f >= desde && f <= hasta;
  const cobradoP = sum(cobros.filter(c => en(c.fecha)), c => c.monto);
  const gastosP = sum(gastos.filter(g => en(g.fecha)), g => g.monto);
  const ventasP = ventas.filter(v => en(v.fecha));
  const porCobrar = sum(ventas, v => Math.max(v.saldo, 0));

  // socios (acumulado, reservando lo que falta pagar)
  const resultadoTotal = sum(cobros, c => c.monto) - sum(gastos, g => g.monto);
  const ss = socios();
  const leToca = ss.length ? (resultadoTotal - P.faltaInstr - P.faltaCom) / ss.length : 0;
  const filasSocios = ss.map(s => { const ret = sum(retiros.filter(r => r.socio_nombre === s), r => r.monto); return [s, $$(leToca), $$(ret), $$(leToca - ret)]; });

  // gastos por categoría (período)
  const porCat = agrupar(gastos.filter(g => en(g.fecha)), g => g.categoria);
  // por mes
  const meses = [...new Set([...ventas.map(v => v.fecha), ...cobros.map(c => c.fecha), ...gastos.map(g => g.fecha)].map(f => f.slice(0, 7)))].sort().reverse().slice(0, 12);
  const filasMes = meses.map(m => {
    const vm = ventas.filter(v => v.fecha.startsWith(m));
    const cm = sum(cobros.filter(c => c.fecha.startsWith(m)), c => c.monto);
    const gm = sum(gastos.filter(g => g.fecha.startsWith(m)), g => g.monto);
    return [nombreMes(m), vm.length, $$(sum(vm, v => v.precio)), $$(cm), $$(gm), $$(cm - gm), $$((cm - gm) / (ss.length || 1))];
  });

  poner(main, 
    h('div', { class: 'fila' }, h('h2', {}, 'Resumen'),
      sel('', [['mes', 'Este mes'], ['mesant', 'Mes anterior'], ['todo', 'Todo'], ...meses.map(m => [m, nombreMes(m)])], S.periodo,
        { onchange: e => { S.periodo = e.target.value; recargar(); }, style: 'padding:8px 10px;border-radius:10px;border:1px solid var(--borde)' })),
    h('div', { class: 'kpis' },
      kpi('Cobrado', $$(cobradoP)), kpi('Gastos', $$(gastosP)), kpi('Resultado', $$(cobradoP - gastosP), true),
      kpi('Por cobrar (total)', $$(porCobrar)), kpi('Cursos vendidos', `${ventasP.length} · ${$$(sum(ventasP, v => v.precio))}`)),
    h('h3', {}, 'Pagos a realizar'),
    tabla(['Concepto', 'Generado', 'Pagado', 'Falta pagar'], [
      ['Instructores (clases dadas)', $$(sum(Object.values(P.porInstr), x => x.generado)), $$(sum(Object.values(P.porInstr), x => x.pagado)), $$(P.faltaInstr)],
      ['Comisiones (alumno pagó todo)', $$(sum(Object.values(P.porVend), x => x.exigible)), $$(sum(Object.values(P.porVend), x => x.pagado)), $$(P.faltaCom)],
    ]),
    P.comFutura > 0 && h('p', { class: 'ayuda' }, `Además hay ${$$(P.comFutura)} de comisiones que se van a poder pagar cuando esos alumnos terminen de pagar.`),
    h('h3', {}, `Socios (1/${ss.length || 1} cada uno, reservando lo que falta pagar)`),
    tabla(['Socio', 'Le corresponde', 'Retirado', 'Disponible'], filasSocios),
    h('h3', {}, 'Gastos por categoría'),
    Object.keys(porCat).length ? tabla(['Categoría', 'Total'],
      Object.entries(porCat).sort((a, b) => sum(b[1], g => g.monto) - sum(a[1], g => g.monto)).map(([k, l]) => [k, $$(sum(l, g => g.monto))]),
      ['Total', $$(gastosP)]) : h('p', { class: 'ayuda' }, 'Sin gastos en este período.'),
    h('h3', {}, 'Por mes'),
    filasMes.length ? tabla(['Mes', 'Ventas', 'Facturado', 'Cobrado', 'Gastos', 'Resultado', 'Por socio'], filasMes) : h('p', { class: 'ayuda' }, 'Sin movimientos.'));
}

const filaPago = (nombre, falta, detalle, boton) => h('div', { class: 'card' },
  h('div', { class: 'fila' }, h('b', {}, nombre), h('span', {}, 'Falta ', h('b', {}, $$(falta)))),
  h('div', { class: 'ayuda', style: 'margin-top:4px' }, detalle),
  h('div', { class: 'acciones' }, boton));

async function vPagos(main) {
  const A = await cargarAdmin();
  const P = pendientes(A);
  const btnPagar = (cat, nombre, monto) => monto > 0
    ? h('button', { class: 'btn chico', onclick: () => { const d = modal('Registrar pago', formGasto({ categoria: cat, beneficiario: nombre, monto, descripcion: cat === 'Pago instructor' ? 'Pago de clases' : 'Comisión de ventas' }, () => { d.close(); recargar(); })); } }, 'Pagar')
    : h('span', { class: 'chip c-verde' }, 'Al día');
  const instr = Object.entries(P.porInstr).sort();
  const vend = Object.entries(P.porVend).sort();
  poner(main, h('h2', {}, 'Pagos a realizar'),
    h('div', { class: 'kpis', style: 'margin-bottom:6px' },
      kpi('Instructores', $$(P.faltaInstr)), kpi('Comisiones', $$(P.faltaCom)), kpi('Total a pagar', $$(P.faltaInstr + P.faltaCom), true)),
    h('h3', {}, 'Instructores'),
    h('p', { class: 'ayuda' }, `Se calcula con las clases marcadas como dadas o con alumno ausente, a ${$$(tarifaClase() * 2)} la hora.`),
    instr.length ? instr.map(([n, x]) => filaPago(n, Math.max(x.generado - x.pagado, 0),
      `${(x.minutos / 60).toLocaleString('es-AR')} h dadas · generado ${$$(x.generado)} · pagado ${$$(x.pagado)}`,
      btnPagar('Pago instructor', n, x.generado - x.pagado)))
      : h('p', { class: 'ayuda' }, 'Todavía no hay clases dadas.'),
    h('h3', {}, 'Comisiones de vendedores'),
    h('p', { class: 'ayuda' }, 'La comisión se puede pagar cuando el alumno terminó de pagar el curso.'),
    vend.length ? vend.map(([n, x]) => filaPago(n, Math.max(x.exigible - x.pagado, 0),
      `generada ${$$(x.generada)} · ya se puede pagar ${$$(x.exigible)} · pagado ${$$(x.pagado)}`,
      btnPagar('Comisión vendedor', n, x.exigible - x.pagado)))
      : h('p', { class: 'ayuda' }, 'No hay comisiones.'));
}

// ---------------------------------------------------------------- retiros, equipo, ajustes (socios)
async function vRetiros(main) {
  const retiros = chk(await sb.from('retiros').select('*').order('fecha', { ascending: false }));
  const form = h('form', { class: 'f' },
    h('div', { class: 'dos' },
      campo('Socio', sel('socio_nombre', socios(), S.perfil.nombre)),
      campo('Fecha', h('input', { name: 'fecha', type: 'date', value: hoy(), required: true }))),
    h('div', { class: 'dos' },
      campo('Monto', h('input', { name: 'monto', inputmode: 'numeric', required: true })),
      campo('Nota', h('input', { name: 'nota' }))),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar retiro'));
  form.onsubmit = async ev => {
    ev.preventDefault();
    const x = datos(form);
    if (num(x.monto) <= 0) return alert('Poné un monto.');
    if (await intentar(async () => chk(await sb.from('retiros').insert({ socio_nombre: x.socio_nombre, fecha: x.fecha, monto: num(x.monto), nota: x.nota.trim() || null })), 'Retiro guardado')) recargar();
  };
  poner(main, h('h2', {}, 'Retiros de socios'), h('div', { class: 'card' }, form),
    h('div', { class: 'kpis', style: 'margin:12px 0' }, socios().map(s => kpi(s, $$(sum(retiros.filter(r => r.socio_nombre === s), r => r.monto))))),
    retiros.length ? tabla(['Fecha', 'Socio', 'Monto', ''], retiros.map(r => [dm(r.fecha), r.socio_nombre, $$(r.monto),
      h('button', { class: 'btn peligro chico', onclick: async () => {
        if (confirm('¿Borrar este retiro?') && await intentar(async () => chk(await sb.from('retiros').delete().eq('id', r.id)), 'Borrado')) recargar();
      } }, '×')])) : h('div', { class: 'vacio' }, 'Sin retiros.'));
}

async function vEquipo(main) {
  await cargarBase();
  const link = location.origin + location.pathname;
  poner(main, h('h2', {}, 'Equipo'),
    h('div', { class: 'card' },
      h('p', { style: 'margin-top:0' }, 'Para sumar a alguien: pasale el link de la app, que se cree la cuenta y después le asignás el rol acá.'),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn sec chico', onclick: async () => { try { await navigator.clipboard.writeText(link); toast('Link copiado'); } catch { prompt('Copiá el link:', link); } } }, 'Copiar link de la app'),
        h('a', { class: 'btn sec chico', href: 'https://wa.me/?text=' + encodeURIComponent('Entrá a la app de Autoescuela 360 y creá tu usuario: ' + link), target: '_blank', rel: 'noopener' }, 'Mandar por WhatsApp'))),
    S.perfiles.map(p => h('div', { class: 'card fila' },
      h('div', {}, h('b', {}, p.nombre), p.id === S.user.id ? h('span', { class: 'ayuda' }, ' (vos)') : null,
        p.rol === 'pendiente' && h('div', {}, h('span', { class: 'chip c-amarillo' }, 'Esperando acceso'))),
      h('div', { style: 'display:flex;gap:6px;align-items:center' },
        sel('', Object.entries(ROLES).map(([k, v]) => [k, v]), p.rol, {
          disabled: p.id === S.user.id, style: 'padding:8px;border-radius:8px;border:1px solid var(--borde)',
          onchange: async e => { if (await intentar(async () => chk(await sb.from('perfiles').update({ rol: e.target.value }).eq('id', p.id)), 'Rol actualizado')) recargar(); } }),
        p.id !== S.user.id && h('button', { class: 'btn sec chico', onclick: async () => {
          if (await intentar(async () => chk(await sb.from('perfiles').update({ activo: !p.activo }).eq('id', p.id)), p.activo ? 'Usuario desactivado' : 'Usuario activado')) recargar();
        } }, p.activo ? 'Desactivar' : 'Activar')))));
}

async function vAjustes(main) {
  await cargarBase();
  const form = h('form', { class: 'f' },
    h('div', { class: 'dos' },
      campo('Pago instructor por clase de 30 min', h('input', { name: 'pago_instructor_clase', inputmode: 'numeric', value: S.ajustes.pago_instructor_clase || '' })),
      campo('Comisión por venta (vendedores)', h('input', { name: 'comision_venta', inputmode: 'numeric', value: S.ajustes.comision_venta || '' }))),
    campo('Socios (separados por coma)', h('input', { name: 'socios', value: S.ajustes.socios || '' })),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar ajustes'));
  form.onsubmit = async ev => {
    ev.preventDefault();
    const x = datos(form);
    const filas = [['pago_instructor_clase', String(num(x.pago_instructor_clase))], ['comision_venta', String(num(x.comision_venta))],
      ['socios', x.socios.split(',').map(s => s.trim()).filter(Boolean).join(',')]].map(([clave, valor]) => ({ clave, valor }));
    if (await intentar(async () => chk(await sb.from('ajustes').upsert(filas)), 'Ajustes guardados')) recargar();
  };
  const filaCurso = c => {
    const f = h('form', { class: 'card f', style: 'gap:8px' },
      campo('Curso', h('input', { name: 'nombre', value: c.nombre || '', required: true })),
      h('div', { class: 'tres' },
        campo('Clases (30 min)', h('input', { name: 'clases', inputmode: 'numeric', value: String(c.clases ?? '') })),
        campo('Precio', h('input', { name: 'precio', inputmode: 'numeric', value: c.precio != null ? String(Number(c.precio)) : '' })),
        campo('Activo', sel('activo', [['true', 'Sí'], ['false', 'No']], String(c.activo ?? true)))),
      h('button', { class: 'btn sec chico', type: 'submit' }, c.id ? 'Guardar' : 'Agregar curso'));
    f.onsubmit = async ev => {
      ev.preventDefault();
      const x = datos(f);
      const fila = { nombre: x.nombre.trim(), clases: num(x.clases), precio: num(x.precio), activo: x.activo === 'true' };
      if (await intentar(async () => chk(c.id ? await sb.from('cursos').update(fila).eq('id', c.id) : await sb.from('cursos').insert({ ...fila, orden: 99 })), 'Curso guardado')) recargar();
    };
    return f;
  };
  poner(main, h('h2', {}, 'Ajustes'), h('div', { class: 'card' }, form),
    h('h3', {}, 'Cursos y precios'),
    h('p', { class: 'ayuda' }, 'Cambiar un precio afecta solo a las ventas nuevas.'),
    S.cursos.map(filaCurso), h('h3', {}, 'Nuevo curso'), filaCurso({}));
}

// ---------------------------------------------------------------- mis pagos (instructor / vendedor)
async function vMisPagos(main) {
  const pagos = chk(await sb.from('gastos').select('*').eq('beneficiario_id', S.user.id).order('fecha', { ascending: false }));
  const pagado = sum(pagos, g => g.monto);
  let bloque;
  if (rol() === 'instructor') {
    const cl = chk(await sb.from('clases').select('fecha,duracion_min,estado').eq('instructor_id', S.user.id).in('estado', ['dada', 'ausente']));
    const mes = hoy().slice(0, 7);
    const ganado = sum(cl, c => c.duracion_min / 30) * tarifaClase();
    const horasMes = sum(cl.filter(c => c.fecha.startsWith(mes)), c => c.duracion_min) / 60;
    bloque = [h('div', { class: 'kpis' },
      kpi('Horas este mes', horasMes.toLocaleString('es-AR')), kpi('Generado total', $$(ganado)),
      kpi('Cobrado', $$(pagado)), kpi('Te deben', $$(Math.max(ganado - pagado, 0)), true)),
    h('p', { class: 'ayuda' }, `Se calcula con tus clases marcadas como dadas (o alumno ausente), a ${$$(tarifaClase() * 2)} la hora.`)];
  } else {
    const ventas = await cargarVentas();
    const conCom = ventas.filter(v => Number(v.comision) > 0);
    const exigible = sum(conCom.filter(v => v.saldo <= 0), v => v.comision);
    bloque = [h('div', { class: 'kpis' },
      kpi('Ventas', ventas.length), kpi('Comisiones generadas', $$(sum(conCom, v => v.comision))),
      kpi('Ya cobrables', $$(exigible)), kpi('Cobrado', $$(pagado)), kpi('Te deben', $$(Math.max(exigible - pagado, 0)), true)),
    h('p', { class: 'ayuda' }, 'La comisión se cobra cuando el alumno termina de pagar el curso.')];
  }
  poner(main, h('h2', {}, rol() === 'instructor' ? 'Mis pagos' : 'Mis comisiones'), ...bloque,
    h('h3', {}, 'Pagos recibidos'),
    pagos.length ? tabla(['Fecha', 'Detalle', 'Monto'], pagos.map(g => [dm(g.fecha), g.descripcion || g.categoria, $$(g.monto)]), ['Total', '', $$(pagado)])
      : h('div', { class: 'vacio' }, 'Todavía no hay pagos registrados.'));
}

const VISTAS = {
  resumen: vResumen, calendario: vCalendario, ventas: vVentas, misventas: vVentas, nueva: vNueva,
  gastos: vGastos, pagos: vPagos, cobros: vCobros, retiros: vRetiros, equipo: vEquipo, ajustes: vAjustes, mispagos: vMisPagos,
};

// ---------------------------------------------------------------- sesión
let sesionActual, iniciado = false;
sb.auth.onAuthStateChange((evento, session) => {
  if (evento === 'PASSWORD_RECOVERY') setTimeout(nuevaContrasena, 400);
  const id = session?.user?.id || null;
  if (iniciado && id === sesionActual) return;     // refresco de token, etc.
  iniciado = true; sesionActual = id;
  // setTimeout: no llamar a Supabase dentro del callback de auth
  setTimeout(() => { if (session) entrar(session); else { S.perfil = null; S.tab = null; pantallaLogin(); } }, 0);
});
