/*****************************************************
 * app.js
 * Lógica completa de Zona PC V3.0.0
 * Compatible Firebase 11.8.1 modular
 *****************************************************/
(() => {
  // --- Variables globales ---
  let currentUser = null;
  const sections = document.querySelectorAll("main > section");
  const navButtons = document.querySelectorAll(".nav-btn");

  // --- Helper: mostrar secciones ---
  function showSection(id) {
    sections.forEach(s => s.classList.add("hidden"));
    const sec = document.getElementById(id);
    if (sec) sec.classList.remove("hidden");
  }

  navButtons.forEach(btn => btn.addEventListener("click", () => showSection(btn.dataset.section)));
  showSection("cobro"); // sección por defecto

// --- LOGIN ADMINISTRADOR AL INICIO ---
(async () => {
  // Verificar si ya tenemos el token guardado en localStorage
  const deviceToken = localStorage.getItem("adminDeviceToken");
  if (deviceToken) return; // ya validado antes, no pedir contraseña

  // Crear modal
  const adminModal = document.createElement("div");
  adminModal.id = "admin-modal";
  adminModal.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    display:flex; justify-content:center; align-items:center;
    background:rgba(0,0,0,0.7); z-index:9999;
  `;
  adminModal.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:10px; text-align:center;">
      <h2>🔒 Contraseña de Administrador</h2>
      <input id="admin-pass-input" type="password" placeholder="Contraseña" style="width:200px; text-align:center;">
      <p id="admin-pass-msg" style="color:red; margin:5px 0;"></p>
      <button id="admin-pass-btn">Ingresar</button>
    </div>
  `;
  document.body.appendChild(adminModal);

  const adminPassInput = document.getElementById("admin-pass-input");
  const adminPassBtn = document.getElementById("admin-pass-btn");
  const adminPassMsg = document.getElementById("admin-pass-msg");

  async function validarAdmin() {
    const snap = await window.get(window.ref("/config"));
    const val = snap.exists() ? snap.val() : {};
    const passAdmin = val.passAdmin || "1918";
    const masterPass = val.masterPass || "1409";
    const entrada = adminPassInput.value.trim();
    if (entrada === passAdmin || entrada === masterPass) {
      // Generar un token aleatorio único por dispositivo
      const token = crypto.randomUUID();
      localStorage.setItem("adminDeviceToken", token);
      adminModal.remove();
    } else {
      adminPassMsg.textContent = "Contraseña incorrecta";
    }
  }

  adminPassBtn.addEventListener("click", validarAdmin);
  adminPassInput.addEventListener("keyup", e => { if (e.key === "Enter") validarAdmin(); });
})();

  // --- LOGIN CAJERO ---
  const loginModal = document.getElementById("login-modal");
  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-msg");
  const cobroControles = document.getElementById("cobro-controles");

  async function loadCajeros() {
    const snap = await window.get(window.ref("/cajeros"));
    loginUsuario.innerHTML = "";
    if (snap.exists()) {
      Object.keys(snap.val()).forEach(k => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = snap.val()[k].nombre;
        loginUsuario.appendChild(opt);
      });
    }
  }

btnLogin.addEventListener("click", async () => {
  loginMsg.textContent = "";
  const userId = loginUsuario.value.trim();
  const password = loginPass.value.trim();
  const userSnap = await window.get(window.ref(`/cajeros/${userId}`));

  if (userSnap.exists() && userSnap.val().pass === password) {
    currentUser = { id: userId, ...userSnap.val() };

    // --- Actualizar título visible con nombre del cajero ---
    const appTitle = document.getElementById("app-title");
    if (appTitle) {
      appTitle.textContent = `${currentUser.nombre} (${currentUser.id})`;
    }

    loginModal.classList.add("hidden");
    cobroControles.classList.remove("hidden");
    showSection("cobro");
  } else {
    loginMsg.textContent = "Contraseña incorrecta";
  }
});

// --- COBRO ---
const cobroProductos = document.getElementById("cobro-productos");
const cobroSueltos = document.getElementById("cobro-sueltos");
const cobroCantidad = document.getElementById("cobro-cantidad");
const inputCodigoProducto = document.getElementById("cobro-codigo");
const inputCodigoSuelto = document.getElementById("cobro-codigo-suelto");
const inputKgSuelto = document.getElementById("input-kg-suelto");
const btnAddProduct = document.getElementById("btn-add-product");
const btnAddSuelto = document.getElementById("btn-add-suelto");
const btnKgMas = document.getElementById("btn-incr-kg");
const btnKgMenos = document.getElementById("btn-decr-kg");
const tablaCobro = document.getElementById("tabla-cobro").querySelector("tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");
const inputPrecioSuelto = document.getElementById("input-precio-suelto");
const inputCodigoPrecio = document.getElementById("cobro-codigo-precio");
const cobroSueltosPrecio = document.getElementById("cobro-sueltos-precio");

// nuevos inputs
const inputDescuento = document.getElementById("input-descuento");
const inputRecargo = document.getElementById("input-recargo");

let carrito = [];
let porcentajeFinal = 0;
let precioUnitarioActual = 0; // para actualizar KG <-> Precio

// --- Funciones de carga ---
async function loadProductos() {
  const snap = await window.get(window.ref("/stock"));
  cobroProductos.innerHTML = '<option value="">Elija un Item</option>';
  if (snap.exists()) Object.entries(snap.val()).forEach(([k, v]) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = v.nombre;
    cobroProductos.appendChild(opt);
  });

  const sueltosSnap = await window.get(window.ref("/sueltos"));
  cobroSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
  if (sueltosSnap.exists()) Object.entries(sueltosSnap.val()).forEach(([k, v]) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = v.nombre;
    cobroSueltos.appendChild(opt);
  });

  cobroCantidad.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    cobroCantidad.appendChild(opt);
  }

  inputCodigoProducto.value = "";
  inputCodigoSuelto.value = "";
  inputKgSuelto.value = "0.100";
  inputCodigoPrecio.value = "";
  inputPrecioSuelto.value = "000";
}

// --- Inicialización ---
async function inicializarCobro() {
  await loadProductos();
}
inicializarCobro();

// --- Calcular porcentaje final ---
function calcularPorcentajeFinal() {
  const desc = Math.min(Math.max(Number(inputDescuento.value) || 0, 0), 100);
  const rec = Math.min(Math.max(Number(inputRecargo.value) || 0, 0), 100);

  inputDescuento.value = String(Math.round(desc));
  inputRecargo.value = String(Math.round(rec));

  porcentajeFinal = rec - desc;
  actualizarTabla();
}

// --- Tabla de cobro ---
function actualizarTabla() {
  tablaCobro.innerHTML = "";
  let total = 0;
  carrito.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.tipo === "stock" ? item.cant : item.cant.toFixed(3)}</td>
      <td>${item.nombre}</td>
      <td>${item.precio.toFixed(2)}</td>
      <td>${(item.cant * item.precio).toFixed(2)}</td>
      <td><button data-idx="${idx}">❌</button></td>
    `;
    tr.querySelector("button").addEventListener("click", () => {
      carrito.splice(idx, 1);
      actualizarTabla();
    });
    tablaCobro.appendChild(tr);
    total += item.cant * item.precio;
  });

  const totalModificado = total * (1 + porcentajeFinal / 100);
  const signo = porcentajeFinal > 0 ? "+" : porcentajeFinal < 0 ? "-" : "";
  const porcentajeTexto = porcentajeFinal !== 0 ? ` <small>(${signo}${Math.abs(porcentajeFinal)}%)</small>` : "";
  totalDiv.innerHTML = `TOTAL: <span style="color:red; font-weight:bold;">$${totalModificado.toFixed(2)}</span>${porcentajeTexto}`;

  btnCobrar.classList.toggle("hidden", carrito.length === 0);
}

// --- Escuchar cambios en descuento / recargo ---
if (inputDescuento) inputDescuento.addEventListener("input", calcularPorcentajeFinal);
if (inputRecargo) inputRecargo.addEventListener("input", calcularPorcentajeFinal);

// --- Carrito ---
async function agregarAlCarrito(nuevoItem) {
  const snap = await window.get(window.ref(`/${nuevoItem.tipo}/${nuevoItem.id}`));
  if (!snap.exists()) return alert("Producto no encontrado");
  const data = snap.val();

  const idx = carrito.findIndex(it => it.id === nuevoItem.id && it.tipo === nuevoItem.tipo);
  let totalCant = nuevoItem.cant;
  if (idx >= 0) totalCant += carrito[idx].cant;

  if ((nuevoItem.tipo === "stock" && totalCant > data.cant) || (nuevoItem.tipo === "sueltos" && totalCant > data.kg)) {
    return alert("STOCK INSUFICIENTE");
  }

  if (idx >= 0) carrito[idx].cant += nuevoItem.cant;
  else carrito.push(nuevoItem);

  actualizarTabla();
}

// --- Botones AGREGAR ---
btnAddProduct.addEventListener("click", async () => {
  let id = cobroProductos.value || inputCodigoProducto.value.trim();
  let cant = parseInt(cobroCantidad.value);
  if (!id || cant <= 0) return;

  const snap = await window.get(window.ref(`/stock/${id}`));
  if (!snap.exists()) return alert("Producto no encontrado");
  const data = snap.val();

  if (cant > data.cant) return alert("STOCK INSUFICIENTE");

  agregarAlCarrito({ id, nombre: data.nombre, cant, precio: data.precio, tipo: "stock" });
  inputCodigoProducto.value = "";
});

// --- SUELTOS UNIFICADOS KG <-> PRECIO ---
async function actualizarPrecioUnitario() {
  let id = cobroSueltos.value || inputCodigoSuelto.value.trim();
  if (!id) return;
  const snap = await window.get(window.ref(`/sueltos/${id}`));
  if (!snap.exists()) return;
  precioUnitarioActual = snap.val().precio;

  // actualizar precio segun KG actual
  inputPrecioSuelto.value = (parseFloat(inputKgSuelto.value) * precioUnitarioActual).toFixed(2);
}

async function actualizarKgSegunPrecio() {
  if (!precioUnitarioActual) return;
  let precio = parseFloat(inputPrecioSuelto.value) || 0;
  inputKgSuelto.value = (precio / precioUnitarioActual).toFixed(3);
}

// --- NUEVO FORMATEO KG FANTÁSTICO ---
const msgKgCobro = document.createElement("p");
msgKgCobro.style.color = "red";
msgKgCobro.style.margin = "4px 0 0 0";
msgKgCobro.style.fontSize = "0.9em";
inputKgSuelto.parentNode.appendChild(msgKgCobro);

// Valor inicial igual que SUELTOS
inputKgSuelto.value = "0.000";

function formatearKgCobro(inputElement, msgElement, delta = 0) {
  let raw = inputElement.value.replace(/\D/g, "");

  if (delta !== 0) {
    let val = parseFloat(inputElement.value) || 0;
    val = Math.min(99.000, Math.max(0.000, val + delta));
    inputElement.value = val.toFixed(3);
    if (msgElement) msgElement.textContent = "";
    actualizarPrecioUnitario();
    return;
  }

  let val;
  switch (raw.length) {
    case 0: val = 0.000; break;
    case 1: val = parseFloat("0.00" + raw); break;
    case 2: val = parseFloat("0.0" + raw); break;
    case 3: val = parseFloat("0." + raw); break;
    case 4: val = parseFloat(raw[0] + "." + raw.slice(1, 4)); break;
    case 5: val = parseFloat(raw.slice(0, 2) + "." + raw.slice(2, 5)); break;
    default: val = parseFloat(raw.slice(0, 2) + "." + raw.slice(2, 5)); break;
  }

  if (isNaN(val) || val < 0.000 || val > 99) {
    msgElement.textContent = "KG inválido: ejemplo 1.250 kg";
    inputElement.value = "0.000"; // restablecemos a 0.000 en error
  } else {
    inputElement.value = val.toFixed(3);
    msgElement.textContent = "";
  }

  actualizarPrecioUnitario();
}

// --- Botones + / - sueltos con formateo ---
btnKgMas.addEventListener("click", () => formatearKgCobro(inputKgSuelto, msgKgCobro, 0.100));
btnKgMenos.addEventListener("click", () => formatearKgCobro(inputKgSuelto, msgKgCobro, -0.100));

// --- Edición manual KG ---
inputKgSuelto.addEventListener("input", () => formatearKgCobro(inputKgSuelto, msgKgCobro));
inputKgSuelto.addEventListener("blur", () => formatearKgCobro(inputKgSuelto, msgKgCobro));

// --- Escuchar cambios precio / selección sueltos ---
inputPrecioSuelto.addEventListener("input", actualizarKgSegunPrecio);
cobroSueltos.addEventListener("change", actualizarPrecioUnitario);
inputCodigoSuelto.addEventListener("change", actualizarPrecioUnitario);

// --- Botón agregar suelto unificado ---
btnAddSuelto.addEventListener("click", async () => {
  let id = cobroSueltos.value || inputCodigoSuelto.value.trim();
  if (!id) return alert("Seleccione un producto suelto");

  const snap = await window.get(window.ref(`/sueltos/${id}`));
  if (!snap.exists()) return alert("Producto no encontrado");
  const data = snap.val();

  let cant = parseFloat(inputKgSuelto.value) || 0;
  if (cant <= 0) return alert("Cantidad inválida");
  if (cant > data.kg) return alert("STOCK INSUFICIENTE");

  agregarAlCarrito({ id, nombre: data.nombre, cant, precio: data.precio, tipo: "sueltos" });

  // reset inputs
  inputKgSuelto.value = "0.100";
  inputPrecioSuelto.value = "000";
  inputCodigoSuelto.value = "";
});

// --- FORMATO DE PRECIOS ---
function formatPrecioSimple(valor) {
  return valor.toFixed(2).replace('.', ',');
}

// --- IMPRIMIR TICKET ---
async function imprimirTicket(ticketID, fecha, cajeroID, items, total, tipoPago) {
  const signo = porcentajeFinal > 0 ? "+" : porcentajeFinal < 0 ? "-" : "";
  const porcentajeTexto = porcentajeFinal !== 0 ? ` (${signo}${Math.abs(porcentajeFinal)}%)` : "";

  let shopName = "TICKET";
  let shopLocation = "Sucursal Nueva";
  let shopCuit = "00000000000";
  try {
    const snap = await window.get(window.ref("/config"));
    if (snap.exists()) {
      const val = snap.val();
      shopName = val.shopName || "TICKET";
      shopLocation = val.shopLocation || "Sucursal Nueva";
      shopCuit = val.shopCuit || "00000000000";
    }
  } catch (e) {
    console.error("Error al cargar configuración de tienda:", e);
  }

  const iva = total * 0.21; // IVA 21%

  const contenido = `
*** CONSUMIDOR FINAL ***
${shopName.toUpperCase()}
${shopLocation}
CUIT: ${shopCuit}
${ticketID}
Fecha: ${fecha}
Cajero: ${cajeroID}
Pago: ${tipoPago}
==============================

${items.map(it => `  ${it.nombre}
  $${formatPrecioSimple(it.precio)} (x${it.cant}) = $${formatPrecioSimple(it.precio * it.cant)}
  =========================`).join("\n")}

TOTAL: $${formatPrecioSimple(total)}${porcentajeTexto}
==============================
<span>Regimen de Transparencia Fiscal</span>
<span>al Consumidor Ley 27.743</span>
<span>IVA Contenido $${formatPrecioSimple(iva)}</span>
<span>Otros impuestos nacionales </span>
<span>Indirectos</span>
<span>Imp. Internos importados $0,00</span>
<span>Los impuestos informados son </span>
<span>solo los que corresponden </span>
<span>a nivel nacional</span>
==============================
`;

  // --- IMPRIMIR EN IFRAME ---
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
<html>
  <head>
    <style>
      @page { size: auto; margin: 0; }
      body {
        font-family: monospace;
        font-size: 10px;
        width: 5cm;
        margin: 0;
        padding: 4px;
        white-space: pre-wrap;
        line-height: 1.4;
        text-align: center;
      }
      body span.sep {
        display: block;
        text-align: center;
      }
      span { display:block; text-align:center; }
    </style>
  </head>
  <body>
${contenido}
  </body>
</html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  setTimeout(() => iframe.remove(), 100); // 2s antes de remover
}

// --- COBRAR ---
btnCobrar.addEventListener("click", async () => {
  if (!currentUser || carrito.length === 0) return;

  const modal = document.createElement("div");
  modal.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    display:flex; justify-content:center; align-items:center;
    background:rgba(0,0,0,0.7); z-index:9999;
  `;
  modal.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:10px; text-align:center;">
      <h2>¿Cómo Pagará el Cliente?</h2>
      <div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; margin:10px 0;">
        <button data-pay="Efectivo">💵​Efectivo</button>
        <button data-pay="Tarjeta">💳​Tarjeta</button>
        <button data-pay="QR">📲QR</button>
        <button data-pay="Electronico">📳Electronico</button>
        <button data-pay="Otro">💰Otro</button>
      </div>
      <button id="cancelar-pago" style="background:red; color:#fff; padding:5px 15px;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);

  const allButtons = modal.querySelectorAll("button");

  function disableButtons() { allButtons.forEach(b => b.disabled = true); }

  document.getElementById("cancelar-pago").addEventListener("click", () => {
    disableButtons();
    modal.remove();
  });

  modal.querySelectorAll("button[data-pay]").forEach(btn => {
    btn.addEventListener("click", async () => {
      disableButtons();

      const tipoPago = btn.dataset.pay;
      const fechaHoy = new Date().toISOString().split("T")[0];

      const confSnap = await window.get(window.ref("/config"));
      const confVal = confSnap.exists() ? confSnap.val() : {};
      let ultimoID = confVal.ultimoTicketID || 0;
      let ultimoFecha = confVal.ultimoTicketFecha || "";

      if (ultimoFecha !== fechaHoy) ultimoID = 0;
      ultimoID++;
      const ticketID = "ID_" + String(ultimoID).padStart(6, "0");

      const fecha = new Date();
      const fechaStr = `${fecha.getDate().toString().padStart(2,'0')}/${(fecha.getMonth()+1).toString().padStart(2,'0')}/${fecha.getFullYear()} (${fecha.getHours().toString().padStart(2,'0')}:${fecha.getMinutes().toString().padStart(2,'0')})`;

      const totalOriginal = carrito.reduce((a,b) => a+b.cant*b.precio,0);
      const totalFinal = totalOriginal * (1 + (porcentajeFinal || 0)/100);

      await window.set(window.ref(`/movimientos/${ticketID}`), {
        ticketID, cajero: currentUser.id, items: carrito,
        total: totalFinal, fecha: fecha.toISOString(), tipo: tipoPago,
        eliminado: false, porcentajeAplicado: porcentajeFinal||0
      });

      await window.set(window.ref(`/historial/${ticketID}`), {
        ticketID, cajero: currentUser.id, items: carrito,
        total: totalFinal, fecha: fecha.toISOString(), tipo: tipoPago,
        porcentajeAplicado: porcentajeFinal||0
      });

      await window.update(window.ref("/config"), { ultimoTicketID: ultimoID, ultimoTicketFecha: fechaHoy });

      for (const item of carrito) {
        const snapItem = await window.get(window.ref(`/${item.tipo}/${item.id}`));
        if (snapItem.exists()) {
          const data = snapItem.val();
          if (item.tipo === "stock") await window.update(window.ref(`/${item.tipo}/${item.id}`), { cant: data.cant - item.cant });
          else await window.update(window.ref(`/${item.tipo}/${item.id}`), { kg: data.kg - item.cant });
        }
      }

      // --- IMPRIMIR TICKET AUTOMÁTICAMENTE ---
      imprimirTicket(ticketID, fechaStr, currentUser.id, carrito, totalFinal, tipoPago);

      // --- ALERTA VENTA FINALIZADA POST-IMPRESIÓN ---
      setTimeout(() => {
        alert("VENTA FINALIZADA");

        // --- LIMPIAR ---
        carrito = [];
        actualizarTabla();
        loadStock();
        loadSueltos();
        loadMovimientos();
        loadHistorial();
        modal.remove();
      }, 500); // espera 0.5s para iniciar alert tras imprimir
    });
  });
});

// --- MOVIMIENTOS ---
const tablaMovimientos = document.getElementById("tabla-movimientos").querySelector("tbody");
const filtroCajero = document.getElementById("filtroCajero");
const btnTirarZ = document.getElementById("btn-tirar-z");

// --- GENERAR NUEVO TICKET ID ---
async function generarTicketID() {
  const snap = await window.get(window.ref("/ultimoTicketID"));
  let ultimo = snap.exists() ? parseInt(snap.val()) : 0;

  // Incrementar y hacer rollover si supera 999999
  let nuevo = ultimo + 1;
  if (nuevo > 999999) nuevo = 1;

  const ticketID = "ID_" + nuevo.toString().padStart(6, "0");

  // Guardar el nuevo valor en la base
  await window.set(window.ref("/ultimoTicketID"), nuevo);

  return ticketID;
}

// Cargar movimientos
async function loadMovimientos() {
  const snap = await window.get(window.ref("/movimientos"));
  tablaMovimientos.innerHTML = "";
  filtroCajero.innerHTML = '<option value="TODOS">TODOS</option>';
  if (!snap.exists()) return;

  const entries = Object.entries(snap.val()).sort(([, a], [, b]) => new Date(b.fecha) - new Date(a.fecha));

  entries.forEach(([id, mov]) => {
    if (filtroCajero.value !== "TODOS" && mov.cajero !== filtroCajero.value) return;
    const tr = document.createElement("tr");
    const eliminado = mov.eliminado || false;

    const fechaObj = new Date(mov.fecha);
    const horaStr = `${fechaObj.getHours().toString().padStart(2,"0")}:${fechaObj.getMinutes().toString().padStart(2,"0")}`;

    tr.style.backgroundColor = eliminado ? "#ccc" : "";
    tr.innerHTML = `
      <td>${mov.ticketID}</td>
      <td>${mov.total.toFixed(2)}</td>
      <td>${mov.tipo}</td>
      <td>${mov.cajero}</td>
      <td>${horaStr}</td>
      <td>
        <button class="reimprimir" data-id="${mov.ticketID}" ${eliminado ? "disabled" : ""}>🖨</button>
        <button class="eliminar" data-id="${mov.ticketID}" ${eliminado ? "disabled" : ""}>❌</button>
      </td>
    `;

    // --- REIMPRIMIR MOVIMIENTO ---
    tr.querySelector(".reimprimir").addEventListener("click", () => {
      const fechaStr = `${fechaObj.getDate().toString().padStart(2,'0')}/${(fechaObj.getMonth()+1).toString().padStart(2,'0')}/${fechaObj.getFullYear()}`;
      const fechaFormateada = `${fechaStr} (${horaStr})`;

      imprimirTicket(
        mov.ticketID || "N/A",
        fechaFormateada,
        mov.cajero,
        mov.items,
        mov.total,
        mov.tipo
      );
    });

    // --- ELIMINAR MOVIMIENTO ---
    tr.querySelector(".eliminar").addEventListener("click", () => {
      showAdminActionModal(async () => {
        for (const item of mov.items) {
          const snapItem = await window.get(window.ref(`/${item.tipo}/${item.id}`));
          if (!snapItem.exists()) continue;
          const data = snapItem.val();
          if (item.tipo === "stock") {
            await window.update(window.ref(`/${item.tipo}/${item.id}`), { cant: (data.cant || 0) + item.cant });
          } else {
            await window.update(window.ref(`/${item.tipo}/${item.id}`), { kg: (data.kg || 0) + item.cant });
          }
        }
        await window.update(window.ref(`/movimientos/${mov.ticketID}`), { eliminado: true });
        loadMovimientos();
      });
    });

    tablaMovimientos.appendChild(tr);

    if (!filtroCajero.querySelector(`option[value="${mov.cajero}"]`)) {
      const opt = document.createElement("option");
      opt.value = mov.cajero;
      opt.textContent = mov.cajero;
      filtroCajero.appendChild(opt);
    }
  });
}

// --- TIRAR Z ---
btnTirarZ.addEventListener("click", () => {
  showAdminActionModal(async () => {
    const snap = await window.get(window.ref("/movimientos"));
    if (!snap.exists()) return alert("No hay movimientos para tirar Z");

    const todosMov = Object.entries(snap.val())
      .filter(([, mov]) => filtroCajero.value === "TODOS" || mov.cajero === filtroCajero.value);

    if (!todosMov.length) return alert("No hay movimientos para el cajero seleccionado");

    const fechaZ = new Date();
    const zID = `TIRAR_Z_${fechaZ.getTime()}`;

    const totalPorTipoPago = {};
    let totalGeneral = 0;
    for (const [, mov] of todosMov) {
      totalPorTipoPago[mov.tipo] = (totalPorTipoPago[mov.tipo] || 0) + mov.total;
      totalGeneral += mov.total;
    }

    const registroZ = {
      tipo: "TIRAR Z",
      fecha: fechaZ.toISOString(),
      fechaExpira: new Date(fechaZ.getFullYear(), fechaZ.getMonth(), fechaZ.getDate() + 1).toISOString(),
      items: todosMov.map(([id, mov]) => ({ ...mov, ticketID: mov.ticketID })),
      totalPorTipoPago,
      totalGeneral,
      cajeros: [...new Set(todosMov.map(([, mov]) => mov.cajero))],
      eliminado: false
    };

    // Guarda en historial y respaldo
    await window.set(window.ref(`/historial/${zID}`), registroZ);
    await window.set(window.ref(`/respaldoZ/${zID}`), snap.val());

    // Elimina movimientos
    for (const [id] of todosMov) await window.remove(window.ref(`/movimientos/${id}`));

    loadMovimientos();
    if (typeof loadHistorial === "function") loadHistorial();

    // --- FORMATO DE IMPRESIÓN ---
    const fechaFormateada = `${fechaZ.getDate().toString().padStart(2,'0')}/${(fechaZ.getMonth()+1).toString().padStart(2,'0')}/${fechaZ.getFullYear()} (${fechaZ.getHours().toString().padStart(2,"0")}:${fechaZ.getMinutes().toString().padStart(2,"0")})`;

    let cuerpo = '';
    for (const cajero of registroZ.cajeros) {
      cuerpo += `CAJERO: ${cajero}\n--------------------------------\n`;
      const movCajero = registroZ.items.filter(i => i.cajero === cajero);
      const tiposPago = [...new Set(movCajero.map(i => i.tipo))];
      for (const tipo of tiposPago) {
        const ventasTipo = movCajero.filter(i => i.tipo === tipo);
        const subtotal = ventasTipo.reduce((acc, m) => acc + m.total, 0);
        cuerpo += ` ${tipo.toUpperCase()} — Subtotal: $${subtotal.toFixed(2)}\n`;
        ventasTipo.forEach(m => {
          cuerpo += `   ${m.ticketID.slice(-6)}  $${m.total.toFixed(2)}\n`;
        });
        cuerpo += `--------------------------------\n`;
      }
      cuerpo += `\n`;
    }
    cuerpo += `TOTAL GENERAL: $${registroZ.totalGeneral.toFixed(2)}\n--------------------------------\n`;
    cuerpo += `CIERRE COMPLETO - ${registroZ.cajeros.length} CAJEROS\n`;
    cuerpo += `--------------------------------\nFIN DEL REPORTE Z\n`;

    // --- IMPRIMIR ---
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <style>
            body {
              font-family: monospace;
              font-size: 13px;
              max-width: 6cm;
              white-space: pre-line;
              margin: 0;
              padding: 6px;
            }
            .titulo {
              text-align: center;
              font-weight: bold;
              border-bottom: 1px dashed #000;
              margin-bottom: 6px;
              padding-bottom: 2px;
            }
            .bloque { margin-bottom: 8px; }
            .total {
              text-align: center;
              font-weight: bold;
              font-size: 14px;
              border-top: 1px dashed #000;
              padding-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="titulo">*** CIERRE DE CAJA (Z) ***</div>
          <div class="bloque">${fechaFormateada}</div>
          <div class="bloque" style="white-space: pre-line;">${cuerpo}</div>
          <div class="total">TOTAL: $${registroZ.totalGeneral.toFixed(2)}</div>
        </body>
      </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 100);
  });
});

// --- HISTORIAL ---
async function loadHistorial() {
  const tablaHistorial = document.querySelector("#tabla-historial tbody");
  if (!tablaHistorial) return;
  tablaHistorial.innerHTML = "";

  const snap = await window.get(window.ref("/historial"));
  if (!snap.exists()) return;

  const hoy = new Date();
  const entries = Object.entries(snap.val()).sort(([, a], [, b]) => new Date(b.fecha) - new Date(a.fecha));

  for (const [id, mov] of entries) {
    const expirada = mov.fechaExpira && new Date(mov.fechaExpira) < hoy;
    const tr = document.createElement("tr");
    tr.style.backgroundColor = expirada ? "#eee" : mov.eliminado ? "#ccc" : "";

    let botones = "";
    if (mov.tipo === "TIRAR Z") {
      if (!expirada && !mov.eliminado) {
        botones = `
          <button class="reimprimir" data-id="${id}">🖨</button>
          <button class="eliminar-z">❌</button>`;
      }
    } else {
      botones = `<button class="reimprimir" data-id="${id}">🖨</button>`;
    }

    tr.innerHTML = `
      <td>${id}</td>
<td>${mov.totalGeneral ? mov.totalGeneral.toFixed(2) : mov.total ? mov.total.toFixed(2) : "-"}</td>
<td>${mov.tipo}</td>
<td>${mov.cajeros ? mov.cajeros.join(", ") : mov.cajero || ""}</td>
<td>${(() => {
  const fechaObj = new Date(mov.fecha);
  const dia = fechaObj.getDate().toString().padStart(2, "0");
  const mes = (fechaObj.getMonth() + 1).toString().padStart(2, "0");
  const anio = fechaObj.getFullYear();
  const horas = fechaObj.getHours().toString().padStart(2, "0");
  const minutos = fechaObj.getMinutes().toString().padStart(2, "0");
  return `${dia}/${mes}/${anio} (${horas}:${minutos})`;
})()}</td>
<td>${botones}</td>
    `;

// --- REIMPRIMIR DESDE HISTORIAL ---
const btnReimprimir = tr.querySelector(".reimprimir");
if (btnReimprimir) {
  btnReimprimir.addEventListener("click", () => {
    if (mov.tipo === "TIRAR Z") {
      // --- FORMATO CIERRE Z ---
      const fechaZ = new Date(mov.fecha);
      const fechaFormateada = `${fechaZ.getDate().toString().padStart(2,'0')}/${(fechaZ.getMonth()+1).toString().padStart(2,'0')}/${fechaZ.getFullYear()} (${fechaZ.getHours().toString().padStart(2,"0")}:${fechaZ.getMinutes().toString().padStart(2,"0")})`;

      let cuerpo = '';
      for (const cajero of mov.cajeros) {
        cuerpo += `CAJERO: ${cajero}\n--------------------------------\n`;
        const movCajero = mov.items.filter(i => i.cajero === cajero);
        const tiposPago = [...new Set(movCajero.map(i => i.tipo))];
        for (const tipo of tiposPago) {
          const ventasTipo = movCajero.filter(i => i.tipo === tipo);
          const subtotal = ventasTipo.reduce((acc, m) => acc + m.total, 0);
          cuerpo += ` ${tipo.toUpperCase()} — Subtotal: $${subtotal.toFixed(2)}\n`;
          ventasTipo.forEach(m => {
            cuerpo += `   ${m.ticketID.slice(-5)}  $${m.total.toFixed(2)}\n`;
          });
          cuerpo += `--------------------------------\n`;
        }
        cuerpo += `\n`;
      }
      cuerpo += `TOTAL GENERAL: $${mov.totalGeneral.toFixed(2)}\n--------------------------------\n`;
      cuerpo += `CIERRE COMPLETO - ${mov.cajeros.length} CAJEROS\n`;
      cuerpo += `--------------------------------\nFIN DEL REPORTE Z\n`;

      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "0";
      iframe.style.height = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <html>
          <head>
            <style>
              body { font-family: monospace; font-size:13px; max-width:6cm; white-space:pre-line; margin:0; padding:6px; }
              .titulo { text-align:center; font-weight:bold; border-bottom:1px dashed #000; margin-bottom:6px; padding-bottom:2px; }
              .bloque { margin-bottom:8px; }
              .total { text-align:center; font-weight:bold; font-size:14px; border-top:1px dashed #000; padding-top:4px; }
            </style>
          </head>
          <body>
            <div class="titulo">*** CIERRE DE CAJA (Z) ***</div>
            <div class="bloque">${fechaFormateada}</div>
            <div class="bloque" style="white-space: pre-line;">${cuerpo}</div>
            <div class="total">TOTAL: $${mov.totalGeneral.toFixed(2)}</div>
          </body>
        </html>
      `);
      doc.close();
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 500);

    } else {
      // --- VENTAS NORMALES: unificadas con Cobrar/Movimientos ---
      const fechaObj = new Date(mov.fecha);
      const fechaStr = `${fechaObj.getDate().toString().padStart(2,'0')}/${(fechaObj.getMonth()+1).toString().padStart(2,'0')}/${fechaObj.getFullYear()} (${fechaObj.getHours().toString().padStart(2,'0')}:${fechaObj.getMinutes().toString().padStart(2,'0')})`;

      imprimirTicket(
        mov.ticketID || "N/A",
        fechaStr,
        mov.cajero,
        mov.items,
        mov.total,
        mov.tipo
      );
    }
  });
}

    // --- ELIMINAR Z ---
    const btnEliminarZ = tr.querySelector(".eliminar-z");
    if (btnEliminarZ) {
      btnEliminarZ.addEventListener("click", async () => {
        showAdminActionModal(async () => {
          const respaldoSnap = await window.get(window.ref(`/respaldoZ/${id}`));
          if (respaldoSnap.exists()) {
            await window.set(window.ref("/movimientos"), respaldoSnap.val());
          }
          await window.update(window.ref(`/historial/${id}`), { eliminado: true });
          await window.remove(window.ref(`/respaldoZ/${id}`));
          loadMovimientos();
          loadHistorial();
        });
      });
    }

    // --- ELIMINAR AUTOMÁTICO DE RESPALDO Z VENCIDO ---
    if (expirada) {
      await window.remove(window.ref(`/respaldoZ/${id}`));
    }

    tablaHistorial.appendChild(tr);
  }
}

  
// --- STOCK ---
const stockCodigo = document.getElementById("stock-codigo");
const stockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const btnBuscarStock = document.getElementById("buscar-stock");
const tablaStock = document.getElementById("tabla-stock").querySelector("tbody");
const btnStockDecr = document.getElementById("stock-btn-decr");
const btnStockIncr = document.getElementById("stock-btn-incr");

// Actualiza cantidad (0–999)
function actualizarCant(delta, inputElement) {
  let val = parseInt(inputElement.value) || 0;
  val = Math.min(999, Math.max(0, val + delta));
  inputElement.value = val;
}

// Botones globales
if (btnStockDecr) btnStockDecr.addEventListener("click", () => actualizarCant(-1, stockCantidad));
if (btnStockIncr) btnStockIncr.addEventListener("click", () => actualizarCant(1, stockCantidad));

// Formato fecha
function formatFecha(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} (${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')})`;
}

// Formato precio "$0.000.000,00"
function formatPrecio(num) {
  const entero = Math.floor(num);
  const dec = Math.round((num - entero) * 100);
  return `$${entero.toLocaleString('es-AR', {minimumIntegerDigits:1})},${String(dec).padStart(2,'0')}`;
}

// Cargar stock con edición directa y responsive
async function loadStock(filtro = "") {
  const snap = await window.get(window.ref("/stock"));
  tablaStock.innerHTML = "";
  if (!snap.exists()) return;

  let stockArray = Object.entries(snap.val()).filter(([id, prod]) => {
    if (!filtro) return true;
    filtro = filtro.toLowerCase();
    return id.toLowerCase().includes(filtro) || prod.nombre.toLowerCase().includes(filtro);
  });

  stockArray.sort((a,b) => new Date(b[1].fecha||0)-new Date(a[1].fecha||0));

  stockArray.forEach(([id, prod]) => {
    const tr = document.createElement("tr");

    const entero = Math.floor(prod.precio);
    const dec = Math.round((prod.precio - entero) * 100);

    tr.innerHTML = `
      <td>${id}</td>
      <td><input type="text" value="${prod.nombre}" maxlength="20" style="width:100%; min-width:100px; box-sizing:border-box;" data-field="nombre"></td>
      <td style="display:flex; align-items:center; gap:4px;">
        <button class="btn-cant" data-action="-">-</button>
        <input type="number" min="0" max="999" value="${prod.cant}" style="width:100%; max-width:70px; box-sizing:border-box; text-align:center;" data-field="cant">
        <button class="btn-cant" data-action="+">+</button>
      </td>
      <td>${prod.fecha ? formatFecha(prod.fecha) : ""}</td>
      <td style="display:flex; gap:4px; align-items:center;">
        <input type="text" value="${entero.toLocaleString('es-AR')}" style="width:100%; max-width:90px; box-sizing:border-box; text-align:right;" data-field="precio-entero">
        <span>,</span>
        <input type="number" min="0" max="99" value="${dec.toString().padStart(2,'0')}" style="width:100%; max-width:60px; min-width:40px; box-sizing:border-box; text-align:center;" data-field="precio-centavos">
      </td>
      <td><button data-del-id="${id}">❌</button></td>
    `;

    // --- ELIMINAR ---
    tr.querySelector(`button[data-del-id="${id}"]`).addEventListener("click", async () => {
      await window.remove(window.ref(`/stock/${id}`));
      loadStock();
      loadProductos();
    });

    // --- CANTIDAD + / - ---
    tr.querySelectorAll(".btn-cant").forEach(btn => {
      const input = tr.querySelector('input[data-field="cant"]');
      btn.addEventListener("click", async () => {
        actualizarCant(btn.dataset.action === "+" ? 1 : -1, input);
        await window.update(window.ref(`/stock/${id}`), { cant: parseInt(input.value) });
        loadProductos();
      });
    });

    // --- GUARDAR NOMBRE ---
    tr.querySelector('input[data-field="nombre"]').addEventListener("change", async e => {
      let val = e.target.value.trim().slice(0,20);
      e.target.value = val;
      await window.update(window.ref(`/stock/${id}`), { nombre: val });
    });

    // --- GUARDAR PRECIO ---
    const inputEnt = tr.querySelector('input[data-field="precio-entero"]');
    const inputDec = tr.querySelector('input[data-field="precio-centavos"]');
    function guardarPrecio() {
      let raw = inputEnt.value.replace(/\D/g,"").slice(0,7);
      let val = parseInt(raw)||0;
      inputEnt.value = val.toLocaleString('es-AR');

      let decVal = parseInt(inputDec.value)||0;
      if(decVal<0) decVal=0;
      if(decVal>99) decVal=decVal.toString().padStart(2,'0');
      inputDec.value = decVal.toString().padStart(2,'0');

      const precioFinal = val + decVal/100;
      window.update(window.ref(`/stock/${id}`), { precio: precioFinal });
      loadProductos();
    }
    inputEnt.addEventListener("input", guardarPrecio);
    inputDec.addEventListener("input", guardarPrecio);

    tablaStock.appendChild(tr);
  });
}

// Agregar stock
btnAgregarStock.addEventListener("click", async () => {
  const codigo = stockCodigo.value.trim();
  const cant = parseInt(stockCantidad.value);
  if(!codigo || isNaN(cant) || cant<=0) return;
  const snap = await window.get(window.ref(`/stock/${codigo}`));
  const fecha = new Date().toISOString();
  if(snap.exists()){
    const currentCant = parseInt(snap.val().cant)||0;
    const newCant = Math.min(999,currentCant+cant);
    await window.update(window.ref(`/stock/${codigo}`),{ cant: newCant, fecha });
  } else {
    await window.set(window.ref(`/stock/${codigo}`),{
      nombre: "NUEVO",
      cant: Math.min(999,cant),
      fecha,
      precio:0.0,
    });
  }
  loadStock();
  loadProductos();
});

// Buscar stock
btnBuscarStock.addEventListener("click",()=>{ loadStock(stockCodigo.value.trim()); });

// Inicial
loadStock();

// --- SUELTOS ---
const sueltosCodigo = document.getElementById("sueltos-codigo");
const sueltosKg = document.getElementById("sueltos-kg");
const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");
const tablaSueltos = document.getElementById("tabla-sueltos").querySelector("tbody");
const btnSueltoDecr = document.getElementById("sueltos-btn-decr");
const btnSueltoIncr = document.getElementById("sueltos-btn-incr");

// Mensaje debajo del input sueltosKg
let msgKg = document.createElement("p");
msgKg.style.color = "red";
msgKg.style.margin = "4px 0 0 0";
msgKg.style.fontSize = "0.9em";
sueltosKg.parentNode.appendChild(msgKg);

// Formateo KG
function formatearKg(inputElement, msgElement, delta = 0) {
  let raw = inputElement.value.replace(/\D/g, "");

  if (delta !== 0) {
    let val = parseFloat(inputElement.value) || 0;
    val = Math.min(99.000, Math.max(0.000, val + delta));
    inputElement.value = val.toFixed(3);
    if (msgElement) msgElement.textContent = "";
    return;
  }

  let val;
  switch (raw.length) {
    case 0: val = 0.000; break;
    case 1: val = parseFloat("0.00" + raw); break;
    case 2: val = parseFloat("0.0" + raw); break;
    case 3: val = parseFloat("0." + raw); break;
    case 4: val = parseFloat(raw[0] + "." + raw.slice(1)); break;
    case 5: val = parseFloat(raw.slice(0, 2) + "." + raw.slice(2, 5)); break;
    default: val = parseFloat(raw.slice(0, 2) + "." + raw.slice(2, 5)); break;
  }

  if (isNaN(val) || val < 0 || val > 99) {
    msgElement.textContent = "KG inválido: ejemplo 1.250 kg";
    inputElement.value = "0.000";
  } else {
    inputElement.value = val.toFixed(3);
    msgElement.textContent = "";
  }
}

// Botones + y -
btnSueltoIncr.addEventListener("click", () => formatearKg(sueltosKg, msgKg, 0.100));
btnSueltoDecr.addEventListener("click", () => formatearKg(sueltosKg, msgKg, -0.100));

// Edición manual
sueltosKg.addEventListener("input", () => formatearKg(sueltosKg, msgKg));
sueltosKg.addEventListener("blur", () => formatearKg(sueltosKg, msgKg));

// Formatos
function formatFecha(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} (${hh}:${min})`;
}
function formatPrecio(num) {
  const entero = Math.floor(num);
  const dec = Math.round((num - entero) * 100);
  return `$${entero.toLocaleString('es-AR')},${String(dec).padStart(2,'0')}`;
}

// Cargar sueltos con edición directa
async function loadSueltos(filtro = "") {
  const snap = await window.get(window.ref("/sueltos"));
  tablaSueltos.innerHTML = "";
  if (!snap.exists()) return;

  let sueltosArray = Object.entries(snap.val()).filter(([id, prod]) => {
    if (!filtro) return true;
    filtro = filtro.toLowerCase();
    return id.toLowerCase().includes(filtro) || prod.nombre.toLowerCase().includes(filtro);
  });

  sueltosArray.sort((a, b) => new Date(b[1].fecha || 0) - new Date(a[1].fecha || 0));

  sueltosArray.forEach(([id, prod]) => {
    const tr = document.createElement("tr");

    // Separar entero y centavos
    const entero = Math.floor(prod.precio);
    const dec = Math.round((prod.precio - entero) * 100);

    tr.innerHTML = `
      <td>${id}</td>
      <td><input type="text" value="${prod.nombre}" maxlength="20" style="width:100%; min-width:100px; box-sizing:border-box;" data-field="nombre"></td>
      <td><input type="text" value="${prod.kg.toFixed(3)}" style="width:100%; max-width:70px; box-sizing:border-box; text-align:center;" data-field="kg"></td>
      <td>${prod.fecha ? formatFecha(prod.fecha) : ""}</td>
      <td style="display:flex; gap:4px; align-items:center;">
        <input type="text" value="${entero}" style="width:100%; max-width:90px; box-sizing:border-box; text-align:right;" data-field="precio-entero">
        <span>,</span>
        <input type="number" min="0" max="99" value="${dec.toString().padStart(2,'0')}" style="width:100%; max-width:60px; min-width:40px; box-sizing:border-box; text-align:center;" data-field="precio-centavos">
      </td>
      <td><button data-del-id="${id}">❌</button></td>
    `;

    // --- ELIMINAR ---
    tr.querySelector(`button[data-del-id="${id}"]`).addEventListener("click", async () => {
      await window.remove(window.ref(`/sueltos/${id}`));
      loadSueltos();
      loadProductos();
    });

    // --- GUARDAR NOMBRE ---
    tr.querySelector('input[data-field="nombre"]').addEventListener("change", async e => {
      let val = e.target.value.trim().slice(0,20);
      e.target.value = val;
      await window.update(window.ref(`/sueltos/${id}`), { nombre: val });
    });

    // --- GUARDAR KG ---
    const inputKg = tr.querySelector('input[data-field="kg"]');
    function guardarKg() {
      let raw = inputKg.value.replace(/\D/g,"");
      let val;
      switch (raw.length) {
        case 0: val=0.000; break;
        case 1: val=parseFloat("0.00"+raw); break;
        case 2: val=parseFloat("0.0"+raw); break;
        case 3: val=parseFloat("0."+raw); break;
        case 4: val=parseFloat(raw[0]+"."+raw.slice(1)); break;
        case 5: val=parseFloat(raw.slice(0,2)+"."+raw.slice(2,5)); break;
        default: val=parseFloat(raw.slice(0,2)+"."+raw.slice(2,5)); break;
      }
      if(isNaN(val)||val<0||val>99) val=0.000;
      inputKg.value = val.toFixed(3);
      window.update(window.ref(`/sueltos/${id}`), { kg: val });
    }
    inputKg.addEventListener("input", guardarKg);
    inputKg.addEventListener("blur", guardarKg);

    // --- GUARDAR PRECIO ---
    const inputEnt = tr.querySelector('input[data-field="precio-entero"]');
    const inputDec = tr.querySelector('input[data-field="precio-centavos"]');
    function guardarPrecio() {
      let raw = inputEnt.value.replace(/\D/g,"").slice(0,7);
      let val = parseInt(raw)||0;
      inputEnt.value = val.toLocaleString('es-AR');
      let decVal = parseInt(inputDec.value)||0;
      if(decVal<0) decVal=0;
      if(decVal>99) decVal=99;
      inputDec.value = decVal.toString().padStart(2,'0');
      const precioFinal = val + decVal/100;
      window.update(window.ref(`/sueltos/${id}`), { precio: precioFinal });
    }
    inputEnt.addEventListener("input", guardarPrecio);
    inputDec.addEventListener("input", guardarPrecio);

    tablaSueltos.appendChild(tr);
  });
}

// Agregar suelto
btnAgregarSuelto.addEventListener("click", async () => {
  const codigo = sueltosCodigo.value.trim();
  let kg = parseFloat(sueltosKg.value);
  if (!codigo || isNaN(kg) || kg < 0 || kg > 99) {
    msgKg.textContent = "KG inválido: ejemplo 1.250 kg";
    return;
  }

  const fecha = new Date().toISOString();
  const sueltoRef = window.ref(`/sueltos/${codigo}`);
  const snap = await window.get(sueltoRef);

  if (snap.exists()) {
    const existingKg = parseFloat(snap.val().kg) || 0;
    kg = Math.min(99.000, existingKg + kg);
    await window.update(sueltoRef, { kg, fecha });
  } else {
    await window.set(sueltoRef, { nombre: "NUEVO", kg, fecha, precio: 0.0 });
  }

  loadSueltos();
  loadProductos();
});

// Buscar suelto
btnBuscarSuelto.addEventListener("click", () => {
  const filtro = sueltosCodigo.value.trim();
  loadSueltos(filtro);
});

// Inicial
loadSueltos();

// --- CAJEROS ---
const cajeroNro = document.getElementById("cajero-nro");
const cajeroNombre = document.getElementById("cajero-nombre");
const cajeroDni = document.getElementById("cajero-dni");
const cajeroPass = document.getElementById("cajero-pass");
const btnAgregarCajero = document.getElementById("agregar-cajero");
const tablaCajeros = document.getElementById("tabla-cajeros").querySelector("tbody");

function showSection(id) {
  sections.forEach(s => s.classList.add("hidden"));
  const sec = document.getElementById(id);
  if (sec) sec.classList.remove("hidden");

  if (id === "cajeros") loadCajerosTabla();
  if (id === "cobro") {
    loadProductos();
    loadStock();
    loadSueltos();
  }
  if (id === "movimientos") loadMovimientos();
  if (id === "historial") loadHistorial();
}

function loadCajeroSelectOptions(selected = null) {
  cajeroNro.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    const opt = document.createElement("option");
    opt.value = String(i).padStart(2, "0");
    opt.textContent = String(i).padStart(2, "0");
    if (selected && selected === opt.value) opt.selected = true;
    cajeroNro.appendChild(opt);
  }
}

// Modal de contraseña admin reutilizable
function showAdminActionModal(actionCallback) {
  const modal = document.createElement("div");
  modal.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    display:flex; justify-content:center; align-items:center;
    background:rgba(0,0,0,0.7); z-index:9999;
  `;
  modal.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:10px; width:300px; text-align:center;">
      <h2>Contraseña Administrador</h2>
      <input id="admin-pass-input" type="password" placeholder="Contraseña Admin" style="width:100%; margin:5px 0;">
      <div style="margin-top:10px;">
        <button id="admin-pass-aceptar" style="margin-right:5px;">Aceptar</button>
        <button id="admin-pass-cancelar" style="background:red; color:#fff;">Cancelar</button>
      </div>
      <p id="admin-pass-msg" style="color:red; margin-top:5px;"></p>
    </div>
  `;
  document.body.appendChild(modal);

  const input = modal.querySelector("#admin-pass-input");
  const aceptar = modal.querySelector("#admin-pass-aceptar");
  const cancelar = modal.querySelector("#admin-pass-cancelar");
  const msg = modal.querySelector("#admin-pass-msg");

  cancelar.addEventListener("click", () => modal.remove());

  aceptar.addEventListener("click", async () => {
    const pass = input.value.trim();
    const confSnap = await window.get(window.ref("/config"));
    const confVal = confSnap.exists() ? confSnap.val() : {};
    const passAdmin = confVal.passAdmin || "1918";
    const masterPass = confVal.masterPass || "1409";

    if (pass !== passAdmin && pass !== masterPass) {
      msg.textContent = "Contraseña incorrecta";
      return;
    }
    modal.remove();
    actionCallback();
  });
}

async function loadCajerosTabla() {
  const snap = await window.get(window.ref("/cajeros"));
  tablaCajeros.innerHTML = "";
  loadCajeroSelectOptions();

  if (snap.exists()) {
    Object.entries(snap.val())
      .sort(([idA], [idB]) => Number(idA) - Number(idB))
      .forEach(([id, cajero]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${id}</td>
          <td>${cajero.nombre}</td>
          <td>${cajero.dni}</td>
          <td>
            <button data-edit-id="${id}">✏️</button>
            <button data-del-id="${id}">❌</button>
          </td>
        `;

        // Eliminar cajero usando modal
        tr.querySelector(`button[data-del-id="${id}"]`).addEventListener("click", () => {
          showAdminActionModal(async () => {
            // Confirmación removida, solo se elimina directamente
            await window.remove(window.ref(`/cajeros/${id}`));
            loadCajerosTabla();
            loadCajeros();
          });
        });

// Editar cajero usando modal de admin
tr.querySelector(`button[data-edit-id="${id}"]`).addEventListener("click", () => {
  showAdminActionModal(async () => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      display:flex; justify-content:center; align-items:center;
      background:rgba(0,0,0,0.7); z-index:9999;
    `;
    modal.innerHTML = `
      <div style="background:#fff; padding:20px; border-radius:10px; width:320px; text-align:center;">
        <h2>Editar Cajero ${id}</h2>
        
        <label for="edit-nro">Número de Cajero (1-99)</label>
        <input id="edit-nro" type="number" min="1" max="99" placeholder="Nro Cajero" value="${id}" style="width:100%; margin:5px 0;">

        <label for="edit-nombre">Nombre (6 a 20 letras)</label>
        <input id="edit-nombre" type="text" placeholder="Nombre" value="${cajero.nombre}" style="width:100%; margin:5px 0;">

        <label for="edit-dni">DNI (8 dígitos)</label>
        <input id="edit-dni" type="text" placeholder="DNI" value="${cajero.dni}" style="width:100%; margin:5px 0;" maxlength="8">

        <label for="edit-pass">Contraseña</label>
        <input id="edit-pass" type="text" placeholder="Contraseña" value="${cajero.pass}" style="width:100%; margin:5px 0;">

        <div style="margin-top:10px;">
          <button id="edit-aceptar" style="margin-right:5px;">Aceptar</button>
          <button id="edit-cancelar" style="background:red; color:#fff;">Cancelar</button>
        </div>
        <p id="edit-msg" style="color:red; margin-top:5px;"></p>
      </div>
    `;
    document.body.appendChild(modal);

    const editNro = modal.querySelector("#edit-nro");
    const editNombre = modal.querySelector("#edit-nombre");
    const editDni = modal.querySelector("#edit-dni");
    const editPass = modal.querySelector("#edit-pass");
    const editAceptar = modal.querySelector("#edit-aceptar");
    const editCancelar = modal.querySelector("#edit-cancelar");
    const editMsg = modal.querySelector("#edit-msg");

    editCancelar.addEventListener("click", () => modal.remove());

    editAceptar.addEventListener("click", async () => {
      const newNro = String(editNro.value).padStart(2, "0");
      const newNombre = editNombre.value.trim();
      const newDni = editDni.value.trim();
      const newPass = editPass.value.trim();

      if (!newNro || !newNombre || !newDni || !newPass) {
        editMsg.textContent = "Todos los campos son obligatorios";
        return;
      }

      if (!/^\d{8}$/.test(newDni)) {
        editMsg.textContent = "El DNI debe tener exactamente 8 dígitos";
        return;
      }

      if (!/^[A-Za-zñÑ\s]{6,20}$/.test(newNombre)) {
        editMsg.textContent = "El nombre debe tener entre 6 y 20 letras, puede incluir espacios y ñ";
        return;
      }

      if (newNro !== id) {
        const existingSnap = await window.get(window.ref(`/cajeros/${newNro}`));
        if (existingSnap.exists()) {
          editMsg.textContent = "❌ Este Nro ya está en uso";
          return;
        }
        await window.set(window.ref(`/cajeros/${newNro}`), { nombre: newNombre, dni: newDni, pass: newPass });
        await window.remove(window.ref(`/cajeros/${id}`));
      } else {
        await window.update(window.ref(`/cajeros/${id}`), { nombre: newNombre, dni: newDni, pass: newPass });
      }

      loadCajerosTabla();
      loadCajeros();
      modal.remove();
    });
  });
});


        tablaCajeros.appendChild(tr);
      });
  }
}

// Agregar cajero usando modal
btnAgregarCajero.addEventListener("click", () => {
  const nro = cajeroNro.value;
  const nombre = cajeroNombre.value.trim();
  const dni = cajeroDni.value.trim();
  const pass = cajeroPass.value.trim();
  if (!nro || !nombre || !dni || !pass) return;

  if (!/^\d{8}$/.test(dni)) {
    alert("El DNI debe tener exactamente 8 dígitos");
    return;
  }

  if (!/^[A-Za-zñÑ\s]{6,20}$/.test(nombre)) {
    alert("El nombre debe tener entre 6 y 20 letras, puede incluir espacios y ñ");
    return;
  }

  showAdminActionModal(async () => {
    const existingSnap = await window.get(window.ref(`/cajeros/${nro}`));
    if (existingSnap.exists()) {
      alert("❌ Este Nro de cajero ya está en uso");
      return;
    }

    await window.set(window.ref(`/cajeros/${nro}`), { nombre, dni, pass });
    cajeroNombre.value = cajeroDni.value = cajeroPass.value = "";
    loadCajerosTabla();
    loadCajeros();
  });
});

loadCajeroSelectOptions();


// --- CONFIG ---
const configNombre = document.getElementById("config-nombre");
const configUbicacion = document.getElementById("config-ubicacion");
const configCuit = document.getElementById("config-cuit"); // nuevo input
const configPassActual = document.getElementById("config-pass-actual");
const configPassNueva = document.getElementById("config-pass-nueva");
const guardarConfig = document.getElementById("guardar-config");
const configMsg = document.getElementById("config-msg");
const masterPassInput = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");

async function loadConfig() {
  const snap = await window.get(window.ref("/config"));
  if (snap.exists()) {
    const val = snap.val();
    configNombre.value = val.shopName || "";
    configUbicacion.value = val.shopLocation || "Sucursal Nueva";
    configCuit.value = val.shopCuit || "00000000000"; // valor por defecto
  }
}

guardarConfig.addEventListener("click", async () => {
  const snap = await window.get(window.ref("/config"));
  if (!snap.exists()) return;
  const val = snap.val();
  if (configPassActual.value !== val.passAdmin) {
    configMsg.textContent = "Contraseña incorrecta";
    return;
  }
  // Asegurar CUIT de 11 dígitos
  let cuitValue = configCuit.value.replace(/\D/g, '').padStart(11, '0').slice(0,11);

  await window.update(window.ref("/config"), {
    shopName: configNombre.value,
    shopLocation: configUbicacion.value || "Sucursal Nueva",
    shopCuit: cuitValue,
    passAdmin: configPassNueva.value || val.passAdmin
  });
  configMsg.textContent = "✅ Configuración guardada";
  configPassActual.value = configPassNueva.value = "";
});

btnRestaurar.addEventListener("click", async () => {
  const snap = await window.get(window.ref("/config"));
  if (!snap.exists()) return;
  if (masterPassInput.value === snap.val().masterPass) {
    await window.update(window.ref("/config"), { passAdmin: snap.val().masterPass });
    alert("✅ Contraseña restaurada al maestro");
    masterPassInput.value = "";
  } else {
    alert("❌ Contraseña maestra incorrecta");
  }
});

  // --- MODAL ADMIN OCULTO PARA ACCIONES FUTURAS ---
const adminActionModal = document.createElement("div");
adminActionModal.id = "admin-action-modal";
adminActionModal.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: none; /* oculto por defecto */
  justify-content: center;
  align-items: center;
  background: rgba(0,0,0,0.7);
  z-index: 9999;
`;
adminActionModal.innerHTML = `
  <div style="background:#fff; padding:20px; border-radius:10px; width:300px; text-align:center;">
    <h2>🔒 Contraseña de Administrador</h2>
    <input id="admin-action-pass-input" type="password" placeholder="Contraseña" style="width:200px; text-align:center; margin:10px 0;">
    <p id="admin-action-pass-msg" style="color:red; margin:5px 0;"></p>
    <div style="margin-top:10px;">
      <button id="admin-action-pass-btn">Aceptar</button>
      <button id="admin-action-cancel-btn" style="background:red; color:#fff;">Cancelar</button>
    </div>
  </div>
`;
document.body.appendChild(adminActionModal);

const adminActionPassInput = document.getElementById("admin-action-pass-input");
const adminActionPassBtn = document.getElementById("admin-action-pass-btn");
const adminActionCancelBtn = document.getElementById("admin-action-cancel-btn");
const adminActionPassMsg = document.getElementById("admin-action-pass-msg");

// Función para mostrar el modal
function showAdminActionModal(onSuccess) {
  adminActionPassInput.value = "";
  adminActionPassMsg.textContent = "";
  adminActionModal.style.display = "flex";

  function validar() {
    window.get(window.ref("/config")).then(snap => {
      const val = snap.exists() ? snap.val() : {};
      const passAdmin = val.passAdmin || "1918";
      const masterPass = val.masterPass || "1409";
      if (adminActionPassInput.value.trim() === passAdmin || adminActionPassInput.value.trim() === masterPass) {
        adminActionModal.style.display = "none";
        onSuccess();
      } else {
        adminActionPassMsg.textContent = "Contraseña incorrecta";
      }
    });
  }

  adminActionPassBtn.onclick = validar;
  adminActionPassInput.onkeyup = e => { if (e.key === "Enter") validar(); };
  adminActionCancelBtn.onclick = () => { adminActionModal.style.display = "none"; };
}

// --- MODAL ADMIN HEADER ---
const adminHeaderModal = document.createElement("div");
adminHeaderModal.style.cssText = `
  position: fixed; top:0; left:0; width:100%; height:100%;
  display: none; justify-content:center; align-items:center;
  background: rgba(0,0,0,0.7); z-index:9999;
`;
adminHeaderModal.innerHTML = `
  <div style="background:#fff; padding:20px; border-radius:10px; width:300px; text-align:center;">
    <h2>Contraseña Administrador</h2>
    <input id="admin-header-pass" type="password" placeholder="Contraseña Admin" style="width:100%; margin:5px 0;">
    <div style="margin-top:10px;">
      <button id="admin-header-aceptar" style="margin-right:5px;">Aceptar</button>
      <button id="admin-header-cancelar" style="background:red; color:#fff;">Cancelar</button>
    </div>
    <p id="admin-header-msg" style="color:red; margin-top:5px;"></p>
  </div>
`;
document.body.appendChild(adminHeaderModal);

const adminHeaderPassInput = adminHeaderModal.querySelector("#admin-header-pass");
const adminHeaderPassMsg = adminHeaderModal.querySelector("#admin-header-msg");
const adminHeaderAceptarBtn = adminHeaderModal.querySelector("#admin-header-aceptar");
const adminHeaderCancelarBtn = adminHeaderModal.querySelector("#admin-header-cancelar");

// Función que bloquea la sección hasta introducir la contraseña correcta
function requireAdminHeader(callback) {
  adminHeaderPassInput.value = "";
  adminHeaderPassMsg.textContent = "";
  adminHeaderModal.style.display = "flex";

  function validar() {
    window.get(window.ref("/config")).then(snap => {
      const val = snap.exists() ? snap.val() : {};
      const passAdmin = val.passAdmin || "1918";
      const masterPass = val.masterPass || "1409";
      if (adminHeaderPassInput.value.trim() === passAdmin || adminHeaderPassInput.value.trim() === masterPass) {
        adminHeaderModal.style.display = "none";
        callback();
      } else {
        adminHeaderPassMsg.textContent = "Contraseña incorrecta";
      }
    });
  }

  adminHeaderAceptarBtn.onclick = validar;
  adminHeaderPassInput.onkeyup = e => { if (e.key === "Enter") validar(); };

  // CANCELAR: abrir automáticamente la sección de cobro
  adminHeaderCancelarBtn.onclick = () => {
    adminHeaderModal.style.display = "none";
    document.querySelectorAll("main > section").forEach(sec => sec.classList.add("hidden"));
    document.getElementById("cobro").classList.remove("hidden");
  };
}

// --- HEADER STOCK & SUELTOS ---
document.querySelectorAll("button.nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const section = btn.dataset.section;

    if (section === "stock" || section === "sueltos") {
      requireAdminHeader(() => {
        document.querySelectorAll("main > section").forEach(sec => sec.classList.add("hidden"));
        document.getElementById(section).classList.remove("hidden");
        if (section === "stock") loadStock();
        if (section === "sueltos") loadSueltos();
      });
    } else {
      // Secciones normales
      document.querySelectorAll("main > section").forEach(sec => sec.classList.add("hidden"));
      document.getElementById(section).classList.remove("hidden");
    }
  });
});

  // --- Inicialización ---
  (async () => {
    await loadCajeros();
    await loadProductos();
    await loadStock();
    await loadSueltos();
    await loadMovimientos();
    await loadHistorial();
    await loadConfig();
  })();
})();
