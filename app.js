// =======================
// PARTE 1 - app.js
// =======================

import { ref, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// ------------------------
// VARIABLES GLOBALES
// ------------------------
let currentCajero = null;        // Cajero logueado
let cobroTabla = [];             // Array de productos cargados en COBRAR
let cobroTotal = 0;              // Total de la venta actual

// ------------------------
// ELEMENTOS HTML
// ------------------------
const loginModal = document.getElementById("login-modal");
const loginUsuario = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");

const cobroControles = document.getElementById("cobro-controles");
const cobroCantidad = document.getElementById("cobro-cantidad");
const cobroCodigo = document.getElementById("cobro-codigo");
const cobroProductos = document.getElementById("cobro-productos");
const btnAddProduct = document.getElementById("btn-add-product");

const inputKgSuelto = document.getElementById("input-kg-suelto");
const btnIncrKg = document.getElementById("btn-incr-kg");
const btnDecrKg = document.getElementById("btn-decr-kg");
const cobroCodigoSuelto = document.getElementById("cobro-codigo-suelto");
const cobroSueltos = document.getElementById("cobro-sueltos");
const btnAddSuelto = document.getElementById("btn-add-suelto");

const tablaCobroBody = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");

const navBtns = document.querySelectorAll(".nav-btn");
const secciones = document.querySelectorAll("main section");

// ------------------------
// FUNCIONES UTILES
// ------------------------
function mostrarSeccion(seccionId) {
  secciones.forEach(sec => {
    if (sec.id === seccionId) sec.classList.remove("hidden");
    else sec.classList.add("hidden");
  });
}

// Inicializa selects de cantidad del 1 al 99
function initSelectCantidad(select) {
  select.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    const option = document.createElement("option");
    option.value = i.toString().padStart(2, "0");
    option.textContent = i.toString().padStart(2, "0");
    select.appendChild(option);
  }
}

// Formatea número a moneda $0,00
function formatMoney(num) {
  return `$${Number(num).toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

// ------------------------
// MODAL DE ADMINISTRADOR
// ------------------------
async function validarAdmin(pass) {
  const configSnap = await get(ref(window.db, "config"));
  if (!configSnap.exists()) return false;
  const config = configSnap.val();
  return pass === config.passAdmin || pass === config.masterPass;
}

// ------------------------
// EVENTO LOGIN ADMIN AL ABRIR APP
// ------------------------
btnLogin.addEventListener("click", async () => {
  const password = loginPass.value.trim();
  if (await validarAdmin(password)) {
    loginModal.classList.add("hidden");
    cobroControles.classList.remove("hidden");
    loginMsg.textContent = "";
    await cargarCajerosSelect();
    initSelectCantidad(cobroCantidad);
  } else {
    loginMsg.textContent = "Contraseña incorrecta";
  }
});

// ------------------------
// NAVEGACION SECCIONES
// ------------------------
navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    mostrarSeccion(btn.dataset.section);
  });
});

// ------------------------
// INICIALIZAR COBRO CONTROLES
// ------------------------
btnIncrKg.addEventListener("click", () => {
  let valor = parseFloat(inputKgSuelto.value);
  valor += 0.1;
  if (valor > 99.9) valor = 99.9;
  inputKgSuelto.value = valor.toFixed(3);
});

btnDecrKg.addEventListener("click", () => {
  let valor = parseFloat(inputKgSuelto.value);
  valor -= 0.1;
  if (valor < 0.1) valor = 0.1;
  inputKgSuelto.value = valor.toFixed(3);
});

// ------------------------
// CARGAR PRODUCTOS STOCK Y SUELTOS EN SELECTS
// ------------------------
async function cargarStockSelect() {
  const stockSnap = await get(ref(window.db, "stock"));
  cobroProductos.innerHTML = '<option value="">Elija un Item</option>';
  if (!stockSnap.exists()) return;
  const data = stockSnap.val();
  Object.entries(data).forEach(([codigo, item]) => {
    const opt = document.createElement("option");
    opt.value = codigo;
    opt.textContent = item.nombre;
    cobroProductos.appendChild(opt);
  });
}

async function cargarSueltosSelect() {
  const sueltosSnap = await get(ref(window.db, "sueltos"));
  cobroSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
  if (!sueltosSnap.exists()) return;
  const data = sueltosSnap.val();
  Object.entries(data).forEach(([codigo, item]) => {
    const opt = document.createElement("option");
    opt.value = codigo;
    opt.textContent = item.nombre;
    cobroSueltos.appendChild(opt);
  });
}

// ------------------------
// CARGAR CAJEROS AL SELECT LOGIN
// ------------------------
async function cargarCajerosSelect() {
  loginUsuario.innerHTML = "";
  const cajerosSnap = await get(ref(window.db, "cajeros"));
  if (!cajerosSnap.exists()) return;
  const data = cajerosSnap.val();
  Object.keys(data).forEach(nro => {
    const opt = document.createElement("option");
    opt.value = nro;
    opt.textContent = nro;
    loginUsuario.appendChild(opt);
  });
}

// ------------------------
// FUNCIONES PARA AÑADIR PRODUCTOS A TABLA
// ------------------------
function actualizarTablaCobro() {
  tablaCobroBody.innerHTML = "";
  cobroTotal = 0;
  cobroTabla.slice().reverse().forEach((prod, idx) => {
    const tr = document.createElement("tr");

    const tdCant = document.createElement("td");
    tdCant.textContent = prod.tipo === "stock" ? prod.cantidad : prod.kg.toFixed(3);
    tr.appendChild(tdCant);

    const tdProd = document.createElement("td");
    tdProd.textContent = prod.nombre;
    tr.appendChild(tdProd);

    const tdPrecio = document.createElement("td");
    tdPrecio.textContent = formatMoney(prod.precio);
    tr.appendChild(tdPrecio);

    const tdTotal = document.createElement("td");
    tdTotal.textContent = formatMoney(prod.total);
    tr.appendChild(tdTotal);

    const tdAccion = document.createElement("td");
    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "❌";
    btnEliminar.classList.add("btn-eliminar");
    btnEliminar.addEventListener("click", () => {
      // Se abrirá modal de admin para eliminar (PARTE 2)
      eliminarProductoModal(idx);
    });
    tdAccion.appendChild(btnEliminar);
    tr.appendChild(tdAccion);

    tablaCobroBody.appendChild(tr);
    cobroTotal += prod.total;
  });
  totalDiv.textContent = `TOTAL: ${formatMoney(cobroTotal)}`;
}

// EVENTO BOTON AGREGAR PRODUCTO STOCK
btnAddProduct.addEventListener("click", async () => {
  const codigo = cobroCodigo.value.trim() || cobroProductos.value;
  if (!codigo) return;

  const stockSnap = await get(ref(window.db, `stock/${codigo}`));
  if (!stockSnap.exists()) return;

  const item = stockSnap.val();
  const cantidad = parseInt(cobroCantidad.value, 10);
  const total = item.precio * cantidad;

  cobroTabla.push({
    tipo: "stock",
    codigo,
    nombre: item.nombre,
    cantidad,
    precio: item.precio,
    total
  });
  actualizarTablaCobro();
  cobroCodigo.value = "";
  cobroProductos.value = "";
});

// EVENTO BOTON AGREGAR PRODUCTO SUELTOS
btnAddSuelto.addEventListener("click", async () => {
  const codigo = cobroCodigoSuelto.value.trim() || cobroSueltos.value;
  if (!codigo) return;

  const sueltosSnap = await get(ref(window.db, `sueltos/${codigo}`));
  if (!sueltosSnap.exists()) return;

  const item = sueltosSnap.val();
  const kg = parseFloat(inputKgSuelto.value);
  const total = item.precio * kg;

  cobroTabla.push({
    tipo: "sueltos",
    codigo,
    nombre: item.nombre,
    kg,
    precio: item.precio,
    total
  });
  actualizarTablaCobro();
  inputKgSuelto.value = "0.100";
  cobroCodigoSuelto.value = "";
  cobroSueltos.value = "";
});

// ------------------------
// CARGAR SELECTS INICIALES
// ------------------------
cargarStockSelect();
cargarSueltosSelect();
initSelectCantidad(cobroCantidad);

// =======================
// PARTE 2 - app.js
// =======================

// ------------------------
// MODAL DE COBRAR (TIPO DE PAGO)
// ------------------------
function abrirModalCobro() {
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");

  const modal = document.createElement("div");
  modal.classList.add("modal");

  const h3 = document.createElement("h3");
  h3.textContent = "¿Cómo Pagará el Cliente?";
  modal.appendChild(h3);

  const tiposPago = ["Efectivo", "Tarjeta", "QR", "Electrónico", "Otro"];
  tiposPago.forEach(tipo => {
    const btn = document.createElement("button");
    btn.textContent = tipo;
    btn.addEventListener("click", () => {
      registrarVenta(tipo);
      document.body.removeChild(overlay);
    });
    modal.appendChild(btn);
  });

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.style.background = "#d63031";
  btnCancelar.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ------------------------
// BOTON COBRAR
// ------------------------
btnCobrar.addEventListener("click", () => {
  if (cobroTabla.length === 0) return;
  abrirModalCobro();
});

// ------------------------
// ELIMINAR PRODUCTO DE TABLA (PARA ADMIN)
// ------------------------
function eliminarProductoModal(idx) {
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");

  const modal = document.createElement("div");
  modal.classList.add("modal");

  const h3 = document.createElement("h3");
  h3.textContent = "Ingrese contraseña de administrador";
  modal.appendChild(h3);

  const input = document.createElement("input");
  input.type = "password";
  modal.appendChild(input);

  const btnAceptar = document.createElement("button");
  btnAceptar.textContent = "Aceptar";
  btnAceptar.addEventListener("click", async () => {
    const val = input.value.trim();
    if (await validarAdmin(val)) {
      cobroTabla.splice(idx, 1);
      actualizarTablaCobro();
      document.body.removeChild(overlay);
    } else {
      alert("Contraseña incorrecta");
    }
  });
  modal.appendChild(btnAceptar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ------------------------
// REGISTRAR VENTA EN FIREBASE
// ------------------------
async function registrarVenta(tipoPago) {
  if (!currentCajero) {
    alert("No hay cajero logueado");
    return;
  }

  const fecha = new Date();
  const fechaStr = `${fecha.getDate().toString().padStart(2,"0")}/${(fecha.getMonth()+1).toString().padStart(2,"0")}/${fecha.getFullYear()} (${fecha.getHours().toString().padStart(2,"0")}:${fecha.getMinutes().toString().padStart(2,"0")})`;

  const movimientosRef = ref(window.db, "movimientos");
  const historialRef = ref(window.db, "historial");

  const idNuevo = (await get(movimientosRef)).exists() ? 
    String(Object.keys((await get(movimientosRef)).val()).length + 1).padStart(6,"0") :
    "000001";

  // Construir objeto venta
  const venta = {
    id: `ID_${idNuevo}`,
    cajero: currentCajero,
    fecha: fechaStr,
    tipoPago,
    productos: cobroTabla,
    total: cobroTotal
  };

  // Guardar en movimientos y historial
  const nuevoMovRef = push(movimientosRef);
  await set(nuevoMovRef, venta);

  const nuevoHistRef = push(historialRef);
  await set(nuevoHistRef, venta);

  // Actualizar stock y sueltos
  for (const prod of cobroTabla) {
    if (prod.tipo === "stock") {
      const itemRef = ref(window.db, `stock/${prod.codigo}`);
      const snap = await get(itemRef);
      if (snap.exists()) {
        const nuevoStock = snap.val().cant - prod.cantidad;
        await update(itemRef, { cant: nuevoStock });
      }
    } else if (prod.tipo === "sueltos") {
      const itemRef = ref(window.db, `sueltos/${prod.codigo}`);
      const snap = await get(itemRef);
      if (snap.exists()) {
        const nuevoKg = snap.val().kg - prod.kg;
        await update(itemRef, { kg: nuevoKg });
      }
    }
  }

  // Imprimir ticket
  imprimirTicket(venta);

  // Limpiar tabla
  cobroTabla = [];
  actualizarTablaCobro();
}

// ------------------------
// IMPRIMIR TICKET
// ------------------------
function imprimirTicket(venta) {
  const printWindow = window.open('', '', 'width=300,height=400');
  const contenido = document.createElement("div");
  contenido.classList.add("print-area");

  const header = document.createElement("div");
  header.innerHTML = `
    ${venta.id} <br>
    ${venta.fecha} <br>
    Cajero: ${venta.cajero} <br>
    ==========
  `;
  contenido.appendChild(header);

  venta.productos.forEach(prod => {
    const prodDiv = document.createElement("div");
    prodDiv.textContent = `${prod.nombre} ${formatMoney(prod.precio)} ${(prod.tipo==="stock" ? `(x${prod.cantidad})` : ``)} = ${formatMoney(prod.total)}`;
    contenido.appendChild(prodDiv);
    const hr = document.createElement("hr");
    hr.id = "hr-ticket";
    contenido.appendChild(hr);
  });

  const footer = document.createElement("div");
  footer.innerHTML = `TOTAL: ${formatMoney(venta.total)}<br>Pago: ${venta.tipoPago}`;
  contenido.appendChild(footer);

  printWindow.document.body.appendChild(contenido);
  printWindow.print();
  printWindow.close();
}

// ------------------------
// MOVIMIENTOS - CARGAR TABLA EN TIEMPO REAL
// ------------------------
const tablaMovBody = document.querySelector("#tabla-movimientos tbody");
const filtroCajero = document.getElementById("filtroCajero");

function actualizarTablaMovimientos(data) {
  tablaMovBody.innerHTML = "";
  Object.entries(data).sort((a,b) => b[0]-a[0]).forEach(([key, mov]) => {
    if (filtroCajero.value !== "TODOS" && mov.cajero !== filtroCajero.value) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mov.id}</td>
      <td>${formatMoney(mov.total)}</td>
      <td>${mov.tipoPago}</td>
      <td></td>
    `;

    const tdAccion = tr.querySelector("td:last-child");
    const btnReimprimir = document.createElement("button");
    btnReimprimir.textContent = "Reimprimir";
    btnReimprimir.classList.add("btn-ver");
    btnReimprimir.addEventListener("click", () => {
      imprimirTicket(mov);
    });

    const btnCancelar = document.createElement("button");
    btnCancelar.textContent = "Eliminar";
    btnCancelar.classList.add("btn-eliminar");
    btnCancelar.addEventListener("click", () => {
      eliminarVentaModal(key, mov);
    });

    tdAccion.appendChild(btnReimprimir);
    tdAccion.appendChild(btnCancelar);

    tablaMovBody.appendChild(tr);
  });
}

// ------------------------
// ESCUCHAR MOVIMIENTOS EN TIEMPO REAL
// ------------------------
onValue(ref(window.db, "movimientos"), snap => {
  if (!snap.exists()) return;
  actualizarTablaMovimientos(snap.val());
});

filtroCajero.addEventListener("change", () => {
  get(ref(window.db, "movimientos")).then(snap => {
    if (!snap.exists()) return;
    actualizarTablaMovimientos(snap.val());
  });
});

// ------------------------
// ELIMINAR VENTA (RESTAURA STOCK / SUELTOS)
// ------------------------
function eliminarVentaModal(key, mov) {
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");

  const modal = document.createElement("div");
  modal.classList.add("modal");

  const h3 = document.createElement("h3");
  h3.textContent = "Ingrese contraseña de administrador";
  modal.appendChild(h3);

  const input = document.createElement("input");
  input.type = "password";
  modal.appendChild(input);

  const btnAceptar = document.createElement("button");
  btnAceptar.textContent = "Aceptar";
  btnAceptar.addEventListener("click", async () => {
    const val = input.value.trim();
    if (await validarAdmin(val)) {
      // Restaurar stock/sueltos
      for (const prod of mov.productos) {
        if (prod.tipo === "stock") {
          const itemRef = ref(window.db, `stock/${prod.codigo}`);
          const snap = await get(itemRef);
          if (snap.exists()) {
            const nuevoStock = snap.val().cant + prod.cantidad;
            await update(itemRef, { cant: nuevoStock });
          }
        } else if (prod.tipo === "sueltos") {
          const itemRef = ref(window.db, `sueltos/${prod.codigo}`);
          const snap = await get(itemRef);
          if (snap.exists()) {
            const nuevoKg = snap.val().kg + prod.kg;
            await update(itemRef, { kg: nuevoKg });
          }
        }
      }

      // Eliminar movimiento
      await remove(ref(window.db, `movimientos/${key}`));
      document.body.removeChild(overlay);
    } else {
      alert("Contraseña incorrecta");
    }
  });
  modal.appendChild(btnAceptar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// =======================
// PARTE 3 - app.js
// =======================

// ------------------------
// FUNCIONES AUXILIARES
// ------------------------
function formatMoney(num) {
  return "$" + Number(num).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ------------------------
// STOCK - CARGAR SELECTS Y TABLA
// ------------------------
const tablaStockBody = document.querySelector("#tabla-stock tbody");
const stockCodigoInput = document.getElementById("stock-codigo");
const stockCantidadSelect = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const btnBuscarStock = document.getElementById("buscar-stock");

// llenar select de cantidad 01-999
for (let i=1; i<=999; i++) {
  const opt = document.createElement("option");
  opt.value = i.toString().padStart(3,"0");
  opt.textContent = i.toString().padStart(3,"0");
  stockCantidadSelect.appendChild(opt);
}

async function actualizarTablaStock(filtro="") {
  const snap = await get(ref(window.db,"stock"));
  tablaStockBody.innerHTML = "";
  if (!snap.exists()) return;
  Object.entries(snap.val()).sort((a,b) => b[1].fecha.localeCompare(a[1].fecha)).forEach(([codigo, prod])=>{
    if (filtro && !prod.nombre.toLowerCase().includes(filtro.toLowerCase()) && !codigo.includes(filtro)) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${prod.nombre}</td>
      <td>${prod.cant}</td>
      <td>${prod.fecha}</td>
      <td>${formatMoney(prod.precio)}</td>
      <td></td>
    `;
    const tdAccion = tr.querySelector("td:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.classList.add("btn-ver");
    btnEditar.addEventListener("click", () => editarStock(codigo));

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "Eliminar";
    btnEliminar.classList.add("btn-eliminar");
    btnEliminar.addEventListener("click", () => eliminarStock(codigo));

    tdAccion.appendChild(btnEditar);
    tdAccion.appendChild(btnEliminar);

    tablaStockBody.appendChild(tr);
  });
}

// AGREGAR STOCK
btnAgregarStock.addEventListener("click", async ()=>{
  const codigo = stockCodigoInput.value.trim().padStart(3,"0");
  const cant = parseInt(stockCantidadSelect.value);
  if (!codigo) return;
  const snap = await get(ref(window.db, `stock/${codigo}`));
  const fecha = new Date();
  const fechaStr = `${fecha.getDate().toString().padStart(2,"0")}/${(fecha.getMonth()+1).toString().padStart(2,"0")}/${fecha.getFullYear()} (${fecha.getHours().toString().padStart(2,"0")}:${fecha.getMinutes().toString().padStart(2,"0")})`;
  if (snap.exists()) {
    await update(ref(window.db, `stock/${codigo}`), { cant: snap.val().cant + cant, fecha: fechaStr });
  } else {
    await set(ref(window.db, `stock/${codigo}`), { nombre: "PRODUCTO NUEVO", cant, precio: 0, fecha: fechaStr });
  }
  actualizarTablaStock();
});

// BUSCAR STOCK
btnBuscarStock.addEventListener("click", ()=> actualizarTablaStock(stockCodigoInput.value));

// EDITAR / ELIMINAR STOCK
async function editarStock(codigo){
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `<h3>Editar Stock - ${codigo}</h3>`;
  const snap = await get(ref(window.db,`stock/${codigo}`));
  if (!snap.exists()) return;
  const data = snap.val();

  const inputNombre = document.createElement("input");
  inputNombre.value = data.nombre;
  modal.appendChild(inputNombre);

  const inputCant = document.createElement("input");
  inputCant.type = "number";
  inputCant.value = data.cant;
  modal.appendChild(inputCant);

  const inputPrecio = document.createElement("input");
  inputPrecio.type = "number";
  inputPrecio.value = data.precio;
  modal.appendChild(inputPrecio);

  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Contraseña Admin";
  modal.appendChild(inputPass);

  const btnGuardar = document.createElement("button");
  btnGuardar.textContent = "Guardar";
  btnGuardar.addEventListener("click", async ()=>{
    if(await validarAdmin(inputPass.value)){
      await update(ref(window.db,`stock/${codigo}`), { nombre: inputNombre.value, cant: parseFloat(inputCant.value), precio: parseFloat(inputPrecio.value) });
      document.body.removeChild(overlay);
      actualizarTablaStock();
    } else alert("Contraseña incorrecta");
  });
  modal.appendChild(btnGuardar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", ()=> document.body.removeChild(overlay));
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

async function eliminarStock(codigo){
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `<h3>Eliminar Stock - ${codigo}</h3>`;

  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Contraseña Admin";
  modal.appendChild(inputPass);

  const btnAceptar = document.createElement("button");
  btnAceptar.textContent = "Aceptar";
  btnAceptar.addEventListener("click", async ()=>{
    if(await validarAdmin(inputPass.value)){
      await remove(ref(window.db,`stock/${codigo}`));
      document.body.removeChild(overlay);
      actualizarTablaStock();
    } else alert("Contraseña incorrecta");
  });
  modal.appendChild(btnAceptar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", ()=> document.body.removeChild(overlay));
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ------------------------
// SUELTOS - SIMILAR A STOCK
// ------------------------
const tablaSueltosBody = document.querySelector("#tabla-sueltos tbody");
const sueltosCodigoInput = document.getElementById("sueltos-codigo");
const sueltosKgInput = document.getElementById("sueltos-kg");
const btnIncrKg = document.getElementById("sueltos-btn-incr");
const btnDecrKg = document.getElementById("sueltos-btn-decr");
const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");

// Botones + / -
btnIncrKg.addEventListener("click", ()=>{
  let val = parseFloat(sueltosKgInput.value);
  if(val < 99) val += 0.100;
  sueltosKgInput.value = val.toFixed(3);
});
btnDecrKg.addEventListener("click", ()=>{
  let val = parseFloat(sueltosKgInput.value);
  if(val > 0.100) val -= 0.100;
  sueltosKgInput.value = val.toFixed(3);
});

async function actualizarTablaSueltos(filtro="") {
  const snap = await get(ref(window.db,"sueltos"));
  tablaSueltosBody.innerHTML = "";
  if (!snap.exists()) return;
  Object.entries(snap.val()).sort((a,b)=>b[1].fecha.localeCompare(a[1].fecha)).forEach(([codigo, prod])=>{
    if (filtro && !prod.nombre.toLowerCase().includes(filtro.toLowerCase()) && !codigo.includes(filtro)) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${prod.nombre}</td>
      <td>${prod.kg.toFixed(3)}</td>
      <td>${prod.fecha}</td>
      <td>${formatMoney(prod.precio)}</td>
      <td></td>
    `;
    const tdAccion = tr.querySelector("td:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.classList.add("btn-ver");
    btnEditar.addEventListener("click", () => editarSuelto(codigo));

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "Eliminar";
    btnEliminar.classList.add("btn-eliminar");
    btnEliminar.addEventListener("click", () => eliminarSuelto(codigo));

    tdAccion.appendChild(btnEditar);
    tdAccion.appendChild(btnEliminar);

    tablaSueltosBody.appendChild(tr);
  });
}

// AGREGAR SUELTOS
btnAgregarSuelto.addEventListener("click", async ()=>{
  const codigo = sueltosCodigoInput.value.trim().padStart(3,"0");
  let kg = parseFloat(sueltosKgInput.value);
  if(!codigo || kg <= 0) return;
  const snap = await get(ref(window.db, `sueltos/${codigo}`));
  const fecha = new Date();
  const fechaStr = `${fecha.getDate().toString().padStart(2,"0")}/${(fecha.getMonth()+1).toString().padStart(2,"0")}/${fecha.getFullYear()} (${fecha.getHours().toString().padStart(2,"0")}:${fecha.getMinutes().toString().padStart(2,"0")})`;
  if (snap.exists()) {
    await update(ref(window.db, `sueltos/${codigo}`), { kg: snap.val().kg + kg, fecha: fechaStr });
  } else {
    await set(ref(window.db, `sueltos/${codigo}`), { nombre: "PRODUCTO NUEVO", kg, precio: 0, fecha: fechaStr });
  }
  actualizarTablaSueltos();
});

// BUSCAR SUELTOS
btnBuscarSuelto.addEventListener("click", ()=> actualizarTablaSueltos(sueltosCodigoInput.value));

// EDITAR / ELIMINAR SUELTOS
async function editarSuelto(codigo){
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `<h3>Editar Suelto - ${codigo}</h3>`;
  const snap = await get(ref(window.db,`sueltos/${codigo}`));
  if (!snap.exists()) return;
  const data = snap.val();

  const inputNombre = document.createElement("input");
  inputNombre.value = data.nombre;
  modal.appendChild(inputNombre);

  const inputKg = document.createElement("input");
  inputKg.type = "number";
  inputKg.value = data.kg.toFixed(3);
  modal.appendChild(inputKg);

  const inputPrecio = document.createElement("input");
  inputPrecio.type = "number";
  inputPrecio.value = data.precio;
  modal.appendChild(inputPrecio);

  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Contraseña Admin";
  modal.appendChild(inputPass);

  const btnGuardar = document.createElement("button");
  btnGuardar.textContent = "Guardar";
  btnGuardar.addEventListener("click", async ()=>{
    if(await validarAdmin(inputPass.value)){
      await update(ref(window.db,`sueltos/${codigo}`), { nombre: inputNombre.value, kg: parseFloat(inputKg.value), precio: parseFloat(inputPrecio.value) });
      document.body.removeChild(overlay);
      actualizarTablaSueltos();
    } else alert("Contraseña incorrecta");
  });
  modal.appendChild(btnGuardar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", ()=> document.body.removeChild(overlay));
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

async function eliminarSuelto(codigo){
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `<h3>Eliminar Suelto - ${codigo}</h3>`;

  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Contraseña Admin";
  modal.appendChild(inputPass);

  const btnAceptar = document.createElement("button");
  btnAceptar.textContent = "Aceptar";
  btnAceptar.addEventListener("click", async ()=>{
    if(await validarAdmin(inputPass.value)){
      await remove(ref(window.db,`sueltos/${codigo}`));
      document.body.removeChild(overlay);
      actualizarTablaSueltos();
    } else alert("Contraseña incorrecta");
  });
  modal.appendChild(btnAceptar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", ()=> document.body.removeChild(overlay));
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ------------------------
// INICIALIZAR TABLAS AL CARGAR
// ------------------------
actualizarTablaStock();
actualizarTablaSueltos();

// =======================
// PARTE 4 - app.js (CAJEROS y CONFIG)
// =======================

// ------------------------
// FUNCIONES AUXILIARES ADMIN
// ------------------------
async function validarAdmin(pass) {
  const snap = await get(ref(window.db,"admin"));
  if(!snap.exists()) return false;
  return snap.val().password === pass;
}

// ------------------------
// CAJEROS
// ------------------------
const tablaCajerosBody = document.querySelector("#tabla-cajeros tbody");
const cajeroUsuarioInput = document.getElementById("cajero-usuario");
const cajeroNombreInput = document.getElementById("cajero-nombre");
const cajeroPassInput = document.getElementById("cajero-pass");
const btnAgregarCajero = document.getElementById("btn-agregar-cajero");

async function actualizarTablaCajeros() {
  const snap = await get(ref(window.db,"cajeros"));
  tablaCajerosBody.innerHTML = "";
  if(!snap.exists()) return;
  Object.entries(snap.val()).forEach(([uid, caj])=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${uid}</td>
      <td>${caj.nombre}</td>
      <td>${caj.usuario}</td>
      <td></td>
    `;
    const tdAccion = tr.querySelector("td:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.classList.add("btn-ver");
    btnEditar.addEventListener("click", ()=> editarCajero(uid));

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "Eliminar";
    btnEliminar.classList.add("btn-eliminar");
    btnEliminar.addEventListener("click", ()=> eliminarCajero(uid));

    tdAccion.appendChild(btnEditar);
    tdAccion.appendChild(btnEliminar);

    tablaCajerosBody.appendChild(tr);
  });
}

// AGREGAR CAJERO
btnAgregarCajero.addEventListener("click", async ()=>{
  const usuario = cajeroUsuarioInput.value.trim();
  const nombre = cajeroNombreInput.value.trim();
  const pass = cajeroPassInput.value.trim();
  if(!usuario || !nombre || !pass) return;

  const snap = await get(ref(window.db,"cajeros"));
  const existe = snap.exists() && Object.values(snap.val()).some(c=>c.usuario === usuario);
  if(existe) return alert("Usuario ya existe");

  const uid = Date.now().toString();
  await set(ref(window.db,`cajeros/${uid}`), { usuario, nombre, pass });
  cajeroUsuarioInput.value = "";
  cajeroNombreInput.value = "";
  cajeroPassInput.value = "";
  actualizarTablaCajeros();
});

// EDITAR / ELIMINAR CAJERO
async function editarCajero(uid){
  const snap = await get(ref(window.db,`cajeros/${uid}`));
  if(!snap.exists()) return;
  const data = snap.val();

  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `<h3>Editar Cajero - ${uid}</h3>`;

  const inputNombre = document.createElement("input");
  inputNombre.value = data.nombre;
  modal.appendChild(inputNombre);

  const inputUsuario = document.createElement("input");
  inputUsuario.value = data.usuario;
  modal.appendChild(inputUsuario);

  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Contraseña Admin";
  modal.appendChild(inputPass);

  const btnGuardar = document.createElement("button");
  btnGuardar.textContent = "Guardar";
  btnGuardar.addEventListener("click", async ()=>{
    if(await validarAdmin(inputPass.value)){
      await update(ref(window.db,`cajeros/${uid}`), { nombre: inputNombre.value, usuario: inputUsuario.value });
      document.body.removeChild(overlay);
      actualizarTablaCajeros();
    } else alert("Contraseña incorrecta");
  });
  modal.appendChild(btnGuardar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", ()=> document.body.removeChild(overlay));
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

async function eliminarCajero(uid){
  const overlay = document.createElement("div");
  overlay.classList.add("modal-overlay");
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `<h3>Eliminar Cajero - ${uid}</h3>`;

  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Contraseña Admin";
  modal.appendChild(inputPass);

  const btnAceptar = document.createElement("button");
  btnAceptar.textContent = "Aceptar";
  btnAceptar.addEventListener("click", async ()=>{
    if(await validarAdmin(inputPass.value)){
      await remove(ref(window.db,`cajeros/${uid}`));
      document.body.removeChild(overlay);
      actualizarTablaCajeros();
    } else alert("Contraseña incorrecta");
  });
  modal.appendChild(btnAceptar);

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "Cancelar";
  btnCancelar.addEventListener("click", ()=> document.body.removeChild(overlay));
  modal.appendChild(btnCancelar);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ------------------------
// CONFIGURACIÓN
// ------------------------
const configTiendaSelect = document.getElementById("config-tienda");
const btnGuardarConfig = document.getElementById("btn-guardar-config");

async function cargarTiendas(){
  const snap = await get(ref(window.db,"tiendas"));
  if(!snap.exists()) return;
  configTiendaSelect.innerHTML = "";
  Object.entries(snap.val()).forEach(([id, tienda])=>{
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = tienda.nombre;
    configTiendaSelect.appendChild(opt);
  });
}

btnGuardarConfig.addEventListener("click", async ()=>{
  const tiendaId = configTiendaSelect.value;
  const snap = await get(ref(window.db,"config"));
  const adminPass = prompt("Contraseña admin:");
  if(await validarAdmin(adminPass)){
    await set(ref(window.db,"config/tiendaActual"), tiendaId);
    alert("Tienda guardada correctamente");
  } else alert("Contraseña incorrecta");
});

// ------------------------
// CAMBIO DE CONTRASEÑA ADMIN
// ------------------------
const inputOldPass = document.getElementById("admin-old-pass");
const inputNewPass = document.getElementById("admin-new-pass");
const btnCambiarPass = document.getElementById("btn-cambiar-pass");

btnCambiarPass.addEventListener("click", async ()=>{
  const oldPass = inputOldPass.value;
  const newPass = inputNewPass.value;
  if(await validarAdmin(oldPass)){
    await update(ref(window.db,"admin"), { password: newPass });
    inputOldPass.value = "";
    inputNewPass.value = "";
    alert("Contraseña cambiada con éxito");
  } else alert("Contraseña actual incorrecta");
});

// ------------------------
// INICIALIZAR
// ------------------------
actualizarTablaCajeros();
cargarTiendas();
