// app.js - PARTE 1
import { db, ref, get, set, update, push, remove, onValue } from './init.js'; // wrapper global

/*****************************************
 * VARIABLES GLOBALES
 *****************************************/
let usuarioActivo = null; // Cajero logueado
let cobroTabla = [];      // Array temporal de productos agregados a cobrar
let idTicketDiario = 1;   // ID incremental diario
let stockItems = {};      // Contendrá todos los productos de stock
let sueltosItems = {};    // Contendrá todos los productos de sueltos
let configGlobal = {};    // Configuración de la tienda

/*****************************************
 * SELECTORES PRINCIPALES
 *****************************************/
const loginModal = document.getElementById("login-modal");
const loginUsuario = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");

const secciones = document.querySelectorAll("main section");
const navBtns = document.querySelectorAll(".nav-btn");

const cobroControles = document.getElementById("cobro-controles");
const selectCantidad = document.getElementById("cobro-cantidad");
const selectProductos = document.getElementById("cobro-productos");
const inputCodigo = document.getElementById("cobro-codigo");
const btnAddProduct = document.getElementById("btn-add-product");
const tablaCobro = document.getElementById("tabla-cobro").querySelector("tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");

const inputKgSuelto = document.getElementById("input-kg-suelto");
const btnIncrKg = document.getElementById("btn-incr-kg");
const btnDecrKg = document.getElementById("btn-decr-kg");
const inputCodigoSuelto = document.getElementById("cobro-codigo-suelto");
const selectSuelto = document.getElementById("cobro-sueltos");
const btnAddSuelto = document.getElementById("btn-add-suelto");

/*****************************************
 * FUNCIONES AUXILIARES
 *****************************************/

// Inicializa select de cantidades (1-99)
function initCantidadSelect(selectElement) {
  selectElement.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    let opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i.toString().padStart(2, "0");
    selectElement.appendChild(opt);
  }
}

// Mostrar una sección y ocultar las demás
function mostrarSeccion(seccionId) {
  secciones.forEach(sec => sec.classList.add("hidden"));
  const secActiva = document.getElementById(seccionId);
  if (secActiva) secActiva.classList.remove("hidden");
}

// Actualizar total en COBRAR
function actualizarTotal() {
  let total = 0;
  cobroTabla.forEach(item => total += parseFloat(item.total));
  totalDiv.textContent = `TOTAL: $${total.toFixed(2)}`;
}

// Crear fila en tabla de COBRO
function agregarFilaTabla(item) {
  const tr = document.createElement("tr");
  tr.dataset.codigo = item.codigo;

  tr.innerHTML = `
    <td>${item.cantKg}</td>
    <td>${item.nombre}</td>
    <td>$${item.precio.toFixed(2)}</td>
    <td>$${item.total.toFixed(2)}</td>
    <td><button class="btn-eliminar" data-codigo="${item.codigo}">Eliminar</button></td>
  `;

  tablaCobro.prepend(tr);

  // Evento eliminar fila
  tr.querySelector(".btn-eliminar").addEventListener("click", () => {
    if (!usuarioActivo) {
      alert("Debe iniciar sesión un cajero para eliminar.");
      return;
    }
    // Eliminar de array
    cobroTabla = cobroTabla.filter(x => x.codigo !== item.codigo);
    tr.remove();
    actualizarTotal();
  });
}

// Incrementar KG
btnIncrKg.addEventListener("click", () => {
  let val = parseFloat(inputKgSuelto.value);
  if (val < 99.9) val += 0.1;
  inputKgSuelto.value = val.toFixed(3);
});

// Decrementar KG
btnDecrKg.addEventListener("click", () => {
  let val = parseFloat(inputKgSuelto.value);
  if (val > 0.1) val -= 0.1;
  inputKgSuelto.value = val.toFixed(3);
});

/*****************************************
 * LOGIN ADMIN AL ABRIR APP
 *****************************************/
async function loginAdminModal() {
  loginModal.classList.remove("hidden");
  cobroControles.classList.add("hidden");

  btnLogin.addEventListener("click", async () => {
    const passIngresada = loginPass.value.trim();
    const configSnap = await get(ref(db, "config"));
    configGlobal = configSnap.exists() ? configSnap.val() : { passAdmin: "1918", masterPass: "1409" };

    if (passIngresada === configGlobal.passAdmin || passIngresada === configGlobal.masterPass) {
      loginModal.classList.add("hidden");
      cobroControles.classList.remove("hidden");
      loginMsg.textContent = "";
      initApp();
    } else {
      loginMsg.textContent = "Contraseña incorrecta";
    }
  });
}

/*****************************************
 * LOGIN DE CAJERO EN COBRAR
 *****************************************/
btnLogin.addEventListener("click", async () => {
  const nroCajero = loginUsuario.value;
  const pass = loginPass.value.trim();

  const cajeroSnap = await get(ref(db, `cajeros/${nroCajero}`));
  if (!cajeroSnap.exists() || cajeroSnap.val().pass !== pass) {
    loginMsg.textContent = "Contraseña incorrecta";
    return;
  }

  usuarioActivo = { nro: nroCajero, ...cajeroSnap.val() };
  loginMsg.textContent = "";
  loginModal.classList.add("hidden");
  cobroControles.classList.remove("hidden");
  console.log("Cajero logueado:", usuarioActivo);
});

/*****************************************
 * INICIALIZACIÓN GENERAL
 *****************************************/
async function initApp() {
  // Inicializar selects
  initCantidadSelect(selectCantidad);

  // Inicializar select de cajeros
  await cargarCajerosSelect();

  // Inicializar productos STOCK y SUELTOS
  await cargarProductosStock();
  await cargarProductosSueltos();

  // Inicializar navegación
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      mostrarSeccion(btn.dataset.section);
    });
  });

  // Por defecto mostrar COBRAR
  mostrarSeccion("cobro");

  // Evento añadir producto STOCK
  btnAddProduct.addEventListener("click", () => {
    const codigo = inputCodigo.value.trim();
    const cantidad = parseInt(selectCantidad.value);
    if (!codigo || !stockItems[codigo]) return;

    const item = stockItems[codigo];
    const total = cantidad * item.precio;

    const nuevoItem = {
      codigo,
      nombre: item.nombre,
      cantKg: cantidad,
      precio: item.precio,
      total
    };
    cobroTabla.push(nuevoItem);
    agregarFilaTabla(nuevoItem);
    actualizarTotal();
    inputCodigo.value = "";
  });

  // Evento añadir producto SUELTOS
  btnAddSuelto.addEventListener("click", () => {
    const codigo = inputCodigoSuelto.value.trim();
    const kg = parseFloat(inputKgSuelto.value);
    if (!codigo || !sueltosItems[codigo]) return;

    const item = sueltosItems[codigo];
    const total = kg * item.precio; // Ajuste por porcentaje más adelante

    const nuevoItem = {
      codigo,
      nombre: item.nombre,
      cantKg: kg.toFixed(3),
      precio: item.precio,
      total
    };
    cobroTabla.push(nuevoItem);
    agregarFilaTabla(nuevoItem);
    actualizarTotal();
    inputCodigoSuelto.value = "0.100";
  });
}

/*****************************************
 * CARGAR CAJEROS EN SELECT
 *****************************************/
async function cargarCajerosSelect() {
  const cajerosSnap = await get(ref(db, "cajeros"));
  loginUsuario.innerHTML = "";
  if (cajerosSnap.exists()) {
    const data = cajerosSnap.val();
    Object.keys(data).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key.padStart(2, "0");
      loginUsuario.appendChild(opt);
    });
  }
}

/*****************************************
 * CARGAR PRODUCTOS STOCK
 *****************************************/
async function cargarProductosStock() {
  const stockSnap = await get(ref(db, "stock"));
  stockItems = stockSnap.exists() ? stockSnap.val() : {};
  selectProductos.innerHTML = `<option value="">Elija un Item</option>`;
  Object.keys(stockItems).forEach(cod => {
    const opt = document.createElement("option");
    opt.value = cod;
    opt.textContent = stockItems[cod].nombre;
    selectProductos.appendChild(opt);
  });
}

/*****************************************
 * CARGAR PRODUCTOS SUELTOS
 *****************************************/
async function cargarProductosSueltos() {
  const sueltosSnap = await get(ref(db, "sueltos"));
  sueltosItems = sueltosSnap.exists() ? sueltosSnap.val() : {};
  selectSuelto.innerHTML = `<option value="">Elija un Item (Sueltos)</option>`;
  Object.keys(sueltosItems).forEach(cod => {
    const opt = document.createElement("option");
    opt.value = cod;
    opt.textContent = sueltosItems[cod].nombre;
    selectSuelto.appendChild(opt);
  });
}

/*****************************************
 * INICIALIZAR APP AL CARGAR
 *****************************************/
document.addEventListener("DOMContentLoaded", loginAdminModal);

// app.js - PARTE 2
/*****************************************
 * MODAL DE TIPO DE PAGO
 *****************************************/
function abrirModalPago() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <h3>¿Cómo Pagará el Cliente?</h3>
    <button data-tipo="Efectivo">Efectivo</button>
    <button data-tipo="Tarjeta">Tarjeta</button>
    <button data-tipo="QR">QR</button>
    <button data-tipo="Electrónico">Electrónico</button>
    <button data-tipo="Otro">Otro</button>
    <br><br>
    <button id="btn-cancelar-modal" style="background:red;color:white;">Cancelar</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Cerrar modal
  document.getElementById("btn-cancelar-modal").addEventListener("click", () => {
    overlay.remove();
  });

  // Selección de pago
  modal.querySelectorAll("button[data-tipo]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tipoPago = btn.dataset.tipo;
      await registrarVenta(tipoPago);
      overlay.remove();
    });
  });
}

/*****************************************
 * FUNCION REGISTRAR VENTA
 *****************************************/
async function registrarVenta(tipoPago) {
  if (!usuarioActivo) return;

  const fecha = new Date();
  const fechaStr = `${fecha.getDate().toString().padStart(2,"0")}/${(fecha.getMonth()+1).toString().padStart(2,"0")}/${fecha.getFullYear()} (${fecha.getHours().toString().padStart(2,"0")}:${fecha.getMinutes().toString().padStart(2,"0")})`;

  // Preparar datos venta
  const totalVenta = cobroTabla.reduce((acc, item) => acc + parseFloat(item.total), 0);
  const ventaData = {
    id: `ID_${idTicketDiario.toString().padStart(6,"0")}`,
    fecha: fechaStr,
    cajero: usuarioActivo.nro,
    total: totalVenta,
    tipo: tipoPago,
    productos: [...cobroTabla]
  };

  // Guardar en movimientos
  await set(ref(db, `movimientos/${ventaData.id}`), ventaData);

  // Guardar en historial
  await set(ref(db, `historial/${ventaData.id}`), ventaData);

  // Actualizar STOCK y SUELTOS
  for (let item of cobroTabla) {
    if (stockItems[item.codigo]) {
      // STOCK
      const nuevaCant = parseInt(stockItems[item.codigo].cant) - parseInt(item.cantKg);
      stockItems[item.codigo].cant = Math.max(nuevaCant, 0);
      await update(ref(db, `stock/${item.codigo}`), { cant: stockItems[item.codigo].cant });
    } else if (sueltosItems[item.codigo]) {
      // SUELTOS
      const nuevaKg = parseFloat(sueltosItems[item.codigo].kg) - parseFloat(item.cantKg);
      sueltosItems[item.codigo].kg = Math.max(nuevaKg, 0).toFixed(3);
      await update(ref(db, `sueltos/${item.codigo}`), { kg: sueltosItems[item.codigo].kg });
    }
  }

  // Imprimir ticket
  imprimirTicket(ventaData);

  // Limpiar tabla COBRAR
  tablaCobro.innerHTML = "";
  cobroTabla = [];
  actualizarTotal();
  idTicketDiario++;
}

/*****************************************
 * FUNCION IMPRIMIR TICKET
 *****************************************/
function imprimirTicket(ventaData) {
  const printArea = document.createElement("div");
  printArea.className = "print-area";

  let html = `<div id="texto-ticket">`;
  html += `${ventaData.id}<br>`;
  html += `${ventaData.fecha}<br>`;
  html += `Cajero: ${ventaData.cajero}<br>`;
  html += `==========<br>`;

  ventaData.productos.forEach(p => {
    html += `${p.nombre} $${p.precio.toFixed(2)} (x${p.cantKg}) = $${p.total.toFixed(2)}<br>`;
    html += `==========<br>`;
  });

  html += `TOTAL: $${ventaData.total.toFixed(2)}<br>`;
  html += `Pago: ${ventaData.tipo}<br>`;
  html += `</div><hr id="hr-ticket">`;

  printArea.innerHTML = html;
  document.body.appendChild(printArea);
  window.print();
  printArea.remove();
}

/*****************************************
 * BOTON COBRAR
 *****************************************/
btnCobrar.addEventListener("click", () => {
  if (cobroTabla.length === 0) {
    alert("No hay productos agregados para cobrar.");
    return;
  }
  abrirModalPago();
});

// app.js - PARTE 3
/*****************************************
 * VARIABLES MOVIMIENTOS
 *****************************************/
const filtroCajero = document.getElementById("filtroCajero");
const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");

/*****************************************
 * CARGAR MOVIMIENTOS EN TIEMPO REAL
 *****************************************/
onValue(ref(db, "movimientos"), snap => {
  tablaMovimientos.innerHTML = "";
  if (!snap.exists()) return;

  const data = snap.val();
  const movArray = Object.values(data).sort((a, b) => b.fecha.localeCompare(a.fecha));

  movArray.forEach(ticket => {
    // Filtrar por cajero
    if (filtroCajero.value !== "TODOS" && ticket.cajero !== filtroCajero.value) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>$${ticket.total.toFixed(2)}</td>
      <td>${ticket.tipo}</td>
      <td>
        <button class="btn-ver" data-id="${ticket.id}">Reimprimir</button>
        <button class="btn-eliminar" data-id="${ticket.id}">Eliminar</button>
      </td>
    `;
    tablaMovimientos.appendChild(tr);
  });
  asignarEventosMovimientos();
});

/*****************************************
 * ASIGNAR EVENTOS BOTONES MOVIMIENTOS
 *****************************************/
function asignarEventosMovimientos() {
  tablaMovimientos.querySelectorAll(".btn-ver").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const ticketSnap = await get(ref(db, `movimientos/${id}`));
      if (!ticketSnap.exists()) return;
      abrirModalReimprimir(ticketSnap.val());
    });
  });

  tablaMovimientos.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      abrirModalEliminarMovimiento(id);
    });
  });
}

/*****************************************
 * MODAL REIMPRIMIR
 *****************************************/
function abrirModalReimprimir(ticket) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>${ticket.id}</h3>
    <p>Cajero: ${ticket.cajero}</p>
    <p>Tipo Pago: ${ticket.tipo}</p>
    <p>Total: $${ticket.total.toFixed(2)}</p>
    <button id="btn-reimprimir">Reimprimir</button>
    <button id="btn-cancelar-modal">Cancelar</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector("#btn-cancelar-modal").addEventListener("click", () => overlay.remove());
  modal.querySelector("#btn-reimprimir").addEventListener("click", () => {
    imprimirTicket(ticket);
    overlay.remove();
  });
}

/*****************************************
 * MODAL ELIMINAR MOVIMIENTO
 *****************************************/
function abrirModalEliminarMovimiento(id) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>Eliminar Movimiento</h3>
    <input id="pass-eliminar" type="password" placeholder="Contraseña Admin">
    <br><br>
    <button id="btn-aceptar-eliminar">Aceptar</button>
    <button id="btn-cancelar-eliminar">Cancelar</button>
    <p id="msg-eliminar" class="msg-error"></p>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector("#btn-cancelar-eliminar").addEventListener("click", () => overlay.remove());

  modal.querySelector("#btn-aceptar-eliminar").addEventListener("click", async () => {
    const pass = modal.querySelector("#pass-eliminar").value;
    const configSnap = await get(ref(db, "config"));
    const configData = configSnap.val();
    if (pass !== configData.passAdmin) {
      modal.querySelector("#msg-eliminar").textContent = "Contraseña incorrecta";
      return;
    }

    // Recuperar el movimiento
    const ticketSnap = await get(ref(db, `movimientos/${id}`));
    if (!ticketSnap.exists()) return;

    const ticket = ticketSnap.val();

    // Restaurar STOCK/SUELTOS
    for (let item of ticket.productos) {
      if (stockItems[item.codigo]) {
        stockItems[item.codigo].cant += parseInt(item.cantKg);
        await update(ref(db, `stock/${item.codigo}`), { cant: stockItems[item.codigo].cant });
      } else if (sueltosItems[item.codigo]) {
        sueltosItems[item.codigo].kg = (parseFloat(sueltosItems[item.codigo].kg) + parseFloat(item.cantKg)).toFixed(3);
        await update(ref(db, `sueltos/${item.codigo}`), { kg: sueltosItems[item.codigo].kg });
      }
    }

    // Eliminar movimiento
    await remove(ref(db, `movimientos/${id}`));
    overlay.remove();
  });
}

/*****************************************
 * BOTON TIRAR Z
 *****************************************/
btnTirarZ.addEventListener("click", async () => {
  if (!confirm("⚠️ADVERTENCIA: Tirar Z no puede revertirse⚠️")) return;

  const cajero = filtroCajero.value;
  let movimientosRef = ref(db, "movimientos");
  const movSnap = await get(movimientosRef);

  if (!movSnap.exists()) return;

  const data = movSnap.val();
  for (let id in data) {
    if (cajero === "TODOS" || data[id].cajero === cajero) {
      await remove(ref(db, `movimientos/${id}`));
    }
  }
});

// app.js - PARTE 4
/*****************************************
 * VARIABLES HISTORIAL
 *****************************************/
const tablaHistorial = document.querySelector("#tabla-historial tbody");
const historialInfo = document.getElementById("historial-info");

let historialDia = new Date();
let historialData = {};

/*****************************************
 * FUNCION CARGAR HISTORIAL
 *****************************************/
async function cargarHistorial() {
  tablaHistorial.innerHTML = "";
  const snap = await get(ref(db, "historial"));
  if (!snap.exists()) return;

  historialData = snap.val();

  // Filtrar tickets del mes anterior hasta el día 15 y mes actual
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const mesActual = hoy.getMonth();
  const añoActual = hoy.getFullYear();

  const tickets = Object.values(historialData).filter(ticket => {
    const fechaTicket = new Date(ticket.fecha);
    if (fechaTicket.getFullYear() < añoActual) return false;
    if (fechaTicket.getMonth() < mesActual - 1 && diaActual > 15) return false;
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Filtrar por historialDia
  const ticketsDia = tickets.filter(ticket => {
    const fechaTicket = new Date(ticket.fecha);
    return fechaTicket.toDateString() === historialDia.toDateString();
  });

  ticketsDia.forEach(ticket => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>$${ticket.total.toFixed(2)}</td>
      <td>${ticket.tipo}</td>
      <td>${ticket.cajero}</td>
      <td>${new Date(ticket.fecha).toLocaleString()}</td>
      <td>
        <button class="btn-ver" data-id="${ticket.id}">Reimprimir</button>
      </td>
    `;
    tablaHistorial.appendChild(tr);
  });

  asignarEventosHistorial();
}

/*****************************************
 * ASIGNAR EVENTOS BOTONES HISTORIAL
 *****************************************/
function asignarEventosHistorial() {
  tablaHistorial.querySelectorAll(".btn-ver").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const ticketSnap = await get(ref(db, `historial/${id}`));
      if (!ticketSnap.exists()) return;
      abrirModalReimprimir(ticketSnap.val());
    });
  });
}

/*****************************************
 * PAGINADOR DIAS
 *****************************************/
const paginadorHistorial = document.createElement("div");
paginadorHistorial.id = "historial-paginador";
paginadorHistorial.innerHTML = `
  <button id="hist-prev">&lt;Anterior</button>
  <span id="hist-dia-label">${historialDia.toLocaleDateString()}</span>
  <button id="hist-next">Siguiente&gt;</button>
`;
document.querySelector("#historial").insertBefore(paginadorHistorial, tablaHistorial);

/*****************************************
 * EVENTOS PAGINADOR
 *****************************************/
document.getElementById("hist-prev").addEventListener("click", () => {
  historialDia.setDate(historialDia.getDate() - 1);
  document.getElementById("hist-dia-label").textContent = historialDia.toLocaleDateString();
  cargarHistorial();
});

document.getElementById("hist-next").addEventListener("click", () => {
  historialDia.setDate(historialDia.getDate() + 1);
  document.getElementById("hist-dia-label").textContent = historialDia.toLocaleDateString();
  cargarHistorial();
});

/*****************************************
 * INICIALIZAR HISTORIAL
 *****************************************/
cargarHistorial();

// app.js - PARTE 5
/*****************************************
 * VARIABLES STOCK Y SUELTOS
 *****************************************/
const tablaStockBody = document.querySelector("#tabla-stock tbody");
const tablaSueltosBody = document.querySelector("#tabla-sueltos tbody");

const stockCodigo = document.getElementById("stock-codigo");
const stockCantidad = document.getElementById("stock-cantidad");
const agregarStockBtn = document.getElementById("agregar-stock");
const buscarStockBtn = document.getElementById("buscar-stock");

const sueltosCodigo = document.getElementById("sueltos-codigo");
const sueltosKg = document.getElementById("sueltos-kg");
const sueltosBtnIncr = document.getElementById("sueltos-btn-incr");
const sueltosBtnDecr = document.getElementById("sueltos-btn-decr");
const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");

/*****************************************
 * RELLENAR SELECTS DE CANTIDAD
 *****************************************/
for (let i = 1; i <= 999; i++) {
  const optionStock = document.createElement("option");
  optionStock.value = i.toString().padStart(3, "0");
  optionStock.textContent = i.toString().padStart(3, "0");
  stockCantidad.appendChild(optionStock);
}

/*****************************************
 * FUNCIONES STOCK
 *****************************************/
async function cargarStock(filtro = "") {
  tablaStockBody.innerHTML = "";
  const snap = await get(ref(db, "stock"));
  if (!snap.exists()) return;
  const data = snap.val();

  Object.entries(data)
    .sort((a,b) => b[1].fecha.localeCompare(a[1].fecha))
    .forEach(([codigo, producto]) => {
      if (filtro && !producto.nombre.toLowerCase().includes(filtro.toLowerCase()) && !codigo.includes(filtro)) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${codigo}</td>
        <td>${producto.nombre}</td>
        <td>${producto.cant}</td>
        <td>${producto.fecha}</td>
        <td>$${producto.precio.toFixed(2)}</td>
        <td>
          <button class="btn-ver" data-codigo="${codigo}">Editar</button>
          <button class="btn-eliminar" data-codigo="${codigo}">Eliminar</button>
        </td>
      `;
      tablaStockBody.appendChild(tr);
    });

  asignarEventosStock();
}

function asignarEventosStock() {
  tablaStockBody.querySelectorAll(".btn-ver").forEach(btn => {
    btn.addEventListener("click", async () => {
      const codigo = btn.dataset.codigo;
      const productoSnap = await get(ref(db, `stock/${codigo}`));
      if (!productoSnap.exists()) return;
      abrirModalEditarStock(codigo, productoSnap.val());
    });
  });

  tablaStockBody.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const codigo = btn.dataset.codigo;
      abrirModalPassAdmin(async (ok) => {
        if (ok) {
          await remove(ref(db, `stock/${codigo}`));
          cargarStock();
        }
      });
    });
  });
}

agregarStockBtn.addEventListener("click", async () => {
  const codigo = stockCantidad.value.padStart(3,"0");
  const snap = await get(ref(db, `stock/${codigo}`));
  const fecha = new Date().toLocaleString();
  if (snap.exists()) {
    const prod = snap.val();
    await update(ref(db, `stock/${codigo}`), { cant: prod.cant + parseInt(stockCantidad.value), fecha });
  } else {
    await set(ref(db, `stock/${codigo}`), { nombre: "PRODUCTO NUEVO", cant: parseInt(stockCantidad.value), fecha, precio: 0 });
  }
  cargarStock();
});

buscarStockBtn.addEventListener("click", () => {
  cargarStock(stockCodigo.value);
});

/*****************************************
 * FUNCIONES SUELTOS
 *****************************************/
function actualizarKg(value) {
  let val = parseFloat(sueltosKg.value);
  val = Math.max(0.000, Math.min(99.000, val + value));
  val = Math.round(val*1000)/1000;
  sueltosKg.value = val.toFixed(3);
}

sueltosBtnIncr.addEventListener("click", () => actualizarKg(0.100));
sueltosBtnDecr.addEventListener("click", () => actualizarKg(-0.100));

async function cargarSueltos(filtro="") {
  tablaSueltosBody.innerHTML = "";
  const snap = await get(ref(db, "sueltos"));
  if (!snap.exists()) return;
  const data = snap.val();

  Object.entries(data)
    .sort((a,b) => b[1].fecha.localeCompare(a[1].fecha))
    .forEach(([codigo, producto]) => {
      if (filtro && !producto.nombre.toLowerCase().includes(filtro.toLowerCase()) && !codigo.includes(filtro)) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${codigo}</td>
        <td>${producto.nombre}</td>
        <td>${producto.kg.toFixed(3)}</td>
        <td>${producto.fecha}</td>
        <td>$${producto.precio.toFixed(2)}</td>
        <td>
          <button class="btn-ver" data-codigo="${codigo}">Editar</button>
          <button class="btn-eliminar" data-codigo="${codigo}">Eliminar</button>
        </td>
      `;
      tablaSueltosBody.appendChild(tr);
    });

  asignarEventosSueltos();
}

function asignarEventosSueltos() {
  tablaSueltosBody.querySelectorAll(".btn-ver").forEach(btn => {
    btn.addEventListener("click", async () => {
      const codigo = btn.dataset.codigo;
      const productoSnap = await get(ref(db, `sueltos/${codigo}`));
      if (!productoSnap.exists()) return;
      abrirModalEditarSuelto(codigo, productoSnap.val());
    });
  });

  tablaSueltosBody.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const codigo = btn.dataset.codigo;
      abrirModalPassAdmin(async (ok) => {
        if (ok) {
          await remove(ref(db, `sueltos/${codigo}`));
          cargarSueltos();
        }
      });
    });
  });
}

btnAgregarSuelto.addEventListener("click", async () => {
  const codigo = sueltosCodigo.value.padStart(3,"0");
  const kg = parseFloat(sueltosKg.value);
  const fecha = new Date().toLocaleString();
  const snap = await get(ref(db, `sueltos/${codigo}`));
  if (snap.exists()) {
    const prod = snap.val();
    await update(ref(db, `sueltos/${codigo}`), { kg: prod.kg + kg, fecha });
  } else {
    await set(ref(db, `sueltos/${codigo}`), { nombre: "PRODUCTO NUEVO", kg, fecha, precio: 0 });
  }
  cargarSueltos();
});

btnBuscarSuelto.addEventListener("click", () => {
  cargarSueltos(sueltosCodigo.value);
});

/*****************************************
 * INICIALIZAR STOCK Y SUELTOS
 *****************************************/
cargarStock();
cargarSueltos();

// app.js - PARTE 6
/*****************************************
 * VARIABLES CAJEROS Y CONFIG
 *****************************************/
const cajeroNro = document.getElementById("cajero-nro");
const cajeroNombre = document.getElementById("cajero-nombre");
const cajeroDNI = document.getElementById("cajero-dni");
const cajeroPass = document.getElementById("cajero-pass");
const agregarCajeroBtn = document.getElementById("agregar-cajero");
const tablaCajerosBody = document.querySelector("#tabla-cajeros tbody");

const configNombre = document.getElementById("config-nombre");
const configPassActual = document.getElementById("config-pass-actual");
const configPassNueva = document.getElementById("config-pass-nueva");
const guardarConfigBtn = document.getElementById("guardar-config");
const masterPass = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");
const configMsg = document.getElementById("config-msg");

/*****************************************
 * FUNCIONES CAJEROS
 *****************************************/
function rellenarSelectCajeros() {
  cajeroNro.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    const option = document.createElement("option");
    option.value = i.toString().padStart(2, "0");
    option.textContent = i.toString().padStart(2, "0");
    cajeroNro.appendChild(option);
  }
}

async function cargarCajeros() {
  tablaCajerosBody.innerHTML = "";
  const snap = await get(ref(db, "cajeros"));
  if (!snap.exists()) return;
  const data = snap.val();

  Object.entries(data)
    .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([nro, cajero]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${nro}</td>
        <td>${cajero.nombre}</td>
        <td>${cajero.dni}</td>
        <td>
          <button class="btn-ver" data-nro="${nro}">Editar</button>
          <button class="btn-eliminar" data-nro="${nro}">Eliminar</button>
        </td>
      `;
      tablaCajerosBody.appendChild(tr);
    });

  asignarEventosCajeros();
}

function asignarEventosCajeros() {
  tablaCajerosBody.querySelectorAll(".btn-ver").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nro = btn.dataset.nro;
      const snap = await get(ref(db, `cajeros/${nro}`));
      if (!snap.exists()) return;
      abrirModalEditarCajero(nro, snap.val());
    });
  });

  tablaCajerosBody.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nro = btn.dataset.nro;
      abrirModalPassAdmin(async (ok) => {
        if (ok) {
          await remove(ref(db, `cajeros/${nro}`));
          cargarCajeros();
        }
      });
    });
  });
}

agregarCajeroBtn.addEventListener("click", () => {
  abrirModalPassAdmin(async (ok) => {
    if (!ok) return;
    const nro = cajeroNro.value.padStart(2,"0");
    const nombre = cajeroNombre.value.trim() || "CAJERO NUEVO";
    const dni = cajeroDNI.value.trim();
    const pass = cajeroPass.value.trim();
    if (pass.length < 4 || pass.length > 12) {
      alert("La contraseña debe tener entre 4 y 12 caracteres");
      return;
    }
    await set(ref(db, `cajeros/${nro}`), { nombre, dni, pass });
    cargarCajeros();
  });
});

/*****************************************
 * FUNCIONES CONFIG
 *****************************************/
async function cargarConfig() {
  const snap = await get(ref(db, "config"));
  if (!snap.exists()) return;
  const cfg = snap.val();
  configNombre.value = cfg.shopName || "ZONAPC";
}

guardarConfigBtn.addEventListener("click", async () => {
  const snap = await get(ref(db, "config"));
  if (!snap.exists()) return;
  const cfg = snap.val();
  if (cfg.passAdmin !== configPassActual.value.trim()) {
    configMsg.textContent = "Contraseña actual incorrecta";
    configMsg.className = "msg-error";
    return;
  }
  const shopName = configNombre.value.trim() || cfg.shopName;
  const passAdmin = configPassNueva.value.trim() || cfg.passAdmin;
  await update(ref(db, "config"), { shopName, passAdmin });
  configMsg.textContent = "Configuración guardada correctamente";
  configMsg.className = "msg-exito";
  document.getElementById("app-title").textContent = shopName;
});

btnRestaurar.addEventListener("click", async () => {
  const snap = await get(ref(db, "config"));
  if (!snap.exists()) return;
  const cfg = snap.val();
  if (masterPass.value.trim() !== cfg.masterPass) {
    configMsg.textContent = "Contraseña maestra incorrecta";
    configMsg.className = "msg-error";
    return;
  }
  await update(ref(db, "config"), { passAdmin: cfg.masterPass });
  configMsg.textContent = "Contraseña de administrador restaurada a la maestra";
  configMsg.className = "msg-exito";
});

/*****************************************
 * INICIALIZACIÓN CAJEROS Y CONFIG
 *****************************************/
rellenarSelectCajeros();
cargarCajeros();
cargarConfig();
