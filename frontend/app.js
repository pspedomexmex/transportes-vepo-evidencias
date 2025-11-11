// Cuando esté en Render, solo cambias esta URL
const BACKEND_URL = 'http://localhost:4000';

const tablaBody = document.querySelector('#tabla-ordenes tbody');
const listaMovil = document.getElementById('lista-ordenes-movil');
const filtroStatus = document.getElementById('filtro-status');
const btnRecargar = document.getElementById('btn-recargar');
const mensajeVacio = document.getElementById('mensaje-vacio');

async function cargarOrdenes() {
  try {
    const status = filtroStatus.value;
    const url = status
      ? `${BACKEND_URL}/api/ordenes?status=${encodeURIComponent(status)}`
      : `${BACKEND_URL}/api/ordenes`;

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error('Error al obtener órdenes');
    }

    const ordenes = await resp.json();
    renderTabla(ordenes);
    renderMovil(ordenes);
  } catch (err) {
    console.error(err);
    alert('Error al cargar órdenes. Revisa la consola.');
  }
}

function renderTabla(ordenes) {
  tablaBody.innerHTML = '';

  if (!ordenes.length) {
    mensajeVacio.classList.remove('oculto');
    return;
  }

  mensajeVacio.classList.add('oculto');

  for (const ord of ordenes) {
    const tr = document.createElement('tr');

    if (ord.requiere_alerta) {
      tr.classList.add('fila-alerta');
    }

    tr.innerHTML = `
      <td>${ord.id}</td>
      <td>${ord.cliente || ''}</td>
      <td>${ord.destino || ''}</td>
      <td>${ord.oc_pedido || ''}</td>
      <td>${ord.equipo || ''}</td>
      <td>${ord.operador || ''}</td>
      <td>${ord.permisionario || ''}</td>
      <td>
        <span class="status-chip status-${(ord.evidencia_status || '').toLowerCase()}">
          ${ord.evidencia_status}
        </span>
      </td>
      <td>${ord.dias_desde_creacion ?? '-'}</td>
      <td>${ord.requiere_alerta ? '⚠️' : ''}</td>
      <td>
        <select data-id="${ord.id}" class="select-status">
          <option value="PENDIENTE" ${ord.evidencia_status === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
          <option value="RECOLECTADO" ${ord.evidencia_status === 'RECOLECTADO' ? 'selected' : ''}>Recolectado</option>
          <option value="ENTREGADO" ${ord.evidencia_status === 'ENTREGADO' ? 'selected' : ''}>Entregado</option>
        </select>
      </td>
    `;

    tablaBody.appendChild(tr);
  }

  // Listeners para los select de la tabla
  document.querySelectorAll('.select-status').forEach(sel => {
    sel.addEventListener('change', onCambioStatus);
  });
}

function renderMovil(ordenes) {
  listaMovil.innerHTML = '';

  if (!ordenes.length) {
    // mensaje_vacio ya lo maneja renderTabla
    return;
  }

  for (const ord of ordenes) {
    const card = document.createElement('article');
    card.classList.add('orden-card');
    if (ord.requiere_alerta) {
      card.classList.add('orden-card-alerta');
    }

    card.innerHTML = `
      <header class="orden-card-header">
        <div class="orden-card-id">ID #${ord.id}</div>
        <div class="orden-card-status">
          <span class="status-chip status-${(ord.evidencia_status || '').toLowerCase()}">
            ${ord.evidencia_status}
          </span>
        </div>
      </header>

      <div class="orden-card-body">
        <div><strong>Cliente:</strong> ${ord.cliente || ''}</div>
        <div><strong>Destino:</strong> ${ord.destino || ''}</div>
        <div><strong>OC:</strong> ${ord.oc_pedido || ''}</div>
        <div><strong>Equipo:</strong> ${ord.equipo || ''}</div>
        <div><strong>Operador:</strong> ${ord.operador || ''}</div>
        <div><strong>Permisionario:</strong> ${ord.permisionario || ''}</div>
        <div><strong>Días:</strong> ${ord.dias_desde_creacion ?? '-'}</div>
        ${
          ord.requiere_alerta
            ? '<div class="orden-card-alerta-texto">⚠️ Pendiente con más de 3 días</div>'
            : ''
        }
      </div>

      <footer class="orden-card-footer">
        <label>
          Estatus:
          <select data-id="${ord.id}" class="select-status-movil">
            <option value="PENDIENTE" ${ord.evidencia_status === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
            <option value="RECOLECTADO" ${ord.evidencia_status === 'RECOLECTADO' ? 'selected' : ''}>Recolectado</option>
            <option value="ENTREGADO" ${ord.evidencia_status === 'ENTREGADO' ? 'selected' : ''}>Entregado</option>
          </select>
        </label>
      </footer>
    `;

    listaMovil.appendChild(card);
  }

  // Listeners para los select en móvil
  document.querySelectorAll('.select-status-movil').forEach(sel => {
    sel.addEventListener('change', onCambioStatus);
  });
}

async function onCambioStatus(e) {
  const select = e.target;
  const id = select.getAttribute('data-id');
  const nuevoStatus = select.value;

  try {
    const resp = await fetch(`${BACKEND_URL}/api/ordenes/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ evidencia_status: nuevoStatus })
    });

    if (!resp.ok) {
      throw new Error('Error al actualizar estatus');
    }

    await cargarOrdenes();
  } catch (err) {
    console.error(err);
    alert('No se pudo actualizar el estatus. Revisa la consola.');
  }
}

btnRecargar.addEventListener('click', cargarOrdenes);
filtroStatus.addEventListener('change', cargarOrdenes);

// Cargar al inicio
cargarOrdenes();
