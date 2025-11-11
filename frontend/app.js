// Ajusta esta URL cuando el backend esté en Render
const BACKEND_URL = 'http://localhost:4000';

const tablaBody = document.querySelector('#tabla-ordenes tbody');
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

  // Agregar listeners a todos los select de status
  document.querySelectorAll('.select-status').forEach(sel => {
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

    // Recargar la tabla para actualizar chips, alertas, etc.
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
