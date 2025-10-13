// ----------------------------
// APP.JS - PARTE 1/4
// ----------------------------

import { db, ref, get, set, update, push, remove, onValue } from './init.js';

// ---------- VARIABLES GLOBALES ----------
let cajeroActivo = null;
let tablaCobro = [];
let totalCobro = 0;
let ticketID = 1; // Reinicia cada día
let appSections = document.querySelectorAll('main section');
let navBtns = document.querySelectorAll('.nav-btn');

// Modales
const modalAdmin = document.createElement('div');
modalAdmin.id = 'modal-admin';
modalAdmin.style.display = 'none';
document.body.appendChild(modalAdmin);

// Inputs y botones generales
const inputKG = document.getElementById('input-kg-suelto');
const btnIncrKG = document.getElementById('btn-incr-kg');
const btnDecrKG = document.getElementById('btn-decr-kg');
const tablaCobroBody = document.querySelector('#tabla-cobro tbody');
const totalDiv = document.getElementById('total-div');
const btnCobrar = document.getElementById('btn-cobrar');

// ---------- FUNCIONES GENERALES ----------

// Función para mostrar secciones según nav
function showSection(sectionId) {
  appSections.forEach(sec => sec.classList.add('hidden'));
  document.getElementById(sectionId).classList.remove('hidden');
}

// Función para actualizar selects de cantidad 01-99
function cargarSelectsCantidad() {
  const selectsCantidad = document.querySelectorAll('#cobro-cantidad, #login-usuario, #stock-cantidad, #cajero-nro');
  selectsCantidad.forEach(sel => {
    sel.innerHTML = '';
    for (let i = 1; i <= 99; i++) {
      let num = i.toString().padStart(2, '0');
      sel.innerHTML += `<option value="${num}">${num}</option>`;
    }
  });
}

// ---------- MODAL CONTRASEÑA ADMIN INICIAL ----------
const modalLoginAdmin = document.createElement('div');
modalLoginAdmin.id = 'modal-login-admin';
modalLoginAdmin.style.position = 'fixed';
modalLoginAdmin.style.top = '0';
modalLoginAdmin.style.left = '0';
modalLoginAdmin.style.width = '100%';
modalLoginAdmin.style.height = '100%';
modalLoginAdmin.style.background = 'rgba(0,0,0,0.5)';
modalLoginAdmin.style.display = 'flex';
modalLoginAdmin.style.alignItems = 'center';
modalLoginAdmin.style.justifyContent = 'center';
modalLoginAdmin.style.zIndex = '9999';

modalLoginAdmin.innerHTML = `
  <div style="background:#fff; padding:20px; border-radius:10px; text-align:center;">
    <h2>🔒 Contraseña de Administrador 🔒</h2>
    <input type="password" id="admin-pass-input" placeholder="Contraseña">
    <button id="btn-admin-login">Ingresar</button>
    <p id="admin-msg" style="color:red;"></p>
  </div>
`;

document.body.appendChild(modalLoginAdmin);

document.getElementById('btn-admin-login').addEventListener('click', () => {
  const val = document.getElementById('admin-pass-input').value;
  if (val === '1918' || val === '1409') {
    modalLoginAdmin.style.display = 'none';
    showSection('cobro');
  } else {
    document.getElementById('admin-msg').textContent = 'Contraseña incorrecta';
  }
});

// ---------- NAVEGACIÓN ----------
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    showSection(btn.dataset.section);
  });
});

// ---------- LOGIN DE CAJEROS ----------
const btnLoginCajero = document.getElementById('btn-login');
btnLoginCajero.addEventListener('click', async () => {
  const nro = document.getElementById('login-usuario').value;
  const pass = document.getElementById('login-pass').value;

  const cajeroSnap = await get(ref(db, `cajeros/${nro}`));
  if (!cajeroSnap.exists() || cajeroSnap.val().pass !== pass) {
    document.getElementById('login-msg').textContent = 'Contraseña incorrecta';
    return;
  }

  cajeroActivo = { nro, ...cajeroSnap.val() };
  document.getElementById('login-msg').textContent = '';
  document.getElementById('cobro-controles').classList.remove('hidden');
  document.getElementById('login-modal').classList.add('hidden');

  cargarSelectsStock();
  cargarSelectsSueltos();
});

// ---------- INCREMENTO / DECREMENTO KG ----------
btnIncrKG.addEventListener('click', () => {
  let val = parseFloat(inputKG.value);
  val += 0.1;
  if (val > 99.9) val = 99.9;
  inputKG.value = val.toFixed(3);
});

btnDecrKG.addEventListener('click', () => {
  let val = parseFloat(inputKG.value);
  val -= 0.1;
  if (val < 0.1) val = 0.1;
  inputKG.value = val.toFixed(3);
});

// ---------- FUNCIONES PARA CARGAR SELECTS DE STOCK Y SUELTOS ----------
async function cargarSelectsStock() {
  const selectStock = document.getElementById('cobro-productos');
  selectStock.innerHTML = '<option value="">Elija un Item</option>';
  const stockSnap = await get(ref(db, 'stock'));
  if (!stockSnap.exists()) return;
  Object.entries(stockSnap.val()).forEach(([codigo, item]) => {
    selectStock.innerHTML += `<option value="${codigo}">${item.nombre}</option>`;
  });
}

async function cargarSelectsSueltos() {
  const selectSueltos = document.getElementById('cobro-sueltos');
  selectSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
  const sueltosSnap = await get(ref(db, 'sueltos'));
  if (!sueltosSnap.exists()) return;
  Object.entries(sueltosSnap.val()).forEach(([codigo, item]) => {
    selectSueltos.innerHTML += `<option value="${codigo}">${item.nombre}</option>`;
  });
}

// ---------- INICIALIZACIONES ----------
cargarSelectsCantidad();
showSection('cobro');

// ----------------------------
// APP.JS - PARTE 2/4
// ----------------------------

// ---------- FUNCIONES TABLA COBRO ----------

// Calcular total de la tabla
function actualizarTotal() {
  totalCobro = tablaCobro.reduce((acc, item) => acc + item.total, 0);
  totalDiv.textContent = `TOTAL: $${totalCobro.toFixed(2)}`;
}

// Renderizar tabla cobro
function renderTablaCobro() {
  tablaCobroBody.innerHTML = '';
  tablaCobro.slice().reverse().forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.cantidad.toFixed(3)}</td>
      <td>${item.nombre}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>$${item.total.toFixed(2)}</td>
      <td><button class="btn-eliminar" data-index="${index}">Eliminar</button></td>
    `;
    tablaCobroBody.appendChild(tr);
  });

  // Botones eliminar
  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = btn.dataset.index;
      abrirModalAdminEliminar(index);
    });
  });

  actualizarTotal();
}

// ---------- AGREGAR PRODUCTOS STOCK ----------
document.getElementById('btn-add-product').addEventListener('click', async () => {
  const codigo = document.getElementById('cobro-productos').value;
  const cantidad = parseInt(document.getElementById('cobro-cantidad').value);
  if (!codigo || !cantidad) return;

  const itemSnap = await get(ref(db, `stock/${codigo}`));
  if (!itemSnap.exists()) return;
  const item = itemSnap.val();
  const total = cantidad * item.precio;

  tablaCobro.push({
    tipo: 'stock',
    codigo,
    nombre: item.nombre,
    cantidad,
    precio: item.precio,
    total
  });

  renderTablaCobro();
});

// ---------- AGREGAR PRODUCTOS SUELTOS ----------
document.getElementById('btn-add-suelto').addEventListener('click', async () => {
  const codigo = document.getElementById('cobro-sueltos').value;
  let kg = parseFloat(document.getElementById('input-kg-suelto').value);
  if (!codigo || !kg) return;

  const itemSnap = await get(ref(db, `sueltos/${codigo}`));
  if (!itemSnap.exists()) return;
  const item = itemSnap.val();
  const total = kg * item.precio;

  tablaCobro.push({
    tipo: 'sueltos',
    codigo,
    nombre: item.nombre,
    cantidad: kg,
    precio: item.precio,
    total
  });

  renderTablaCobro();
});

// ---------- MODAL ELIMINAR CON CONTRASEÑA ADMIN ----------
function abrirModalAdminEliminar(index) {
  const modal = document.createElement('div');
  modal.classList.add('modal-eliminar');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:10px; text-align:center;">
      <h3>Ingrese Contraseña de Administrador</h3>
      <input type="password" id="pass-eliminar" placeholder="Contraseña">
      <div style="margin-top:10px;">
        <button id="btn-aceptar-eliminar">Aceptar</button>
        <button id="btn-cancelar-eliminar">Cancelar</button>
      </div>
      <p id="msg-eliminar" style="color:red;"></p>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-aceptar-eliminar').addEventListener('click', () => {
    const val = document.getElementById('pass-eliminar').value;
    if (val === '1918' || val === '1409') {
      tablaCobro.splice(index, 1);
      renderTablaCobro();
      modal.remove();
    } else {
      document.getElementById('msg-eliminar').textContent = 'Contraseña incorrecta';
    }
  });

  document.getElementById('btn-cancelar-eliminar').addEventListener('click', () => {
    modal.remove();
  });
}

// ----------------------------
// APP.JS - PARTE 3/4
// ----------------------------

// ---------- BOTÓN COBRAR ----------
btnCobrar.addEventListener('click', () => {
  if (tablaCobro.length === 0) return;

  const modal = document.createElement('div');
  modal.classList.add('modal-cobrar');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:10px; text-align:center;">
      <h3>¿Cómo Pagará el Cliente?</h3>
      <div style="margin:10px 0;">
        <button class="metodo-pago" data-metodo="Efectivo">Efectivo</button>
        <button class="metodo-pago" data-metodo="Tarjeta">Tarjeta</button>
        <button class="metodo-pago" data-metodo="QR">QR</button>
        <button class="metodo-pago" data-metodo="Electrónico">Electrónico</button>
        <button class="metodo-pago" data-metodo="Otro">Otro</button>
      </div>
      <button id="btn-cancelar-pago" style="background:red; color:white;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-cancelar-pago').addEventListener('click', () => modal.remove());

  document.querySelectorAll('.metodo-pago').forEach(btn => {
    btn.addEventListener('click', async () => {
      const metodo = btn.dataset.metodo;
      await procesarVenta(metodo);
      modal.remove();
      tablaCobro = [];
      renderTablaCobro();
    });
  });
});

// ---------- PROCESAR VENTA ----------
async function procesarVenta(metodoPago) {
  const hoy = new Date();
  const fechaStr = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()} (${String(hoy.getHours()).padStart(2,'0')}:${String(hoy.getMinutes()).padStart(2,'0')})`;

  // Obtener ID diario
  const diaKey = `${hoy.getFullYear()}-${hoy.getMonth()+1}-${hoy.getDate()}`;
  const idRef = ref(db, `ids/${diaKey}`);
  const idSnap = await get(idRef);
  let nuevoId = 1;
  if (idSnap.exists()) nuevoId = idSnap.val() + 1;
  await set(idRef, nuevoId);

  const ticketId = `ID_${String(nuevoId).padStart(6,'0')}`;

  // Guardar ticket en movimientos y historial
  const ticketData = {
    id: ticketId,
    total: totalCobro,
    metodo: metodoPago,
    cajero: cajeroActivo,
    fecha: fechaStr,
    productos: tablaCobro
  };

  const movRef = ref(db, `movimientos/${ticketId}`);
  await set(movRef, ticketData);

  const histRef = ref(db, `historial/${ticketId}`);
  await set(histRef, ticketData);

  // Actualizar stock/sueltos
  for (const item of tablaCobro) {
    if (item.tipo === 'stock') {
      const prodRef = ref(db, `stock/${item.codigo}/cant`);
      const snap = await get(prodRef);
      if (snap.exists()) await set(prodRef, snap.val() - item.cantidad);
    } else if (item.tipo === 'sueltos') {
      const prodRef = ref(db, `sueltos/${item.codigo}/kg`);
      const snap = await get(prodRef);
      if (snap.exists()) await set(prodRef, snap.val() - item.cantidad);
    }
  }

  imprimirTicket(ticketData);
  alert('Venta realizada');
}

// ---------- IMPRIMIR TICKET ----------
function imprimirTicket(ticket) {
  let contenido = `${ticket.id}\n${ticket.fecha}\nCajero: ${ticket.cajero}\n==========\n`;
  ticket.productos.forEach(p => {
    contenido += `${p.nombre} $${p.precio.toFixed(2)} (${p.cantidad}) = $${p.total.toFixed(2)}\n==========\n`;
  });
  contenido += `TOTAL: $${ticket.total.toFixed(2)}\nPago: ${ticket.metodo}`;
  
  const w = window.open('', 'Ticket', 'width=400,height=600');
  w.document.write(`<pre>${contenido}</pre>`);
  w.print();
  w.close();
}
// ----------------------------
// APP.JS - PARTE 4/4
// ----------------------------

// ----------------------------
// MOVIMIENTOS
// ----------------------------
const filtroCajero = document.getElementById('filtroCajero');
const tablaMovimientosBody = document.querySelector('#tabla-movimientos tbody');

onValue(ref(db, 'movimientos'), snap => {
  tablaMovimientosBody.innerHTML = '';
  if (!snap.exists()) return;
  const data = snap.val();
  Object.values(data).sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(ticket => {
    if (filtroCajero.value !== 'TODOS' && ticket.cajero !== filtroCajero.value) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>${ticket.total.toFixed(2)}</td>
      <td>${ticket.metodo}</td>
      <td>
        <button class="reimprimir-btn">Reimprimir</button>
        <button class="eliminar-btn">Eliminar</button>
      </td>
    `;
    tablaMovimientosBody.appendChild(tr);

    tr.querySelector('.reimprimir-btn').addEventListener('click', () => imprimirTicket(ticket));

    tr.querySelector('.eliminar-btn').addEventListener('click', () => {
      const pwd = prompt('Contraseña de administrador:');
      if (pwd !== adminPass) return alert('Contraseña incorrecta');
      remove(ref(db, `movimientos/${ticket.id}`));
      // Restaurar stock/sueltos
      ticket.productos.forEach(async p => {
        if (p.tipo === 'stock') {
          const snapS = await get(ref(db, `stock/${p.codigo}/cant`));
          if (snapS.exists()) await set(ref(db, `stock/${p.codigo}/cant`), snapS.val() + p.cantidad);
        } else if (p.tipo === 'sueltos') {
          const snapS = await get(ref(db, `sueltos/${p.codigo}/kg`));
          if (snapS.exists()) await set(ref(db, `sueltos/${p.codigo}/kg`), snapS.val() + p.cantidad);
        }
      });
    });
  });
});

// ----------------------------
// HISTORIAL
// ----------------------------
const tablaHistorialBody = document.querySelector('#tabla-historial tbody');

onValue(ref(db, 'historial'), snap => {
  tablaHistorialBody.innerHTML = '';
  if (!snap.exists()) return;
  const data = snap.val();
  Object.values(data).sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(ticket => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>${ticket.total.toFixed(2)}</td>
      <td>${ticket.metodo}</td>
      <td>${ticket.cajero}</td>
      <td>${ticket.fecha}</td>
      <td><button class="reimprimir-btn">Reimprimir</button></td>
    `;
    tablaHistorialBody.appendChild(tr);

    tr.querySelector('.reimprimir-btn').addEventListener('click', () => imprimirTicket(ticket));
  });
});

// ----------------------------
// STOCK
// ----------------------------
const tablaStockBody = document.querySelector('#tabla-stock tbody');

onValue(ref(db, 'stock'), snap => {
  tablaStockBody.innerHTML = '';
  if (!snap.exists()) return;
  const data = snap.val();
  Object.entries(data).sort((a,b) => b[1].fecha - a[1].fecha).forEach(([codigo, item]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.cant}</td>
      <td>${item.fecha}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>
        <button class="edit-btn">Editar</button>
        <button class="delete-btn">Eliminar</button>
      </td>
    `;
    tablaStockBody.appendChild(tr);

    tr.querySelector('.edit-btn').addEventListener('click', () => editarStock(codigo, item));
    tr.querySelector('.delete-btn').addEventListener('click', () => eliminarStock(codigo));
  });
});

// ----------------------------
// SUELTOS
// ----------------------------
const tablaSueltosBody = document.querySelector('#tabla-sueltos tbody');

onValue(ref(db, 'sueltos'), snap => {
  tablaSueltosBody.innerHTML = '';
  if (!snap.exists()) return;
  const data = snap.val();
  Object.entries(data).sort((a,b) => b[1].fecha - a[1].fecha).forEach(([codigo, item]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.kg.toFixed(3)}</td>
      <td>${item.fecha}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>
        <button class="edit-btn">Editar</button>
        <button class="delete-btn">Eliminar</button>
      </td>
    `;
    tablaSueltosBody.appendChild(tr);

    tr.querySelector('.edit-btn').addEventListener('click', () => editarSuelto(codigo, item));
    tr.querySelector('.delete-btn').addEventListener('click', () => eliminarSuelto(codigo));
  });
});

// ----------------------------
// CAJEROS
// ----------------------------
const tablaCajerosBody = document.querySelector('#tabla-cajeros tbody');

onValue(ref(db, 'cajeros'), snap => {
  tablaCajerosBody.innerHTML = '';
  if (!snap.exists()) return;
  const data = snap.val();
  Object.values(data).sort((a,b) => a.nro - b.nro).forEach(cajero => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cajero.nro}</td>
      <td>${cajero.nombre}</td>
      <td>${cajero.dni}</td>
      <td>
        <button class="edit-btn">Editar</button>
        <button class="delete-btn">Eliminar</button>
      </td>
    `;
    tablaCajerosBody.appendChild(tr);

    tr.querySelector('.edit-btn').addEventListener('click', () => editarCajero(cajero));
    tr.querySelector('.delete-btn').addEventListener('click', () => eliminarCajero(cajero.nro));
  });
});

// ----------------------------
// CONFIG
// ----------------------------
const btnGuardarConfig = document.getElementById('guardar-config');
const btnRestaurar = document.getElementById('btn-restaurar');

btnGuardarConfig.addEventListener('click', async () => {
  const pwdActual = document.getElementById('config-pass-actual').value;
  const nuevaPass = document.getElementById('config-pass-nueva').value;
  if (pwdActual !== adminPass) return alert('Contraseña incorrecta');
  if (nuevaPass.length < 4 || nuevaPass.length > 12) return alert('Contraseña inválida');
  adminPass = nuevaPass;
  alert('Contraseña actualizada');
});

btnRestaurar.addEventListener('click', () => {
  const master = document.getElementById('master-pass').value;
  if (master !== masterPass) return alert('Contraseña maestra incorrecta');
  adminPass = '1918';
  alert('Contraseña de administrador restaurada a 1918');
});
