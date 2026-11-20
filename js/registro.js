// js/registro.js
let listaResidentes = [];
let listaServicios = [];
let listaPersonal = [];
let html5QrCode = null;
let camaraActiva = false;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await verificarSesion();
  if (!session) return;

  await cargarCatalogos();
  await cargarRecientes();
  configurarEventos();
});

// 1. Cargar Servicios, Personal y Residentes desde Supabase
async function cargarCatalogos() {
  const [resServicios, resPersonal, resResidentes] = await Promise.all([
    supabaseClient.from('servicios').select('*').eq('activo', true).order('nombre'),
    supabaseClient.from('personal').select('*').eq('activo', true).order('nombres'),
    supabaseClient.from('residentes').select('*').eq('activo', true).order('nombres')
  ]);

  listaServicios = resServicios.data || [];
  listaPersonal = resPersonal.data || [];
  listaResidentes = resResidentes.data || [];

  // Poblar Select Servicios
  const selServicio = document.getElementById('select-servicio');
  selServicio.innerHTML = '<option value="">-- Elige un servicio --</option>' +
    listaServicios.map(s => `<option value="${s.id}">${s.icono} ${s.nombre}</option>`).join('');

  // Poblar Select Personal
  const selPersonal = document.getElementById('select-personal');
  selPersonal.innerHTML = '<option value="">-- ¿Quién atiende? --</option>' +
    listaPersonal.map(p => `<option value="${p.id}">${p.nombres} (${p.cargo || 'Personal'})</option>`).join('');

  // Poblar Select Residentes
  const selResidente = document.getElementById('select-residente');
  selResidente.innerHTML = '<option value="">-- Selecciona o escanea QR --</option>' +
    listaResidentes.map(r => `<option value="${r.id}">[${r.codigo_qr}] ${r.nombres} ${r.apellidos} (${r.habitacion || 'S/H'})</option>`).join('');

  // Restaurar última selección de servicio/personal en este celular
  const ultimoServicio = localStorage.getItem('ultimo_servicio_id');
  const ultimoPersonal = localStorage.getItem('ultimo_personal_id');
  if (ultimoServicio) selServicio.value = ultimoServicio;
  if (ultimoPersonal) selPersonal.value = ultimoPersonal;
}

// 2. Configurar botones, cámara QR y Modal de Confirmación
function configurarEventos() {
  const btnCamara = document.getElementById('btn-toggle-camara');
  btnCamara.addEventListener('click', toggleCamaraQR);

  document.getElementById('btn-pre-confirmar').addEventListener('click', abrirModalConfirmacion);
  document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
    document.getElementById('modal-confirmacion').classList.add('hidden');
  });
  document.getElementById('btn-guardar-definitivo').addEventListener('click', guardarAtencion);
}

// 3. Control de Cámara QR del Celular
async function toggleCamaraQR() {
  const contenedor = document.getElementById('contenedor-camara');
  const textoBtn = document.getElementById('texto-btn-camara');

  if (!camaraActiva) {
    contenedor.classList.remove('hidden');
    textoBtn.textContent = 'Cerrar Cámara';
    html5QrCode = new Html5Qrcode("reader");

    try {
      await html5QrCode.start(
        { facingMode: "environment" }, // Usa la cámara trasera del celular
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (codigoLeido) => {
          procesarCodigoQR(codigoLeido.trim());
        }
      );
      camaraActiva = true;
    } catch (err) {
      alert('No se pudo acceder a la cámara. Verifica los permisos del navegador o usa HTTPS.');
      contenedor.classList.add('hidden');
      textoBtn.textContent = 'Escanear Carnet QR con Cámara';
    }
  } else {
    await detenerCamara();
  }
}

async function detenerCamara() {
  if (html5QrCode && camaraActiva) {
    await html5QrCode.stop();
    camaraActiva = false;
  }
  document.getElementById('contenedor-camara').classList.add('hidden');
  document.getElementById('texto-btn-camara').textContent = 'Escanear Carnet QR con Cámara';
}

// 4. Cuando la cámara detecta un QR
async function procesarCodigoQR(codigo) {
  const residente = listaResidentes.find(r => r.codigo_qr.toUpperCase() === codigo.toUpperCase());

  if (!residente) {
    alert(`⚠️ El código QR "${codigo}" no pertenece a ningún residente activo.`);
    return;
  }

  // Apagamos la cámara, seleccionamos al abuelito y abrimos directo la confirmación
  await detenerCamara();
  document.getElementById('select-residente').value = residente.id;
  abrirModalConfirmacion();
}

// 5. Validar y mostrar el Modal de Confirmación
function abrirModalConfirmacion() {
  const servicioId = document.getElementById('select-servicio').value;
  const personalId = document.getElementById('select-personal').value;
  const residenteId = document.getElementById('select-residente').value;

  if (!servicioId || !personalId || !residenteId) {
    alert('Por favor selecciona el Servicio, el Personal que atiende y el Residente.');
    return;
  }

  const servicio = listaServicios.find(s => s.id === servicioId);
  const personal = listaPersonal.find(p => p.id === personalId);
  const residente = listaResidentes.find(r => r.id === residenteId);

  document.getElementById('conf-residente').textContent = `${residente.nombres} ${residente.apellidos} (${residente.codigo_qr})`;
  document.getElementById('conf-servicio').textContent = `${servicio.icono} ${servicio.nombre}`;
  document.getElementById('conf-personal').textContent = personal.nombres;
  document.getElementById('conf-fecha').textContent = new Date().toLocaleString('es-PE', {
    dateStyle: 'short', timeStyle: 'short'
  });

  document.getElementById('modal-confirmacion').classList.remove('hidden');
}

// 6. Guardar definitivamente en Supabase
async function guardarAtencion() {
  const btnGuardar = document.getElementById('btn-guardar-definitivo');
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  const servicioId = document.getElementById('select-servicio').value;
  const personalId = document.getElementById('select-personal').value;
  const residenteId = document.getElementById('select-residente').value;
  const observacion = document.getElementById('input-observacion').value.trim();

  const { error } = await supabaseClient.from('atenciones').insert([{
    residente_id: residenteId,
    servicio_id: servicioId,
    personal_id: personalId,
    observacion: observacion || null
  }]);

  btnGuardar.disabled = false;
  btnGuardar.textContent = '✅ Confirmar';

  if (error) {
    alert('Error al guardar: ' + error.message);
    return;
  }

  // Recordar servicio y personal para la siguiente atención rápida
  localStorage.setItem('ultimo_servicio_id', servicioId);
  localStorage.setItem('ultimo_personal_id', personalId);

  // Limpiar solo el residente y observación, cerrar modal y mostrar aviso
  document.getElementById('select-residente').value = '';
  document.getElementById('input-observacion').value = '';
  document.getElementById('modal-confirmacion').classList.add('hidden');

  const toast = document.getElementById('toast-exito');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);

  await cargarRecientes();
}

// 7. Mostrar los últimos 5 registros del día
async function cargarRecientes() {
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  const { data } = await supabaseClient
    .from('atenciones')
    .select(`
      fecha_hora,
      residentes (nombres, apellidos),
      servicios (nombre, icono),
      personal (nombres)
    `)
    .gte('fecha_hora', hoyInicio.toISOString())
    .order('fecha_hora', { ascending: false })
    .limit(5);

  const ul = document.getElementById('lista-recientes');
  if (!data || data.length === 0) {
    ul.innerHTML = '<li class="py-2 text-slate-400">Aún no hay atenciones registradas hoy.</li>';
    return;
  }

  ul.innerHTML = data.map(item => {
    const hora = new Date(item.fecha_hora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    return `
      <li class="py-2.5 flex justify-between items-center">
        <div>
          <p class="font-semibold text-slate-800">${item.residentes.nombres} ${item.residentes.apellidos}</p>
          <p class="text-xs text-slate-500">${item.servicios.icono} ${item.servicios.nombre} • Atendió: ${item.personal.nombres}</p>
        </div>
        <span class="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">${hora}</span>
      </li>
    `;
  }).join('');
}