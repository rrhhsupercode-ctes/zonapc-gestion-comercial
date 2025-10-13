/*****************************************************
 * app.js - PARTE 1
 * Login Admin + Navegación + Inicio Cobrar
 *****************************************************/

import { ref, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

/* ---------------------------
   LOGIN DE ADMINISTRADOR
   --------------------------- */
const adminModal = document.createElement("div"); // opcional, si quieres un modal genérico
let configData = { passAdmin: "1918", masterPass: "1409", shopName: "ZONAPC" };

const loginAdminModal = document.createElement("div");
loginAdminModal.id = "admin-login-modal";
loginAdminModal.innerHTML = `
  <div class="modal-content">
    <h2>🔒 Contraseña de Administrador 🔒</h2>
    <input type="password" id="input-admin-pass" placeholder="Contraseña">
    <button id="btn-admin-login">Ingresar</button>
    <p id="admin-login-msg" class="msg-error"></p>
  </div>
`;
document.body.appendChild(loginAdminModal);

const inputAdminPass = document.getElementById("input-admin-pass");
const btnAdminLogin = document.getElementById("btn-admin-login");
const adminLoginMsg = document.getElementById("admin-login-msg");
const mainContent = document.querySelector("main");

mainContent.style.filter = "blur(5px)";
loginAdminModal.style.display = "block";

btnAdminLogin.addEventListener("click", async () => {
  const val = inputAdminPass.value;
  const configSnap = await get(ref(window.db, "config"));
  if (configSnap.exists()) configData = configSnap.val();

  if (val === configData.passAdmin || val === configData.masterPass) {
    loginAdminModal.style.display = "none";
    mainContent.style.filter = "none";
  } else {
    adminLoginMsg.textContent = "Contraseña incorrecta";
  }
});

/* ---------------------------
   NAVEGACIÓN ENTRE SECCIONES
   --------------------------- */
const navBtns = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll("main section");

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.section;
    sections.forEach(sec => {
      if (sec.id === target) sec.classList.remove("hidden");
      else sec.classList.add("hidden");
    });
  });
});

/* ---------------------------
   COBRAR - SETUP INICIAL
   --------------------------- */
const loginUsuario = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");
const cobroControles = document.getElementById("cobro-controles");

// Cajero actual
let cajeroActual = null;
let cobroItems = [];

// Cargar select de cantidad 1 a 99
const cobroCantidad = document.getElementById("cobro-cantidad");
for (let i = 1; i <= 99; i++) {
  const opt = document.createElement("option");
  opt.value = i.toString().padStart(2, "0");
  opt.textContent = i.toString().padStart(2, "0");
  cobroCantidad.appendChild(opt);
}

// Cargar select de usuarios (cajeros)
async function cargarCajerosSelect() {
  const cajerosSnap = await get(ref(window.db, "cajeros"));
  loginUsuario.innerHTML = "";
  if (cajerosSnap.exists()) {
    const cajeros = cajerosSnap.val();
    Object.keys(cajeros).sort().forEach(num => {
      const opt = document.createElement("option");
      opt.value = num;
      opt.textContent = num;
      loginUsuario.appendChild(opt);
    });
  }
}
cargarCajerosSelect();

// Login Cajero
btnLogin.addEventListener("click", async () => {
  const nro = loginUsuario.value;
  const pass = loginPass.value;
  if (!nro || !pass) return;

  const cajeroSnap = await get(ref(window.db, `cajeros/${nro}`));
  if (!cajeroSnap.exists()) {
    loginMsg.textContent = "Cajero no encontrado";
    return;
  }

  const cajeroData = cajeroSnap.val();
  if (pass === cajeroData.pass) {
    cajeroActual = { nro, ...cajeroData };
    loginMsg.textContent = "";
    cobroControles.classList.remove("hidden");
  } else {
    loginMsg.textContent = "Contraseña incorrecta";
  }
});

/* ---------------------------
   COBRAR - STOCK Y SUELTOS
   --------------------------- */
const cobroProductos = document.getElementById("cobro-productos");
const cobroSueltos = document.getElementById("cobro-sueltos");

async function cargarItemsSelect() {
  const stockSnap = await get(ref(window.db, "stock"));
  const sueltosSnap = await get(ref(window.db, "sueltos"));

  // STOCK
  cobroProductos.innerHTML = '<option value="">Elija un Item</option>';
  if (stockSnap.exists()) {
    Object.entries(stockSnap.val()).forEach(([cod, item]) => {
      const opt = document.createElement("option");
      opt.value = cod;
      opt.textContent = item.nombre;
      cobroProductos.appendChild(opt);
    });
  }

  // SUELTOS
  cobroSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
  if (sueltosSnap.exists()) {
    Object.entries(sueltosSnap.val()).forEach(([cod, item]) => {
      const opt = document.createElement("option");
      opt.value = cod;
      opt.textContent = item.nombre;
      cobroSueltos.appendChild(opt);
    });
  }
}
cargarItemsSelect();
/*****************************************************
 * app.js - PARTE 2
 * Funcionalidad COBRAR completa
 *****************************************************/

/* ---------------------------
   COBRAR - TABLA Y KG SUELTOS
   --------------------------- */
const btnAddProduct = document.getElementById("btn-add-product");
const btnAddSuelto = document.getElementById("btn-add-suelto");
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");

const inputKgSuelto = document.getElementById("input-kg-suelto");
const btnIncrKg = document.getElementById("btn-incr-kg");
const btnDecrKg = document.getElementById("btn-decr-kg");

// Incrementar / Decrementar KG
btnIncrKg.addEventListener("click", () => {
  let val = parseFloat(inputKgSuelto.value);
  val += 0.100;
  if (val > 99.900) val = 99.900;
  inputKgSuelto.value = val.toFixed(3);
});

btnDecrKg.addEventListener("click", () => {
  let val = parseFloat(inputKgSuelto.value);
  val -= 0.100;
  if (val < 0.100) val = 0.100;
  inputKgSuelto.value = val.toFixed(3);
});

// Función para recalcular TOTAL
function recalcularTotal() {
  let total = 0;
  cobroItems.forEach(item => {
    total += item.total;
  });
  totalDiv.textContent = `TOTAL: $${total.toFixed(2)}`;
}

// Función para renderizar tabla
function renderTabla() {
  tablaCobro.innerHTML = "";
  cobroItems.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.cant}</td>
      <td>${item.nombre}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>$${item.total.toFixed(2)}</td>
      <td><button class="btn-eliminar" data-idx="${idx}">Eliminar</button></td>
    `;
    tablaCobro.appendChild(tr);
  });
  recalcularTotal();
}

// Agregar producto STOCK
btnAddProduct.addEventListener("click", async () => {
  const cod = document.getElementById("cobro-codigo").value;
  const cant = parseInt(cobroCantidad.value);
  if (!cod || !cant) return;

  const itemSnap = await get(ref(window.db, `stock/${cod}`));
  if (!itemSnap.exists()) return;

  const item = itemSnap.val();
  const total = cant * parseFloat(item.precio || 0);
  cobroItems.unshift({ cod, nombre: item.nombre, cant, precio: parseFloat(item.precio || 0), total, tipo: "stock" });
  renderTabla();
});

// Agregar producto SUELTOS
btnAddSuelto.addEventListener("click", async () => {
  const cod = document.getElementById("cobro-codigo-suelto").value;
  let kg = parseFloat(inputKgSuelto.value);
  if (!cod || !kg) return;

  const itemSnap = await get(ref(window.db, `sueltos/${cod}`));
  if (!itemSnap.exists()) return;

  const item = itemSnap.val();
  // El total se calcula según porcentaje del precio por KG
  const total = kg * parseFloat(item.precio || 0);
  cobroItems.unshift({ cod, nombre: item.nombre, cant: kg.toFixed(3), precio: parseFloat(item.precio || 0), total, tipo: "sueltos" });
  renderTabla();
});

/* ---------------------------
   ELIMINAR PRODUCTO (requiere admin)
   --------------------------- */
tablaCobro.addEventListener("click", (e) => {
  if (!e.target.classList.contains("btn-eliminar")) return;
  const idx = e.target.dataset.idx;

  const adminPass = prompt("Contraseña de administrador:");
  if (!adminPass) return;

  if (adminPass === configData.passAdmin || adminPass === configData.masterPass) {
    cobroItems.splice(idx, 1);
    renderTabla();
  } else {
    alert("Contraseña incorrecta");
  }
});

/* ---------------------------
   BOTÓN COBRAR - MODAL TIPO PAGO
   --------------------------- */
const btnCobrar = document.getElementById("btn-cobrar");
btnCobrar.classList.remove("hidden");

btnCobrar.addEventListener("click", () => {
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `
    <div class="modal-content">
      <h2>¿Cómo Pagará el Cliente?</h2>
      <button data-pago="Efectivo">Efectivo</button>
      <button data-pago="Tarjeta">Tarjeta</button>
      <button data-pago="QR">QR</button>
      <button data-pago="Electrónico">Electrónico</button>
      <button data-pago="Otro">Otro</button>
      <button id="btn-cancelar-pago" style="background:red;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
  mainContent.style.filter = "blur(5px)";

  modal.addEventListener("click", async (e) => {
    const pago = e.target.dataset.pago;
    if (pago) {
      await registrarVenta(pago);
      document.body.removeChild(modal);
      mainContent.style.filter = "none";
      cobroItems = [];
      renderTabla();
      alert("Venta realizada");
    }
    if (e.target.id === "btn-cancelar-pago") {
      document.body.removeChild(modal);
      mainContent.style.filter = "none";
    }
  });
});

/* ---------------------------
   FUNCIÓN REGISTRAR VENTA
   --------------------------- */
async function registrarVenta(tipoPago) {
  if (!cajeroActual) return;

  const fecha = new Date();
  const dia = fecha.toISOString().slice(0,10).replace(/-/g,""); // YYYYMMDD
  const movimientosRef = ref(window.db, `movimientos/${dia}`);
  const historialRef = ref(window.db, `historial/${dia}`);

  // ID Ticket secuencial
  const movSnap = await get(movimientosRef);
  let nextID = 1;
  if (movSnap.exists()) nextID = Object.keys(movSnap.val()).length + 1;
  const idTicket = "ID_" + nextID.toString().padStart(6, "0");

  const ventaData = {
    id: idTicket,
    cajero: cajeroActual.nro,
    fecha: fecha.toLocaleString(),
    tipoPago,
    items: cobroItems,
    total: cobroItems.reduce((a,b) => a + b.total,0)
  };

  // Guardar en movimientos y historial
  const newMovRef = push(movimientosRef);
  await set(newMovRef, ventaData);

  const newHistRef = push(historialRef);
  await set(newHistRef, ventaData);

  // Restar stock / sueltos
  for (const item of cobroItems) {
    const path = item.tipo === "stock" ? `stock/${item.cod}` : `sueltos/${item.cod}`;
    const snap = await get(ref(window.db, path));
    if (!snap.exists()) continue;
    const data = snap.val();
    if (item.tipo === "stock") data.cant -= item.cant;
    else data.kg = (parseFloat(data.kg) - parseFloat(item.cant)).toFixed(3);
    await update(ref(window.db, path), data);
  }

  // Imprimir ticket (simulado)
  console.log("Ticket:", ventaData);
}
/*****************************************************
 * app.js - PARTE 3
 * Movimientos, Historial, Stock, Sueltos, Cajeros, Config
 *****************************************************/

/* ---------------------------
   MOVIMIENTOS
   --------------------------- */
const filtroCajero = document.getElementById("filtroCajero");
const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
const btnTirarZ = document.getElementById("btn-tirar-z");

async function cargarMovimientos() {
  const dia = new Date().toISOString().slice(0,10).replace(/-/g,"");
  const movSnap = await get(ref(window.db, `movimientos/${dia}`));
  tablaMovimientos.innerHTML = "";
  if (!movSnap.exists()) return;

  const movimientos = Object.entries(movSnap.val()).sort((a,b)=>b[0]-a[0]); // más recientes arriba
  movimientos.forEach(([key, mov]) => {
    if (filtroCajero.value !== "TODOS" && mov.cajero !== filtroCajero.value) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mov.id}</td>
      <td>$${mov.total.toFixed(2)}</td>
      <td>${mov.tipoPago}</td>
      <td>
        <button class="reimprimir" data-key="${key}">Reimprimir</button>
        <button class="eliminar" data-key="${key}">Eliminar</button>
      </td>
    `;
    tablaMovimientos.appendChild(tr);
  });
}
filtroCajero.addEventListener("change", cargarMovimientos);
btnTirarZ.addEventListener("click", async () => {
  if (confirm("⚠️Tirar Z no puede revertirse. Continuar?⚠️")) {
    const dia = new Date().toISOString().slice(0,10).replace(/-/g,"");
    await remove(ref(window.db, `movimientos/${dia}`));
    cargarMovimientos();
  }
});

tablaMovimientos.addEventListener("click", async (e) => {
  const key = e.target.dataset.key;
  if (!key) return;

  if (e.target.classList.contains("reimprimir")) {
    const dia = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const movSnap = await get(ref(window.db, `movimientos/${dia}/${key}`));
    if (!movSnap.exists()) return;
    alert("Ticket a reimprimir: " + JSON.stringify(movSnap.val()));
  }

  if (e.target.classList.contains("eliminar")) {
    const pass = prompt("Contraseña de administrador:");
    if (pass !== configData.passAdmin && pass !== configData.masterPass) return alert("Contraseña incorrecta");
    const dia = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const movSnap = await get(ref(window.db, `movimientos/${dia}/${key}`));
    if (!movSnap.exists()) return;
    // restaurar stock/sueltos
    const items = movSnap.val().items;
    for (const item of items) {
      const path = item.tipo === "stock" ? `stock/${item.cod}` : `sueltos/${item.cod}`;
      const snap = await get(ref(window.db, path));
      if (!snap.exists()) continue;
      const data = snap.val();
      if (item.tipo === "stock") data.cant += item.cant;
      else data.kg = (parseFloat(data.kg) + parseFloat(item.cant)).toFixed(3);
      await update(ref(window.db, path), data);
    }
    await remove(ref(window.db, `movimientos/${dia}/${key}`));
    cargarMovimientos();
  }
});

/* ---------------------------
   HISTORIAL
   --------------------------- */
const tablaHistorial = document.querySelector("#tabla-historial tbody");

async function cargarHistorial(fechaISO = null) {
  const fecha = fechaISO || new Date();
  const dia = fecha.toISOString().slice(0,10).replace(/-/g,"");
  const histSnap = await get(ref(window.db, `historial/${dia}`));
  tablaHistorial.innerHTML = "";
  if (!histSnap.exists()) return;

  const historial = Object.values(histSnap.val()).sort((a,b)=>b.id.localeCompare(a.id));
  historial.forEach(mov => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mov.id}</td>
      <td>$${mov.total.toFixed(2)}</td>
      <td>${mov.tipoPago}</td>
      <td>${mov.cajero}</td>
      <td>${mov.fecha}</td>
      <td><button class="reimprimir-hist">Reimprimir</button></td>
    `;
    tablaHistorial.appendChild(tr);
  });
}

tablaHistorial.addEventListener("click", async (e)=>{
  if(!e.target.classList.contains("reimprimir-hist")) return;
  const tr = e.target.closest("tr");
  alert("Ticket historial: " + JSON.stringify(tr.cells[0].textContent));
});

/* ---------------------------
   STOCK
   --------------------------- */
const tablaStock = document.querySelector("#tabla-stock tbody");
const stockCodigo = document.getElementById("stock-codigo");
const stockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const btnBuscarStock = document.getElementById("buscar-stock");

async function cargarStock() {
  const snap = await get(ref(window.db, "stock"));
  tablaStock.innerHTML = "";
  if (!snap.exists()) return;
  Object.entries(snap.val()).sort((a,b)=>b[0]-a[0]).forEach(([cod, item])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cod}</td>
      <td>${item.nombre}</td>
      <td>${item.cant}</td>
      <td>${item.fecha}</td>
      <td>$${parseFloat(item.precio||0).toFixed(2)}</td>
      <td>
        <button class="editar-stock" data-cod="${cod}">Editar</button>
        <button class="eliminar-stock" data-cod="${cod}">Eliminar</button>
      </td>
    `;
    tablaStock.appendChild(tr);
  });
}

btnAgregarStock.addEventListener("click", async ()=>{
  const cod = stockCodigo.value;
  const cant = parseInt(stockCantidad.value);
  if(!cod || !cant) return;
  const snap = await get(ref(window.db, `stock/${cod}`));
  const fecha = new Date().toLocaleString();
  if(snap.exists()){
    const data = snap.val();
    data.cant += cant;
    await update(ref(window.db, `stock/${cod}`), data);
  } else {
    await set(ref(window.db, `stock/${cod}`), {nombre:"PRODUCTO NUEVO", cant, precio:0, fecha});
  }
  cargarStock();
});

btnBuscarStock.addEventListener("click", async ()=>{
  const term = stockCodigo.value.toLowerCase();
  const snap = await get(ref(window.db, "stock"));
  tablaStock.innerHTML = "";
  if (!snap.exists()) return;
  Object.entries(snap.val()).forEach(([cod, item])=>{
    if(cod.toLowerCase().includes(term) || item.nombre.toLowerCase().includes(term)){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${cod}</td><td>${item.nombre}</td><td>${item.cant}</td>
        <td>${item.fecha}</td><td>$${parseFloat(item.precio||0).toFixed(2)}</td>
        <td>
          <button class="editar-stock" data-cod="${cod}">Editar</button>
          <button class="eliminar-stock" data-cod="${cod}">Eliminar</button>
        </td>
      `;
      tablaStock.appendChild(tr);
    }
  });
});

/* ---------------------------
   SUELTOS
   --------------------------- */
const tablaSueltos = document.querySelector("#tabla-sueltos tbody");
const sueltosCodigo = document.getElementById("sueltos-codigo");
const sueltosKg = document.getElementById("sueltos-kg");
const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");
const btnIncrSuelto = document.getElementById("sueltos-btn-incr");
const btnDecrSuelto = document.getElementById("sueltos-btn-decr");

btnIncrSuelto.addEventListener("click", ()=>{
  let val = parseFloat(sueltosKg.value);
  val += 0.100; if(val>99.000) val=99.000;
  sueltosKg.value = val.toFixed(3);
});
btnDecrSuelto.addEventListener("click", ()=>{
  let val = parseFloat(sueltosKg.value);
  val -= 0.100; if(val<0.000) val=0.000;
  sueltosKg.value = val.toFixed(3);
});

async function cargarSueltos() {
  const snap = await get(ref(window.db, "sueltos"));
  tablaSueltos.innerHTML = "";
  if(!snap.exists()) return;
  Object.entries(snap.val()).sort((a,b)=>b[0]-a[0]).forEach(([cod,item])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cod}</td><td>${item.nombre}</td><td>${parseFloat(item.kg).toFixed(3)}</td>
      <td>${item.fecha}</td><td>$${parseFloat(item.precio||0).toFixed(2)}</td>
      <td>
        <button class="editar-suelto" data-cod="${cod}">Editar</button>
        <button class="eliminar-suelto" data-cod="${cod}">Eliminar</button>
      </td>
    `;
    tablaSueltos.appendChild(tr);
  });
}

/* ---------------------------
   CAJEROS
   --------------------------- */
const tablaCajeros = document.querySelector("#tabla-cajeros tbody");
const cajeroNro = document.getElementById("cajero-nro");
const cajeroNombre = document.getElementById("cajero-nombre");
const cajeroDni = document.getElementById("cajero-dni");
const cajeroPass = document.getElementById("cajero-pass");
const btnAgregarCajero = document.getElementById("agregar-cajero");

async function cargarCajeros() {
  const snap = await get(ref(window.db, "cajeros"));
  tablaCajeros.innerHTML = "";
  if(!snap.exists()) return;
  Object.entries(snap.val()).sort((a,b)=>a[0]-b[0]).forEach(([nro,cajero])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${nro}</td>
      <td>${cajero.nombre}</td>
      <td>${cajero.dni}</td>
      <td>
        <button class="editar-cajero" data-nro="${nro}">Editar</button>
        <button class="eliminar-cajero" data-nro="${nro}">Eliminar</button>
      </td>
    `;
    tablaCajeros.appendChild(tr);
  });
}

btnAgregarCajero.addEventListener("click", async ()=>{
  const nro = cajeroNro.value;
  const nombre = cajeroNombre.value;
  const dni = cajeroDni.value;
  const pass = cajeroPass.value;
  const passAdmin = prompt("Contraseña administrador:");
  if(passAdmin!==configData.passAdmin && passAdmin!==configData.masterPass) return alert("Contraseña incorrecta");
  await set(ref(window.db, `cajeros/${nro}`), {nombre,dni,pass});
  cargarCajeros();
});

/* ---------------------------
   CONFIG
   --------------------------- */
const configNombre = document.getElementById("config-nombre");
const configPassActual = document.getElementById("config-pass-actual");
const configPassNueva = document.getElementById("config-pass-nueva");
const btnGuardarConfig = document.getElementById("guardar-config");
const masterPassInput = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");

btnGuardarConfig.addEventListener("click", async ()=>{
  const passActual = configPassActual.value;
  if(passActual !== configData.passAdmin) return alert("Contraseña incorrecta");
  const updates = { shopName: configNombre.value, passAdmin: configPassNueva.value };
  await update(ref(window.db, "config"), updates);
  configData = {...configData,...updates};
  alert("Configuración guardada");
});

btnRestaurar.addEventListener("click", async ()=>{
  if(masterPassInput.value !== configData.masterPass) return alert("Contraseña maestra incorrecta");
  await update(ref(window.db, "config"), {passAdmin: configData.masterPass});
  configData.passAdmin = configData.masterPass;
  alert("Contraseña de administrador restaurada a la maestra");
});

/* ---------------------------
   Inicializar todas las secciones
   --------------------------- */
cargarMovimientos();
cargarHistorial();
cargarStock();
cargarSueltos();
cargarCajeros();
