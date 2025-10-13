/* ================================
   APP.JS - PARTE 1/4
   Inicialización, navegación y modal admin
   Para Firebase v11.8.1
   ================================ */

import { db, ref, get, set, update, push, remove, onValue } from './init.js';

// ---------------------------
// VARIABLES GLOBALES
// ---------------------------
const sections = document.querySelectorAll('main section');
const navButtons = document.querySelectorAll('.nav-btn');
let currentSection = 'cobro';

let appAdminPassword = '1918';   // Contraseña admin
let masterPassword = '1409';     // Contraseña maestra
let loggedCajero = null;

const cobroControles = document.getElementById('cobro-controles');
const tablaCobroBody = document.querySelector('#tabla-cobro tbody');
const totalDiv = document.getElementById('total-div');
const btnCobrar = document.getElementById('btn-cobrar');

// ---------------------------
// MODAL CONTRASEÑA ADMIN INICIAL
// ---------------------------
const adminModal = document.createElement('div');
adminModal.id = 'admin-modal';
adminModal.innerHTML = `
  <div class="modal-content">
    <h2>🔒 Contraseña Administrador 🔒</h2>
    <input type="password" id="admin-pass-input" placeholder="Contraseña">
    <button id="admin-pass-btn">Ingresar</button>
    <p id="admin-pass-msg" class="msg-error"></p>
  </div>
`;
document.body.appendChild(adminModal);
document.body.style.overflow = 'hidden';

const adminPassInput = document.getElementById('admin-pass-input');
const adminPassBtn = document.getElementById('admin-pass-btn');
const adminPassMsg = document.getElementById('admin-pass-msg');

adminPassBtn.addEventListener('click', () => {
  const val = adminPassInput.value.trim();
  if (val === appAdminPassword || val === masterPassword) {
    adminModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    initApp();
  } else {
    adminPassMsg.textContent = 'Contraseña incorrecta';
  }
});

// ---------------------------
// FUNCIONES GENERALES
// ---------------------------
function showSection(sectionId) {
  sections.forEach(sec => sec.classList.add('hidden'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.remove('hidden');
  currentSection = sectionId;
}

function populateNumberSelect(selectId, min, max) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';
  for (let i = min; i <= max; i++) {
    const val = i.toString().padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  }
}

// ---------------------------
// NAVIGACIÓN POR SECCIONES
// ---------------------------
navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    showSection(btn.dataset.section);
  });
});

// ---------------------------
// INICIALIZACIÓN APP
// ---------------------------
function initApp() {
  showSection('cobro');

  // Cargar selects numéricos
  populateNumberSelect('login-usuario', 1, 99);
  populateNumberSelect('cobro-cantidad', 1, 99);
  populateNumberSelect('stock-cantidad', 1, 999);
  populateNumberSelect('cajero-nro', 1, 99);

  // Preparar tabla cobro y botones
  tablaCobroBody.innerHTML = '';
  totalDiv.textContent = 'TOTAL: $0';
  btnCobrar.classList.add('hidden');
}

/* ================================
   APP.JS - PARTE 2/4
   Sección COBRAR completa
   ================================ */

// ---------------------------
// VARIABLES COBRAR
// ---------------------------
const loginModal = document.getElementById('login-modal');
const loginUsuario = document.getElementById('login-usuario');
const loginPass = document.getElementById('login-pass');
const btnLogin = document.getElementById('btn-login');
const loginMsg = document.getElementById('login-msg');

const cobroCantidad = document.getElementById('cobro-cantidad');
const cobroCodigo = document.getElementById('cobro-codigo');
const cobroProductos = document.getElementById('cobro-productos');
const btnAddProduct = document.getElementById('btn-add-product');

const btnIncrKg = document.getElementById('btn-incr-kg');
const btnDecrKg = document.getElementById('btn-decr-kg');
const inputKgSuelto = document.getElementById('input-kg-suelto');
const cobroCodigoSuelto = document.getElementById('cobro-codigo-suelto');
const cobroSueltos = document.getElementById('cobro-sueltos');
const btnAddSuelto = document.getElementById('btn-add-suelto');

let tablaCobro = []; // Array temporal de productos a cobrar

// ---------------------------
// LOGIN CAJERO
// ---------------------------
btnLogin.addEventListener('click', async () => {
  const nro = loginUsuario.value;
  const pass = loginPass.value.trim();
  const cajeroRef = ref(db, `cajeros/${nro}`);
  const snap = await get(cajeroRef);

  if (!snap.exists()) {
    loginMsg.textContent = 'Cajero inexistente';
    return;
  }

  const cajeroData = snap.val();
  if (cajeroData.pass !== pass) {
    loginMsg.textContent = 'Contraseña incorrecta';
    return;
  }

  loggedCajero = { nro, ...cajeroData };
  loginModal.classList.add('hidden');
  cobroControles.classList.remove('hidden');
  loginMsg.textContent = '';
  loadStockSelects();
});

// ---------------------------
// CARGA DE SELECTS STOCK Y SUELTOS
// ---------------------------
async function loadStockSelects() {
  const stockSnap = await get(ref(db, 'stock'));
  const sueltosSnap = await get(ref(db, 'sueltos'));

  cobroProductos.innerHTML = '<option value="">Elija un Item</option>';
  cobroSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';

  if (stockSnap.exists()) {
    Object.entries(stockSnap.val()).forEach(([codigo, item]) => {
      const opt = document.createElement('option');
      opt.value = codigo;
      opt.textContent = item.nombre;
      cobroProductos.appendChild(opt);
    });
  }

  if (sueltosSnap.exists()) {
    Object.entries(sueltosSnap.val()).forEach(([codigo, item]) => {
      const opt = document.createElement('option');
      opt.value = codigo;
      opt.textContent = item.nombre;
      cobroSueltos.appendChild(opt);
    });
  }
}

// ---------------------------
// FUNCIONES ADD PRODUCTO STOCK
// ---------------------------
btnAddProduct.addEventListener('click', async () => {
  const cantidad = parseInt(cobroCantidad.value);
  const codigo = cobroCodigo.value.trim() || cobroProductos.value;
  if (!codigo) return;

  const snap = await get(ref(db, `stock/${codigo}`));
  if (!snap.exists()) return;

  const item = snap.val();
  const total = cantidad * item.precio;
  tablaCobro.unshift({ tipo: 'stock', codigo, nombre: item.nombre, cantidad, precio: item.precio, total });

  renderTablaCobro();
});

// ---------------------------
// FUNCIONES ADD PRODUCTO SUELTOS
// ---------------------------
btnAddSuelto.addEventListener('click', async () => {
  const kg = parseFloat(inputKgSuelto.value);
  const codigo = cobroCodigoSuelto.value.trim() || cobroSueltos.value;
  if (!codigo) return;

  const snap = await get(ref(db, `sueltos/${codigo}`));
  if (!snap.exists()) return;

  const item = snap.val();
  const total = kg * item.precio; // Ajuste según porcentaje si quieres
  tablaCobro.unshift({ tipo: 'suelto', codigo, nombre: item.nombre, kg, precio: item.precio, total });

  renderTablaCobro();
});

// ---------------------------
// INCREMENTAR / DECREMENTAR KG
// ---------------------------
btnIncrKg.addEventListener('click', () => {
  let val = parseFloat(inputKgSuelto.value);
  val += 0.1;
  if (val > 99.9) val = 99.9;
  inputKgSuelto.value = val.toFixed(3);
});

btnDecrKg.addEventListener('click', () => {
  let val = parseFloat(inputKgSuelto.value);
  val -= 0.1;
  if (val < 0.1) val = 0.1;
  inputKgSuelto.value = val.toFixed(3);
});

// ---------------------------
// RENDER TABLA COBRO
// ---------------------------
function renderTablaCobro() {
  tablaCobroBody.innerHTML = '';
  let totalGeneral = 0;

  tablaCobro.forEach((prod, idx) => {
    const tr = document.createElement('tr');

    const cantKg = prod.tipo === 'stock' ? prod.cantidad : prod.kg.toFixed(3);
    tr.innerHTML = `
      <td>${cantKg}</td>
      <td>${prod.nombre}</td>
      <td>$${prod.precio.toFixed(2)}</td>
      <td>$${prod.total.toFixed(2)}</td>
      <td><button data-idx="${idx}" class="btn-eliminar">Eliminar</button></td>
    `;
    tablaCobroBody.appendChild(tr);
    totalGeneral += prod.total;
  });

  totalDiv.textContent = `TOTAL: $${totalGeneral.toFixed(2)}`;
  btnCobrar.classList.toggle('hidden', tablaCobro.length === 0);

  // EVENTO ELIMINAR
  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      promptAdminEliminar(idx);
    });
  });
}

// ---------------------------
// MODAL ADMIN PARA ELIMINAR PRODUCTO
// ---------------------------
function promptAdminEliminar(idx) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Ingrese contraseña de administrador para eliminar</h3>
      <input type="password" id="del-pass-input">
      <button id="del-pass-aceptar">Aceptar</button>
      <button id="del-pass-cancelar">Cancelar</button>
      <p id="del-pass-msg" class="msg-error"></p>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const passInput = modal.querySelector('#del-pass-input');
  const btnAceptar = modal.querySelector('#del-pass-aceptar');
  const btnCancelar = modal.querySelector('#del-pass-cancelar');
  const msg = modal.querySelector('#del-pass-msg');

  btnAceptar.addEventListener('click', () => {
    if (passInput.value === appAdminPassword || passInput.value === masterPassword) {
      tablaCobro.splice(idx, 1);
      renderTablaCobro();
      document.body.removeChild(modal);
      document.body.style.overflow = 'auto';
    } else {
      msg.textContent = 'Contraseña incorrecta';
    }
  });

  btnCancelar.addEventListener('click', () => {
    document.body.removeChild(modal);
    document.body.style.overflow = 'auto';
  });
}

/* ================================
   APP.JS - PARTE 3/4
   Cobrar, modal de pago, tickets y Movimientos
   ================================ */

const btnCobrarModal = document.getElementById('btn-cobrar');

btnCobrarModal.addEventListener('click', () => {
  if (!loggedCajero) return;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>¿Cómo Pagará el Cliente?</h3>
      <div style="display:flex; gap:5px; margin:10px 0;">
        <button data-tipo="Efectivo">Efectivo</button>
        <button data-tipo="Tarjeta">Tarjeta</button>
        <button data-tipo="QR">QR</button>
        <button data-tipo="Electrónico">Electrónico</button>
        <button data-tipo="Otro">Otro</button>
      </div>
      <button id="cancel-cobro" style="background:red; color:white;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  modal.querySelectorAll('button[data-tipo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tipoPago = btn.dataset.tipo;
      await realizarVenta(tipoPago);
      document.body.removeChild(modal);
      document.body.style.overflow = 'auto';
      tablaCobro = [];
      renderTablaCobro();
      alert('Venta realizada');
    });
  });

  modal.querySelector('#cancel-cobro').addEventListener('click', () => {
    document.body.removeChild(modal);
    document.body.style.overflow = 'auto';
  });
});

// ---------------------------
// FUNCION REALIZAR VENTA
// ---------------------------
async function realizarVenta(tipoPago) {
  const date = new Date();
  const fecha = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()} (${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')})`;

  // Obtener último ID de ticket del día
  const movimientosRef = ref(db, 'movimientos');
  const snap = await get(movimientosRef);
  let idTicket = 'ID_000001';
  if (snap.exists()) {
    const ticketsHoy = Object.keys(snap.val()).filter(k => k.startsWith(`ID_${getDateString()}`));
    const nextNum = ticketsHoy.length + 1;
    idTicket = `ID_${nextNum.toString().padStart(6,'0')}`;
  }

  // Guardar cada producto vendido en MOVIMIENTOS y ajustar STOCK/SUELTOS
  for (const prod of tablaCobro) {
    const prodRef = ref(db, prod.tipo === 'stock' ? `stock/${prod.codigo}` : `sueltos/${prod.codigo}`);
    const snapProd = await get(prodRef);
    if (!snapProd.exists()) continue;

    const actual = snapProd.val();
    if (prod.tipo === 'stock') {
      await update(prodRef, { cant: actual.cant - prod.cantidad });
    } else {
      await update(prodRef, { kg: parseFloat((actual.kg - prod.kg).toFixed(3)) });
    }
  }

  // Guardar movimiento completo
  const total = tablaCobro.reduce((acc, p) => acc + p.total, 0);
  await set(ref(db, `movimientos/${idTicket}`), {
    id: idTicket,
    cajero: loggedCajero.nro,
    fecha,
    tipo: tipoPago,
    total,
    productos: tablaCobro
  });

  // Imprimir ticket
  imprimirTicket(idTicket, fecha, loggedCajero.nro, tablaCobro, total, tipoPago);

  // Actualizar tabla MOVIMIENTOS
  cargarMovimientos();
}

// ---------------------------
// FUNCION OBTENER FECHA PARA ID
// ---------------------------
function getDateString() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getFullYear()}`;
}

// ---------------------------
// IMPRIMIR TICKET
// ---------------------------
function imprimirTicket(id, fecha, cajero, productos, total, tipoPago) {
  const ticketWindow = window.open('', 'PRINT', 'height=400,width=600');
  ticketWindow.document.write(`<pre>`);
  ticketWindow.document.write(`${id}\n`);
  ticketWindow.document.write(`${fecha}\n`);
  ticketWindow.document.write(`Cajero: ${cajero}\n`);
  ticketWindow.document.write(`==========\n`);
  productos.forEach(p => {
    const cantidad = p.tipo === 'stock' ? p.cantidad : p.kg.toFixed(3);
    ticketWindow.document.write(`${p.nombre} $${p.precio.toFixed(2)} (x${cantidad}) = $${p.total.toFixed(2)}\n`);
    ticketWindow.document.write(`==========\n`);
  });
  ticketWindow.document.write(`TOTAL: $${total.toFixed(2)}\n`);
  ticketWindow.document.write(`Pago: ${tipoPago}\n`);
  ticketWindow.document.write(`</pre>`);
  ticketWindow.document.close();
  ticketWindow.print();
}

// ---------------------------
// CARGAR TABLA MOVIMIENTOS
// ---------------------------
const filtroCajero = document.getElementById('filtroCajero');
const tablaMovimientosBody = document.querySelector('#tabla-movimientos tbody');

async function cargarMovimientos() {
  tablaMovimientosBody.innerHTML = '';
  const snap = await get(ref(db, 'movimientos'));
  if (!snap.exists()) return;

  const data = snap.val();
  const filter = filtroCajero.value;

  const tickets = Object.values(data).filter(t => filter === 'TODOS' || t.cajero === filter)
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  tickets.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.id}</td>
      <td>$${t.total.toFixed(2)}</td>
      <td>${t.tipo}</td>
      <td>
        <button class="btn-reimprimir" data-id="${t.id}">Reimprimir</button>
        <button class="btn-eliminar-mov" data-id="${t.id}">Eliminar</button>
      </td>
    `;
    tablaMovimientosBody.appendChild(tr);
  });

  // Eventos botones
  document.querySelectorAll('.btn-reimprimir').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const movSnap = await get(ref(db, `movimientos/${id}`));
      if (!movSnap.exists()) return;
      const t = movSnap.val();
      imprimirTicket(t.id, t.fecha, t.cajero, t.productos, t.total, t.tipo);
    });
  });

  document.querySelectorAll('.btn-eliminar-mov').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      promptAdminEliminarMovimiento(id);
    });
  });
}

// ---------------------------
// FILTRO CAJERO
// ---------------------------
filtroCajero.addEventListener('change', () => {
  cargarMovimientos();
});

// ---------------------------
// MODAL ELIMINAR MOVIMIENTO
// ---------------------------
function promptAdminEliminarMovimiento(id) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Ingrese contraseña de administrador para eliminar ticket</h3>
      <input type="password" id="del-mov-pass-input">
      <button id="del-mov-aceptar">Aceptar</button>
      <button id="del-mov-cancelar">Cancelar</button>
      <p id="del-mov-msg" class="msg-error"></p>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  const passInput = modal.querySelector('#del-mov-pass-input');
  const btnAceptar = modal.querySelector('#del-mov-aceptar');
  const btnCancelar = modal.querySelector('#del-mov-cancelar');
  const msg = modal.querySelector('#del-mov-msg');

  btnAceptar.addEventListener('click', async () => {
    if (passInput.value === appAdminPassword || passInput.value === masterPassword) {
      // Restaurar stock o sueltos
      const movSnap = await get(ref(db, `movimientos/${id}`));
      if (movSnap.exists()) {
        const productos = movSnap.val().productos;
        for (const p of productos) {
          const prodRef = ref(db, p.tipo === 'stock' ? `stock/${p.codigo}` : `sueltos/${p.codigo}`);
          const snapProd = await get(prodRef);
          if (!snapProd.exists()) continue;

          if (p.tipo === 'stock') {
            await update(prodRef, { cant: snapProd.val().cant + p.cantidad });
          } else {
            await update(prodRef, { kg: parseFloat((snapProd.val().kg + p.kg).toFixed(3)) });
          }
        }
      }

      await remove(ref(db, `movimientos/${id}`));
      cargarMovimientos();
      document.body.removeChild(modal);
      document.body.style.overflow = 'auto';
    } else {
      msg.textContent = 'Contraseña incorrecta';
    }
  });

  btnCancelar.addEventListener('click', () => {
    document.body.removeChild(modal);
    document.body.style.overflow = 'auto';
  });
}

/* ================================
   APP.JS - PARTE 4/4
   HISTORIAL, STOCK, SUELTOS, CAJEROS, CONFIG
   ================================ */

// ---------------------------
// VARIABLES GENERALES
// ---------------------------
const historialBody = document.querySelector('#tabla-historial tbody');
const stockBody = document.querySelector('#tabla-stock tbody');
const sueltosBody = document.querySelector('#tabla-sueltos tbody');
const cajerosBody = document.querySelector('#tabla-cajeros tbody');

const configNombre = document.getElementById('config-nombre');
const configPassActual = document.getElementById('config-pass-actual');
const configPassNueva = document.getElementById('config-pass-nueva');
const btnGuardarConfig = document.getElementById('guardar-config');
const masterPassInput = document.getElementById('master-pass');
const btnRestaurar = document.getElementById('btn-restaurar');

// ---------------------------
// HISTORIAL
// ---------------------------
async function cargarHistorial(dia = new Date()) {
  historialBody.innerHTML = '';
  const snap = await get(ref(db, 'movimientos'));
  if (!snap.exists()) return;

  const data = Object.values(snap.val()).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  data.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.id}</td>
      <td>$${t.total.toFixed(2)}</td>
      <td>${t.tipo}</td>
      <td>${t.cajero}</td>
      <td>${t.fecha}</td>
      <td>
        <button class="btn-reimprimir-hist" data-id="${t.id}">Reimprimir</button>
      </td>
    `;
    historialBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-reimprimir-hist').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const tSnap = await get(ref(db, `movimientos/${id}`));
      if (!tSnap.exists()) return;
      const t = tSnap.val();
      imprimirTicket(t.id, t.fecha, t.cajero, t.productos, t.total, t.tipo);
    });
  });
}

// ---------------------------
// STOCK
// ---------------------------
document.getElementById('agregar-stock').addEventListener('click', async () => {
  const codigo = document.getElementById('stock-codigo').value.trim();
  const cant = parseInt(document.getElementById('stock-cantidad').value);

  if (!codigo || cant <= 0) return;

  const stockRef = ref(db, `stock/${codigo}`);
  const snap = await get(stockRef);
  const fecha = new Date();
  const fechaStr = `${fecha.getDate().toString().padStart(2,'0')}/${(fecha.getMonth()+1).toString().padStart(2,'0')}/${fecha.getFullYear()} (${fecha.getHours()}:${fecha.getMinutes().toString().padStart(2,'0')})`;

  if (snap.exists()) {
    await update(stockRef, { cant: snap.val().cant + cant });
  } else {
    await set(stockRef, { nombre:'PRODUCTO NUEVO', cant, fecha: fechaStr, precio:0 });
  }
  cargarStock();
});

async function cargarStock() {
  stockBody.innerHTML = '';
  const snap = await get(ref(db, 'stock'));
  if (!snap.exists()) return;
  Object.entries(snap.val()).sort((a,b) => b[1].fecha.localeCompare(a[1].fecha)).forEach(([codigo,item]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.cant}</td>
      <td>${item.fecha}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>
        <button class="btn-edit-stock" data-codigo="${codigo}">Editar</button>
        <button class="btn-del-stock" data-codigo="${codigo}">Eliminar</button>
      </td>
    `;
    stockBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-edit-stock').forEach(btn => {
    btn.addEventListener('click', () => promptEditStock(btn.dataset.codigo));
  });
  document.querySelectorAll('.btn-del-stock').forEach(btn => {
    btn.addEventListener('click', () => promptDelStock(btn.dataset.codigo));
  });
}

// ---------------------------
// SUELTOS
// ---------------------------
document.getElementById('btn-agregar-suelto').addEventListener('click', async () => {
  const codigo = document.getElementById('sueltos-codigo').value.trim();
  let kg = parseFloat(document.getElementById('sueltos-kg').value);
  if (!codigo || kg <= 0) return;

  const sueltoRef = ref(db, `sueltos/${codigo}`);
  const snap = await get(sueltoRef);
  const fecha = new Date();
  const fechaStr = `${fecha.getDate().toString().padStart(2,'0')}/${(fecha.getMonth()+1).toString().padStart(2,'0')}/${fecha.getFullYear()} (${fecha.getHours()}:${fecha.getMinutes().toString().padStart(2,'0')})`;

  if (snap.exists()) {
    await update(sueltoRef, { kg: parseFloat((snap.val().kg + kg).toFixed(3)) });
  } else {
    await set(sueltoRef, { nombre:'PRODUCTO NUEVO', kg, fecha: fechaStr, precio:0 });
  }
  cargarSueltos();
});

async function cargarSueltos() {
  sueltosBody.innerHTML = '';
  const snap = await get(ref(db, 'sueltos'));
  if (!snap.exists()) return;
  Object.entries(snap.val()).sort((a,b) => b[1].fecha.localeCompare(a[1].fecha)).forEach(([codigo,item]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.kg.toFixed(3)}</td>
      <td>${item.fecha}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>
        <button class="btn-edit-suelto" data-codigo="${codigo}">Editar</button>
        <button class="btn-del-suelto" data-codigo="${codigo}">Eliminar</button>
      </td>
    `;
    sueltosBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-edit-suelto').forEach(btn => {
    btn.addEventListener('click', () => promptEditSueltos(btn.dataset.codigo));
  });
  document.querySelectorAll('.btn-del-suelto').forEach(btn => {
    btn.addEventListener('click', () => promptDelSueltos(btn.dataset.codigo));
  });
}

// ---------------------------
// CAJEROS
// ---------------------------
document.getElementById('agregar-cajero').addEventListener('click', () => {
  promptAdminAgregarCajero();
});

// ---------------------------
// CONFIGURACION
// ---------------------------
btnGuardarConfig.addEventListener('click', async () => {
  if (configPassActual.value !== appAdminPassword) {
    alert('Contraseña incorrecta');
    return;
  }
  if (configNombre.value) {
    await update(ref(db, 'config'), { nombre: configNombre.value });
    document.getElementById('app-title').textContent = configNombre.value;
  }
  if (configPassNueva.value) appAdminPassword = configPassNueva.value;
  configPassActual.value = '';
  configPassNueva.value = '';
  alert('Configuración guardada');
});

btnRestaurar.addEventListener('click', () => {
  if (masterPassInput.value === masterPassword) {
    appAdminPassword = '1918';
    masterPassInput.value = '';
    alert('Contraseña de administrador restaurada');
  } else {
    alert('Contraseña maestra incorrecta');
  }
});

// ---------------------------
// FUNCIONES GENERICAS MODALES EDIT/DEL
// ---------------------------
function promptEditStock(codigo){ /* Implementa modal editar stock */ }
function promptDelStock(codigo){ /* Implementa modal eliminar stock */ }
function promptEditSueltos(codigo){ /* Implementa modal editar sueltos */ }
function promptDelSueltos(codigo){ /* Implementa modal eliminar sueltos */ }
function promptAdminAgregarCajero(){ /* Implementa modal agregar cajero */ }

// ---------------------------
// INICIALIZACION
// ---------------------------
cargarStock();
cargarSueltos();
cargarHistorial();
cargarMovimientos();
