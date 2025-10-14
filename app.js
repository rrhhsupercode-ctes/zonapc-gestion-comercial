// =========================================
// app.js (Firebase 11.8.1) — PARTE 1
// =========================================

// ---------------------------
// Inicializar Firebase
// ---------------------------
import {
  getDatabase, ref, get, set, update, remove, onValue, push
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

import { app } from "./init.js";

window.db = getDatabase(app);
window.auth = getAuth(app);

// ---------------------------
// Variables globales
// ---------------------------
let stockData = {};
let sueltosData = {};
let movimientosData = {};
let historialData = {};
let cajerosData = {};

let usuarioActual = null;
let usuarioRol = null;

// ---------------------------
// Referencias a nodos
// ---------------------------
const stockRef = ref(db, "stock");
const sueltosRef = ref(db, "sueltos");
const movimientosRef = ref(db, "movimientos");
const historialRef = ref(db, "historial");
const cajerosRef = ref(db, "cajeros");
const configRef = ref(db, "config");

// ---------------------------
// Sincronización en tiempo real
// ---------------------------
onValue(stockRef, snap => {
  if (snap.exists()) {
    stockData = snap.val();
    renderTablaStock();
  } else {
    stockData = {};
    document.getElementById("tablaStockBody").innerHTML = "";
  }
});

onValue(sueltosRef, snap => {
  if (snap.exists()) {
    sueltosData = snap.val();
    renderTablaSueltos();
  } else {
    sueltosData = {};
    document.getElementById("tablaSueltosBody").innerHTML = "";
  }
});

onValue(movimientosRef, snap => {
  if (snap.exists()) {
    movimientosData = snap.val();
    renderTablaMovimientos();
  } else {
    movimientosData = {};
    document.getElementById("tablaMovBody").innerHTML = "";
  }
});

onValue(historialRef, snap => {
  if (snap.exists()) historialData = snap.val();
  else historialData = {};
});

onValue(cajerosRef, snap => {
  if (snap.exists()) {
    cajerosData = snap.val();
    renderTablaCajeros();
    actualizarSelectCajeros();
  } else {
    cajerosData = {};
    document.getElementById("tablaCajerosBody").innerHTML = "";
  }
});

// ---------------------------
// Actualización de selects (cajeros)
// ---------------------------
function actualizarSelectCajeros() {
  const loginUsuarioSelect = document.getElementById("loginUsuarioSelect");
  if (!loginUsuarioSelect) return;

  loginUsuarioSelect.innerHTML = "";
  const optDef = document.createElement("option");
  optDef.value = "";
  optDef.textContent = "Seleccione un cajero";
  loginUsuarioSelect.appendChild(optDef);

  Object.entries(cajerosData).forEach(([key, caj]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${caj.nombre}`;
    loginUsuarioSelect.appendChild(opt);
  });
}

// ---------------------------
// Función de login de cajero
// ---------------------------
async function loginCajero() {
  const sel = document.getElementById("loginUsuarioSelect");
  const pass = document.getElementById("loginPassInput");
  if (!sel || !pass) return;

  const userId = sel.value.trim();
  const clave = pass.value.trim();

  if (userId === "" || clave === "") {
    alert("Complete usuario y contraseña");
    return;
  }

  const snap = await get(ref(db, `cajeros/${userId}`));
  if (snap.exists()) {
    const caj = snap.val();
    if (caj.pass === clave) {
      usuarioActual = caj.nombre;
      usuarioRol = caj.rol;
      document.getElementById("loginModal").classList.add("oculto");
      document.body.classList.remove("bloqueado");
      document.getElementById("usuarioActivo").textContent = usuarioActual;
      console.log("Cajero logueado:", usuarioActual);
    } else {
      alert("Contraseña incorrecta");
    }
  } else {
    alert("Cajero no encontrado");
  }
}

document.getElementById("btnLoginCajero")?.addEventListener("click", loginCajero);

// ---------------------------
// Cerrar sesión
// ---------------------------
document.getElementById("btnLogoutCajero")?.addEventListener("click", ()=>{
  usuarioActual = null;
  usuarioRol = null;
  document.getElementById("loginModal").classList.remove("oculto");
  document.body.classList.add("bloqueado");
});

// ---------------------------
// Render tablas (sólo estructura base)
// ---------------------------
function renderTablaStock() {
  const body = document.getElementById("tablaStockBody");
  if (!body) return;
  body.innerHTML = "";
  Object.entries(stockData).forEach(([key, s])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.codigo}</td>
      <td>${s.nombre}</td>
      <td>${s.cant}</td>
      <td>$${s.precio.toFixed(2)}</td>
      <td><button class="btn-editar" data-id="${key}">Editar</button></td>
    `;
    body.appendChild(tr);
  });
}

function renderTablaSueltos() {
  const body = document.getElementById("tablaSueltosBody");
  if (!body) return;
  body.innerHTML = "";
  Object.entries(sueltosData).forEach(([key, s])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.codigo}</td>
      <td>${s.nombre}</td>
      <td>${s.kg.toFixed(3)}</td>
      <td>$${s.precio.toFixed(2)}</td>
      <td><button class="btn-editar" data-id="${key}">Editar</button></td>
    `;
    body.appendChild(tr);
  });
}

function renderTablaMovimientos() {
  const body = document.getElementById("tablaMovBody");
  if (!body) return;
  body.innerHTML = "";
  Object.entries(movimientosData).forEach(([key, m])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.id}</td>
      <td>$${m.total.toFixed(2)}</td>
      <td>${m.tipoPago}</td>
      <td><button class="btn-reimp" data-id="${key}">Reimprimir</button></td>
    `;
    body.appendChild(tr);
  });
}

function renderTablaCajeros() {
  const body = document.getElementById("tablaCajerosBody");
  if (!body) return;
  body.innerHTML = "";
  Object.entries(cajerosData).forEach(([key, c])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nro}</td>
      <td>${c.nombre}</td>
      <td>${c.dni}</td>
      <td>${c.pass}</td>
    `;
    body.appendChild(tr);
  });
}

// =========================================
// app.js (Firebase 11.8.1) — PARTE 2
// =========================================

// ---------------------------
// AGREGAR PRODUCTO STOCK
// ---------------------------
const btnAgregarStock = document.getElementById("btnAgregarStock");
btnAgregarStock?.addEventListener("click", async ()=>{
  const codigo = document.getElementById("stockCodigo").value.trim();
  const nombre = document.getElementById("stockNombre").value.trim();
  const cantidad = parseFloat(document.getElementById("stockCantidad").value);
  const precio = parseFloat(document.getElementById("stockPrecio").value);

  if(!codigo || !nombre || isNaN(cantidad) || isNaN(precio)){
    alert("Complete todos los campos correctamente");
    return;
  }

  const nuevo = {
    codigo,
    nombre,
    cant: cantidad,
    precio,
    fecha: new Date().toISOString()
  };

  await set(ref(db, `stock/${codigo}`), nuevo);
  document.getElementById("stockCodigo").value = "";
  document.getElementById("stockNombre").value = "";
  document.getElementById("stockCantidad").value = "";
  document.getElementById("stockPrecio").value = "";
});

// ---------------------------
// EDITAR PRODUCTO STOCK
// ---------------------------
document.getElementById("tablaStockBody")?.addEventListener("click", async e=>{
  if(e.target.classList.contains("btn-editar")){
    const key = e.target.dataset.id;
    const prodSnap = await get(ref(db, `stock/${key}`));
    if(!prodSnap.exists()) return;

    const p = prodSnap.val();
    const nombreNuevo = prompt("Editar nombre:", p.nombre) ?? p.nombre;
    const cantidadNueva = parseFloat(prompt("Editar cantidad:", p.cant) ?? p.cant);
    const precioNuevo = parseFloat(prompt("Editar precio:", p.precio) ?? p.precio);

    if(isNaN(cantidadNueva) || isNaN(precioNuevo)){
      alert("Valores inválidos");
      return;
    }

    await update(ref(db, `stock/${key}`), {
      nombre: nombreNuevo,
      cant: cantidadNueva,
      precio: precioNuevo
    });
  }
});

// ---------------------------
// ELIMINAR PRODUCTO STOCK
// ---------------------------
document.getElementById("btnEliminarStock")?.addEventListener("click", async ()=>{
  const codigo = prompt("Ingrese el código a eliminar:");
  if(!codigo) return;

  const snap = await get(ref(db, `stock/${codigo}`));
  if(!snap.exists()){
    alert("Código no encontrado");
    return;
  }

  if(confirm(`¿Seguro que desea eliminar ${snap.val().nombre}?`)){
    await remove(ref(db, `stock/${codigo}`));
  }
});

// ---------------------------
// AGREGAR PRODUCTO SUELTO
// ---------------------------
const btnAgregarSuelto = document.getElementById("btnAgregarSuelto");
btnAgregarSuelto?.addEventListener("click", async ()=>{
  const codigo = document.getElementById("sueltoCodigo").value.trim();
  const nombre = document.getElementById("sueltoNombre").value.trim();
  const kg = parseFloat(document.getElementById("sueltoKg").value);
  const precio = parseFloat(document.getElementById("sueltoPrecio").value);

  if(!codigo || !nombre || isNaN(kg) || isNaN(precio)){
    alert("Complete todos los campos correctamente");
    return;
  }

  const nuevo = {
    codigo,
    nombre,
    kg,
    precio,
    fecha: new Date().toISOString()
  };

  await set(ref(db, `sueltos/${codigo}`), nuevo);
  document.getElementById("sueltoCodigo").value = "";
  document.getElementById("sueltoNombre").value = "";
  document.getElementById("sueltoKg").value = "";
  document.getElementById("sueltoPrecio").value = "";
});

// ---------------------------
// EDITAR PRODUCTO SUELTO
// ---------------------------
document.getElementById("tablaSueltosBody")?.addEventListener("click", async e=>{
  if(e.target.classList.contains("btn-editar")){
    const key = e.target.dataset.id;
    const prodSnap = await get(ref(db, `sueltos/${key}`));
    if(!prodSnap.exists()) return;

    const p = prodSnap.val();
    const nombreNuevo = prompt("Editar nombre:", p.nombre) ?? p.nombre;
    const kgNuevo = parseFloat(prompt("Editar kg:", p.kg) ?? p.kg);
    const precioNuevo = parseFloat(prompt("Editar precio:", p.precio) ?? p.precio);

    if(isNaN(kgNuevo) || isNaN(precioNuevo)){
      alert("Valores inválidos");
      return;
    }

    await update(ref(db, `sueltos/${key}`), {
      nombre: nombreNuevo,
      kg: kgNuevo,
      precio: precioNuevo
    });
  }
});

// ---------------------------
// ELIMINAR PRODUCTO SUELTO
// ---------------------------
document.getElementById("btnEliminarSuelto")?.addEventListener("click", async ()=>{
  const codigo = prompt("Ingrese el código a eliminar:");
  if(!codigo) return;

  const snap = await get(ref(db, `sueltos/${codigo}`));
  if(!snap.exists()){
    alert("Código no encontrado");
    return;
  }

  if(confirm(`¿Seguro que desea eliminar ${snap.val().nombre}?`)){
    await remove(ref(db, `sueltos/${codigo}`));
  }
});

// ---------------------------
// REFRESCAR TABLAS MANUALMENTE
// ---------------------------
document.getElementById("btnRefrescarStock")?.addEventListener("click", ()=>{
  renderTablaStock();
});

document.getElementById("btnRefrescarSueltos")?.addEventListener("click", ()=>{
  renderTablaSueltos();
});

// =========================================
// app.js — PARTE 3 (Sincronización y persistencia en Firebase)
// =========================================

// --- Helpers DB (usar ref/get/set/update/push/remove importados al inicio del archivo) ---
// NOTA: tu index.html ya expone window.db, window.ref, window.get, window.set, window.update, window.push, window.remove, window.onValue
// pero por coherencia con tu código anterior usaremos ref(window.db, path) y get(...)

function isoDateNow() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
}

// ---- Rutas útiles ----
const dbPaths = {
  stock: () => `stock`,
  sueltos: () => `sueltos`,
  cajeros: () => `cajeros`,
  movimientosForDate: (iso) => `movimientos/${iso}`,
  historialForMonth: (monthKey) => `historial/${monthKey}`,
  countersForDate: (iso) => `counters/${iso}`
};

// ---------------------------
// 1) Escuchar cambios en Firebase y mantener objetos locales actualizados
// ---------------------------
async function attachRealtimeListeners() {
  try {
    // STOCK
    window.onValue(ref(window.db, dbPaths.stock()), snap => {
      stockData = snap.exists() ? snap.val() : {};
      // mantener consistencia de cantidad/fecha si faltan campos
      Object.entries(stockData).forEach(([k, v]) => {
        if (typeof v.cantidad === "undefined" && typeof v.cant !== "undefined") {
          v.cantidad = v.cant; // si tu DB tiene 'cant' como campo legacy
        }
      });
      actualizarSelectProductos();
      renderStock();
    });

    // SUELTOS
    window.onValue(ref(window.db, dbPaths.sueltos()), snap => {
      sueltosData = snap.exists() ? snap.val() : {};
      renderSueltos();
      actualizarSelectProductos();
    });

    // CAJEROS
    window.onValue(ref(window.db, dbPaths.cajeros()), snap => {
      cajerosData = snap.exists() ? snap.val() : {};
      renderCajeros();
      cargarCajeroLogin();
      actualizarFiltroCajeros();
    });

    // MOVIMIENTOS (para el día actual)
    const iso = isoDateNow();
    window.onValue(ref(window.db, dbPaths.movimientosForDate(iso)), snap => {
      movimientosData = snap.exists() ? snap.val() : {};
      renderMovimientos();
    });

    // HISTORIAL (mes actual)
    const monthKey = monthKeyNow();
    window.onValue(ref(window.db, dbPaths.historialForMonth(monthKey)), snap => {
      historialData = snap.exists() ? snap.val() : {};
      renderHistorial();
    });

    // CONTADOR DIARIO inicial (asegura existencia)
    ensureDailyCounter();
  } catch (err) {
    console.error("attachRealtimeListeners error:", err);
  }
}

// Llamar cuando la app esté lista (por ejemplo justo después de init)
attachRealtimeListeners();


// ---------------------------
// 2) Funciones de guardado en Firebase (llamarlas cuando hagas cambios)
// ---------------------------
async function saveStockToDB() {
  try {
    await window.set(ref(window.db, dbPaths.stock()), stockData);
  } catch (err) {
    console.error("saveStockToDB error:", err);
  }
}
async function saveSueltosToDB() {
  try {
    await window.set(ref(window.db, dbPaths.sueltos()), sueltosData);
  } catch (err) {
    console.error("saveSueltosToDB error:", err);
  }
}
async function saveCajerosToDB() {
  try {
    await window.set(ref(window.db, dbPaths.cajeros()), cajerosData);
  } catch (err) {
    console.error("saveCajerosToDB error:", err);
  }
}

// NOTA: para movimientos e historial preferimos escribir por ticket concreto (no sobreescribir todo)
async function saveMovimientoTicket(ticket) {
  try {
    const iso = isoDateNow();
    const path = `${dbPaths.movimientosForDate(iso)}/${ticket.id}`;
    await window.set(ref(window.db, path), ticket);
  } catch (err) {
    console.error("saveMovimientoTicket error:", err);
  }
}
async function deleteMovimientoTicket(ticketId) {
  try {
    const iso = isoDateNow();
    const path = `${dbPaths.movimientosForDate(iso)}/${ticketId}`;
    await window.remove(ref(window.db, path));
  } catch (err) {
    console.error("deleteMovimientoTicket error:", err);
  }
}
async function saveHistorialTicket(ticket) {
  try {
    const monthKey = monthKeyNow();
    const path = `${dbPaths.historialForMonth(monthKey)}/${ticket.id}`;
    await window.set(ref(window.db, path), ticket);
  } catch (err) {
    console.error("saveHistorialTicket error:", err);
  }
}

// ---------------------------
// 3) Contador diario seguro en Firebase (obtener y aumentar atomically)
// ---------------------------
/**
 * incrementDailyCounter - obtiene y aumenta lastId en /counters/{ISODate} de forma segura
 * devuelve el nuevo lastId (número)
 */
async function incrementDailyCounterAndGet() {
  const iso = isoDateNow();
  const counterRef = ref(window.db, dbPaths.countersForDate(iso));
  // no hay transacciones en los wrappers simples que usas, pero SDK tiene runTransaction
  // para evitar complejidad usamos get -> update (hay riesgo de race condition en concurrentes,
  // si necesitás seguridad absoluta usar runTransaction de Firebase).
  try {
    const snap = await get(counterRef);
    let lastId = 0;
    if (!snap.exists()) {
      await window.set(counterRef, { lastId: 0 });
    } else {
      const val = snap.val();
      lastId = (val && typeof val.lastId !== "undefined") ? Number(val.lastId) : 0;
    }
    const newId = lastId + 1;
    await window.update(counterRef, { lastId: newId });
    return newId;
  } catch (err) {
    console.error("incrementDailyCounterAndGet error:", err);
    // fallback local
    ticketCounter = (ticketCounter || 0) + 1;
    return ticketCounter;
  }
}

// ---------------------------
// 4) Ajustes en realizarVenta para persistir TODO en DB
// ---------------------------
async function realizarVentaPersistente(tipo) {
  if (!currentCajero) {
    alert("No hay cajero logueado");
    return;
  }
  if (!cobroItems || cobroItems.length === 0) {
    alert("No hay items para cobrar");
    return;
  }

  try {
    // 1) obtener id diario desde Firebase
    const newNumericId = await incrementDailyCounterAndGet();
    const ticketID = `ID_${String(newNumericId).padStart(6, "0")}`; // ID_000001

    // 2) calcular total y construir ticket
    const total = cobroItems.reduce((acc, it) => {
      return acc + (it.tipo === "stock" ? (it.cantidad * it.precio) : (it.cantidad * it.precio * (it.porcentaje || 1)));
    }, 0);

    const ticket = {
      id: ticketID,
      cajero: currentCajero || null,
      fecha: fechaHora(),
      tipoPago: tipo,
      items: JSON.parse(JSON.stringify(cobroItems)), // clonar
      total
    };

    // 3) Persistir en movimientos (/movimientos/{ISODate}/{ticketID}) y en historial (/historial/{YYYY-MM}/{ticketID})
    await saveMovimientoTicket(ticket);
    await saveHistorialTicket(ticket);

    // 4) Actualizar stock y sueltos en memoria y en DB
    cobroItems.forEach(it => {
      if (it.tipo === "stock") {
        if (!stockData[it.codigo]) {
          // protección: si no existía, ignora o crea
          stockData[it.codigo] = { nombre: it.nombre, cantidad: 0, precio: it.precio, fecha: fechaHora() };
        }
        stockData[it.codigo].cantidad = Number((Number(stockData[it.codigo].cantidad) - Number(it.cantidad)).toFixed(3));
        if (stockData[it.codigo].cantidad < 0) stockData[it.codigo].cantidad = 0;
      } else {
        if (!sueltosData[it.codigo]) {
          sueltosData[it.codigo] = { nombre: it.nombre, cantidad: 0, precio: it.precio, fecha: fechaHora() };
        }
        sueltosData[it.codigo].cantidad = Number((Number(sueltosData[it.codigo].cantidad) - Number(it.cantidad)).toFixed(3));
        if (sueltosData[it.codigo].cantidad < 0) sueltosData[it.codigo].cantidad = 0;
      }
    });

    // 5) Guardar los cambios de stock y sueltos en Firebase
    await saveStockToDB();
    await saveSueltosToDB();

    // 6) Actualizar renders locales
    cobroItems = [];
    renderTablaCobro();
    actualizarSelectProductos();
    renderMovimientos();   // local render (movimientosData se actualizará por onValue/socket)
    renderHistorial();     // historialData se actualizará por onValue
    alert("Venta realizada correctamente");
    // imprimir ticket (sigue tu función existente)
    imprimirTicket(ticket);

  } catch (err) {
    console.error("realizarVentaPersistente error:", err);
    alert("Ocurrió un error al procesar la venta");
  }
}

// Reemplaza el binding anterior que llamaba a realizarVenta(tipo) por la versión persistente
document.querySelectorAll(".pay-btn").forEach(btn => {
  btn.removeEventListener?.("click", () => {}); // si existía, removemos
});
// Donde creas el modal (en tu código anterior), modifica la línea que llamaba a realizarVenta(tipo)
// por: realizarVentaPersistente(tipo)
// En caso de que no quieras tocar el modal, también puedes sobreescribir la función realizarVenta:
window.realizarVenta = realizarVentaPersistente; // alias seguro


// ---------------------------
// 5) Eliminar ticket: persistir eliminación en Firebase y restaurar stock
// ---------------------------
async function eliminarMovimiento(ticketId) {
  try {
    const iso = isoDateNow();
    const snap = await get(ref(window.db, `${dbPaths.movimientosForDate(iso)}/${ticketId}`));
    if (!snap.exists()) {
      alert("Ticket no encontrado en movimientos");
      return;
    }
    const ticket = snap.val();

    // Restaurar stock/sueltos
    ticket.items.forEach(it => {
      if (it.tipo === "stock") {
        if (!stockData[it.codigo]) stockData[it.codigo] = { nombre: it.nombre, cantidad: 0, precio: it.precio, fecha: fechaHora() };
        stockData[it.codigo].cantidad = Number((Number(stockData[it.codigo].cantidad) + Number(it.cantidad)).toFixed(3));
      } else {
        if (!sueltosData[it.codigo]) sueltosData[it.codigo] = { nombre: it.nombre, cantidad: 0, precio: it.precio, fecha: fechaHora() };
        sueltosData[it.codigo].cantidad = Number((Number(sueltosData[it.codigo].cantidad) + Number(it.cantidad)).toFixed(3));
      }
    });

    // Guardar stock y sueltos en DB
    await saveStockToDB();
    await saveSueltosToDB();

    // Borrar ticket de movimientos en DB (no se borra de historial por diseño)
    await deleteMovimientoTicket(ticketId);

    alert("Movimiento eliminado y stock restaurado");
  } catch (err) {
    console.error("eliminarMovimiento error:", err);
    alert("Error al eliminar movimiento");
  }
}

// Integra la llamada al eliminar en tu handler existente de tablaMovimientos:
// Reemplaza la sección donde haces delete movimientos con: await eliminarMovimiento(ticketId);

// ---------------------------
// 6) Asegurar uso de listeners/guardados cuando se edita/agrega cajero / stock / sueltos
// ---------------------------
// Ejemplos: en los lugares donde antes modificabas stockData[...] = ...; llama a saveStockToDB()
// donde modificabas cajerosData => call saveCajerosToDB()

// Ejemplo para agregar cajero (reemplaza tu handler o añade save):
btnAgregarCajero.addEventListener("click", async ()=>{
  const nro = cajeroNro.value;
  const nombre = cajeroNombre.value.trim();
  const dni = cajeroDni.value.trim();
  const pass = cajeroPass.value.trim();
  const admin = prompt("Contraseña administrador:");
  if(admin!==adminPass) return alert("Contraseña incorrecta");
  cajerosData[nro]={nombre,dni,pass};
  await saveCajerosToDB(); // <-- guarda en Firebase
  renderCajeros();
  cargarCajeroLogin();
});

// Para agregar o editar stock/sueltos en tus handlers ya existentes, simplemente llama a saveStockToDB() / saveSueltosToDB() después
// Ejemplo: en btnAgregarStock handler de tu código original añade await saveStockToDB(); y en btnAgregarSuelto añade await saveSueltosToDB();


// ---------------------------
// 7) Inicialización: asegurarse de obtener el contador e listeners ya al cargar
// ---------------------------
(async function initPersistence() {
  try {
    // Asegurar que existe contador e historial (funciones definidas en tu bloque de auto-maintenance ya incluido)
    await ensureDailyCounter(); // tu función del final del archivo
    // listeners ya attachados con attachRealtimeListeners()
    console.log("Persistencia Firebase lista");
  } catch (err) {
    console.error("initPersistence error:", err);
  }
})();

// =========================================
// app.js — PARTE 4 (UI: modales, confirm admin, paginador historial, bindings finales)
// =========================================

/* ---------------------------
   1) Sincronizar config (shopName, passAdmin, masterPass) desde Firebase
   --------------------------- */
const appTitleEl = document.getElementById("app-title");
window.onValue(ref(window.db, "config"), snap => {
  const cfg = snap.exists() ? snap.val() : null;
  if (cfg) {
    if (cfg.shopName) appTitleEl.textContent = cfg.shopName + " - Gestión Comercial V2.12.2";
    if (cfg.passAdmin) adminPass = String(cfg.passAdmin);
    if (cfg.masterPass) masterPass = String(cfg.masterPass);
  }
});

/* ---------------------------
   2) Modal administrativo reutilizable (en vez de prompt)
   devuelve Promise<string|null> (password) o null si cancelado
   y showAdminConfirm que devuelve Promise<boolean> (comparar con adminPass)
   --------------------------- */
function createAdminModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3>Contraseña de administrador</h3>
      <input id="__adm_input" type="password" placeholder="Contraseña" style="width:80%;padding:8px;margin:8px 0;">
      <div style="margin-top:12px;">
        <button id="__adm_ok" class="btn-guardar">Aceptar</button>
        <button id="__adm_cancel" class="btn-eliminar">Cancelar</button>
      </div>
      <p id="__adm_msg" style="margin-top:8px;"></p>
    </div>
  `;
  return overlay;
}

function promptAdminPassword() {
  return new Promise(resolve => {
    const modal = createAdminModal();
    document.body.appendChild(modal);
    const input = modal.querySelector("#__adm_input");
    const ok = modal.querySelector("#__adm_ok");
    const cancel = modal.querySelector("#__adm_cancel");
    const msg = modal.querySelector("#__adm_msg");

    input.focus();
    function cleanup() { modal.remove(); }

    ok.addEventListener("click", () => {
      const val = input.value.trim();
      if (!val) { msg.innerText = "Ingrese la contraseña"; return; }
      cleanup();
      resolve(val);
    });
    cancel.addEventListener("click", () => { cleanup(); resolve(null); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") ok.click();
      if (e.key === "Escape") cancel.click();
    });
  });
}

async function showAdminConfirm() {
  const p = await promptAdminPassword();
  if (p === null) return false;
  return p === adminPass || p === masterPass;
}

/* ---------------------------
   3) Reemplazar prompts en handlers críticos por modal admin
   - Eliminar item en tabla cobrar
   - Eliminar movimiento
   - Editar/Eliminar stock y sueltos
   - Agregar/editar/eliminar cajeros
   --------------------------- */

// 3.1 Eliminar item cargado en tabla cobrar (reemplaza prompt)
tablaCobro.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("btn-elim-item")) return;
  const index = Number(e.target.dataset.index);
  const ok = await showAdminConfirm();
  if (!ok) { alert("Contraseña incorrecta"); return; }
  cobroItems.splice(index, 1);
  renderTablaCobro();
});

// 3.2 Movimientos: reimpresión y eliminación persistente
tablaMovimientos.addEventListener("click", async (e) => {
  if (e.target.classList.contains("reimp-btn")) {
    const ticket = movimientosData?.[e.target.dataset.id];
    if (ticket) imprimirTicket(ticket);
    return;
  }
  if (e.target.classList.contains("elim-btn")) {
    const ticketId = e.target.dataset.id;
    const ok = await showAdminConfirm();
    if (!ok) { alert("Contraseña incorrecta"); return; }
    // llamar función persistente para eliminar y restaurar stock
    await eliminarMovimiento(ticketId);
    // movimientosData se actualizará por listener en Firebase; forzar render local en caso de lag
    renderMovimientos();
  }
});

// 3.3 Stock: cuando se edita/elimina/agrega, persistir en DB
tablaStock.addEventListener("click", async (e) => {
  const codigo = e.target.dataset.codigo;
  if (!codigo) return;
  if (e.target.classList.contains("edit-stock")) {
    const ok = await showAdminConfirm();
    if (!ok) { alert("Contraseña incorrecta"); return; }
    const nombre = prompt("Nuevo nombre:", stockData[codigo].nombre) || stockData[codigo].nombre;
    const precio = parseFloat(prompt("Nuevo precio:", stockData[codigo].precio)) || 0;
    const cant = parseFloat(prompt("Nueva cantidad:", stockData[codigo].cantidad)) || 0;
    stockData[codigo] = { nombre, precio, cantidad: Number(cant), fecha: fechaHora() };
    await saveStockToDB();
    renderStock();
    actualizarSelectProductos();
    return;
  }
  if (e.target.classList.contains("del-stock")) {
    const ok = await showAdminConfirm();
    if (!ok) { alert("Contraseña incorrecta"); return; }
    delete stockData[codigo];
    await saveStockToDB();
    renderStock();
    actualizarSelectProductos();
    return;
  }
});

// 3.4 Sueltos: editar/eliminar persistente
tablaSueltos.addEventListener("click", async (e) => {
  const codigo = e.target.dataset.codigo;
  if (!codigo) return;
  if (e.target.classList.contains("edit-suelto")) {
    const ok = await showAdminConfirm();
    if (!ok) { alert("Contraseña incorrecta"); return; }
    const nombre = prompt("Nuevo nombre:", sueltosData[codigo].nombre) || sueltosData[codigo].nombre;
    const precio = parseFloat(prompt("Nuevo precio:", sueltosData[codigo].precio)) || 0;
    const kg = parseFloat(prompt("Nueva cantidad (KG):", sueltosData[codigo].cantidad)) || 0;
    sueltosData[codigo] = { nombre, precio, cantidad: Number(kg), fecha: fechaHora() };
    await saveSueltosToDB();
    renderSueltos();
    actualizarSelectProductos();
    return;
  }
  if (e.target.classList.contains("del-suelto")) {
    const ok = await showAdminConfirm();
    if (!ok) { alert("Contraseña incorrecta"); return; }
    delete sueltosData[codigo];
    await saveSueltosToDB();
    renderSueltos();
    actualizarSelectProductos();
    return;
  }
});

// 3.5 Cajeros: persistir cambios
tablaCajeros.addEventListener("click", async (e) => {
  const nro = e.target.dataset.nro;
  if (!nro) return;
  if (e.target.classList.contains("edit-cajero")) {
    const ok = await showAdminConfirm();
    if (!ok) { alert("Contraseña incorrecta"); return; }
    const nombre = prompt("Nuevo nombre:", cajerosData[nro].nombre) || cajerosData[nro].nombre;
    const dni = prompt("Nuevo DNI:", cajerosData[nro].dni) || cajerosData[nro].dni;
    const password = prompt("Nueva contraseña:", cajerosData[nro].pass) || cajerosData[nro].pass;
    cajerosData[nro] = { nombre, dni, pass: password };
    await saveCajerosToDB();
    renderCajeros();
    cargarCajeroLogin();
    return;
  }
  if (e.target.classList.contains("del-cajero")) {
    const ok = await showAdminConfirm();
    if (!ok) { alert("Contraseña incorrecta"); return; }
    delete cajerosData[nro];
    await saveCajerosToDB();
    renderCajeros();
    cargarCajeroLogin();
    return;
  }
});

/* ---------------------------
   4) Reemplazar add-stock y add-suelto / agregar cajero para persistir automáticamente
   (si ya existe listener agregado, removemos previos y añadimos versiones async)
   --------------------------- */

// reinserto listeners con guardado en DB para mantener coherencia
btnAgregarStock.removeEventListener?.("click", ()=>{});
btnAgregarStock.addEventListener("click", async () => {
  const codigo = stockCodigo.value.trim();
  if (!codigo) return alert("Ingrese código");
  const cant = parseInt(stockCantidad.value, 10) || 0;
  const ok = await showAdminConfirm();
  if (!ok) return alert("Contraseña incorrecta");
  if (stockData[codigo]) {
    stockData[codigo].cantidad = Number((Number(stockData[codigo].cantidad) + cant).toFixed(3));
    stockData[codigo].fecha = fechaHora();
  } else {
    stockData[codigo] = { nombre: "PRODUCTO NUEVO", cantidad: Number(cant), precio: 0, fecha: fechaHora() };
  }
  await saveStockToDB();
  renderStock();
  actualizarSelectProductos();
});

btnAgregarSuelto.removeEventListener?.("click", ()=>{});
btnAgregarSuelto.addEventListener("click", async () => {
  const codigo = sueltosCodigo.value.trim();
  if (!codigo) return alert("Ingrese código");
  const kg = Number(parseFloat(sueltosKg.value) || 0);
  const ok = await showAdminConfirm();
  if (!ok) return alert("Contraseña incorrecta");
  if (sueltosData[codigo]) {
    sueltosData[codigo].cantidad = Number((Number(sueltosData[codigo].cantidad) + kg).toFixed(3));
    sueltosData[codigo].fecha = fechaHora();
  } else {
    sueltosData[codigo] = { nombre: "PRODUCTO NUEVO", cantidad: Number(kg), precio: 0, fecha: fechaHora() };
  }
  await saveSueltosToDB();
  renderSueltos();
  actualizarSelectProductos();
});

// Agregar cajero persistente (sobrescribe listener anterior)
btnAgregarCajero.removeEventListener?.("click", ()=>{});
btnAgregarCajero.addEventListener("click", async () => {
  const nro = cajeroNro.value;
  const nombre = cajeroNombre.value.trim();
  const dni = cajeroDni.value.trim();
  const pass = cajeroPass.value.trim();
  const ok = await showAdminConfirm();
  if (!ok) return alert("Contraseña incorrecta");
  cajerosData[nro] = { nombre, dni, pass };
  await saveCajerosToDB();
  renderCajeros();
  cargarCajeroLogin();
});

/* ---------------------------
   5) Modal Cobrar (pagos) — asegurar uso de realizarVentaPersistente
   Si tu código ya crea un modal con botones .pay-btn, lo reemplazamos por una versión robusta
   --------------------------- */
document.getElementById("btn-cobrar").removeEventListener?.("click", ()=>{});
document.getElementById("btn-cobrar").addEventListener("click", (e) => {
  // crear modal
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3>¿Cómo pagará el Cliente?</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0;">
        <button class="pay-btn btn-ver">Efectivo</button>
        <button class="pay-btn btn-ver">Tarjeta</button>
        <button class="pay-btn btn-ver">QR</button>
        <button class="pay-btn btn-ver">Electrónico</button>
        <button class="pay-btn btn-ver">Otro</button>
      </div>
      <div style="margin-top:10px;">
        <button id="__cancel_pay" class="btn-eliminar">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#__cancel_pay").addEventListener("click", () => overlay.remove());
  overlay.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tipo = btn.innerText;
      // llamar a la versión persistente
      if (typeof realizarVentaPersistente === "function") {
        await realizarVentaPersistente(tipo);
      } else if (typeof window.realizarVenta === "function") {
        await window.realizarVenta(tipo);
      } else {
        alert("Función de cobro no disponible");
      }
      overlay.remove();
    });
  });
});

/* ---------------------------
   6) Paginador Historial por día (prev / next)
   Crea controles encima y debajo de la tabla si no existen
   --------------------------- */

(function createHistorialPaginador() {
  // contenedor padre donde está la tabla #tabla-historial
  const historialSection = document.getElementById("historial");
  if (!historialSection) return;

  // crear paginador si no existe
  if (!document.getElementById("historial-paginador")) {
    const pag = document.createElement("div");
    pag.id = "historial-paginador";
    pag.innerHTML = `
      <button id="hist-prev">&lt; Anterior</button>
      <div id="hist-dia-label">${historialDia.toLocaleDateString()}</div>
      <button id="hist-next">Siguiente &gt;</button>
    `;
    // insertar arriba del table
    historialSection.insertBefore(pag.cloneNode(true), historialSection.querySelector("table"));
    // insertar abajo de la tabla
    historialSection.appendChild(pag);
  }

  // listeners
  function updateHistLabel() {
    const labelEls = Array.from(document.querySelectorAll("#hist-dia-label"));
    labelEls.forEach(el => el.textContent = historialDia.toLocaleDateString());
  }

  document.querySelectorAll("#hist-prev").forEach(btn => {
    btn.addEventListener("click", () => {
      historialDia.setDate(historialDia.getDate() - 1);
      renderHistorial();
      updateHistLabel();
    });
  });
  document.querySelectorAll("#hist-next").forEach(btn => {
    btn.addEventListener("click", () => {
      historialDia.setDate(historialDia.getDate() + 1);
      renderHistorial();
      updateHistLabel();
    });
  });

  updateHistLabel();
})();

/* ---------------------------
   7) Integraciones finales / limpiezas
   - Asegurarse que render inicial esté en sync con DB
   --------------------------- */
(async function finalSync() {
  try {
    // forzar carga inicial desde DB (si no lo hizo init)
    await cargarStock();
    await cargarSueltos();
    await cargarCajeros();
    actualizarSelectProductos();
    renderStock();
    renderSueltos();
    renderCajeros();
    renderMovimientos();
    renderHistorial();
    actualizarFiltroCajeros();
    console.log("UI finalizado y sincronizado con Firebase.");
  } catch (err) {
    console.error("finalSync error:", err);
  }
})();

/* ---------------------------
   Nota final
   - Todas las operaciones críticas que modifican datos ahora llaman a funciones
     que persisten en Firebase (saveStockToDB, saveSueltosToDB, saveCajerosToDB,
     saveMovimientoTicket, saveHistorialTicket, deleteMovimientoTicket).
   - Los listeners en tiempo real (attachRealtimeListeners) refrescan las variables
     locales cuando cambian en Firebase; eso permite ver cambios desde otros clientes.
   - Las operaciones que antes usaban prompt() ahora usan un modal seguro (promptAdminPassword / showAdminConfirm).
   --------------------------- */

/***********************************************
 * Persistencia Firebase + Listeners (v11.8.1)
 * Pegar al final de app.js (después del código que ya tienes)
 ***********************************************/

/* ---------- Helpers fechas / DB paths ---------- */
const nowObj = () => {
  const d = new Date();
  const isoDate = d.toISOString().slice(0,10); // YYYY-MM-DD
  const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; // YYYY-MM
  return { d, isoDate, monthKey, day:d.getDate() };
};

const dbRef = (path) => window.ref(window.db, path);
const countersRefFor = (isoDate) => dbRef(`/counters/${isoDate}`);
const movimientosRef = dbRef("/movimientos");
const historialRef = dbRef("/historial");
const stockRef = dbRef("/stock");
const sueltosRef = dbRef("/sueltos");
const cajerosRef = dbRef("/cajeros");
const configRef = dbRef("/config");

/* ---------- Guardado / Lectura: funciones async ---------- */
async function saveStockToDB(){
  try {
    await window.set(stockRef, stockData || {});
    console.log("saveStockToDB OK");
  } catch(err){ console.error("saveStockToDB:", err); }
}
async function saveSueltosToDB(){
  try {
    await window.set(sueltosRef, sueltosData || {});
    console.log("saveSueltosToDB OK");
  } catch(err){ console.error("saveSueltosToDB:", err); }
}
async function saveCajerosToDB(){
  try {
    await window.set(cajerosRef, cajerosData || {});
    console.log("saveCajerosToDB OK");
  } catch(err){ console.error("saveCajerosToDB:", err); }
}

/* Save movimientos map (por simplicidad escribimos todo)
   Movimientos se mantiene en /movimientos */
async function saveMovimientosToDB(){
  try {
    await window.set(movimientosRef, movimientosData || {});
    console.log("saveMovimientosToDB OK");
  } catch(err){ console.error("saveMovimientosToDB:", err); }
}

/* Save historial completo */
async function saveHistorialToDB(){
  try {
    await window.set(historialRef, historialData || {});
    console.log("saveHistorialToDB OK");
  } catch(err){ console.error("saveHistorialToDB:", err); }
}

/* Save config (shopName, passAdmin, masterPass) */
async function saveConfigToDB(cfg){
  try {
    await window.update(configRef, cfg);
    console.log("saveConfigToDB OK");
  } catch(err){ console.error("saveConfigToDB:", err); }
}

/* ---------- Contador diario: obtener y reservar nextId ---------- */
async function getAndIncrementDailyCounter() {
  const now = nowObj();
  const cRef = countersRefFor(now.isoDate);
  try {
    const snap = await window.get(cRef);
    if(!snap.exists()){
      // crear
      await window.set(cRef, { lastId: 0 });
      return 1;
    } else {
      const val = snap.val();
      const last = Number(val?.lastId || 0);
      const next = last + 1;
      await window.update(cRef, { lastId: next });
      return next;
    }
  } catch(err){
    console.error("getAndIncrementDailyCounter:", err);
    // fallback local (no ideal)
    return ticketCounter++;
  }
}

/* ---------- Realizar venta persistente (usa contador diario) ---------- */
async function realizarVentaPersistente(tipoPago) {
  if (!currentCajero) {
    alert("No hay cajero logueado.");
    return;
  }
  if (!cobroItems || cobroItems.length === 0) {
    alert("No hay items para cobrar.");
    return;
  }

  try {
    // obtener id diario persistente
    const nextIdNum = await getAndIncrementDailyCounter();
    const id = `ID_${String(nextIdNum).padStart(6,"0")}`;

    // calcular total
    const total = cobroItems.reduce((acc,it)=>{
      return acc + (it.tipo==="stock" ? it.cantidad*it.precio : it.cantidad*it.precio* (it.porcentaje || 1));
    },0);

    const ticket = {
      id,
      cajero: currentCajero || "00",
      fecha: fechaHora(),
      tipoPago,
      items: JSON.parse(JSON.stringify(cobroItems)),
      total
    };

    // Persistir en /movimientos y en /historial (ambos)
    // Para mantener estructura ordenada por dia en historial, guardamos por ID en raiz historial
    movimientosData = movimientosData || {};
    historialData = historialData || {};
    movimientosData[id] = ticket;
    historialData[id] = ticket;

    await saveMovimientosToDB();
    await saveHistorialToDB();

    // Restar stock/sueltos y persistir
    cobroItems.forEach(it=>{
      if(it.tipo==="stock"){
        if(!stockData[it.codigo]) stockData[it.codigo] = { nombre: it.nombre, cantidad: 0, precio: it.precio || 0 };
        stockData[it.codigo].cantidad = Number((Number(stockData[it.codigo].cantidad) - Number(it.cantidad)).toFixed(3));
        stockData[it.codigo].fecha = fechaHora();
      } else {
        if(!sueltosData[it.codigo]) sueltosData[it.codigo] = { nombre: it.nombre, cantidad: 0, precio: it.precio || 0 };
        sueltosData[it.codigo].cantidad = Number((Number(sueltosData[it.codigo].cantidad) - Number(it.cantidad)).toFixed(3));
        sueltosData[it.codigo].fecha = fechaHora();
      }
    });

    // Persistir stock y sueltos
    await saveStockToDB();
    await saveSueltosToDB();

    // Imprimir ticket
    imprimirTicket(ticket);

    // Limpiar cobro
    cobroItems = [];
    renderTablaCobro();
    actualizarSelectProductos();

    alert("Venta realizada y guardada correctamente.");

    return ticket;
  } catch(err){
    console.error("realizarVentaPersistente:", err);
    alert("Error al realizar venta. Revisa la consola.");
    throw err;
  }
}

/* ---------- Eliminar movimiento persistente ---------- */
async function eliminarMovimiento(ticketId) {
  try {
    if(!movimientosData || !movimientosData[ticketId]) {
      console.warn("eliminarMovimiento: no existe ticket en movimientos", ticketId);
      return;
    }
    // Restaurar stock/sueltos segun items del ticket
    const ticket = movimientosData[ticketId];
    ticket.items.forEach(it=>{
      if(it.tipo==="stock"){
        if(!stockData[it.codigo]) stockData[it.codigo] = { nombre: it.nombre, cantidad: 0, precio: it.precio || 0 };
        stockData[it.codigo].cantidad = Number((Number(stockData[it.codigo].cantidad) + Number(it.cantidad)).toFixed(3));
        stockData[it.codigo].fecha = fechaHora();
      } else {
        if(!sueltosData[it.codigo]) sueltosData[it.codigo] = { nombre: it.nombre, cantidad: 0, price: it.precio || 0 };
        sueltosData[it.codigo].cantidad = Number((Number(sueltosData[it.codigo].cantidad) + Number(it.cantidad)).toFixed(3));
        sueltosData[it.codigo].fecha = fechaHora();
      }
    });

    // Borrar de movimientos (pero NO de historial)
    delete movimientosData[ticketId];

    // Persistir cambios
    await saveStockToDB();
    await saveSueltosToDB();
    await saveMovimientosToDB();

    alert("Movimiento eliminado y stock restaurado correctamente.");
    return true;
  } catch(err){
    console.error("eliminarMovimiento:", err);
    alert("Error al eliminar movimiento. Revisa la consola.");
    throw err;
  }
}

/* ---------- Listeners en tiempo real para sincronizar UI ---------- */
(function attachRealtimeListeners(){
  try {
    // STOCK listener
    window.onValue(stockRef, snap => {
      stockData = snap.exists() ? snap.val() : {};
      actualizarSelectProductos();
      renderStock();
      console.log("Realtime: stock actualizado");
    });

    // SUELTOS listener
    window.onValue(sueltosRef, snap => {
      sueltosData = snap.exists() ? snap.val() : {};
      actualizarSelectProductos();
      renderSueltos();
      console.log("Realtime: sueltos actualizado");
    });

    // CAJEROS listener
    window.onValue(cajerosRef, snap => {
      cajerosData = snap.exists() ? snap.val() : {};
      renderCajeros();
      cargarCajeroLogin();
      actualizarFiltroCajeros();
      console.log("Realtime: cajeros actualizado");
    });

    // MOVIMIENTOS listener
    window.onValue(movimientosRef, snap => {
      movimientosData = snap.exists() ? snap.val() : {};
      renderMovimientos();
      console.log("Realtime: movimientos actualizado");
    });

    // HISTORIAL listener
    window.onValue(historialRef, snap => {
      historialData = snap.exists() ? snap.val() : {};
      renderHistorial();
      console.log("Realtime: historial actualizado");
    });

    // CONFIG listener
    window.onValue(configRef, snap => {
      const cfg = snap.exists() ? snap.val() : null;
      if(cfg){
        if(cfg.shopName) appTitle.textContent = cfg.shopName + " - Gestión Comercial V2.12.2";
        if(cfg.passAdmin) adminPass = String(cfg.passAdmin);
        if(cfg.masterPass) masterPass = String(cfg.masterPass);
      }
      console.log("Realtime: config actualizado");
    });

    console.log("Listeners realtime attached.");
  } catch(err){
    console.error("attachRealtimeListeners:", err);
  }
})();

/* ---------- Reemplazar las llamadas locales por persistentes en handlers ya existentes ----------
   Estos puntos ya fueron actualizados en PARTE 4 para llamar a realizarVentaPersistente o eliminarMovimiento.
   Asegúrate de que no existan otras funciones que manipulen stockData/cajerosData/sueltosData/movimientosData
   sin llamar a los save* correspondientes. Si encuentras una, añade "await saveXToDB()" tras la modificación.
-------------------------------------------------------------------------- */

/* ---------- Inicialización final: asegurar que la base contiene ramas mínimas ----------
   Si init.js no se ejecutó o DB viene vacía, init.js ya creará. Aun así, por seguridad:
*/
(async function ensureRootBranches(){
  try {
    const rootR = dbRef("/");
    const snap = await window.get(rootR);
    if(!snap.exists() || snap.val() === null){
      const ramasIniciales = {
        config: { shopName: "ZONAPC", passAdmin: "1918", masterPass: "1409" },
        cajeros: {},
        stock: {},
        sueltos: {},
        movimientos: {},
        historial: {},
        counters: {}
      };
      await window.set(rootR, ramasIniciales);
      console.log("Se crearon ramas iniciales en la DB");
    }
  } catch(err){ console.error("ensureRootBranches:", err); }
})();

/* ---------- Exportar utilidades globales (opcional, para debug) ---------- */
window.__supercode_persistence = {
  saveStockToDB, saveSueltosToDB, saveCajerosToDB,
  saveMovimientosToDB, saveHistorialToDB,
  realizarVentaPersistente, eliminarMovimiento, getAndIncrementDailyCounter
};
