// js/admin.js
document.addEventListener('DOMContentLoaded', async () => {
  const session = await verificarSesion();
  if (!session) return;

  configurarTabs();
  configurarFormularios();
  await Promise.all([cargarResidentes(), cargarServicios(), cargarPersonal()]);
});

function configurarTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-teal-600', 'text-white');
        b.classList.add('text-slate-600', 'hover:bg-slate-100');
      });
      btn.classList.add('bg-teal-600', 'text-white');
      btn.classList.remove('text-slate-600', 'hover:bg-slate-100');

      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });

  document.getElementById('btn-cerrar-qr').addEventListener('click', () => {
    document.getElementById('modal-qr').classList.add('hidden');
  });
}

function configurarFormularios() {
  document.getElementById('form-residente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo_qr = document.getElementById('res-codigo').value.trim().toUpperCase();
    const nombres = document.getElementById('res-nombres').value.trim();
    const apellidos = document.getElementById('res-apellidos').value.trim();
    const habitacion = document.getElementById('res-habitacion').value.trim() || null;

    const { error } = await supabaseClient.from('residentes').insert([{ codigo_qr, nombres, apellidos, habitacion }]);
    if (error) return alert('Error al guardar residente: ' + error.message);

    e.target.reset();
    await cargarResidentes();
  });

  document.getElementById('form-servicio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('srv-nombre').value.trim();
    const icono = document.getElementById('srv-icono').value.trim() || '✨';

    const { error } = await supabaseClient.from('servicios').insert([{ nombre, icono }]);
    if (error) return alert('Error al guardar servicio: ' + error.message);

    e.target.reset();
    document.getElementById('srv-icono').value = '✨';
    await cargarServicios();
  });

  document.getElementById('form-personal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombres = document.getElementById('per-nombres').value.trim();
    const cargo = document.getElementById('per-cargo').value.trim() || null;

    const { error } = await supabaseClient.from('personal').insert([{ nombres, cargo }]);
    if (error) return alert('Error al guardar personal: ' + error.message);

    e.target.reset();
    await cargarPersonal();
  });
}

async function cargarResidentes() {
  const { data } = await supabaseClient.from('residentes').select('*').order('codigo_qr');
  const tbody = document.getElementById('tbody-residentes');
  tbody.innerHTML = (data || []).map(r => `
    <tr>
      <td class="p-3 font-mono font-semibold text-teal-700">${r.codigo_qr}</td>
      <td class="p-3 font-medium text-slate-800">${r.nombres} ${r.apellidos}</td>
      <td class="p-3 text-slate-500">${r.habitacion || '-'}</td>
      <td class="p-3">
        <span class="px-2 py-1 rounded-full text-xs font-semibold ${r.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
          ${r.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="p-3 text-right space-x-2">
        <button onclick="verQR('${r.codigo_qr}', '${r.nombres} ${r.apellidos}')" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold">
          QR
        </button>
        <button onclick="toggleActivo('residentes', '${r.id}', ${!r.activo}, cargarResidentes)" class="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold">
          ${r.activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function cargarServicios() {
  const { data } = await supabaseClient.from('servicios').select('*').order('nombre');
  const tbody = document.getElementById('tbody-servicios');
  tbody.innerHTML = (data || []).map(s => `
    <tr>
      <td class="p-3 font-medium text-slate-800">${s.icono} ${s.nombre}</td>
      <td class="p-3">
        <span class="px-2 py-1 rounded-full text-xs font-semibold ${s.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
          ${s.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="p-3 text-right">
        <button onclick="toggleActivo('servicios', '${s.id}', ${!s.activo}, cargarServicios)" class="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold">
          ${s.activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function cargarPersonal() {
  const { data } = await supabaseClient.from('personal').select('*').order('nombres');
  const tbody = document.getElementById('tbody-personal');
  tbody.innerHTML = (data || []).map(p => `
    <tr>
      <td class="p-3 font-medium text-slate-800">${p.nombres}</td>
      <td class="p-3 text-slate-500">${p.cargo || '-'}</td>
      <td class="p-3">
        <span class="px-2 py-1 rounded-full text-xs font-semibold ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
          ${p.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="p-3 text-right">
        <button onclick="toggleActivo('personal', '${p.id}', ${!p.activo}, cargarPersonal)" class="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold">
          ${p.activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function toggleActivo(tabla, id, nuevoEstado, recargarFn) {
  const { error } = await supabaseClient.from(tabla).update({ activo: nuevoEstado }).eq('id', id);
  if (error) return alert('Error al actualizar estado: ' + error.message);
  await recargarFn();
}

function verQR(codigo, nombreCompleto) {
  document.getElementById('qr-nombre').textContent = nombreCompleto;
  document.getElementById('qr-codigo-texto').textContent = codigo;
  const contenedor = document.getElementById('qr-canvas');
  contenedor.innerHTML = '';
  new QRCode(contenedor, { text: codigo, width: 170, height: 170 });
  document.getElementById('modal-qr').classList.remove('hidden');
}