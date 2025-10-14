// app.js - PARTE 1/4 CORREGIDA
import { db, ref, get, set, update, push, remove, onValue } from './init.js'; // wrapper global ya definido

/* ---------------------------
   VARIABLES GLOBALES
--------------------------- */
let CONFIG = { shopName: '', passAdmin: '', masterPass: '' };
let CAJEROS = {};
let STOCK = {};
let SUELTOS = {};
let MOVIMIENTOS = {};
let HISTORIAL = {};
let currentCajero = null;

let carrito = [];

/* ---------------------------
   MODAL ADMIN LOGIN (AL ACCEDER)
--------------------------- */
let loginModal, cobroControles, loginUsuario, loginPass, btnLogin, loginMsg;
let APP_TITLE;

/* ---------------------------
   FUNCIONES UTILES
--------------------------- */
function formatCurrency(valor) {
  return '$' + Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function crearModal(titulo, contenidoHTML, callbackAceptar, callbackCancelar) {
  const overlay = document.createElement('div');
  overlay.classList.add('modal-overlay');

  const modal = document.createElement('div');
  modal.classList.add('modal');
  modal.innerHTML = `<h3>${titulo}</h3>${contenidoHTML}`;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.remove();
      if (callbackCancelar) callbackCancelar();
    }
  });

  return { overlay, modal };
}

function actualizarTotalTabla(tabla) {
  let total = 0;
  tabla.querySelectorAll('tbody tr').forEach(tr => {
    const t = parseFloat(tr.dataset.total) || 0;
    total += t;
  });
  document.getElementById('total-div').textContent = `TOTAL: ${formatCurrency(total)}`;
}

/* ---------------------------
   CARGA INICIAL
--------------------------- */
async function initApp() {
  try {
    const configSnap = await get(ref(db, 'config'));
    CONFIG = configSnap.val();
    APP_TITLE.textContent = CONFIG.shopName + ' - Gestión Comercial V2.12.2';

    const cajerosSnap = await get(ref(db, 'cajeros'));
    CAJEROS = cajerosSnap.exists() ? cajerosSnap.val() : {};
    cargarSelectCajeros();

    loginModal.style.display = 'flex';
    cobroControles.classList.add('hidden');

    // Escucha cambios en stock, sueltos, movimientos y historial
    onValue(ref(db, 'stock'), snap => STOCK = snap.val() || {});
    onValue(ref(db, 'sueltos'), snap => SUELTOS = snap.val() || {});
    onValue(ref(db, 'movimientos'), snap => MOVIMIENTOS = snap.val() || {});
    onValue(ref(db, 'historial'), snap => HISTORIAL = snap.val() || {});
  } catch (err) {
    console.error('Error inicializando app:', err);
  }
}

function cargarSelectCajeros() {
  loginUsuario.innerHTML = '';
  Object.keys(CAJEROS).sort().forEach(nro => {
    const opt = document.createElement('option');
    opt.value = nro;
    opt.textContent = nro.padStart(2, '0');
    loginUsuario.appendChild(opt);
  });
}

/* ---------------------------
   INICIALIZACIÓN DEL DOM
--------------------------- */
window.addEventListener('DOMContentLoaded', async () => {
  // Referencias del DOM
  APP_TITLE = document.getElementById('app-title');
  loginModal = document.getElementById('login-modal');
  cobroControles = document.getElementById('cobro-controles');
  loginUsuario = document.getElementById('login-usuario');
  loginPass = document.getElementById('login-pass');
  btnLogin = document.getElementById('btn-login');
  loginMsg = document.getElementById('login-msg');

  // Inicializar app
  await initApp();

  // NAVEGACIÓN ENTRE SECCIONES
  const SECCIONES = {
    COBRAR: document.getElementById('cobro'),
    MOVIMIENTOS: document.getElementById('movimientos'),
    HISTORIAL: document.getElementById('historial'),
    STOCK: document.getElementById('stock'),
    SUELTOS: document.getElementById('sueltos'),
    CAJEROS: document.getElementById('cajeros'),
    CONFIG: document.getElementById('config')
  };
  const NAV_BTNS = document.querySelectorAll('.nav-btn');

  NAV_BTNS.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section.toUpperCase();
      Object.values(SECCIONES).forEach(sec => sec.classList.add('hidden'));
      SECCIONES[target].classList.remove('hidden');
    });
  });

  /* ---------------------------
     LOGIN CAJERO / ADMIN
  --------------------------- */
  btnLogin.addEventListener('click', () => {
    const nro = loginUsuario.value;
    const pass = loginPass.value.trim();

    if (!nro) return;

    if (pass === CONFIG.passAdmin || pass === CONFIG.masterPass) {
      loginMsg.textContent = '';
      loginModal.style.display = 'none';
      cobroControles.classList.remove('hidden');
      currentCajero = { nro, nombre: CAJEROS[nro]?.nombre || 'ADMIN' };
    } else if (CAJEROS[nro] && CAJEROS[nro].pass === pass) {
      loginMsg.textContent = '';
      loginModal.style.display = 'none';
      cobroControles.classList.remove('hidden');
      currentCajero = { nro, nombre: CAJEROS[nro].nombre };
    } else {
      loginMsg.textContent = 'Contraseña incorrecta';
    }
  });
});

// app.js - PARTE 2/4 (COBRAR)
const cobroCantidad = document.getElementById('cobro-cantidad');
const cobroCodigo = document.getElementById('cobro-codigo');
const cobroProductos = document.getElementById('cobro-productos');
const btnAddProduct = document.getElementById('btn-add-product');

const inputKgSuelto = document.getElementById('input-kg-suelto');
const cobroCodigoSuelto = document.getElementById('cobro-codigo-suelto');
const cobroSueltosSelect = document.getElementById('cobro-sueltos');
const btnAddSuelto = document.getElementById('btn-add-suelto');
const btnIncrKg = document.getElementById('btn-incr-kg');
const btnDecrKg = document.getElementById('btn-decr-kg');

const tablaCobro = document.getElementById('tabla-cobro').querySelector('tbody');
const totalDiv = document.getElementById('total-div');
const btnCobrar = document.getElementById('btn-cobrar');

let carrito = [];

/* ---------------------------
   INICIALIZAR SELECTS
--------------------------- */
function cargarSelectCantidad() {
  cobroCantidad.innerHTML = '';
  for (let i = 1; i <= 99; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    cobroCantidad.appendChild(opt);
  }
}

function cargarSelectStock() {
  cobroProductos.innerHTML = '<option value="">Elija un Item</option>';
  Object.entries(STOCK).forEach(([codigo, prod]) => {
    const opt = document.createElement('option');
    opt.value = codigo;
    opt.textContent = prod.nombre;
    cobroProductos.appendChild(opt);
  });
}

function cargarSelectSueltos() {
  cobroSueltosSelect.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
  Object.entries(SUELTOS).forEach(([codigo, prod]) => {
    const opt = document.createElement('option');
    opt.value = codigo;
    opt.textContent = prod.nombre;
    cobroSueltosSelect.appendChild(opt);
  });
}

/* ---------------------------
   BOTONES + / - KG SUELTOS
--------------------------- */
btnIncrKg.addEventListener('click', () => {
  let val = parseFloat(inputKgSuelto.value);
  if (val + 0.1 <= 99.9) {
    val += 0.1;
    inputKgSuelto.value = val.toFixed(3);
  }
});

btnDecrKg.addEventListener('click', () => {
  let val = parseFloat(inputKgSuelto.value);
  if (val - 0.1 >= 0.1) {
    val -= 0.1;
    inputKgSuelto.value = val.toFixed(3);
  }
});

/* ---------------------------
   AGREGAR PRODUCTO STOCK
--------------------------- */
btnAddProduct.addEventListener('click', () => {
  const codigo = cobroCodigo.value || cobroProductos.value;
  const cant = parseInt(cobroCantidad.value);
  if (!codigo || !STOCK[codigo]) return;

  const prod = STOCK[codigo];
  const total = cant * parseFloat(prod.precio || 0);

  carrito.unshift({ tipo: 'stock', codigo, nombre: prod.nombre, cantidad: cant, precioUnidad: parseFloat(prod.precio || 0), total });

  actualizarTablaCobro();
  btnCobrar.classList.remove('hidden');
});

/* ---------------------------
   AGREGAR PRODUCTO SUELTOS
--------------------------- */
btnAddSuelto.addEventListener('click', () => {
  const codigo = cobroCodigoSuelto.value || cobroSueltosSelect.value;
  const kg = parseFloat(inputKgSuelto.value);
  if (!codigo || !SUELTOS[codigo]) return;

  const prod = SUELTOS[codigo];
  const total = kg * parseFloat(prod.precio || 0);

  carrito.unshift({ tipo: 'sueltos', codigo, nombre: prod.nombre, cantidad: kg, precioUnidad: parseFloat(prod.precio || 0), total });

  actualizarTablaCobro();
  btnCobrar.classList.remove('hidden');
});

/* ---------------------------
   ACTUALIZAR TABLA COBRO
--------------------------- */
function actualizarTablaCobro() {
  tablaCobro.innerHTML = '';
  carrito.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.total = item.total;
    tr.innerHTML = `
      <td>${item.cantidad}</td>
      <td>${item.nombre}</td>
      <td>${formatCurrency(item.precioUnidad)}</td>
      <td>${formatCurrency(item.total)}</td>
      <td><button class="btn-eliminar" data-idx="${idx}">Eliminar</button></td>
    `;
    tablaCobro.appendChild(tr);
  });

  actualizarTotalTabla(tablaCobro);

  // Eventos eliminar fila
  tablaCobro.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const password = prompt('Ingrese contraseña de administrador para eliminar este producto:');
      if (password === CONFIG.passAdmin) {
        carrito.splice(idx, 1);
        actualizarTablaCobro();
      } else {
        alert('Contraseña incorrecta');
      }
    });
  });
}

/* ---------------------------
   COBRAR VENTA
--------------------------- */
btnCobrar.addEventListener('click', () => {
  if (!carrito.length) return;

  const { overlay, modal } = crearModal('¿Cómo Pagará el Cliente?', `
    <button data-pago="Efectivo">Efectivo</button>
    <button data-pago="Tarjeta">Tarjeta</button>
    <button data-pago="QR">QR</button>
    <button data-pago="Electrónico">Electrónico</button>
    <button data-pago="Otro">Otro</button>
    <button id="cancelar-cobro" style="background:red; color:#fff;">Cancelar</button>
  `);

  modal.querySelectorAll('button[data-pago]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tipoPago = btn.dataset.pago;
      await registrarVenta(tipoPago);
      overlay.remove();
      carrito = [];
      actualizarTablaCobro();
      btnCobrar.classList.add('hidden');
      alert('Venta realizada');
    });
  });

  modal.querySelector('#cancelar-cobro').addEventListener('click', () => {
    overlay.remove();
  });
});

/* ---------------------------
   FUNCION REGISTRAR VENTA
--------------------------- */
async function registrarVenta(tipoPago) {
  const fecha = new Date();
  const idTicket = Object.keys(MOVIMIENTOS).length + 1;
  const idStr = 'ID_' + String(idTicket).padStart(6, '0');

  const venta = {
    id: idStr,
    fecha: `${fecha.getDate()}/${fecha.getMonth()+1}/${fecha.getFullYear()} (${fecha.getHours()}:${fecha.getMinutes()})`,
    cajero: currentCajero.nro,
    productos: carrito,
    total: carrito.reduce((a,b)=>a+b.total,0),
    tipoPago
  };

  // Actualizar stock y sueltos
  for (const item of carrito) {
    if (item.tipo === 'stock') {
      const prodRef = ref(db, `stock/${item.codigo}/cant`);
      const snap = await get(prodRef);
      const nuevaCant = (snap.val() || 0) - item.cantidad;
      await set(prodRef, nuevaCant);
    } else if (item.tipo === 'sueltos') {
      const prodRef = ref(db, `sueltos/${item.codigo}/kg`);
      const snap = await get(prodRef);
      const nuevaKg = (snap.val() || 0) - item.cantidad;
      await set(prodRef, nuevaKg);
    }
  }

  await set(ref(db, `movimientos/${idStr}`), venta);
  await set(ref(db, `historial/${idStr}`), venta);
}

// app.js - PARTE 3/4 (MOVIMIENTOS + HISTORIAL)
const filtroCajero = document.getElementById('filtroCajero');
const tablaMovimientos = document.getElementById('tabla-movimientos').querySelector('tbody');
const tablaHistorial = document.getElementById('tabla-historial').querySelector('tbody');
const btnTirarZ = document.getElementById('btn-tirar-z');

let MOVIMIENTOS = {};
let HISTORIAL = {};

// ---------------------------
// CARGAR MOVIMIENTOS EN TABLA
// ---------------------------
function cargarMovimientosTabla() {
  tablaMovimientos.innerHTML = '';
  const cajeroFiltro = filtroCajero.value;
  Object.values(MOVIMIENTOS)
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach(mov => {
      if (cajeroFiltro !== 'TODOS' && mov.cajero !== cajeroFiltro) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${mov.id}</td>
        <td>${formatCurrency(mov.total)}</td>
        <td>${mov.tipoPago}</td>
        <td>
          <button class="btn-ver" data-id="${mov.id}">Reimprimir</button>
          <button class="btn-eliminar" data-id="${mov.id}">Eliminar</button>
        </td>
      `;
      tablaMovimientos.appendChild(tr);
    });

  // Botones Reimprimir
  tablaMovimientos.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const venta = MOVIMIENTOS[id];
      mostrarTicketModal(venta);
    });
  });

  // Botones Eliminar
  tablaMovimientos.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const pass = prompt('Ingrese contraseña de administrador para eliminar ticket:');
      if (pass === CONFIG.passAdmin) {
        const venta = MOVIMIENTOS[id];
        // Restaurar stock y sueltos
        for (const item of venta.productos) {
          if (item.tipo === 'stock') {
            const refStock = ref(db, `stock/${item.codigo}/cant`);
            const snap = await get(refStock);
            const nuevaCant = (snap.val() || 0) + item.cantidad;
            await set(refStock, nuevaCant);
          } else if (item.tipo === 'sueltos') {
            const refSuelto = ref(db, `sueltos/${item.codigo}/kg`);
            const snap = await get(refSuelto);
            const nuevaKg = (snap.val() || 0) + item.cantidad;
            await set(refSuelto, nuevaKg);
          }
        }
        await remove(ref(db, `movimientos/${id}`));
        delete MOVIMIENTOS[id];
        cargarMovimientosTabla();
        alert('Ticket eliminado y stock restaurado');
      } else {
        alert('Contraseña incorrecta');
      }
    });
  });
}

// ---------------------------
// CARGAR HISTORIAL EN TABLA
// ---------------------------
function cargarHistorialTabla() {
  tablaHistorial.innerHTML = '';
  const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  Object.values(HISTORIAL)
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach(hist => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${hist.id}</td>
        <td>${formatCurrency(hist.total)}</td>
        <td>${hist.tipoPago}</td>
        <td>${hist.cajero}</td>
        <td>${hist.fecha}</td>
        <td><button class="btn-ver" data-id="${hist.id}">Reimprimir</button></td>
      `;
      tablaHistorial.appendChild(tr);
    });

  tablaHistorial.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const venta = HISTORIAL[id];
      mostrarTicketModal(venta);
    });
  });
}

// ---------------------------
// FILTRO POR CAJERO
// ---------------------------
filtroCajero.addEventListener('change', cargarMovimientosTabla);

// ---------------------------
// TIRAR Z
// ---------------------------
btnTirarZ.addEventListener('click', async () => {
  const confirmacion = confirm('⚠️ADVERTENCIA: Tirar Z no puede revertirse. ¿Desea continuar?');
  if (!confirmacion) return;
  for (const id in MOVIMIENTOS) {
    await remove(ref(db, `movimientos/${id}`));
  }
  MOVIMIENTOS = {};
  cargarMovimientosTabla();
  alert('Z tirado correctamente, movimientos eliminados');
});

// ---------------------------
// MOSTRAR MODAL TICKET
// ---------------------------
function mostrarTicketModal(venta) {
  const { overlay, modal } = crearModal(`Ticket ${venta.id}`, '');
  const div = document.createElement('div');
  div.id = 'texto-ticket-modal';
  div.innerHTML = `
    <p>ID: ${venta.id}</p>
    <p>Fecha: ${venta.fecha}</p>
    <p>Cajero: ${venta.cajero}</p>
    <hr id="hr-ticket">
    ${venta.productos.map(p => `
      <p>${p.nombre} $${p.precioUnidad} (${p.cantidad}) = $${p.total.toFixed(2)}</p>
    `).join('')}
    <hr id="hr-ticket">
    <p>TOTAL: $${venta.total.toFixed(2)}</p>
    <p>Pago: ${venta.tipoPago}</p>
    <button id="reimprimir-ticket">Reimprimir</button>
    <button id="cerrar-ticket">Cancelar</button>
  `;
  modal.appendChild(div);

  modal.querySelector('#cerrar-ticket').addEventListener('click', () => overlay.remove());
  modal.querySelector('#reimprimir-ticket').addEventListener('click', () => {
    imprimirTicketMov(venta); // función de impresión ya definida en tu proyecto
    overlay.remove();
  });
}

// ---------------------------
// SINCRONIZAR FIREBASE
// ---------------------------
onValue(ref(db, 'movimientos'), snap => {
  MOVIMIENTOS = snap.exists() ? snap.val() : {};
  cargarMovimientosTabla();
});

onValue(ref(db, 'historial'), snap => {
  HISTORIAL = snap.exists() ? snap.val() : {};
  cargarHistorialTabla();
});

// app.js - PARTE 4/4 (STOCK + SUELTOS + CAJEROS + CONFIG)

// ---------------------------
// STOCK
// ---------------------------
const stockCodigo = document.getElementById('stock-codigo');
const stockCantidad = document.getElementById('stock-cantidad');
const btnAgregarStock = document.getElementById('agregar-stock');
const btnBuscarStock = document.getElementById('buscar-stock');
const tablaStock = document.getElementById('tabla-stock').querySelector('tbody');

let STOCK = {};

onValue(ref(db, 'stock'), snap => {
  STOCK = snap.exists() ? snap.val() : {};
  renderStockTabla();
});

function renderStockTabla(filtro = '') {
  tablaStock.innerHTML = '';
  Object.values(STOCK)
    .filter(item => item.codigo.includes(filtro) || item.nombre.toLowerCase().includes(filtro.toLowerCase()))
    .sort((a,b) => b.fecha.localeCompare(a.fecha))
    .forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.codigo}</td>
        <td>${item.nombre}</td>
        <td>${item.cant.toFixed(2)}</td>
        <td>${item.fecha}</td>
        <td>$${item.precio.toFixed(2)}</td>
        <td>
          <button class="btn-guardar" data-codigo="${item.codigo}">Editar</button>
          <button class="btn-eliminar" data-codigo="${item.codigo}">Eliminar</button>
        </td>
      `;
      tablaStock.appendChild(tr);
    });

  // Editar stock
  tablaStock.querySelectorAll('.btn-guardar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codigo = btn.dataset.codigo;
      const pass = prompt('Contraseña de administrador:');
      if (pass === CONFIG.passAdmin) {
        const nombre = prompt('Nombre del producto:', STOCK[codigo].nombre);
        const cant = parseFloat(prompt('Cantidad:', STOCK[codigo].cant));
        const precio = parseFloat(prompt('Precio unitario:', STOCK[codigo].precio));
        await update(ref(db, `stock/${codigo}`), { nombre, cant, precio, fecha: fechaHoraActual() });
      } else {
        alert('Contraseña incorrecta');
      }
    });
  });

  // Eliminar stock
  tablaStock.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codigo = btn.dataset.codigo;
      const pass = prompt('Contraseña de administrador:');
      if (pass === CONFIG.passAdmin) {
        await remove(ref(db, `stock/${codigo}`));
      } else {
        alert('Contraseña incorrecta');
      }
    });
  });
}

btnAgregarStock.addEventListener('click', async () => {
  const codigo = stockCodigo.value.trim();
  const cant = parseFloat(stockCantidad.value);
  if (!codigo || isNaN(cant)) return;
  const fecha = fechaHoraActual();
  if (STOCK[codigo]) {
    const nuevaCant = STOCK[codigo].cant + cant;
    await update(ref(db, `stock/${codigo}`), { cant: nuevaCant, fecha });
  } else {
    await set(ref(db, `stock/${codigo}`), { codigo, nombre: 'PRODUCTO NUEVO', cant, precio: 0, fecha });
  }
  stockCodigo.value = '';
});

// Buscar stock
btnBuscarStock.addEventListener('click', () => renderStockTabla(stockCodigo.value));

// ---------------------------
// SUELTOS
// ---------------------------
const sueltosCodigo = document.getElementById('sueltos-codigo');
const sueltosKg = document.getElementById('sueltos-kg');
const btnIncrSuelto = document.getElementById('sueltos-btn-incr');
const btnDecrSuelto = document.getElementById('sueltos-btn-decr');
const btnAgregarSuelto = document.getElementById('btn-agregar-suelto');
const btnBuscarSuelto = document.getElementById('btn-buscar-suelto');
const tablaSueltos = document.getElementById('tabla-sueltos').querySelector('tbody');

let SUELTOS = {};

onValue(ref(db, 'sueltos'), snap => {
  SUELTOS = snap.exists() ? snap.val() : {};
  renderSueltosTabla();
});

function renderSueltosTabla(filtro = '') {
  tablaSueltos.innerHTML = '';
  Object.values(SUELTOS)
    .filter(item => item.codigo.includes(filtro) || item.nombre.toLowerCase().includes(filtro.toLowerCase()))
    .sort((a,b) => b.fecha.localeCompare(a.fecha))
    .forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.codigo}</td>
        <td>${item.nombre}</td>
        <td>${item.kg.toFixed(3)}</td>
        <td>${item.fecha}</td>
        <td>$${item.precio.toFixed(2)}</td>
        <td>
          <button class="btn-guardar" data-codigo="${item.codigo}">Editar</button>
          <button class="btn-eliminar" data-codigo="${item.codigo}">Eliminar</button>
        </td>
      `;
      tablaSueltos.appendChild(tr);
    });

  // Editar sueltos
  tablaSueltos.querySelectorAll('.btn-guardar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codigo = btn.dataset.codigo;
      const pass = prompt('Contraseña de administrador:');
      if (pass === CONFIG.passAdmin) {
        const nombre = prompt('Nombre del producto:', SUELTOS[codigo].nombre);
        const kg = parseFloat(prompt('KG:', SUELTOS[codigo].kg));
        const precio = parseFloat(prompt('Precio unitario:', SUELTOS[codigo].precio));
        await update(ref(db, `sueltos/${codigo}`), { nombre, kg, precio, fecha: fechaHoraActual() });
      } else {
        alert('Contraseña incorrecta');
      }
    });
  });

  // Eliminar sueltos
  tablaSueltos.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codigo = btn.dataset.codigo;
      const pass = prompt('Contraseña de administrador:');
      if (pass === CONFIG.passAdmin) {
        await remove(ref(db, `sueltos/${codigo}`));
      } else {
        alert('Contraseña incorrecta');
      }
    });
  });
}

// Incrementar/decrementar
btnIncrSuelto.addEventListener('click', () => {
  let val = parseFloat(sueltosKg.value);
  if (val < 99) val += 0.100; sueltosKg.value = val.toFixed(3);
});
btnDecrSuelto.addEventListener('click', () => {
  let val = parseFloat(sueltosKg.value);
  if (val > 0) val -= 0.100; sueltosKg.value = val.toFixed(3);
});

btnAgregarSuelto.addEventListener('click', async () => {
  const codigo = sueltosCodigo.value.trim();
  const kg = parseFloat(sueltosKg.value);
  if (!codigo || isNaN(kg)) return;
  const fecha = fechaHoraActual();
  if (SUELTOS[codigo]) {
    const nuevoKg = SUELTOS[codigo].kg + kg;
    await update(ref(db, `sueltos/${codigo}`), { kg: nuevoKg, fecha });
  } else {
    await set(ref(db, `sueltos/${codigo}`), { codigo, nombre: 'PRODUCTO NUEVO', kg, precio: 0, fecha });
  }
  sueltosCodigo.value = '';
});

// Buscar sueltos
btnBuscarSuelto.addEventListener('click', () => renderSueltosTabla(sueltosCodigo.value));

// ---------------------------
// CAJEROS
// ---------------------------
const cajeroNro = document.getElementById('cajero-nro');
const cajeroNombre = document.getElementById('cajero-nombre');
const cajeroDNI = document.getElementById('cajero-dni');
const cajeroPass = document.getElementById('cajero-pass');
const btnAgregarCajero = document.getElementById('agregar-cajero');
const tablaCajeros = document.getElementById('tabla-cajeros').querySelector('tbody');

let CAJEROS = {};

onValue(ref(db, 'cajeros'), snap => {
  CAJEROS = snap.exists() ? snap.val() : {};
  renderCajerosTabla();
});

function renderCajerosTabla() {
  tablaCajeros.innerHTML = '';
  Object.values(CAJEROS)
    .sort((a,b) => a.nro.localeCompare(b.nro))
    .forEach(caj => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${caj.nro}</td>
        <td>${caj.nombre}</td>
        <td>${caj.dni}</td>
        <td>
          <button class="btn-guardar" data-nro="${caj.nro}">Editar</button>
          <button class="btn-eliminar" data-nro="${caj.nro}">Eliminar</button>
        </td>
      `;
      tablaCajeros.appendChild(tr);
    });

  // Editar cajero
  tablaCajeros.querySelectorAll('.btn-guardar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nro = btn.dataset.nro;
      const pass = prompt('Contraseña de administrador:');
      if (pass === CONFIG.passAdmin) {
        const nombre = prompt('Nombre:', CAJEROS[nro].nombre);
        const dni = prompt('DNI:', CAJEROS[nro].dni);
        const clave = prompt('Contraseña:', CAJEROS[nro].pass);
        await update(ref(db, `cajeros/${nro}`), { nombre, dni, pass: clave });
      } else alert('Contraseña incorrecta');
    });
  });

  // Eliminar cajero
  tablaCajeros.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nro = btn.dataset.nro;
      const pass = prompt('Contraseña de administrador:');
      if (pass === CONFIG.passAdmin) {
        await remove(ref(db, `cajeros/${nro}`));
      } else alert('Contraseña incorrecta');
    });
  });
}

btnAgregarCajero.addEventListener('click', async () => {
  const nro = cajeroNro.value.padStart(2,'0');
  const nombre = cajeroNombre.value.trim();
  const dni = cajeroDNI.value.trim();
  const pass = cajeroPass.value.trim();
  if (!nro || !nombre || !dni || !pass) return alert('Complete todos los campos');
  const admPass = prompt('Contraseña de administrador:');
  if (admPass !== CONFIG.passAdmin) return alert('Contraseña incorrecta');
  await set(ref(db, `cajeros/${nro}`), { nro, nombre, dni, pass });
  cajeroNombre.value = ''; cajeroDNI.value = ''; cajeroPass.value = '';
});

// ---------------------------
// CONFIGURACIÓN
// ---------------------------
const configNombre = document.getElementById('config-nombre');
const configPassActual = document.getElementById('config-pass-actual');
const configPassNueva = document.getElementById('config-pass-nueva');
const btnGuardarConfig = document.getElementById('guardar-config');
const masterPassInput = document.getElementById('master-pass');
const btnRestaurar = document.getElementById('btn-restaurar');

let CONFIG = {};

onValue(ref(db, 'config'), snap => {
  CONFIG = snap.exists() ? snap.val() : {};
  configNombre.value = CONFIG.shopName || '';
});

btnGuardarConfig.addEventListener('click', async () => {
  const nombre = configNombre.value.trim();
  const passActual = configPassActual.value.trim();
  const passNueva = configPassNueva.value.trim();
  if (passActual && passActual !== CONFIG.passAdmin) return alert('Contraseña actual incorrecta');
  const updates = { shopName: nombre };
  if (passNueva) updates.passAdmin = passNueva;
  await update(ref(db, 'config'), updates);
  alert('Configuración guardada');
  configPassActual.value = ''; configPassNueva.value = '';
});

// ---------------------------
// FUNCIONES UTILES
// ---------------------------
function fechaHoraActual() {
  const now = new Date();
  return now.toISOString().replace('T',' ').split('.')[0]; // YYYY-MM-DD HH:MM:SS
}

function formatCurrency(valor) {
  return parseFloat(valor).toLocaleString('es-AR',{style:'currency',currency:'ARS'});
}
