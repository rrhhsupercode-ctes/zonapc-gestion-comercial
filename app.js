// app.js
// Versión completa y funcional, persistente en Firebase Realtime DB v11.8.1 (compatibilidad con init.js/index.html wrappers)
// Usa los wrappers que expone el index.html: window.ref, window.get, window.set, window.update, window.push, window.remove, window.onValue

/* ---------------------------
   VARIABLES GLOBALES (mismos nombres)
--------------------------- */
const appSections = document.querySelectorAll("main section");
const navBtns = document.querySelectorAll(".nav-btn");
const appTitle = document.getElementById("app-title");

// Modal de contraseña inicial (ya lo tenías en tu código, lo dejamos igual)
const initAdminModal = document.createElement("div");
initAdminModal.id = "init-admin-modal";
initAdminModal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:9999;";
initAdminModal.innerHTML = `
  <div style="background:#fff;padding:20px;border-radius:10px;text-align:center;">
    <h2>Ingrese contraseña de administrador</h2>
    <input id="init-pass" type="password" placeholder="Contraseña" style="margin-bottom:10px;">
    <button id="init-btn">Ingresar</button>
    <p id="init-msg" style="color:red;margin-top:10px;"></p>
  </div>
`;
document.body.appendChild(initAdminModal);

/* ---------------------------
   ESTADO (misma nomenclatura)
--------------------------- */
let adminPass = "1918"; // por defecto; será sincronizado con /config en Firebase
let masterPass = "1409";
let currentCajero = null;
let ticketsDiarios = {}; // no usabas, pero lo dejo por compatibilidad
let stockData = {};
let sueltosData = {};
let cajerosData = {};
let movimientosData = {};
let historialData = {};
let ticketCounter = 1; // se sincroniza con /counters/{ISODate}.lastId

/* ---------------------------
   RUTAS / HELPERS FIREBASE
--------------------------- */
const dbPath = {
  root: () => window.ref("/"),
  stock: () => window.ref("/stock"),
  sueltos: () => window.ref("/sueltos"),
  cajeros: () => window.ref("/cajeros"),
  movimientos: () => window.ref("/movimientos"),
  movimientoId: id => window.ref(`/movimientos/${id}`),
  historialMonth: monthKey => window.ref(`/historial/${monthKey}`),
  config: () => window.ref("/config"),
  countersForDate: isoDate => window.ref(`/counters/${isoDate}`)
};

const hoyObj = () => {
  const d = new Date();
  const isoDate = d.toISOString().slice(0,10); // YYYY-MM-DD
  const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; // YYYY-MM
  return { d, isoDate, monthKey, day: d.getDate() };
};

/* ---------------------------
   UTIL HELPERS
--------------------------- */
const hideAllSections = () => appSections.forEach(s => s.classList.add("hidden"));
const showSection = (id) => {
  hideAllSections();
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
};

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    showSection(btn.dataset.section);
  });
});

// Helper formateo dinero
const formatMoney = n => `$${Number(n).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// Helper para fecha y hora (igual a tu función pero con paréntesis separados)
const fechaHora = () => {
  const d = new Date();
  const fecha = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const hora = `(${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')})`;
  return `${fecha} ${hora}`;
};

/* ---------------------------
   SYNC: listeners onValue para mantener datos locales sincronizados
   Esto asegura que si otro cliente modifica la DB, tu UI se actualiza.
--------------------------- */
async function setupRealtimeListeners(){
  try {
    // CONFIG (shopName, passAdmin, masterPass)
    window.onValue(dbPath.config(), snap => {
      if (snap.exists()) {
        const cfg = snap.val();
        if (cfg.shopName) appTitle.textContent = cfg.shopName;
        if (cfg.passAdmin) adminPass = String(cfg.passAdmin);
        if (cfg.masterPass) masterPass = String(cfg.masterPass);
      }
    });

    // STOCK
    window.onValue(dbPath.stock(), snap => {
      stockData = snap.exists() ? snap.val() : {};
      actualizarSelectProductos();
      renderStock();
    });

    // SUELTOS
    window.onValue(dbPath.sueltos(), snap => {
      sueltosData = snap.exists() ? snap.val() : {};
      actualizarSelectProductos();
      renderSueltos();
    });

    // CAJEROS
    window.onValue(dbPath.cajeros(), snap => {
      cajerosData = snap.exists() ? snap.val() : {};
      renderCajeros();
      cargarCajeroLogin();
      actualizarFiltroCajeros();
    });

    // MOVIMIENTOS (de un día a otro movimientos puede resetearse según tu lógica; aquí mantenemos todo /movimientos)
    window.onValue(dbPath.movimientos(), snap => {
      movimientosData = snap.exists() ? snap.val() : {};
      renderMovimientos();
    });

    // HISTORIAL (carga todo el nodo /historial; renderHistorial filtra por día actual)
    window.onValue(window.ref(window.db, "/historial"), snap => {
      historialData = snap.exists() ? snap.val() : {};
      renderHistorial();
    });

    // Counters for today -> sync ticketCounter initial value
    const today = hoyObj().isoDate;
    window.onValue(dbPath.countersForDate(today), snap => {
      const val = snap.exists() ? snap.val() : null;
      if (val && typeof val.lastId !== "undefined") {
        // local ticketCounter must be lastId + 1 (next)
        ticketCounter = Number(val.lastId) + 1;
      } else {
        ticketCounter = 1;
      }
    });

    console.log("Listeners realtime configurados.");
  } catch(err){
    console.error("Error setupRealtimeListeners:", err);
  }
}

/* ---------------------------
   SAVE HELPERS (call when local state mutates)
   Cada modificación importante en stock/sueltos/cajeros/movimientos/historial/counters debe llamar a estos.
--------------------------- */
async function saveStock(){
  try {
    await window.set(dbPath.stock(), stockData);
  } catch(e){ console.error("saveStock error:", e); }
}
async function saveSueltos(){
  try {
    await window.set(dbPath.sueltos(), sueltosData);
  } catch(e){ console.error("saveSueltos error:", e); }
}
async function saveCajeros(){
  try {
    await window.set(dbPath.cajeros(), cajerosData);
  } catch(e){ console.error("saveCajeros error:", e); }
}
async function saveMovimientos(){
  try {
    await window.set(dbPath.movimientos(), movimientosData);
  } catch(e){ console.error("saveMovimientos error:", e); }
}
// Para historial guardamos por mes -> estructura: /historial/{YYYY-MM}/{ID} = ticket
async function saveHistorialMonth(monthKey){
  try {
    const monthData = historialData && historialData[monthKey] ? historialData[monthKey] : {};
    await window.set(dbPath.historialMonth(monthKey), monthData);
  } catch(e){ console.error("saveHistorialMonth error:", e); }
}
async function saveConfig(cfg){
  try {
    await window.update(dbPath.config(), cfg);
  } catch(e){ console.error("saveConfig error:", e); }
}
async function saveCounterForDate(isoDate, lastId){
  try {
    await window.set(dbPath.countersForDate(isoDate), { lastId });
  } catch(e){ console.error("saveCounterForDate error:", e); }
}

/* ---------------------------
   INICIO ADMIN (modal inicial)
   Comprueba contra /config si existe, si no usa los defaults en init.js
--------------------------- */
document.getElementById("init-btn").addEventListener("click", async ()=> {
  try {
    // sincronizar config inicial antes de validar
    const cfgSnap = await window.get(dbPath.config());
    if (cfgSnap.exists()) {
      const cfg = cfgSnap.val();
      if (cfg.passAdmin) adminPass = String(cfg.passAdmin);
      if (cfg.masterPass) masterPass = String(cfg.masterPass);
      if (cfg.shopName) appTitle.textContent = cfg.shopName;
    } else {
      // persistir valores por defecto si no existía (Init.js debe haber hecho esto, pero por seguridad)
      await saveConfig({ shopName: appTitle.textContent || "ZONAPC", passAdmin: adminPass, masterPass });
    }

    const pass = document.getElementById("init-pass").value.trim();
    if (pass === adminPass || pass === masterPass) {
      initAdminModal.style.display = "none";
      showSection("cobro");
      // iniciar listeners y cargar datos iniciales
      await setupRealtimeListeners();

      // Ensure daily counter exists
      const today = hoyObj().isoDate;
      const cSnap = await window.get(dbPath.countersForDate(today));
      if (!cSnap.exists()) {
        await saveCounterForDate(today, 0);
        ticketCounter = 1;
      } else {
        const val = cSnap.val();
        ticketCounter = (val && typeof val.lastId !== "undefined") ? Number(val.lastId) + 1 : 1;
      }

      // cargar estructuras locales (si no están por listeners inmediatos)
      const [stockSnap, sueltosSnap, cajerosSnap] = await Promise.all([
        window.get(dbPath.stock()),
        window.get(dbPath.sueltos()),
        window.get(dbPath.cajeros())
      ]);
      stockData = stockSnap.exists() ? stockSnap.val() : {};
      sueltosData = sueltosSnap.exists() ? sueltosSnap.val() : {};
      cajerosData = cajerosSnap.exists() ? cajerosSnap.val() : {};

      // render inicial
      actualizarSelectProductos();
      renderStock();
      renderSueltos();
      renderCajeros();
      cargarCajeroLogin();
      actualizarFiltroCajeros();

    } else {
      document.getElementById("init-msg").innerText = "Contraseña incorrecta";
    }
  } catch(err){
    console.error("Error en init admin:", err);
    document.getElementById("init-msg").innerText = "Error inicializando. Revisa consola.";
  }
});

/* ---------------------------
   COBRAR (mismas referencias DOM)
--------------------------- */
const loginSelect = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const loginBtn = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");
const cobroControles = document.getElementById("cobro-controles");

loginBtn.addEventListener("click", ()=>{
  const cajeroNro = loginSelect.value;
  const pass = loginPass.value.trim();
  if (cajerosData[cajeroNro] && cajerosData[cajeroNro].pass === pass) {
    currentCajero = cajeroNro;
    loginMsg.innerText = "";
    cobroControles.classList.remove("hidden");
    document.getElementById("login-modal").classList.add("hidden");
  } else {
    loginMsg.innerText = "Contraseña incorrecta";
  }
});

// Cargar select de cajeros para login
function cargarCajeroLogin(){
  loginSelect.innerHTML = "";
  Object.keys(cajerosData).sort().forEach(nro => {
    const opt = document.createElement("option");
    opt.value = nro;
    opt.textContent = nro;
    loginSelect.appendChild(opt);
  });
}

// Select cantidad (01-99)
const cantSelect = document.getElementById("cobro-cantidad");
if (cantSelect && cantSelect.children.length === 0) {
  for(let i=1;i<=99;i++){
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = String(i).padStart(2,'0');
    cantSelect.appendChild(opt);
  }
}

// Select productos STOCK y SUELTOS
const cobroProductos = document.getElementById("cobro-productos");
const cobroSueltos = document.getElementById("cobro-sueltos");
function actualizarSelectProductos(){
  if (cobroProductos) {
    cobroProductos.innerHTML = '<option value="">Elija un Item</option>';
    Object.entries(stockData).forEach(([codigo,item])=>{
      const opt = document.createElement("option");
      opt.value = codigo;
      opt.textContent = item.nombre || codigo;
      cobroProductos.appendChild(opt);
    });
  }
  if (cobroSueltos) {
    cobroSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
    Object.entries(sueltosData).forEach(([codigo,item])=>{
      const opt = document.createElement("option");
      opt.value = codigo;
      opt.textContent = item.nombre || codigo;
      cobroSueltos.appendChild(opt);
    });
  }
}

// Tabla de cobro
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
let cobroItems = [];

function renderTablaCobro(){
  tablaCobro.innerHTML = "";
  let totalGeneral = 0;
  cobroItems.forEach((item,index)=>{
    const totalItem = item.tipo === "stock" ? item.cantidad * item.precio : item.cantidad * item.precio * item.porcentaje;
    totalGeneral += totalItem;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.cantidad}</td>
      <td>${item.nombre}</td>
      <td>${formatMoney(item.tipo === "stock" ? item.precio : item.precio * (item.porcentaje || 1))}</td>
      <td>${formatMoney(totalItem)}</td>
      <td><button data-index="${index}" class="btn-elim-item">Eliminar</button></td>
    `;
    tablaCobro.appendChild(tr);
  });
  totalDiv.innerText = `TOTAL: ${formatMoney(totalGeneral)}`;
  const btnCobrar = document.querySelector("#btn-cobrar");
  if (btnCobrar) btnCobrar.classList.toggle("hidden", cobroItems.length === 0);
}

// Agregar item STOCK
document.getElementById("btn-add-product").addEventListener("click", ()=>{
  const codigoInput = document.getElementById("cobro-codigo");
  const codigo = (codigoInput && codigoInput.value.trim()) || cobroProductos.value;
  if (!codigo || !stockData[codigo]) return;
  const cantidad = parseInt(document.getElementById("cobro-cantidad").value,10) || 1;
  cobroItems.unshift({ tipo: "stock", codigo, nombre: stockData[codigo].nombre, cantidad, precio: Number(stockData[codigo].precio || 0) });
  renderTablaCobro();
});

// Agregar item SUELTOS
const kgInput = document.getElementById("input-kg-suelto");
document.getElementById("btn-incr-kg").addEventListener("click", ()=> {
  if (!kgInput) return;
  let v = parseFloat(kgInput.value) || 0.1;
  v = Math.min(99.900, (v + 0.1));
  kgInput.value = v.toFixed(3);
});
document.getElementById("btn-decr-kg").addEventListener("click", ()=> {
  if (!kgInput) return;
  let v = parseFloat(kgInput.value) || 0.1;
  v = Math.max(0.100, (v - 0.1));
  kgInput.value = v.toFixed(3);
});

document.getElementById("btn-add-suelto").addEventListener("click", ()=>{
  const codigoInput = document.getElementById("cobro-codigo-suelto");
  const codigo = (codigoInput && codigoInput.value.trim()) || cobroSueltos.value;
  if (!codigo || !sueltosData[codigo]) return;
  const kg = parseFloat(kgInput.value) || 0.1;
  const porcentaje = Number(kg.toFixed(3)); // según tu modelo
  cobroItems.unshift({ tipo: "sueltos", codigo, nombre: sueltosData[codigo].nombre, cantidad: kg, precio: Number(sueltosData[codigo].precio || 0), porcentaje });
  renderTablaCobro();
});

// Eliminar item de tabla (requiere contraseña admin)
tablaCobro.addEventListener("click", async e => {
  if (e.target.classList.contains("btn-elim-item")) {
    const index = Number(e.target.dataset.index);
    const admin = prompt("Contraseña de administrador para eliminar item:");
    if (admin === adminPass) {
      cobroItems.splice(index, 1);
      renderTablaCobro();
    } else {
      alert("Contraseña incorrecta");
    }
  }
});

// Botón Cobrar -> modal de tipos de pago
document.getElementById("btn-cobrar").addEventListener("click", ()=> {
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:9999;";
  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:10px;text-align:center;">
      <h2>¿Cómo pagará el Cliente?</h2>
      <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin:10px 0;">
        <button class="pay-btn">Efectivo</button>
        <button class="pay-btn">Tarjeta</button>
        <button class="pay-btn">QR</button>
        <button class="pay-btn">Electrónico</button>
        <button class="pay-btn">Otro</button>
      </div>
      <button id="cancel-pay" style="background:red;color:#fff;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#cancel-pay").addEventListener("click", ()=> { modal.remove(); });
  modal.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tipo = btn.innerText;
      await realizarVenta(tipo);
      modal.remove();
    });
  });
});

// realizarVenta -> guarda movimientos, historial, resta stock, actualiza counters y persistencia
async function realizarVenta(tipo){
  if (!currentCajero) {
    alert("Debe iniciar sesión con un cajero antes de cobrar.");
    return;
  }
  if (!cobroItems || cobroItems.length === 0) {
    alert("No hay items para cobrar.");
    return;
  }

  try {
    // Obtener contador diario actual en DB atomically: leer /counters/{iso}.lastId y ++
    const today = hoyObj();
    const counterRef = dbPath.countersForDate(today.isoDate);
    const counterSnap = await window.get(counterRef);
    let lastId = 0;
    if (counterSnap.exists()) lastId = Number(counterSnap.val().lastId || 0);
    const nextId = lastId + 1;
    const ticketID = `ID_${String(nextId).padStart(6,'0')}`;

    // Calcular total
    const total = cobroItems.reduce((acc, it) => {
      return acc + (it.tipo === "stock" ? (it.cantidad * it.precio) : (it.cantidad * it.precio * (it.porcentaje || 1)));
    }, 0);

    const ticket = {
      id: ticketID,
      cajero: currentCajero,
      fecha: fechaHora(),
      tipoPago: tipo,
      items: JSON.parse(JSON.stringify(cobroItems)), // deep copy
      total
    };

    // Guardar en /movimientos/{ticketID}
    movimientosData = movimientosData || {};
    movimientosData[ticketID] = ticket;
    await saveMovimientos();

    // Guardar en /historial/{YYYY-MM}/{ticketID}
    const monthKey = today.monthKey;
    historialData = historialData || {};
    if (!historialData[monthKey]) historialData[monthKey] = {};
    historialData[monthKey][ticketID] = ticket;
    // persistir mes concreto
    await saveHistorialMonth(monthKey);

    // Actualizar contador en DB
    await saveCounterForDate(today.isoDate, nextId);
    ticketCounter = nextId + 1;

    // Restar stock/sueltos localmente y persistir
    for (const it of cobroItems) {
      if (it.tipo === "stock") {
        if (!stockData[it.codigo]) {
          console.warn("Producto en stock no existe:", it.codigo);
          continue;
        }
        stockData[it.codigo].cantidad = Number(stockData[it.codigo].cantidad || 0) - Number(it.cantidad || 0);
        if (stockData[it.codigo].cantidad < 0) stockData[it.codigo].cantidad = 0;
      } else {
        if (!sueltosData[it.codigo]) {
          console.warn("Producto en sueltos no existe:", it.codigo);
          continue;
        }
        sueltosData[it.codigo].cantidad = Number(sueltosData[it.codigo].cantidad || 0) - Number(it.cantidad || 0);
        if (sueltosData[it.codigo].cantidad < 0) sueltosData[it.codigo].cantidad = 0;
      }
    }
    // persistir stock y sueltos
    await saveStock();
    await saveSueltos();

    // Imprimir ticket
    imprimirTicket(ticket);

    // Limpiar cobro y UI
    cobroItems = [];
    renderTablaCobro();
    actualizarSelectProductos();

    alert("Venta realizada");
  } catch(err) {
    console.error("Error realizarVenta:", err);
    alert("Error al procesar la venta. Revisa consola.");
  }
}

/* ---------------------------
   FUNCIONES DE CARGA DE DATOS (sincrónicas porque listeners onValue mantienen local)
   Se mantuvieron nombres originales.
--------------------------- */
async function cargarStock(){
  try {
    const snap = await window.get(dbPath.stock());
    stockData = snap.exists() ? snap.val() : {};
    actualizarSelectProductos();
    renderStock();
  } catch(e){ console.error("cargarStock error:", e); }
}

async function cargarSueltos(){
  try {
    const snap = await window.get(dbPath.sueltos());
    sueltosData = snap.exists() ? snap.val() : {};
    actualizarSelectProductos();
    renderSueltos();
  } catch(e){ console.error("cargarSueltos error:", e); }
}

async function cargarCajeros(){
  try {
    const snap = await window.get(dbPath.cajeros());
    cajerosData = snap.exists() ? snap.val() : {};
    cargarCajeroLogin();
    renderCajeros();
  } catch(e){ console.error("cargarCajeros error:", e); }
}

/* ---------------------------
   IMPRESIÓN DE TICKET (igual que tu función)
--------------------------- */
function imprimirTicket(ticket){
  try {
    const win = window.open("","Ticket","width=200,height=400");
    let html = `<pre style="width:5cm;font-family:monospace;">`;
    html += `${ticket.id}\n${ticket.fecha}\nCajero: ${ticket.cajero}\n==========\n`;
    ticket.items.forEach(it => {
      const totalItem = it.tipo === "stock" ? it.cantidad * it.precio : it.cantidad * it.precio * (it.porcentaje || 1);
      html += `${it.nombre} ${formatMoney(it.precio)} (x${it.cantidad}) = ${formatMoney(totalItem)}\n==========\n`;
    });
    html += `TOTAL: ${formatMoney(ticket.total)}\nPago: ${ticket.tipoPago}\n`;
    html += `</pre>`;
    win.document.write(html);
    win.document.close();
    // Intentamos forzar print; en algunas plataformas esto abre diálogo inmediato.
    setTimeout(()=> {
      try { win.print(); } catch(e) { console.warn("win.print fallback:", e); }
    }, 200);
  } catch(e) {
    console.error("imprimirTicket error:", e);
  }
}

/* ---------------------------
   MOVIMIENTOS (misma UI y comportamiento)
--------------------------- */
const filtroCajero = document.getElementById("filtroCajero");
const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
const btnTirarZ = document.getElementById("btn-tirar-z");

// Cargar select de cajeros para filtro
function actualizarFiltroCajeros(){
  if (!filtroCajero) return;
  filtroCajero.innerHTML = '<option value="TODOS">TODOS</option>';
  Object.keys(cajerosData).sort().forEach(nro => {
    const opt = document.createElement("option");
    opt.value = nro;
    opt.textContent = nro;
    filtroCajero.appendChild(opt);
  });
}

// Render tabla movimientos
function renderMovimientos(){
  if (!tablaMovimientos) return;
  tablaMovimientos.innerHTML = "";
  // movimientosData is an object {ID_xxxxx: ticket}
  const arr = Object.values(movimientosData || {}).slice();
  arr.sort((a,b) => b.id.localeCompare(a.id)); // desc
  arr.forEach(ticket => {
    if (filtroCajero && filtroCajero.value !== "TODOS" && ticket.cajero !== filtroCajero.value) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>${formatMoney(ticket.total)}</td>
      <td>${ticket.tipoPago}</td>
      <td>
        <button class="reimp-btn" data-id="${ticket.id}">Reimprimir</button>
        <button class="elim-btn" data-id="${ticket.id}">Eliminar</button>
      </td>
    `;
    tablaMovimientos.appendChild(tr);
  });
}

// Reimprimir / Eliminar desde MOVIMIENTOS
tablaMovimientos.addEventListener("click", async e => {
  if (e.target.classList.contains("reimp-btn")) {
    const id = e.target.dataset.id;
    const ticket = movimientosData[id];
    if (ticket) imprimirTicket(ticket);
  }
  if (e.target.classList.contains("elim-btn")) {
    const id = e.target.dataset.id;
    const pass = prompt("Contraseña administrador para eliminar ticket:");
    if (pass === adminPass) {
      const ticket = movimientosData[id];
      if (!ticket) {
        alert("Ticket no encontrado");
        return;
      }
      // Restaurar stock/sueltos según items
      for (const it of ticket.items) {
        if (it.tipo === "stock") {
          if (!stockData[it.codigo]) stockData[it.codigo] = { nombre: it.nombre || "PRODUCTO", cantidad: 0, precio: it.precio || 0 };
          stockData[it.codigo].cantidad = Number(stockData[it.codigo].cantidad || 0) + Number(it.cantidad || 0);
        } else {
          if (!sueltosData[it.codigo]) sueltosData[it.codigo] = { nombre: it.nombre || "PRODUCTO", cantidad: 0, precio: it.precio || 0 };
          sueltosData[it.codigo].cantidad = Number(sueltosData[it.codigo].cantidad || 0) + Number(it.cantidad || 0);
        }
      }
      // Persistir stock y sueltos
      await saveStock();
      await saveSueltos();
      // Borrar de movimientos y persistir
      delete movimientosData[id];
      await saveMovimientos();
      renderMovimientos();
      actualizarSelectProductos();
      alert("Ticket eliminado correctamente");
    } else {
      alert("Contraseña incorrecta");
    }
  }
});

if (filtroCajero) filtroCajero.addEventListener("change", renderMovimientos);
if (btnTirarZ) btnTirarZ.addEventListener("click", async ()=> {
  if (confirm("⚠️ADVERTENCIA: Tirar Z no puede revertirse⚠️. Continuar?")) {
    try {
      movimientosData = {};
      await saveMovimientos();
      renderMovimientos();
      alert("Tirado Z completado.");
    } catch(e) {
      console.error("Error tirar Z:", e);
      alert("Error al tirar Z. Revisa consola.");
    }
  }
});

/* ---------------------------
   HISTORIAL (por día con paginador opcional)
   Tu estructura anterior guardaba tickets en historialData con meses; renderHistorial filtra por día.
--------------------------- */
const tablaHistorial = document.querySelector("#tabla-historial tbody");
let historialDia = new Date(); // día mostrado actualmente

function renderHistorial(){
  if (!tablaHistorial) return;
  tablaHistorial.innerHTML = "";
  const hoy = historialDia.toISOString().split("T")[0]; // YYYY-MM-DD
  // historialData tiene estructura /historial/{YYYY-MM}/{ID} = ticket
  // Recorremos todos los meses cargados y juntamos tickets del dia buscado
  const rows = [];
  Object.keys(historialData || {}).forEach(monthKey => {
    const month = historialData[monthKey] || {};
    Object.values(month).forEach(ticket => {
      // ticket.fecha tiene formato "DD/MM/YYYY (hh:mm)"
      const ticketDate = ticket.fecha ? ticket.fecha.split(" ")[0].split("/").reverse().join("-") : null; // YYYY-MM-DD
      if (ticketDate === hoy) rows.push(ticket);
    });
  });
  rows.sort((a,b)=>b.id.localeCompare(a.id));
  rows.forEach(ticket => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>${formatMoney(ticket.total)}</td>
      <td>${ticket.tipoPago}</td>
      <td>${ticket.cajero}</td>
      <td>${ticket.fecha}</td>
      <td><button class="reimp-btn" data-id="${ticket.id}" data-month="${ticket.fecha ? ticket.fecha.split('/').reverse().slice(0,3).join('-').slice(0,7) : ''}">Reimprimir</button></td>
    `;
    tablaHistorial.appendChild(tr);
  });
}

// Reimprimir desde historial
tablaHistorial.addEventListener("click", e => {
  if (e.target.classList.contains("reimp-btn")) {
    const id = e.target.dataset.id;
    // buscar ticket en historialData (recorremos meses)
    let found = null;
    Object.values(historialData || {}).forEach(month => {
      if (month && month[id]) found = month[id];
    });
    if (found) imprimirTicket(found);
  }
});

/* ---------------------------
   STOCK (misma lógica + guardados a Firebase)
--------------------------- */
const tablaStock = document.querySelector("#tabla-stock tbody");
const stockCodigo = document.getElementById("stock-codigo");
const stockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const btnBuscarStock = document.getElementById("buscar-stock");

// Cargar select cantidad 001-999
if (stockCantidad && stockCantidad.children.length === 0) {
  for(let i=1;i<=999;i++){
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = String(i).padStart(3,'0');
    stockCantidad.appendChild(opt);
  }
}

btnAgregarStock.addEventListener("click", async ()=> {
  const codigo = (stockCodigo.value || "").trim();
  const cant = parseInt(stockCantidad.value,10) || 0;
  const pass = prompt("Contraseña administrador para agregar stock:");
  if (pass !== adminPass) return alert("Contraseña incorrecta");
  if (!codigo) return alert("Ingrese código válido");
  if (stockData[codigo]) {
    stockData[codigo].cantidad = Number(stockData[codigo].cantidad || 0) + cant;
    stockData[codigo].fecha = fechaHora();
  } else {
    stockData[codigo] = { nombre: "PRODUCTO NUEVO", cantidad: cant, precio: 0, fecha: fechaHora() };
  }
  await saveStock();
  renderStock();
  actualizarSelectProductos();
});

btnBuscarStock.addEventListener("click", renderStock);

function renderStock(){
  const filtro = (stockCodigo && (stockCodigo.value || "").trim().toLowerCase()) || "";
  if (!tablaStock) return;
  tablaStock.innerHTML = "";
  // Ordenar por fecha (si no, por key)
  const items = Object.entries(stockData || {});
  items.sort((a,b) => {
    const fa = a[1].fecha || "";
    const fb = b[1].fecha || "";
    return fb.localeCompare(fa);
  });
  items.forEach(([codigo,item]) => {
    if (filtro && !codigo.includes(filtro) && !(item.nombre || "").toLowerCase().includes(filtro)) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.cantidad}</td>
      <td>${item.fecha || fechaHora()}</td>
      <td>${formatMoney(item.precio)}</td>
      <td>
        <button class="edit-stock" data-codigo="${codigo}">Editar</button>
        <button class="del-stock" data-codigo="${codigo}">Eliminar</button>
      </td>
    `;
    tablaStock.appendChild(tr);
  });
}

// Editar/Eliminar stock (requer admin y persistir)
tablaStock.addEventListener("click", async e => {
  const codigo = e.target.dataset.codigo;
  if (e.target.classList.contains("edit-stock")) {
    const pass = prompt("Contraseña administrador:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    const nombre = prompt("Nuevo nombre:", stockData[codigo].nombre) || stockData[codigo].nombre;
    const precio = parseFloat(prompt("Nuevo precio:", stockData[codigo].precio)) || 0;
    const cant = parseInt(prompt("Nueva cantidad:", stockData[codigo].cantidad), 10) || 0;
    stockData[codigo] = { nombre, precio, cantidad: cant, fecha: fechaHora() };
    await saveStock();
    renderStock();
    actualizarSelectProductos();
  }
  if (e.target.classList.contains("del-stock")) {
    const pass = prompt("Contraseña administrador:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    delete stockData[codigo];
    await saveStock();
    renderStock();
    actualizarSelectProductos();
  }
});

/* ---------------------------
   SUELTOS
--------------------------- */
const tablaSueltos = document.querySelector("#tabla-sueltos tbody");
const sueltosCodigo = document.getElementById("sueltos-codigo");
const sueltosKg = document.getElementById("sueltos-kg");
const btnIncrSueltos = document.getElementById("sueltos-btn-incr");
const btnDecrSueltos = document.getElementById("sueltos-btn-decr");
const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");

btnIncrSueltos.addEventListener("click", ()=> {
  sueltosKg.value = (Math.min(99.000, (parseFloat(sueltosKg.value) || 0) + 0.100)).toFixed(3);
});
btnDecrSueltos.addEventListener("click", ()=> {
  sueltosKg.value = (Math.max(0.000, (parseFloat(sueltosKg.value) || 0) - 0.100)).toFixed(3);
});

btnAgregarSuelto.addEventListener("click", async ()=> {
  const codigo = (sueltosCodigo.value || "").trim();
  const kg = parseFloat(sueltosKg.value) || 0;
  const pass = prompt("Contraseña administrador:");
  if (pass !== adminPass) return alert("Contraseña incorrecta");
  if (!codigo) return alert("Ingrese codigo valido");
  if (sueltosData[codigo]) {
    sueltosData[codigo].cantidad = Number(sueltosData[codigo].cantidad || 0) + kg;
    sueltosData[codigo].fecha = fechaHora();
  } else {
    sueltosData[codigo] = { nombre: "PRODUCTO NUEVO", cantidad: kg, precio: 0, fecha: fechaHora() };
  }
  await saveSueltos();
  renderSueltos();
  actualizarSelectProductos();
});

btnBuscarSuelto.addEventListener("click", renderSueltos);

function renderSueltos(){
  const filtro = (sueltosCodigo && (sueltosCodigo.value || "").trim().toLowerCase()) || "";
  if (!tablaSueltos) return;
  tablaSueltos.innerHTML = "";
  const items = Object.entries(sueltosData || {});
  items.sort((a,b) => {
    const fa = a[1].fecha || "";
    const fb = b[1].fecha || "";
    return fb.localeCompare(fa);
  });
  items.forEach(([codigo,item]) => {
    if (filtro && !codigo.includes(filtro) && !(item.nombre || "").toLowerCase().includes(filtro)) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${(Number(item.cantidad) || 0).toFixed(3)}</td>
      <td>${item.fecha || fechaHora()}</td>
      <td>${formatMoney(item.precio)}</td>
      <td>
        <button class="edit-suelto" data-codigo="${codigo}">Editar</button>
        <button class="del-suelto" data-codigo="${codigo}">Eliminar</button>
      </td>
    `;
    tablaSueltos.appendChild(tr);
  });
}

// Editar/Eliminar SUELTOS
tablaSueltos.addEventListener("click", async e => {
  const codigo = e.target.dataset.codigo;
  if (e.target.classList.contains("edit-suelto")) {
    const pass = prompt("Contraseña administrador:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    const nombre = prompt("Nuevo nombre:", sueltosData[codigo].nombre) || sueltosData[codigo].nombre;
    const precio = parseFloat(prompt("Nuevo precio:", sueltosData[codigo].precio)) || 0;
    const kg = parseFloat(prompt("Nueva cantidad:", sueltosData[codigo].cantidad)) || 0;
    sueltosData[codigo] = { nombre, precio, cantidad: kg, fecha: fechaHora() };
    await saveSueltos();
    renderSueltos();
    actualizarSelectProductos();
  }
  if (e.target.classList.contains("del-suelto")) {
    const pass = prompt("Contraseña administrador:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    delete sueltosData[codigo];
    await saveSueltos();
    renderSueltos();
    actualizarSelectProductos();
  }
});

/* ---------------------------
   CAJEROS (misma UI y guardado)
--------------------------- */
const cajeroNro = document.getElementById("cajero-nro");
const cajeroNombre = document.getElementById("cajero-nombre");
const cajeroDni = document.getElementById("cajero-dni");
const cajeroPass = document.getElementById("cajero-pass");
const tablaCajeros = document.querySelector("#tabla-cajeros tbody");
const btnAgregarCajero = document.getElementById("agregar-cajero");

// Select Nro Cajero
if (cajeroNro && cajeroNro.children.length === 0) {
  for(let i=1;i<=99;i++){
    const opt = document.createElement("option");
    opt.value = String(i).padStart(2,'0');
    opt.textContent = String(i).padStart(2,'0');
    cajeroNro.appendChild(opt);
  }
}

btnAgregarCajero.addEventListener("click", async ()=> {
  const nro = cajeroNro.value;
  const nombre = (cajeroNombre.value || "").trim();
  const dni = (cajeroDni.value || "").trim();
  const pass = (cajeroPass.value || "").trim();
  const admin = prompt("Contraseña administrador:");
  if (admin !== adminPass) return alert("Contraseña incorrecta");
  if (!nro || !pass) return alert("Completar nro y contraseña del cajero");
  cajerosData[nro] = { nombre, dni, pass };
  await saveCajeros();
  renderCajeros();
  cargarCajeroLogin();
});

function renderCajeros(){
  if (!tablaCajeros) return;
  tablaCajeros.innerHTML = "";
  Object.entries(cajerosData || {})
    .sort((a,b) => a[0].localeCompare(b[0]))
    .forEach(([nro,c]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${nro}</td>
        <td>${c.nombre}</td>
        <td>${c.dni}</td>
        <td>
          <button class="edit-cajero" data-nro="${nro}">Editar</button>
          <button class="del-cajero" data-nro="${nro}">Eliminar</button>
        </td>
      `;
      tablaCajeros.appendChild(tr);
    });
}

tablaCajeros.addEventListener("click", async e => {
  const nro = e.target.dataset.nro;
  if (e.target.classList.contains("edit-cajero")) {
    const pass = prompt("Contraseña administrador:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    const nombre = prompt("Nuevo nombre:", cajerosData[nro].nombre) || cajerosData[nro].nombre;
    const dni = prompt("Nuevo DNI:", cajerosData[nro].dni) || cajerosData[nro].dni;
    const password = prompt("Nueva contraseña:", cajerosData[nro].pass) || cajerosData[nro].pass;
    cajerosData[nro] = { nombre, dni, pass: password };
    await saveCajeros();
    renderCajeros();
    cargarCajeroLogin();
  }
  if (e.target.classList.contains("del-cajero")) {
    const pass = prompt("Contraseña administrador:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    delete cajerosData[nro];
    await saveCajeros();
    renderCajeros();
    cargarCajeroLogin();
  }
});

/* ---------------------------
   CONFIG
--------------------------- */
const configNombre = document.getElementById("config-nombre");
const passActual = document.getElementById("config-pass-actual");
const passNueva = document.getElementById("config-pass-nueva");
const btnGuardarConfig = document.getElementById("guardar-config");
const masterInput = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");

btnGuardarConfig.addEventListener("click", async ()=> {
  try {
    if (passActual.value !== adminPass) return alert("Contraseña incorrecta");
    const updates = {};
    if (configNombre.value && configNombre.value.trim()) {
      updates.shopName = configNombre.value.trim();
      appTitle.textContent = configNombre.value.trim();
    }
    if (passNueva.value && passNueva.value.trim()) {
      updates.passAdmin = passNueva.value.trim();
      adminPass = passNueva.value.trim();
    }
    if (Object.keys(updates).length > 0) {
      await saveConfig(updates);
      alert("Configuración guardada");
    } else {
      alert("No hay cambios para guardar");
    }
  } catch(e) {
    console.error("guardar-config error:", e);
    alert("Error al guardar configuración");
  }
});

btnRestaurar.addEventListener("click", async ()=> {
  try {
    if (masterInput.value === masterPass) {
      adminPass = "1918";
      await saveConfig({ passAdmin: adminPass });
      alert("Contraseña de administrador restaurada");
    } else alert("Contraseña incorrecta");
  } catch(e) {
    console.error("btnRestaurar error:", e);
    alert("Error al restaurar contraseña");
  }
});

/* ---------------------------
   AUTO-MAINTENANCE: limpieza historial (día 15) y
   reseteo diario de contador de tickets
--------------------------- */
(async () => {
  // Limpieza: eliminar mes anterior cuando día > 15
  async function cleanupHistorialByPolicy() {
    try {
      const now = hoyObj();
      if (now.day <= 15) return;
      const prev = new Date(now.d.getFullYear(), now.d.getMonth() - 1, 1);
      const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2,"0")}`;
      const prevRef = dbPath.historialMonth(prevKey);
      const snap = await window.get(prevRef);
      if (!snap.exists()) return;
      await window.remove(prevRef);
      // actualizar historialData local
      if (historialData && historialData[prevKey]) delete historialData[prevKey];
      console.log(`Historial mes anterior eliminado -> ${prevKey}`);
    } catch (err) {
      console.error("cleanupHistorialByPolicy error:", err);
    }
  }

  // Ensure counter for today exists
  async function ensureDailyCounter() {
    try {
      const now = hoyObj();
      const cRef = dbPath.countersForDate(now.isoDate);
      const snap = await window.get(cRef);
      if (!snap.exists()) {
        await saveCounterForDate(now.isoDate, 0);
      } else {
        const val = snap.val();
        if (val == null || typeof val.lastId === "undefined") {
          await saveCounterForDate(now.isoDate, 0);
        }
      }
    } catch (err) {
      console.error("ensureDailyCounter error:", err);
    }
  }

  // Schedule: ejecutar cleanup y ensureDailyCounter ahora y programar ejecución diaria a 00:05
  try {
    await cleanupHistorialByPolicy();
    await ensureDailyCounter();

    // programar a 00:05
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0, 0);
    const ms = next - now;
    setTimeout(async function runDaily() {
      try {
        await cleanupHistorialByPolicy();
        await ensureDailyCounter();
      } catch(e){ console.error("Scheduled daily error:", e); }
      setInterval(async ()=> {
        try {
          await cleanupHistorialByPolicy();
          await ensureDailyCounter();
        } catch(e){ console.error("Scheduled daily error:", e); }
      }, 24*60*60*1000);
    }, Math.max(0, ms));
  } catch(e) {
    console.error("Auto-maintenance init error:", e);
  }
})();

/* ---------------------------
   INICIALIZAR UI (render inicial)
--------------------------- */
(function initRender(){
  renderMovimientos();
  renderHistorial();
  renderStock();
  renderSueltos();
  renderCajeros();
  actualizarFiltroCajeros();
  actualizarSelectProductos();
  // cargar listeners inmediatamente (si no accedieron al modal aún, listeners no correrán hasta que pase el init modal)
  // pero no forzamos carga de datos hasta que admin pase modal (seguridad). Si quieres forzar carga ahora, descomenta:
  // setupRealtimeListeners();
})();

// =========================================
// app.js — PARTE 2 (Gestión STOCK y SUELTOS)
// =========================================

// ---------------------------
// PERSISTENCIA DEL CAJERO
// ---------------------------
const cajeroActual = localStorage.getItem("cajeroActual");
if (cajeroActual) {
  document.getElementById("nombreCajero").textContent = cajeroActual;
} else {
  const modalCajero = document.getElementById("modalCajero");
  modalCajero.style.display = "flex";
  document.getElementById("btnGuardarCajero").onclick = () => {
    const nombre = document.getElementById("inputCajero").value.trim();
    if (!nombre) return alert("Ingrese nombre del cajero");
    localStorage.setItem("cajeroActual", nombre);
    document.getElementById("nombreCajero").textContent = nombre;
    modalCajero.style.display = "none";
  };
}

// ---------------------------
// FUNCIONES GLOBALES DE GUARDADO
// ---------------------------
async function saveStock() {
  await set(ref(db, "stock"), stockData);
}
async function saveSueltos() {
  await set(ref(db, "sueltos"), sueltosData);
}
async function saveMovimientos() {
  await set(ref(db, "movimientos"), movimientosData);
}

// ---------------------------
// CARGA EN TIEMPO REAL DE STOCK Y SUELTOS
// ---------------------------
onValue(ref(db, "stock"), snap => {
  if (!snap.exists()) return;
  stockData = snap.val();
  renderTablaStock();
});

onValue(ref(db, "sueltos"), snap => {
  if (!snap.exists()) return;
  sueltosData = snap.val();
  renderTablaSueltos();
});

// ---------------------------
// AGREGAR PRODUCTO A STOCK
// ---------------------------
document.getElementById("btnAgregarStock")?.addEventListener("click", async () => {
  const codigo = document.getElementById("stockCodigo").value.trim();
  const nombre = document.getElementById("stockNombre").value.trim();
  const cantidad = parseFloat(document.getElementById("stockCantidad").value);
  const precio = parseFloat(document.getElementById("stockPrecio").value);

  if (!codigo || !nombre || isNaN(cantidad) || isNaN(precio)) {
    alert("Complete todos los campos correctamente");
    return;
  }

  stockData[codigo] = {
    codigo,
    nombre,
    cant: cantidad,
    precio,
    fecha: new Date().toISOString()
  };
  await saveStock();
  renderTablaStock();

  document.getElementById("stockCodigo").value = "";
  document.getElementById("stockNombre").value = "";
  document.getElementById("stockCantidad").value = "";
  document.getElementById("stockPrecio").value = "";
});

// ---------------------------
// EDITAR PRODUCTO STOCK
// ---------------------------
document.getElementById("tablaStockBody")?.addEventListener("click", async e => {
  if (e.target.classList.contains("btn-editar")) {
    const key = e.target.dataset.id;
    const p = stockData[key];
    if (!p) return;

    const nombreNuevo = prompt("Editar nombre:", p.nombre) ?? p.nombre;
    const cantidadNueva = parseFloat(prompt("Editar cantidad:", p.cant) ?? p.cant);
    const precioNuevo = parseFloat(prompt("Editar precio:", p.precio) ?? p.precio);

    if (isNaN(cantidadNueva) || isNaN(precioNuevo)) {
      alert("Valores inválidos");
      return;
    }

    stockData[key] = {
      ...p,
      nombre: nombreNuevo,
      cant: cantidadNueva,
      precio: precioNuevo
    };
    await saveStock();
    renderTablaStock();
  }
});

// ---------------------------
// ELIMINAR PRODUCTO STOCK
// ---------------------------
document.getElementById("btnEliminarStock")?.addEventListener("click", async () => {
  const codigo = prompt("Ingrese el código a eliminar:");
  if (!codigo) return;

  if (!stockData[codigo]) {
    alert("Código no encontrado");
    return;
  }

  if (confirm(`¿Seguro que desea eliminar ${stockData[codigo].nombre}?`)) {
    delete stockData[codigo];
    await saveStock();
    renderTablaStock();
  }
});

// ---------------------------
// AGREGAR PRODUCTO SUELTO
// ---------------------------
document.getElementById("btnAgregarSuelto")?.addEventListener("click", async () => {
  const codigo = document.getElementById("sueltoCodigo").value.trim();
  const nombre = document.getElementById("sueltoNombre").value.trim();
  const kg = parseFloat(document.getElementById("sueltoKg").value);
  const precio = parseFloat(document.getElementById("sueltoPrecio").value);

  if (!codigo || !nombre || isNaN(kg) || isNaN(precio)) {
    alert("Complete todos los campos correctamente");
    return;
  }

  sueltosData[codigo] = {
    codigo,
    nombre,
    kg,
    precio,
    fecha: new Date().toISOString()
  };
  await saveSueltos();
  renderTablaSueltos();

  document.getElementById("sueltoCodigo").value = "";
  document.getElementById("sueltoNombre").value = "";
  document.getElementById("sueltoKg").value = "";
  document.getElementById("sueltoPrecio").value = "";
});

// ---------------------------
// EDITAR PRODUCTO SUELTO
// ---------------------------
document.getElementById("tablaSueltosBody")?.addEventListener("click", async e => {
  if (e.target.classList.contains("btn-editar")) {
    const key = e.target.dataset.id;
    const p = sueltosData[key];
    if (!p) return;

    const nombreNuevo = prompt("Editar nombre:", p.nombre) ?? p.nombre;
    const kgNuevo = parseFloat(prompt("Editar kg:", p.kg) ?? p.kg);
    const precioNuevo = parseFloat(prompt("Editar precio:", p.precio) ?? p.precio);

    if (isNaN(kgNuevo) || isNaN(precioNuevo)) {
      alert("Valores inválidos");
      return;
    }

    sueltosData[key] = {
      ...p,
      nombre: nombreNuevo,
      kg: kgNuevo,
      precio: precioNuevo
    };
    await saveSueltos();
    renderTablaSueltos();
  }
});

// ---------------------------
// ELIMINAR PRODUCTO SUELTO
// ---------------------------
document.getElementById("btnEliminarSuelto")?.addEventListener("click", async () => {
  const codigo = prompt("Ingrese el código a eliminar:");
  if (!codigo) return;

  if (!sueltosData[codigo]) {
    alert("Código no encontrado");
    return;
  }

  if (confirm(`¿Seguro que desea eliminar ${sueltosData[codigo].nombre}?`)) {
    delete sueltosData[codigo];
    await saveSueltos();
    renderTablaSueltos();
  }
});

// =========================================
// app.js — PARTE 3 (Cobro y Movimientos)
// =========================================

// ---------------------------
// TABLA COBRO Y SELECCIÓN PRODUCTOS
// ---------------------------
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
let cobroItems = [];

// Renderizar tabla cobro
function renderTablaCobro() {
  tablaCobro.innerHTML = "";
  let total = 0;
  cobroItems.forEach((item, index) => {
    const totalItem = item.tipo === "stock" ? item.cantidad * item.precio : item.cantidad * item.precio * item.porcentaje;
    total += totalItem;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.cantidad}</td>
      <td>${item.nombre}</td>
      <td>${formatMoney(item.tipo==="stock"?item.precio:item.precio*item.porcentaje)}</td>
      <td>${formatMoney(totalItem)}</td>
      <td><button class="btn-elim-item" data-index="${index}">Eliminar</button></td>
    `;
    tablaCobro.appendChild(tr);
  });
  totalDiv.textContent = `TOTAL: ${formatMoney(total)}`;
  document.querySelector("#btn-cobrar").classList.toggle("hidden", cobroItems.length === 0);
}

// ---------------------------
// AGREGAR ITEMS A COBRO
// ---------------------------
document.getElementById("btn-add-product")?.addEventListener("click", () => {
  const codigo = document.getElementById("cobro-codigo").value.trim() || cobroProductos.value;
  if (!codigo || !stockData[codigo]) return;
  const cantidad = parseInt(document.getElementById("cobro-cantidad").value, 10);
  cobroItems.unshift({ tipo: "stock", codigo, nombre: stockData[codigo].nombre, cantidad, precio: stockData[codigo].precio });
  renderTablaCobro();
});

document.getElementById("btn-add-suelto")?.addEventListener("click", () => {
  const codigo = document.getElementById("cobro-codigo-suelto").value.trim() || cobroSueltos.value;
  if (!codigo || !sueltosData[codigo]) return;
  const kg = parseFloat(kgInput.value);
  cobroItems.unshift({ tipo: "sueltos", codigo, nombre: sueltosData[codigo].nombre, cantidad: kg, precio: sueltosData[codigo].precio, porcentaje: kg });
  renderTablaCobro();
});

// ---------------------------
// ELIMINAR ITEM COBRO
// ---------------------------
tablaCobro.addEventListener("click", e => {
  if (!e.target.classList.contains("btn-elim-item")) return;
  const index = e.target.dataset.index;
  const admin = prompt("Contraseña de administrador para eliminar item:");
  if (admin !== adminPass) return alert("Contraseña incorrecta");
  cobroItems.splice(index, 1);
  renderTablaCobro();
});

// ---------------------------
// REALIZAR VENTA
// ---------------------------
document.getElementById("btn-cobrar")?.addEventListener("click", () => {
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:9999;";
  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:10px;text-align:center;">
      <h2>Seleccione forma de pago</h2>
      <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin:10px 0;">
        <button class="pay-btn">Efectivo</button>
        <button class="pay-btn">Tarjeta</button>
        <button class="pay-btn">QR</button>
        <button class="pay-btn">Electrónico</button>
        <button class="pay-btn">Otro</button>
      </div>
      <button id="cancel-pay" style="background:red;color:#fff;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#cancel-pay").addEventListener("click", () => modal.remove());
  modal.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await realizarVenta(btn.innerText);
      modal.remove();
    });
  });
});

// ---------------------------
// FUNCION REALIZAR VENTA
// ---------------------------
async function realizarVenta(tipoPago) {
  const ticketID = `ID_${String(ticketCounter).padStart(6, '0')}`;
  ticketCounter++;

  const total = cobroItems.reduce((acc, it) => acc + (it.tipo === "stock" ? it.cantidad * it.precio : it.cantidad * it.precio * it.porcentaje), 0);
  const ticket = {
    id: ticketID,
    cajero: currentCajero || localStorage.getItem("cajeroActual") || "ANONIMO",
    fecha: fechaHora(),
    tipoPago,
    items: [...cobroItems],
    total
  };

  // Guardar en movimientos e historial
  movimientosData[ticketID] = ticket;
  historialData[ticketID] = ticket;
  await saveMovimientos();

  // Restar stock/sueltos
  cobroItems.forEach(it => {
    if (it.tipo === "stock") stockData[it.codigo].cantidad -= it.cantidad;
    else sueltosData[it.codigo].cantidad -= it.cantidad;
  });
  await saveStock();
  await saveSueltos();

  // Imprimir ticket
  imprimirTicket(ticket);

  // Limpiar cobro
  cobroItems = [];
  renderTablaCobro();
  actualizarSelectProductos();

  alert("Venta realizada correctamente");
}

// ---------------------------
// MOVIMIENTOS EN TIEMPO REAL
// ---------------------------
onValue(ref(db, "movimientos"), snap => {
  movimientosData = snap.exists() ? snap.val() : {};
  renderMovimientos();
});

function renderMovimientos() {
  tablaMovimientos.innerHTML = "";
  Object.values(movimientosData)
    .sort((a, b) => b.id.localeCompare(a.id))
    .forEach(ticket => {
      if (filtroCajero.value !== "TODOS" && ticket.cajero !== filtroCajero.value) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ticket.id}</td>
        <td>${formatMoney(ticket.total)}</td>
        <td>${ticket.tipoPago}</td>
        <td>
          <button class="reimp-btn" data-id="${ticket.id}">Reimprimir</button>
          <button class="elim-btn" data-id="${ticket.id}">Eliminar</button>
        </td>
      `;
      tablaMovimientos.appendChild(tr);
    });
}

tablaMovimientos.addEventListener("click", async e => {
  const id = e.target.dataset.id;
  if (e.target.classList.contains("reimp-btn")) {
    const ticket = movimientosData[id];
    if (ticket) imprimirTicket(ticket);
  }
  if (e.target.classList.contains("elim-btn")) {
    const pass = prompt("Contraseña administrador para eliminar ticket:");
    if (pass !== adminPass) return alert("Contraseña incorrecta");
    const ticket = movimientosData[id];
    if (!ticket) return;
    // Restaurar stock/sueltos
    ticket.items.forEach(it => {
      if (it.tipo === "stock") stockData[it.codigo].cantidad += it.cantidad;
      else sueltosData[it.codigo].cantidad += it.cantidad;
    });
    await saveStock();
    await saveSueltos();
    delete movimientosData[id];
    await saveMovimientos();
    renderMovimientos();
    actualizarSelectProductos();
    alert("Ticket eliminado correctamente");
  }
});

// ---------------------------
// HISTORIAL DIARIO
// ---------------------------
onValue(ref(db, "historial"), snap => {
  historialData = snap.exists() ? snap.val() : {};
  renderHistorial();
});

function renderHistorial() {
  tablaHistorial.innerHTML = "";
  const hoy = new Date().toISOString().slice(0, 10);
  Object.values(historialData)
    .sort((a, b) => b.id.localeCompare(a.id))
    .forEach(ticket => {
      const ticketDate = ticket.fecha.split(" ")[0].split("/").reverse().join("-");
      if (ticketDate !== hoy) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ticket.id}</td>
        <td>${formatMoney(ticket.total)}</td>
        <td>${ticket.tipoPago}</td>
        <td>${ticket.cajero}</td>
        <td>${ticket.fecha}</td>
        <td><button class="reimp-btn" data-id="${ticket.id}">Reimprimir</button></td>
      `;
      tablaHistorial.appendChild(tr);
    });
}

tablaHistorial.addEventListener("click", e => {
  if (e.target.classList.contains("reimp-btn")) {
    const ticket = historialData[e.target.dataset.id];
    if (ticket) imprimirTicket(ticket);
  }
});
