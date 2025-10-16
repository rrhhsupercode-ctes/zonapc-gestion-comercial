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

// --- IMPRIMIR TICKET ---
async function imprimirTicket(ticketID, fecha, cajeroID, items, total, tipoPago) {
  const signo = porcentajeFinal > 0 ? "+" : porcentajeFinal < 0 ? "-" : "";
  const porcentajeTexto = porcentajeFinal !== 0 ? ` (${signo}${Math.abs(porcentajeFinal)}%)` : "";

  // Obtener nombre de tienda desde /config
  let shopName = "ZONAPC";
  try {
    const snap = await window.get(window.ref("/config"));
    if (snap.exists()) {
      const val = snap.val();
      shopName = val.shopName || "ZONAPC";
    }
  } catch (e) {
    console.error("Error al cargar nombre de tienda:", e);
  }

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
          padding: 3px;
          color: #000;
          line-height: 1.2;
        }
        .ticket-container { width: 100%; }

        .ticket-header {
          text-align: center;
          font-weight: bold;
          border-bottom: 0.5px solid #000;
          margin-bottom: 2px;
          padding-bottom: 1px;
        }
        .ticket-subheader { text-align: center; margin-bottom: 2px; }
        .ticket-info { text-align: left; font-size: 10px; margin: 0; padding: 0; }

        .ticket-items { text-align: left; line-height: 1.2; margin: 2px 0; }
        .ticket-item {
          display: block;
          border-bottom: 0.5px solid #000;
          padding: 1px 0;
          margin: 0;
          word-wrap: break-word;
        }

        .ticket-total {
          text-align: center;
          font-weight: bold;
          font-size: 12px;
          border-top: 0.5px solid #000;
          margin: 2px 0 0 0;
          padding-top: 2px;
        }

        .ticket-footer-space { height: 10px; }
      </style>
    </head>
    <body>
      <div class="ticket-container">
        <div class="ticket-header">${shopName.toUpperCase()}</div>
        <div class="ticket-subheader">${ticketID}</div>
        <div class="ticket-info">Fecha: ${fecha}</div>
        <div class="ticket-info">Cajero: ${cajeroID}</div>
        <div class="ticket-info">Pago: ${tipoPago}</div>

        <div class="ticket-items">
          ${items.map(it => `
            <div class="ticket-item">
              ${it.nombre}<br>
              $${it.precio.toFixed(2)} x${it.cant} = $${(it.precio * it.cant).toFixed(2)}
            </div>
          `).join("")}
        </div>

        <div class="ticket-total">TOTAL: $${total.toFixed(2)}${porcentajeTexto}</div>
        <div class="ticket-footer-space"></div>
      </div>
    </body>
  </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  setTimeout(() => iframe.remove(), 100); // permanente: 100ms
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
        <button data-pay="Efectivo">Efectivo</button>
        <button data-pay="Tarjeta">Tarjeta</button>
        <button data-pay="QR">QR</button>
        <button data-pay="Electrónico">Electrónico</button>
        <button data-pay="Otro">Otro</button>
      </div>
      <button id="cancelar-pago" style="background:red; color:#fff; padding:5px 15px;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);

  const allButtons = modal.querySelectorAll("button");

  // --- Función para deshabilitar todos los botones ---
  function disableButtons() {
    allButtons.forEach(btn => btn.disabled = true);
  }

  document.getElementById("cancelar-pago").addEventListener("click", () => {
    disableButtons(); // deshabilitar todos al presionar cancelar
    modal.remove();
  });

  modal.querySelectorAll("button[data-pay]").forEach(btn => {
    btn.addEventListener("click", async () => {
      disableButtons(); // deshabilitar todos los botones al presionar cualquiera

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

      // --- total original y con descuento/recargo ---
      const totalOriginal = carrito.reduce((a, b) => a + b.cant * b.precio, 0);
      const totalFinal = totalOriginal * (1 + (porcentajeFinal || 0) / 100);

      // --- guardar movimientos ---
      await window.set(window.ref(`/movimientos/${ticketID}`), {
        ticketID,
        cajero: currentUser.id,
        items: carrito,
        total: totalFinal,
        fecha: fecha.toISOString(),
        tipo: tipoPago,
        eliminado: false,
        porcentajeAplicado: porcentajeFinal || 0
      });

      // --- guardar historial ---
      await window.set(window.ref(`/historial/${ticketID}`), {
        ticketID,
        cajero: currentUser.id,
        items: carrito,
        total: totalFinal,
        fecha: fecha.toISOString(),
        tipo: tipoPago,
        porcentajeAplicado: porcentajeFinal || 0
      });

      // --- actualizar config ---
      await window.update(window.ref("/config"), {
        ultimoTicketID: ultimoID,
        ultimoTicketFecha: fechaHoy
      });

      // --- actualizar stock ---
      for (const item of carrito) {
        const snapItem = await window.get(window.ref(`/${item.tipo}/${item.id}`));
        if (snapItem.exists()) {
          const data = snapItem.val();
          if (item.tipo === "stock") {
            await window.update(window.ref(`/${item.tipo}/${item.id}`), { cant: data.cant - item.cant });
          } else {
            await window.update(window.ref(`/${item.tipo}/${item.id}`), { kg: data.kg - item.cant });
          }
        }
      }

      // --- imprimir ticket ---
      imprimirTicket(ticketID, fechaStr, currentUser.id, carrito, totalOriginal, tipoPago);

      // --- ALERT ---
      alert("VENTA FINALIZADA");

      // --- limpiar ---
      carrito = [];
      actualizarTabla();
      loadStock();
      loadSueltos();
      loadMovimientos();
      loadHistorial();
      modal.remove();
    });
  });
});

// --- MOVIMIENTOS ---
const tablaMovimientos = document.getElementById("tabla-movimientos").querySelector("tbody");
const filtroCajero = document.getElementById("filtroCajero");
const btnTirarZ = document.getElementById("btn-tirar-z");

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
      <td>${id}</td>
      <td>${mov.total.toFixed(2)}</td>
      <td>${mov.tipo}</td>
      <td>${mov.cajero}</td>
      <td>${horaStr}</td>
      <td>
        <button class="reimprimir" data-id="${id}" ${eliminado ? "disabled" : ""}>🖨</button>
        <button class="eliminar" data-id="${id}" ${eliminado ? "disabled" : ""}>❌</button>
      </td>
    `;

// --- REIMPRIMIR MOVIMIENTO ---
tr.querySelector(".reimprimir").addEventListener("click", () => {
  const fechaObj = new Date(mov.fecha);
  const fechaStr = `${fechaObj.getDate().toString().padStart(2,'0')}/${(fechaObj.getMonth()+1).toString().padStart(2,'0')}/${fechaObj.getFullYear()}`;
  const horaStr = `${fechaObj.getHours().toString().padStart(2,'0')}:${fechaObj.getMinutes().toString().padStart(2,'0')}`;
  const fechaFormateada = `${fechaStr} (${horaStr})`;

  // Reutilizamos la función imprimirTicket
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
        await window.update(window.ref(`/movimientos/${id}`), { eliminado: true });
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
      items: todosMov.map(([id, mov]) => ({ ...mov, ticketID: id })),
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

    // --- Formato estético del ticket Z ---
    let cuerpo = "";
    for (const cajero of registroZ.cajeros) {
      cuerpo += `\nCAJERO: ${cajero}\n------------------------------`;
      const movCajero = registroZ.items.filter(m => m.cajero === cajero);
      const tiposPago = [...new Set(movCajero.map(m => m.tipo))];
      for (const tipo of tiposPago) {
        const ventasTipo = movCajero.filter(m => m.tipo === tipo);
        const subtotal = ventasTipo.reduce((acc, m) => acc + m.total, 0);
        cuerpo += `\n  [${tipo}]  Subtotal: $${subtotal.toFixed(2)}\n`;
        ventasTipo.forEach(m => {
          cuerpo += `    #${m.ticketID}\n    $${m.total.toFixed(2)}\n`;
        });
      }
      cuerpo += `\n------------------------------`;
    }

    // --- Imprimir Z ---
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
          <div class="bloque">${fechaZ.toLocaleDateString()} (${fechaZ.getHours().toString().padStart(2,"0")}:${fechaZ.getMinutes().toString().padStart(2,"0")})</div>
          <div class="bloque" style="white-space: pre-line;">${cuerpo}</div>
          <div class="total">TOTAL: $${totalGeneral.toFixed(2)}</div>
        </body>
      </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(()=>iframe.remove(),500);
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

// Cargar opciones 1 a 999 si el input es un <select>
if (stockCantidad.tagName === "SELECT") {
  stockCantidad.innerHTML = "";
  for (let i = 1; i <= 999; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    stockCantidad.appendChild(opt);
  }
}

// Actualiza cantidad (0–999)
function actualizarCant(delta, inputElement) {
  let val = parseInt(inputElement.value) || 0;
  val = Math.min(999, Math.max(0, val + delta));
  inputElement.value = val;
}

if (btnStockDecr) btnStockDecr.addEventListener("click", () => actualizarCant(-1, stockCantidad));
if (btnStockIncr) btnStockIncr.addEventListener("click", () => actualizarCant(1, stockCantidad));

// Formato fecha
function formatFecha(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} (${hh}:${min})`;
}

// Formato precio "$00000,00"
function formatPrecio(num) {
  const entero = Math.floor(num);
  const dec = Math.round((num - entero) * 100);
  const entStr = String(entero).padStart(5, "0");
  const decStr = String(dec).padStart(2, "0");
  return `$${entStr},${decStr}`;
}

// Modal admin (solo para abrir sección stock desde header)
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

// Cargar stock
async function loadStock(filtro = "") {
  const snap = await window.get(window.ref("/stock"));
  tablaStock.innerHTML = "";
  if (!snap.exists()) return;

  let stockArray = Object.entries(snap.val()).filter(([id, prod]) => {
    if (!filtro) return true;
    filtro = filtro.toLowerCase();
    return id.toLowerCase().includes(filtro) || prod.nombre.toLowerCase().includes(filtro);
  });

  stockArray.sort((a, b) => new Date(b[1].fecha || 0) - new Date(a[1].fecha || 0));

  stockArray.forEach(([id, prod]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${id}</td>
      <td>${prod.nombre}</td>
      <td>${prod.cant}</td>
      <td>${prod.fecha ? formatFecha(prod.fecha) : ""}</td>
      <td>${formatPrecio(prod.precio)}</td>
      <td>
        <button data-edit-id="${id}">✏️</button>
        <button data-del-id="${id}">❌</button>
      </td>
    `;

    // --- Eliminar SIN contraseña ---
    tr.querySelector(`button[data-del-id="${id}"]`).addEventListener("click", async () => {
      await window.remove(window.ref(`/stock/${id}`));
      loadStock();
      loadProductos();
    });

    // --- Editar SIN contraseña ---
    tr.querySelector(`button[data-edit-id="${id}"]`).addEventListener("click", async () => {
      const modal = document.createElement("div");
      modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        display:flex; justify-content:center; align-items:center;
        background:rgba(0,0,0,0.7); z-index:9999;
      `;

      const enteroInicial = Math.floor(prod.precio);
      const centavosInicial = Math.round((prod.precio - enteroInicial) * 100).toString().padStart(2, "0");

      modal.innerHTML = `
        <div style="background:#fff; padding:20px; border-radius:10px; width:340px; text-align:center;">
          <h2>Editar Stock ${id}</h2>

          <label>Nombre</label>
          <input id="edit-nombre" type="text" value="${prod.nombre}" style="width:100%; margin:5px 0;">

          <label>Cantidad (0-999)</label>
          <div style="display:flex; align-items:center; justify-content:space-between; margin:5px 0;">
            <button id="cant-decr" style="width:30%;">-</button>
            <input id="edit-cant" type="number" min="0" max="999" value="${prod.cant}" style="width:40%; text-align:center;">
            <button id="cant-incr" style="width:30%;">+</button>
          </div>

          <label>Precio</label>
          <div style="display:flex; gap:6px; justify-content:center; align-items:center; margin-top:5px;">
            <input id="edit-precio" type="text" style="width:65%; text-align:center;" value="${enteroInicial}">
            <span>,</span>
            <input id="edit-centavos" type="number" min="0" max="99" placeholder="00" style="width:25%; text-align:center;" value="${centavosInicial}">
          </div>

          <p id="preview-precio" style="margin-top:6px; font-weight:bold;">${formatPrecio(prod.precio)}</p>
          <p id="edit-msg" style="color:red; min-height:18px; margin-top:5px;"></p>

          <div style="margin-top:10px;">
            <button id="edit-aceptar" style="margin-right:5px;">Aceptar</button>
            <button id="edit-cancelar" style="background:red; color:#fff;">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const editNombre = modal.querySelector("#edit-nombre");
      const editCant = modal.querySelector("#edit-cant");
      const editPrecio = modal.querySelector("#edit-precio");
      const editCentavos = modal.querySelector("#edit-centavos");
      const editAceptar = modal.querySelector("#edit-aceptar");
      const editCancelar = modal.querySelector("#edit-cancelar");
      const editMsg = modal.querySelector("#edit-msg");
      const preview = modal.querySelector("#preview-precio");
      const cantDecr = modal.querySelector("#cant-decr");
      const cantIncr = modal.querySelector("#cant-incr");

      // Cantidad
      cantDecr.addEventListener("click", () => actualizarCant(-1, editCant));
      cantIncr.addEventListener("click", () => actualizarCant(1, editCant));

      // Precio
      function formatearPrecioModal(inputElement) {
        let raw = inputElement.value.replace(/\D/g, "");
        if (raw.length > 7) raw = raw.slice(0, 7);
        inputElement.value = raw;
        actualizarPreview();
      }
      editPrecio.addEventListener("input", () => formatearPrecioModal(editPrecio));
      editCentavos.addEventListener("input", () => {
        let val = parseInt(editCentavos.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 99) val = 99;
        editCentavos.value = val.toString().padStart(2, "0");
        actualizarPreview();
      });
      function actualizarPreview() {
        const entero = parseInt(editPrecio.value) || 0;
        const dec = parseInt(editCentavos.value) || 0;
        preview.textContent = formatPrecio(entero + dec / 100);
      }

      editCancelar.addEventListener("click", () => modal.remove());
      editAceptar.addEventListener("click", async () => {
        const newNombre = editNombre.value.trim();
        const newCant = parseInt(editCant.value) || 0;
        const entero = parseInt(editPrecio.value) || 0;
        const dec = parseInt(editCentavos.value) || 0;
        const newPrecio = entero + dec / 100;

        if (!newNombre || newCant < 0 || newCant > 999) {
          editMsg.textContent = "Campos obligatorios o cantidad inválida";
          return;
        }

        await window.update(window.ref(`/stock/${id}`), {
          nombre: newNombre,
          cant: newCant,
          precio: newPrecio,
        });

        loadStock();
        loadProductos();
        modal.remove();
      });
    });

    tablaStock.appendChild(tr);
  });
}

// Agregar stock
btnAgregarStock.addEventListener("click", async () => {
  const codigo = stockCodigo.value.trim();
  const cant = parseInt(stockCantidad.value);
  if (!codigo || isNaN(cant) || cant <= 0) return;

  const snap = await window.get(window.ref(`/stock/${codigo}`));
  const fecha = new Date().toISOString();

  if (snap.exists()) {
    const currentCant = parseInt(snap.val().cant) || 0;
    const newCant = Math.min(999, currentCant + cant);
    await window.update(window.ref(`/stock/${codigo}`), { cant: newCant, fecha });
  } else {
    await window.set(window.ref(`/stock/${codigo}`), {
      nombre: "NUEVO",
      cant: Math.min(999, cant),
      fecha,
      precio: 0.0,
    });
  }

  loadStock();
  loadProductos();
});

// Buscar stock
btnBuscarStock.addEventListener("click", () => {
  const filtro = stockCodigo.value.trim();
  loadStock(filtro);
});

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
  const entStr = String(entero).padStart(5, "0");
  const decStr = String(dec).padStart(2, "0");
  return `$${entStr},${decStr}`;
}

// Cargar sueltos
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
    tr.innerHTML = `
      <td>${id}</td>
      <td>${prod.nombre}</td>
      <td>${parseFloat(prod.kg).toFixed(3)}</td>
      <td>${prod.fecha ? formatFecha(prod.fecha) : ""}</td>
      <td>${formatPrecio(prod.precio)}</td>
      <td>
        <button data-edit-id="${id}">✏️</button>
        <button data-del-id="${id}">❌</button>
      </td>
    `;

    // Eliminar SIN contraseña
    tr.querySelector(`button[data-del-id="${id}"]`).addEventListener("click", async () => {
      await window.remove(window.ref(`/sueltos/${id}`));
      loadSueltos();
      loadProductos();
    });

    // Editar SIN contraseña
    tr.querySelector(`button[data-edit-id="${id}"]`).addEventListener("click", async () => {
      const modal = document.createElement("div");
      modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        display:flex; justify-content:center; align-items:center;
        background:rgba(0,0,0,0.7); z-index:9999;
      `;
      const enteroInicial = Math.floor(prod.precio);
      const centavosInicial = Math.round((prod.precio - enteroInicial) * 100).toString().padStart(2, "0");

      modal.innerHTML = `
        <div style="background:#fff; padding:20px; border-radius:10px; width:340px; text-align:center;">
          <h2>Editar Suelto ${id}</h2>

          <label>Nombre</label>
          <input id="edit-nombre" type="text" value="${prod.nombre}" style="width:100%; margin:5px 0;">

          <label>KG</label>
          <div style="display:flex; align-items:center; justify-content:space-between; margin:5px 0;">
            <button id="kg-decr" style="width:30%;">-</button>
            <input id="edit-kg" type="text" value="${parseFloat(prod.kg).toFixed(3)}" style="width:40%; text-align:center;">
            <button id="kg-incr" style="width:30%;">+</button>
          </div>
          <p id="edit-kg-msg" style="color:red; min-height:18px; margin-top:2px; font-size:0.9em;"></p>

          <label>Precio</label>
          <div style="display:flex; gap:6px; justify-content:center; align-items:center; margin-top:5px;">
            <input id="edit-precio" type="text" style="width:65%; text-align:center;" value="${enteroInicial}">
            <span>,</span>
            <input id="edit-centavos" type="number" min="0" max="99" placeholder="00" style="width:25%; text-align:center;" value="${centavosInicial}">
          </div>

          <p id="preview-precio" style="margin-top:6px; font-weight:bold;">${formatPrecio(prod.precio)}</p>
          <p id="edit-msg" style="color:red; min-height:18px; margin-top:5px;"></p>

          <div style="margin-top:10px;">
            <button id="edit-aceptar" style="margin-right:5px;">Aceptar</button>
            <button id="edit-cancelar" style="background:red; color:#fff;">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const editNombre = modal.querySelector("#edit-nombre");
      const editKg = modal.querySelector("#edit-kg");
      const editKgMsg = modal.querySelector("#edit-kg-msg");
      const editPrecio = modal.querySelector("#edit-precio");
      const editCentavos = modal.querySelector("#edit-centavos");
      const editAceptar = modal.querySelector("#edit-aceptar");
      const editCancelar = modal.querySelector("#edit-cancelar");
      const editMsg = modal.querySelector("#edit-msg");
      const preview = modal.querySelector("#preview-precio");
      const kgDecr = modal.querySelector("#kg-decr");
      const kgIncr = modal.querySelector("#kg-incr");

      kgIncr.addEventListener("click", () => formatearKg(editKg, editKgMsg, 0.100));
      kgDecr.addEventListener("click", () => formatearKg(editKg, editKgMsg, -0.100));
      editKg.addEventListener("input", () => formatearKg(editKg, editKgMsg));
      editKg.addEventListener("blur", () => formatearKg(editKg, editKgMsg));

      function formatearPrecioModal(inputElement) {
        let raw = inputElement.value.replace(/\D/g, "");
        if (raw.length > 7) raw = raw.slice(0, 7);
        inputElement.value = raw;
        actualizarPreview();
      }

      editPrecio.addEventListener("input", () => formatearPrecioModal(editPrecio));
      editCentavos.addEventListener("input", () => {
        let val = parseInt(editCentavos.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 99) val = 99;
        editCentavos.value = val.toString().padStart(2, "0");
        actualizarPreview();
      });
      function actualizarPreview() {
        const entero = parseInt(editPrecio.value) || 0;
        const dec = parseInt(editCentavos.value) || 0;
        preview.textContent = formatPrecio(entero + dec / 100);
      }

      editCancelar.addEventListener("click", () => modal.remove());
      editAceptar.addEventListener("click", async () => {
        const newNombre = editNombre.value.trim();
        const newKg = parseFloat(editKg.value);
        const entero = parseInt(editPrecio.value) || 0;
        const dec = parseInt(editCentavos.value) || 0;
        const newPrecio = entero + dec / 100;

        if (!newNombre || isNaN(newKg) || newKg < 0 || newKg > 99) {
          editMsg.textContent = "Campos obligatorios o KG inválido";
          return;
        }

        await window.update(window.ref(`/sueltos/${id}`), {
          nombre: newNombre,
          kg: newKg,
          precio: newPrecio,
        });

        loadSueltos();
        loadProductos();
        modal.remove();
      });
    });

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
    await window.update(window.ref("/config"), {
      shopName: configNombre.value,
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
