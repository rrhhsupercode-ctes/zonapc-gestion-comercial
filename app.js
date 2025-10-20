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
  const deviceToken = localStorage.getItem("adminDeviceToken");
  if (deviceToken) return;

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
    const masterPass = "1409"; // fija y nunca cambia

    const entrada = adminPassInput.value.trim();
    if (entrada === passAdmin || entrada === masterPass) {
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
const inputDescuento = document.getElementById("input-descuento");
const inputRecargo = document.getElementById("input-recargo");

// Modal de búsqueda (IDs existentes)
const modalBusqueda = document.getElementById("modal-busqueda");
const btnBuscarProducto = document.getElementById("btn-buscar-producto");
const btnCancelarBusqueda = document.getElementById("btn-cancelar-busqueda");
const inputBusqueda = document.getElementById("input-busqueda");
const tablaResultados = document.querySelector("#tabla-resultados tbody");

let carrito = [];
let porcentajeFinal = 0;
let precioUnitarioActual = 0; // usado en la UI clásica de sueltos

// --- Utilidades de formato ---
function formatPeso(num) {
  // 1234.5 -> "1.234,50"
  const entero = Math.floor(Math.abs(num));
  const dec = Math.round((Math.abs(num) - entero) * 100);
  const sign = num < 0 ? "-" : "";
  return `${sign}${entero.toLocaleString("es-AR")},${String(dec).padStart(2, "0")}`;
}

function formatPesoEntero(num) {
  // Fuerza centavos ,00 para edición manual de total suelto
  const entero = Math.round(Math.abs(num));
  const sign = num < 0 ? "-" : "";
  return `${sign}${entero.toLocaleString("es-AR")},00`;
}

function parseEnteroFromMoney(str) {
  // "1.234" o "1.234,00" -> 1234
  const raw = (str || "").toString().replace(/\D/g, "");
  return parseInt(raw || "0", 10);
}

// Formatea KG estilo balanza (entrada cruda a 0.000–99.000)
function formatKgFromDigits(rawDigits) {
  const d = rawDigits.replace(/\D/g, "").slice(0, 5); // máx 5 dígitos -> 99.999 (limitamos a 99.000 luego)
  let val = 0;
  switch (d.length) {
    case 0: val = 0.000; break;
    case 1: val = parseFloat("0.00" + d); break;
    case 2: val = parseFloat("0.0" + d); break;
    case 3: val = parseFloat("0." + d); break;
    case 4: val = parseFloat(d[0] + "." + d.slice(1, 4)); break;
    default: val = parseFloat(d.slice(0, 2) + "." + d.slice(2, 5)); break;
  }
  if (isNaN(val)) val = 0.000;
  if (val < 0) val = 0.000;
  if (val > 99) val = 99.000;
  return val.toFixed(3);
}

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

// --- Descuento/Recargo ---
function calcularPorcentajeFinal() {
  const desc = Math.min(Math.max(Number(inputDescuento.value) || 0, 0), 100);
  const rec = Math.min(Math.max(Number(inputRecargo.value) || 0, 0), 100);
  inputDescuento.value = String(Math.round(desc));
  inputRecargo.value = String(Math.round(rec));
  porcentajeFinal = rec - desc;
  actualizarTabla();
}
if (inputDescuento) inputDescuento.addEventListener("input", calcularPorcentajeFinal);
if (inputRecargo) inputRecargo.addEventListener("input", calcularPorcentajeFinal);

// --- Carrito ---
async function agregarAlCarrito(nuevoItem) {
  // nuevoItem: {id, nombre, cant, precio, tipo}  (precio = unitario)
  const snap = await window.get(window.ref(`/${nuevoItem.tipo}/${nuevoItem.id}`));
  if (!snap.exists()) return alert("Producto no encontrado");
  const data = snap.val();
  const idx = carrito.findIndex(it => it.id === nuevoItem.id && it.tipo === nuevoItem.tipo);
  let totalCant = nuevoItem.cant;
  if (idx >= 0) totalCant += carrito[idx].cant;

  if ((nuevoItem.tipo === "stock" && totalCant > (data.cant || 0)) ||
      (nuevoItem.tipo === "sueltos" && totalCant > (data.kg || 0))) {
    return alert("STOCK INSUFICIENTE");
  }

  if (idx >= 0) {
    carrito[idx].cant += nuevoItem.cant;
  } else {
    // Para sueltos guardo además el precioUnit como copia por claridad (precio ya es unitario)
    carrito.push({
      ...nuevoItem,
      precioUnit: nuevoItem.precio
    });
  }
  actualizarTabla();
}

// --- Botones AGREGAR (UI clásica) ---
btnAddProduct.addEventListener("click", async () => {
  let id = cobroProductos.value || inputCodigoProducto.value.trim();
  let cant = parseInt(cobroCantidad.value);
  if (!id || cant <= 0) return;
  const snap = await window.get(window.ref(`/stock/${id}`));
  if (!snap.exists()) return alert("Producto no encontrado");
  const data = snap.val();
  if (cant > (data.cant || 0)) return alert("STOCK INSUFICIENTE");
  agregarAlCarrito({ id, nombre: data.nombre, cant, precio: data.precio, tipo: "stock" });
  inputCodigoProducto.value = "";
});

// --- SUELTOS KG <-> PRECIO (UI clásica) ---
async function actualizarPrecioUnitario() {
  let id = cobroSueltos.value || inputCodigoSuelto.value.trim();
  if (!id) return;
  const snap = await window.get(window.ref(`/sueltos/${id}`));
  if (!snap.exists()) return;
  precioUnitarioActual = snap.val().precio;
  let precio = Math.round(parseFloat(inputKgSuelto.value) * precioUnitarioActual);
  if (precio > 9999999) precio = 9999999;
  inputPrecioSuelto.value = precio.toLocaleString('es-AR');
}

async function actualizarKgSegunPrecio() {
  if (!precioUnitarioActual) return;
  let raw = inputPrecioSuelto.value.replace(/\D/g, '').slice(0, 9);
  let precio = parseInt(raw) || 0; // total redondo manual
  inputPrecioSuelto.value = precio.toLocaleString('es-AR');
  inputKgSuelto.value = (precio / precioUnitarioActual).toFixed(3);
}

// Escuchas sueltos/precio (UI clásica)
if (inputPrecioSuelto) inputPrecioSuelto.addEventListener("input", actualizarKgSegunPrecio);
if (cobroSueltos) cobroSueltos.addEventListener("change", actualizarPrecioUnitario);
if (inputCodigoSuelto) inputCodigoSuelto.addEventListener("change", actualizarPrecioUnitario);

// Formateo KG (UI clásica)
const msgKgCobro = document.createElement("p");
msgKgCobro.style.color = "red";
msgKgCobro.style.margin = "4px 0 0 0";
msgKgCobro.style.fontSize = "0.9em";
if (inputKgSuelto && inputKgSuelto.parentNode) {
  inputKgSuelto.parentNode.appendChild(msgKgCobro);
  inputKgSuelto.value = "0.000";
}

function formatearKgCobro(inputElement, msgElement, delta = 0) {
  if (!inputElement) return;
  let raw = inputElement.value.replace(/\D/g, "");
  if (delta !== 0) {
    let val = parseFloat(inputElement.value) || 0;
    val = Math.min(99.000, Math.max(0.000, val + delta));
    inputElement.value = val.toFixed(3);
    if (msgElement) msgElement.textContent = "";
    actualizarPrecioUnitario();
    return;
  }
  inputElement.value = formatKgFromDigits(raw);
  if (msgElement) msgElement.textContent = "";
  actualizarPrecioUnitario();
}

// Botones + / - KG (UI clásica)
if (btnKgMas) btnKgMas.addEventListener("click", () => formatearKgCobro(inputKgSuelto, msgKgCobro, 0.100));
if (btnKgMenos) btnKgMenos.addEventListener("click", () => formatearKgCobro(inputKgSuelto, msgKgCobro, -0.100));
if (inputKgSuelto) {
  inputKgSuelto.addEventListener("input", () => formatearKgCobro(inputKgSuelto, msgKgCobro));
  inputKgSuelto.addEventListener("blur", () => formatearKgCobro(inputKgSuelto, msgKgCobro));
}

// Agregar suelto (UI clásica)
if (btnAddSuelto) btnAddSuelto.addEventListener("click", async () => {
  let id = cobroSueltos.value || inputCodigoSuelto.value.trim();
  if (!id) return alert("Seleccione un producto suelto");
  const snap = await window.get(window.ref(`/sueltos/${id}`));
  if (!snap.exists()) return alert("Producto no encontrado");
  const data = snap.val();
  let cant = parseFloat(inputKgSuelto.value) || 0;
  if (cant < 0) return alert("Cantidad inválida");
  if (cant > (data.kg || 0)) return alert("STOCK INSUFICIENTE");
  agregarAlCarrito({ id, nombre: data.nombre, cant, precio: data.precio, tipo: "sueltos" });
  inputKgSuelto.value = "0.100";
  inputPrecioSuelto.value = "000";
  inputCodigoSuelto.value = "";
});

// --- Escaneo unificado para stock y sueltos (lector de barras) ---
inputCodigoProducto.addEventListener("input", async () => {
  const codigo = inputCodigoProducto.value.trim();
  if (codigo.length !== 13) return;

  // Primero SUELTOS
  const snapSuelto = await window.get(window.ref(`/sueltos/${codigo}`));
  if (snapSuelto.exists()) {
    const data = snapSuelto.val();
    if ((data.kg || 0) >= 0) {
      agregarAlCarrito({
        id: codigo,
        nombre: data.nombre,
        cant: 0.000, // entra con 0 kg para editar desde tabla
        precio: data.precio,
        tipo: "sueltos"
      });
    } else {
      alert("Stock insuficiente en sueltos");
    }
    inputCodigoProducto.value = "";
    return;
  }

  // Luego STOCK
  const snapStock = await window.get(window.ref(`/stock/${codigo}`));
  if (snapStock.exists()) {
    const data = snapStock.val();
    if ((data.cant || 0) > 0) {
      agregarAlCarrito({
        id: codigo,
        nombre: data.nombre,
        cant: 1,
        precio: data.precio,
        tipo: "stock"
      });
    } else {
      alert("Stock insuficiente en stock");
    }
  } else {
    alert("Producto no encontrado");
  }
  inputCodigoProducto.value = "";
});

// --- Tabla de cobro (EDITABLE) ---
async function validarStockItem(item) {
  const snap = await window.get(window.ref(`/${item.tipo}/${item.id}`));
  if (!snap.exists()) return item;
  const data = snap.val();
  const disponible = item.tipo === "stock" ? (data.cant || 0) : (data.kg || 0);
  if (item.cant > disponible) {
    alert("No hay tanta cantidad disponible");
    item.cant = disponible;
  }
  return item;
}

function actualizarTabla() {
  tablaCobro.innerHTML = "";
  let total = 0;

  carrito.forEach((item, idx) => {
    const tr = document.createElement("tr");

    // celdas: Cant/KG (editable), Producto, Precio Unidad (readonly sueltos / disabled stock), Total (editable solo sueltos manual), Acción
    // Para stock: cantidad number min=1, precioUnidad fijo (disabled), total calculado
    // Para sueltos: input KG + input Total (vinculados), precioUnidad fijo (disabled)

    let celdaCant, celdaProd, celdaPU, celdaTotal, celdaAcc;
    celdaCant = document.createElement("td");
    celdaProd = document.createElement("td");
    celdaPU = document.createElement("td");
    celdaTotal = document.createElement("td");
    celdaAcc = document.createElement("td");

    // PRODUCTO
    celdaProd.textContent = item.nombre;

    // PRECIO UNIDAD (muestra de base)
    const inputPU = document.createElement("input");
    inputPU.type = "number";
    inputPU.step = "0.01";
    inputPU.value = item.precio.toFixed(2);
    inputPU.disabled = true; // Fijo para ambos (así lo pediste). En sueltos muestra el original de la base.
    inputPU.style.width = "90px";
    celdaPU.appendChild(inputPU);

    if (item.tipo === "stock") {
      // CANTIDAD
      const inputCant = document.createElement("input");
      inputCant.type = "number";
      inputCant.min = "1";
      inputCant.max = "999";
      inputCant.value = item.cant;
      inputCant.style.width = "70px";
      celdaCant.appendChild(inputCant);

      // TOTAL (solo visual)
      const spanTotal = document.createElement("span");
      spanTotal.textContent = (item.cant * item.precio).toFixed(2);
      celdaTotal.appendChild(spanTotal);

      // eventos
      inputCant.addEventListener("input", async () => {
        let v = parseInt(inputCant.value) || 1;
        if (v < 1) v = 1;
        if (v > 999) v = 999;
        item.cant = v;
        await validarStockItem(item);
        spanTotal.textContent = (item.cant * item.precio).toFixed(2);
        renderTotalGeneral();
      });

    } else {
      // SUELTOS
      // KG (editable con formato balanza)
      const inputKG = document.createElement("input");
      inputKG.type = "text";
      inputKG.value = (item.cant || 0).toFixed(3);
      inputKG.style.width = "70px";
      inputKG.style.textAlign = "center";

      // TOTAL (editable redondo manual)
      const inputTot = document.createElement("input");
      inputTot.type = "text";
      const totalActual = item.cant * item.precio; // puede tener centavos si viene de KG
      inputTot.value = formatPesoEntero(totalActual); // se muestra ,00
      inputTot.style.width = "90px";
      inputTot.style.textAlign = "right";

      celdaCant.appendChild(inputKG);
      celdaTotal.appendChild(inputTot);

      // Vinculación KG -> Total (real, con centavos)
      inputKG.addEventListener("input", async () => {
        const rawDigits = inputKG.value.replace(/\D/g, "");
        const kgStr = formatKgFromDigits(rawDigits);
        inputKG.value = kgStr;
        item.cant = parseFloat(kgStr) || 0;

        await validarStockItem(item);

        // Si cambia KG, el total se calcula real (puede tener centavos)
        const totalCalc = item.cant * item.precio; // precio unit por kg
        inputTot.value = formatPeso(totalCalc);
        renderTotalGeneral();
      });

      inputKG.addEventListener("blur", async () => {
        // confirmar formato al salir
        const rawDigits = inputKG.value.replace(/\D/g, "");
        const kgStr = formatKgFromDigits(rawDigits);
        inputKG.value = kgStr;
        item.cant = parseFloat(kgStr) || 0;
        await validarStockItem(item);
        const totalCalc = item.cant * item.precio;
        inputTot.value = formatPeso(totalCalc);
        renderTotalGeneral();
      });

      // Vinculación Total (manual, redondo) -> KG
      inputTot.addEventListener("input", async () => {
        const entero = parseEnteroFromMoney(inputTot.value); // solo enteros
        inputTot.value = formatPesoEntero(entero); // fuerza ,00

        const nuevoKg = (entero / item.precio) || 0;
        // recorte a 3 decimales
        item.cant = Math.min(99.000, Math.max(0, parseFloat(nuevoKg.toFixed(3))));
        inputKG.value = item.cant.toFixed(3);

        await validarStockItem(item);

        // al tocar total manual, se mantiene ,00 (no recalc centavos acá)
        inputTot.value = formatPesoEntero(Math.round(item.cant * item.precio));
        renderTotalGeneral();
      });
    }

    // ACCIÓN (eliminar)
    const btnDel = document.createElement("button");
    btnDel.textContent = "❌";
    btnDel.addEventListener("click", () => {
      carrito.splice(idx, 1);
      actualizarTabla();
    });
    celdaAcc.appendChild(btnDel);

    tr.appendChild(celdaCant);
    tr.appendChild(celdaProd);
    tr.appendChild(celdaPU);
    tr.appendChild(celdaTotal);
    tr.appendChild(celdaAcc);
    tablaCobro.appendChild(tr);

    total += item.cant * item.precio;
  });

  // total con descuento/recargo
  renderTotalGeneral();

  function renderTotalGeneral() {
    const subtotal = carrito.reduce((a, it) => a + it.cant * it.precio, 0);
    const totalModificado = subtotal * (1 + porcentajeFinal / 100);
    const signo = porcentajeFinal > 0 ? "+" : porcentajeFinal < 0 ? "-" : "";
    const porcentajeTexto = porcentajeFinal !== 0 ? ` <small>(${signo}${Math.abs(porcentajeFinal)}%)</small>` : "";
    totalDiv.innerHTML = `TOTAL: <span style="color:red; font-weight:bold;">$${totalModificado.toFixed(2)}</span>${porcentajeTexto}`;
    btnCobrar.classList.toggle("hidden", carrito.length === 0);
  }
}

// --- MODAL DE BÚSQUEDA UNIFICADO (SIN DUPLICADOS) ---
btnBuscarProducto.addEventListener("click", () => {
  modalBusqueda.style.display = "flex";
  modalBusqueda.classList.remove("hidden");
  inputBusqueda.focus();
});

btnCancelarBusqueda.addEventListener("click", () => {
  modalBusqueda.style.display = "none";
  modalBusqueda.classList.add("hidden");
  inputBusqueda.value = "";
  tablaResultados.innerHTML = "";
});

inputBusqueda.addEventListener("input", async () => {
  const q = inputBusqueda.value.trim().toLowerCase();
  tablaResultados.innerHTML = "";
  if (q.length < 2) return;

  const [stockSnap, sueltosSnap] = await Promise.all([
    window.get(window.ref("/stock")),
    window.get(window.ref("/sueltos"))
  ]);

  const dedup = new Map(); // clave = tipo|id
  if (stockSnap.exists()) {
    for (const [id, data] of Object.entries(stockSnap.val())) {
      const match = id.toLowerCase().includes(q) || (data.nombre || "").toLowerCase().includes(q);
      if (match) dedup.set(`stock|${id}`, { id, tipo: "stock", nombre: data.nombre, disp: data.cant || 0, precio: data.precio });
    }
  }
  if (sueltosSnap.exists()) {
    for (const [id, data] of Object.entries(sueltosSnap.val())) {
      const match = id.toLowerCase().includes(q) || (data.nombre || "").toLowerCase().includes(q);
      if (match) dedup.set(`sueltos|${id}`, { id, tipo: "sueltos", nombre: data.nombre, disp: data.kg || 0, precio: data.precio });
    }
  }

  dedup.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.nombre}</td>
      <td>${r.tipo}</td>
      <td>${r.disp}</td>
      <td><button ${r.disp <= 0 ? "disabled style='opacity:0.5;'" : ""}>Agregar</button></td>`;
    tr.querySelector("button").addEventListener("click", async () => {
      const snap = await window.get(window.ref(`/${r.tipo}/${r.id}`));
      if (!snap.exists()) return alert("Producto no encontrado");
      const data = snap.val();
      const disponible = r.tipo === "stock" ? (data.cant || 0) : (data.kg || 0);
      if (disponible <= 0) return alert("Producto sin disponibilidad");
      agregarAlCarrito({
        id: r.id,
        nombre: data.nombre,
        cant: r.tipo === "stock" ? 1 : 0.000, // suelto entra a 0 para que lo editen en tabla
        precio: data.precio,
        tipo: r.tipo
      });
      modalBusqueda.style.display = "none";
      modalBusqueda.classList.add("hidden");
      inputBusqueda.value = "";
      tablaResultados.innerHTML = "";
    });
    tablaResultados.appendChild(tr);
  });
});

// --- Submit automático stock/sueltos de la UI clásica ---
inputCodigoProducto.addEventListener("input", () => {
  // ya manejado arriba para 13 dígitos (lector)
  // acá no repetimos nada
});
if (inputCodigoSuelto) {
  inputCodigoSuelto.addEventListener("input", () => {
    if (inputCodigoSuelto.value.trim().length === 13) {
      btnAddSuelto?.click();
      inputCodigoSuelto.value = "";
    }
  });
}

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
        <button class="reimprimir" data-id="${mov.ticketID}" ${eliminado ? "disabled" : ""}>🧾​</button>
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
          <button class="reimprimir" data-id="${id}">🧾​</button>
          <button class="eliminar-z">❌</button>`;
      }
    } else {
      botones = `<button class="reimprimir" data-id="${id}">🧾​</button>`;
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

// --- LLENAR SELECT CANTIDAD 001-999 ---
for (let i = 1; i <= 999; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = String(i).padStart(3, "0");
  stockCantidad.appendChild(opt);
}
stockCantidad.value = "001"; // valor por defecto

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
      <td><input type="text" value="${prod.nombre}" maxlength="30" style="width:100%; min-width:100px; box-sizing:border-box;" data-field="nombre"></td>
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

    // --- CANTIDAD + / - Y EDICIÓN MANUAL ---
    const inputCant = tr.querySelector('input[data-field="cant"]');

    // Botones + / -
    tr.querySelectorAll(".btn-cant").forEach(btn => {
      btn.addEventListener("click", async () => {
        actualizarCant(btn.dataset.action === "+" ? 1 : -1, inputCant);
        await window.update(window.ref(`/stock/${id}`), { cant: parseInt(inputCant.value) });
        loadProductos();
      });
    });

    // Edición manual
    inputCant.addEventListener("change", async () => {
      let val = parseInt(inputCant.value) || 0;
      val = Math.min(999, Math.max(0, val));
      inputCant.value = val;
      await window.update(window.ref(`/stock/${id}`), { cant: val });
      loadProductos();
    });

    // --- GUARDAR NOMBRE ---
    tr.querySelector('input[data-field="nombre"]').addEventListener("change", async e => {
      let val = e.target.value.trim().slice(0,30);
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

    const entero = Math.floor(prod.precio);
    const dec = Math.round((prod.precio - entero) * 100);

    tr.innerHTML = `
      <td>${id}</td>
      <td><input type="text" value="${prod.nombre}" maxlength="30" style="width:100%; min-width:100px; box-sizing:border-box;" data-field="nombre"></td>
      <td><input type="text" value="${prod.kg.toFixed(3)}" style="width:100%; max-width:70px; box-sizing:border-box; text-align:center;" data-field="kg"></td>
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
      await window.remove(window.ref(`/sueltos/${id}`));
      loadSueltos();
      loadProductos();
    });

    // --- GUARDAR NOMBRE ---
    tr.querySelector('input[data-field="nombre"]').addEventListener("change", async e => {
      let val = e.target.value.trim().slice(0,30);
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
      inputEnt.value = val.toLocaleString('es-AR'); // <--- formateo correcto al cargar y editar
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

                <label for="edit-nombre">Nombre (6 a 25 letras)</label>
                <input id="edit-nombre" type="text" placeholder="Nombre" value="${cajero.nombre}" style="width:100%; margin:5px 0;">

                <label for="edit-dni">DNI (8 dígitos)</label>
                <input id="edit-dni" type="text" placeholder="DNI" value="${cajero.dni}" style="width:100%; margin:5px 0;" maxlength="8">

                <label for="edit-pass">Contraseña</label>
                <input id="edit-pass" type="password" placeholder="Contraseña" value="${cajero.pass}" style="width:100%; margin:5px 0;">

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

              if (
                !/^[A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\s[A-Za-zÁÉÍÓÚáéíóúñÑ]+)*$/.test(newNombre) ||
                newNombre.length < 6 ||
                newNombre.length > 25
              ) {
                editMsg.textContent = "El nombre debe tener entre 6 y 25 letras, puede incluir espacios, ñ y acentos";
                return;
              }

              if (newPass.length < 4 || newPass.length > 8) {
                editMsg.textContent = "La contraseña debe tener entre 4 y 8 caracteres";
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
  } // 👈 cierre del if (snap.exists())
}   // 👈 cierre de la función loadCajerosTabla()


// Agregar cajero usando modal
btnAgregarCajero.addEventListener("click", () => {
  const nro = cajeroNro.value;
  const nombre = cajeroNombre.value.trim();
  const dni = cajeroDni.value.trim();
  const pass = cajeroPass.value.trim();

  if (!nro || !nombre || !dni || !pass) {
    alert("Todos los campos son obligatorios");
    return;
  }

  if (!/^\d{8}$/.test(dni)) {
    alert("El DNI debe tener exactamente 8 dígitos");
    return;
  }

  if (
    !/^[A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\s[A-Za-zÁÉÍÓÚáéíóúñÑ]+)*$/.test(nombre) ||
    nombre.length < 6 ||
    nombre.length > 25
  ) {
    alert("El nombre debe tener entre 6 y 25 letras, puede incluir espacios, ñ y acentos");
    return;
  }

  if (pass.length < 4 || pass.length > 8) {
    alert("La contraseña debe tener entre 4 y 8 caracteres");
    return;
  }

  showAdminActionModal(async () => {
    const existingSnap = await window.get(window.ref(`/cajeros/${nro}`));
    if (existingSnap.exists()) {
      alert("❌ Este Nro de cajero ya está en uso");
      return;
    }

    await window.set(window.ref(`/cajeros/${nro}`), { nombre, dni, pass });
    cajeroNombre.value = "";
    cajeroDni.value = "";
    cajeroPass.value = "";
    loadCajerosTabla();
    loadCajeros();
  });
});

loadCajeroSelectOptions();

// --- CONFIG ---
const configNombre = document.getElementById("config-nombre");
const configUbicacion = document.getElementById("config-ubicacion");
const configCuit = document.getElementById("config-cuit");
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
    configCuit.value = val.shopCuit || "00000000000";
  }
}

guardarConfig.addEventListener("click", async () => {
  const snap = await window.get(window.ref("/config"));
  if (!snap.exists()) return;
  const val = snap.val();

  // --- Contraseñas ---
  const passAdmin = val.passAdmin || "1918";
  const masterPass = "1409"; // fija

  if (configPassActual.value !== passAdmin && configPassActual.value !== masterPass) {
    configMsg.textContent = "Contraseña incorrecta";
    return;
  }

  let cuitValue = configCuit.value.replace(/\D/g, '').padStart(11, '0').slice(0,11);

  await window.update(window.ref("/config"), {
    shopName: configNombre.value,
    shopLocation: configUbicacion.value || "Sucursal Nueva",
    shopCuit: cuitValue,
    passAdmin: configPassNueva.value || passAdmin
  });

  configMsg.textContent = "✅ Configuración guardada";
  configPassActual.value = configPassNueva.value = "";
});

btnRestaurar.addEventListener("click", async () => {
  const masterPass = "1409"; // fija
  if (masterPassInput.value === masterPass) {
    await window.update(window.ref("/config"), { passAdmin: "1918" });
    alert("✅ Contraseña restaurada al valor inicial");
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
