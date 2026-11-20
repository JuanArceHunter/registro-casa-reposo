// js/dashboard.js
let atencionesBase = [];
let atencionesFiltradas = [];
let chartServicios = null;
let chartResidentes = null;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await verificarSesion();
  if (!session) return;

  await cargarOpcionesFiltro();
  await cargarAtenciones();
  configurarEventosFiltro();
});

async function cargarOpcionesFiltro() {
  const [resSrv, resPer, resRes] = await Promise.all([
    supabaseClient.from('servicios').select('id, nombre, icono').order('nombre'),
    supabaseClient.from('personal').select('id, nombres').order('nombres'),
    supabaseClient.from('residentes').select('id, nombres, apellidos, codigo_qr').order('nombres')
  ]);

  document.getElementById('filtro-servicio').innerHTML += (resSrv.data || [])
    .map(s => `<option value="${s.id}">${s.icono} ${s.nombre}</option>`).join('');

  document.getElementById('filtro-personal').innerHTML += (resPer.data || [])
    .map(p => `<option value="${p.id}">${p.nombres}</option>`).join('');

  document.getElementById('filtro-residente').innerHTML += (resRes.data || [])
    .map(r => `<option value="${r.id}">[${r.codigo_qr}] ${r.nombres} ${r.apellidos}</option>`).join('');
}

async function cargarAtenciones() {
  const { data, error } = await supabaseClient
    .from('atenciones')
    .select(`
      id,
      fecha_hora,
      observacion,
      residente_id,
      servicio_id,
      personal_id,
      residentes (nombres, apellidos, codigo_qr),
      servicios (nombre, icono),
      personal (nombres)
    `)
    .order('fecha_hora', { ascending: false });

  if (error) {
    console.error('Error cargando atenciones:', error);
    return;
  }

  atencionesBase = data || [];
  aplicarFiltros();
}

function configurarEventosFiltro() {
  ['filtro-desde', 'filtro-hasta', 'filtro-servicio', 'filtro-personal', 'filtro-residente'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltros);
  });

  document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
    document.getElementById('filtro-desde').value = '';
    document.getElementById('filtro-hasta').value = '';
    document.getElementById('filtro-servicio').value = '';
    document.getElementById('filtro-personal').value = '';
    document.getElementById('filtro-residente').value = '';
    aplicarFiltros();
  });

  document.getElementById('btn-exportar-csv').addEventListener('click', exportarCSV);
}

function aplicarFiltros() {
  const desdeVal = document.getElementById('filtro-desde').value;
  const hastaVal = document.getElementById('filtro-hasta').value;
  const servicioId = document.getElementById('filtro-servicio').value;
  const personalId = document.getElementById('filtro-personal').value;
  const residenteId = document.getElementById('filtro-residente').value;

  const fechaDesde = desdeVal ? new Date(`${desdeVal}T00:00:00`) : null;
  const fechaHasta = hastaVal ? new Date(`${hastaVal}T23:59:59.999`) : null;

  atencionesFiltradas = atencionesBase.filter(item => {
    const fechaItem = new Date(item.fecha_hora);
    if (fechaDesde && fechaItem < fechaDesde) return false;
    if (fechaHasta && fechaItem > fechaHasta) return false;
    if (servicioId && item.servicio_id !== servicioId) return false;
    if (personalId && item.personal_id !== personalId) return false;
    if (residenteId && item.residente_id !== residenteId) return false;
    return true;
  });

  renderizarKPIs();
  renderizarGraficos();
  renderizarTabla();
}

function contarFrecuencias(lista, obtenerEtiqueta) {
  const mapa = new Map();
  lista.forEach(item => {
    const etiqueta = obtenerEtiqueta(item);
    mapa.set(etiqueta, (mapa.get(etiqueta) || 0) + 1);
  });
  return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
}

function renderizarKPIs() {
  document.getElementById('kpi-total').textContent = atencionesFiltradas.length;

  const topServicios = contarFrecuencias(
    atencionesFiltradas,
    i => `${i.servicios?.icono || ''} ${i.servicios?.nombre || 'Sin servicio'}`.trim()
  );
  document.getElementById('kpi-servicio-top').textContent =
    topServicios.length ? `${topServicios[0][0]} (${topServicios[0][1]})` : 'Sin datos';

  const topResidentes = contarFrecuencias(
    atencionesFiltradas,
    i => `${i.residentes?.nombres || ''} ${i.residentes?.apellidos || ''}`.trim()
  );
  document.getElementById('kpi-residente-top').textContent =
    topResidentes.length ? `${topResidentes[0][0]} (${topResidentes[0][1]})` : 'Sin datos';
}

function renderizarGraficos() {
  const datosServicios = contarFrecuencias(
    atencionesFiltradas,
    i => `${i.servicios?.icono || ''} ${i.servicios?.nombre || 'Sin servicio'}`.trim()
  );

  const datosResidentes = contarFrecuencias(
    atencionesFiltradas,
    i => `${i.residentes?.nombres || ''} ${i.residentes?.apellidos || ''}`.trim()
  ).slice(0, 7);

  if (chartServicios) chartServicios.destroy();
  chartServicios = new Chart(document.getElementById('chart-servicios'), {
    type: 'bar',
    data: {
      labels: datosServicios.map(d => d[0]),
      datasets: [{
        label: 'Atenciones',
        data: datosServicios.map(d => d[1]),
        backgroundColor: '#0d9488',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  if (chartResidentes) chartResidentes.destroy();
  chartResidentes = new Chart(document.getElementById('chart-residentes'), {
    type: 'bar',
    data: {
      labels: datosResidentes.map(d => d[0]),
      datasets: [{
        label: 'Visitas',
        data: datosResidentes.map(d => d[1]),
        backgroundColor: '#4f46e5',
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderizarTabla() {
  const tbody = document.getElementById('tbody-atenciones');
  document.getElementById('contador-filas').textContent = `${atencionesFiltradas.length} registros`;

  if (atencionesFiltradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">No hay registros que coincidan con los filtros.</td></tr>';
    return;
  }

  tbody.innerHTML = atencionesFiltradas.map(item => {
    const fechaFmt = new Date(item.fecha_hora).toLocaleString('es-PE', {
      dateStyle: 'short', timeStyle: 'short'
    });
    const resNombre = `${item.residentes?.nombres || ''} ${item.residentes?.apellidos || ''}`.trim();
    const srvNombre = `${item.servicios?.icono || ''} ${item.servicios?.nombre || ''}`.trim();

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3 text-slate-600 whitespace-nowrap">${fechaFmt}</td>
        <td class="p-3 font-medium text-slate-800">${resNombre}</td>
        <td class="p-3 text-teal-700 font-medium">${srvNombre}</td>
        <td class="p-3 text-slate-700">${item.personal?.nombres || '-'}</td>
        <td class="p-3 text-slate-500">${item.observacion || '-'}</td>
      </tr>
    `;
  }).join('');
}

function exportarCSV() {
  if (atencionesFiltradas.length === 0) {
    return alert('No hay registros filtrados para exportar.');
  }

  const encabezados = ['Fecha y Hora', 'Codigo QR', 'Residente', 'Servicio', 'Personal', 'Observacion'];
  const filas = atencionesFiltradas.map(item => [
    new Date(item.fecha_hora).toLocaleString('es-PE'),
    item.residentes?.codigo_qr || '',
    `${item.residentes?.nombres || ''} ${item.residentes?.apellidos || ''}`.trim(),
    item.servicios?.nombre || '',
    item.personal?.nombres || '',
    item.observacion || ''
  ]);

  const csvContent = [encabezados, ...filas]
    .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `atenciones_casa_reposo_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}