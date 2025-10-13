// -----------------------
// APP.JS PARTE 1
// -----------------------

// -----------------------
// CONSTANTES Y SELECTORES
// -----------------------
const adminPassword = "1918"; // contraseña admin por defecto
const masterPassword = "1409"; // contraseña maestra
let currentSection = "cobro";
let currentCajero = null;
let cobroItems = []; // items cargados en la tabla de cobro

// Selectores generales
const sections = document.querySelectorAll("main section");
const navButtons = document.querySelectorAll(".nav-btn");

// MODAL ADMIN INICIAL
const adminModal = document.createElement("div");
adminModal.id = "admin-login-modal";
adminModal.style.position = "fixed";
adminModal.style.top = "0";
adminModal.style.left = "0";
adminModal.style.width = "100%";
adminModal.style.height = "100%";
adminModal.style.background = "rgba(0,0,0,0.6)";
adminModal.style.display = "flex";
adminModal.style.alignItems = "center";
adminModal.style.justifyContent = "center";
adminModal.style.zIndex = "9999";
adminModal.innerHTML = `
  <div style="background:#fff;padding:20px;border-radius:8px;text-align:center;">
    <h2>🔒 Contraseña de Administrador 🔒</h2>
    <input id="input-admin-pass" type="password" placeholder="Ingrese contraseña">
    <p id="msg-admin-pass" style="color:red;margin-top:5px;"></p>
    <button id="btn-admin-login">Ingresar</button>
  </div>
`;
document.body.appendChild(adminModal);
document.body.style.filter = "blur(5px)";

// -----------------------
// FUNCIONES DE NAVEGACIÓN
// -----------------------
function showSection(sectionId) {
  sections.forEach(sec => sec.classList.add("hidden"));
  const target = document.getElementById(sectionId);
  if (target) target.classList.remove("hidden");
  currentSection = sectionId;
}

// Nav buttons
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    showSection(btn.dataset.section);
  });
});

// -----------------------
// LOGIN ADMIN MODAL
// -----------------------
document.getElementById("btn-admin-login").addEventListener("click", () => {
  const input = document.getElementById("input-admin-pass").value;
  const msg = document.getElementById("msg-admin-pass");
  if (input === adminPassword || input === masterPassword) {
    adminModal.style.display = "none";
    document.body.style.filter = "none";
    initCobroSection();
  } else {
    msg.textContent = "Contraseña incorrecta";
  }
});

// -----------------------
// COBRAR SECTION
// -----------------------
function initCobroSection() {
  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const msgLogin = document.getElementById("login-msg");
  const cobroControles = document.getElementById("cobro-controles");

  // Llenar select usuarios 01-99
  loginUsuario.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    const val = i.toString().padStart(2, "0");
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val;
    loginUsuario.appendChild(option);
  }

  btnLogin.addEventListener("click", async () => {
    const nro = loginUsuario.value;
    const pass = loginPass.value;

    // Traer datos de cajero desde Firebase
    const snap = await get(ref(db, `cajeros/${nro}`));
    if (!snap.exists() || snap.val().pass !== pass) {
      msgLogin.textContent = "Contraseña incorrecta";
      return;
    }

    currentCajero = nro;
    msgLogin.textContent = "";
    document.getElementById("login-modal").classList.add("hidden");
    cobroControles.classList.remove("hidden");

    initCobroControls();
  });
}

// -----------------------
// FUNCIONES DE COBRO
// -----------------------
function initCobroControls() {
  // Cantidades 01-99
  const selectCantidad = document.getElementById("cobro-cantidad");
  selectCantidad.innerHTML = "";
  for (let i = 1; i <= 99; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i.toString().padStart(2, "0");
    selectCantidad.appendChild(option);
  }

  const btnAddProduct = document.getElementById("btn-add-product");
  const selectProductos = document.getElementById("cobro-productos");
  const inputCodigo = document.getElementById("cobro-codigo");
  const tablaBody = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");

  // Cargar productos STOCK desde Firebase
  onValue(ref(db, "stock"), snap => {
    selectProductos.innerHTML = '<option value="">Elija un Item</option>';
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([codigo, item]) => {
      const opt = document.createElement("option");
      opt.value = codigo;
      opt.textContent = `${item.nombre} ($${item.precio})`;
      selectProductos.appendChild(opt);
    });
  });

  // Añadir producto STOCK a la tabla
  btnAddProduct.addEventListener("click", async () => {
    let cantidad = parseInt(selectCantidad.value);
    let codigo = inputCodigo.value || selectProductos.value;
    if (!codigo) return;

    const snap = await get(ref(db, `stock/${codigo}`));
    if (!snap.exists()) return;

    const item = snap.val();
    const total = item.precio * cantidad;
    const fila = {
      tipo: "stock",
      codigo,
      nombre: item.nombre,
      cantidad,
      precio: item.precio,
      total
    };
    cobroItems.unshift(fila);
    renderTablaCobro();
  });

  // Renderizar tabla COBRO
  function renderTablaCobro() {
    tablaBody.innerHTML = "";
    let totalGeneral = 0;
    cobroItems.forEach((item, index) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${item.cantidad}</td>
        <td>${item.nombre}</td>
        <td>$${item.precio}</td>
        <td>$${item.total}</td>
        <td><button class="btn-eliminar" data-index="${index}">Eliminar</button></td>
      `;
      tablaBody.appendChild(tr);
      totalGeneral += item.total;
    });
    totalDiv.textContent = `TOTAL: $${totalGeneral}`;

    // Eliminar item
    const btnsEliminar = document.querySelectorAll(".btn-eliminar");
    btnsEliminar.forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        pedirAdminPass().then(ok => {
          if (ok) {
            cobroItems.splice(idx, 1);
            renderTablaCobro();
          }
        });
      });
    });
  }

  // Modal pedir contraseña admin
  function pedirAdminPass() {
    return new Promise(resolve => {
      const modal = document.createElement("div");
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.width = "100%";
      modal.style.height = "100%";
      modal.style.background = "rgba(0,0,0,0.6)";
      modal.style.display = "flex";
      modal.style.alignItems = "center";
      modal.style.justifyContent = "center";
      modal.style.zIndex = "9999";

      modal.innerHTML = `
        <div style="background:#fff;padding:20px;border-radius:8px;text-align:center;">
          <h2>🔒 Contraseña de Administrador 🔒</h2>
          <input id="modal-admin-pass" type="password" placeholder="Contraseña">
          <p id="modal-msg" style="color:red;margin-top:5px;"></p>
          <button id="modal-aceptar">Aceptar</button>
          <button id="modal-cancelar">Cancelar</button>
        </div>
      `;
      document.body.appendChild(modal);
      document.body.style.filter = "blur(5px)";

      modal.querySelector("#modal-aceptar").addEventListener("click", () => {
        const val = modal.querySelector("#modal-admin-pass").value;
        if (val === adminPassword) {
          modal.remove();
          document.body.style.filter = "none";
          resolve(true);
        } else {
          modal.querySelector("#modal-msg").textContent = "Contraseña incorrecta";
        }
      });

      modal.querySelector("#modal-cancelar").addEventListener("click", () => {
        modal.remove();
        document.body.style.filter = "none";
        resolve(false);
      });
    });
  }

  // Inicializar KG sueltos (similar STOCK)
  initCobroSueltos();
}

// -----------------------
// SECCIÓN SUELTOS COBRO
// -----------------------
function initCobroSueltos() {
  const inputKg = document.getElementById("input-kg-suelto");
  const btnIncr = document.getElementById("btn-incr-kg");
  const btnDecr = document.getElementById("btn-decr-kg");
  const selectSueltos = document.getElementById("cobro-sueltos");
  const inputCodigoSuelto = document.getElementById("cobro-codigo-suelto");
  const btnAddSuelto = document.getElementById("btn-add-suelto");
  const tablaBody = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");

  // Incrementar/decrementar KG
  btnIncr.addEventListener("click", () => {
    let val = parseFloat(inputKg.value);
    val += 0.1;
    if (val > 99.9) val = 99.9;
    inputKg.value = val.toFixed(3);
  });
  btnDecr.addEventListener("click", () => {
    let val = parseFloat(inputKg.value);
    val -= 0.1;
    if (val < 0.1) val = 0.1;
    inputKg.value = val.toFixed(3);
  });

  // Cargar productos SUELTOS desde Firebase
  onValue(ref(db, "sueltos"), snap => {
    selectSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
    if (!snap.exists()) return;
    const data = snap.val();
    Object.entries(data).forEach(([codigo, item]) => {
      const opt = document.createElement("option");
      opt.value = codigo;
      opt.textContent = `${item.nombre} ($${item.precio})`;
      selectSueltos.appendChild(opt);
    });
  });

  // Agregar sueltos a tabla
  btnAddSuelto.addEventListener("click", async () => {
    const kg = parseFloat(inputKg.value);
    const codigo = inputCodigoSuelto.value || selectSueltos.value;
    if (!codigo) return;

    const snap = await get(ref(db, `sueltos/${codigo}`));
    if (!snap.exists()) return;

    const item = snap.val();
    const total = item.precio * kg;
    const fila = {
      tipo: "sueltos",
      codigo,
      nombre: item.nombre,
      cantidad: kg.toFixed(3),
      precio: item.precio,
      total
    };
    cobroItems.unshift(fila);

    // Re-renderizar tabla
    tablaBody.innerHTML = "";
    let totalGeneral = 0;
    cobroItems.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.cantidad}</td>
        <td>${item.nombre}</td>
        <td>$${item.precio}</td>
        <td>$${item.total.toFixed(2)}</td>
        <td><button class="btn-eliminar" data-index="${index}">Eliminar</button></td>
      `;
      tablaBody.appendChild(tr);
      totalGeneral += item.total;
    });
    totalDiv.textContent = `TOTAL: $${totalGeneral.toFixed(2)}`;
  });
}

// -----------------------
// APP.JS PARTE 2
// -----------------------

// -----------------------
// MODAL COBRAR Y TIPO DE PAGO
// -----------------------
const btnCobrar = document.getElementById("btn-cobrar");
btnCobrar.classList.remove("hidden");

btnCobrar.addEventListener("click", () => {
  if (cobroItems.length === 0) return;

  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9999";

  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:8px;text-align:center; width:300px;">
      <h2>¿Cómo Pagará el Cliente?</h2>
      <div style="margin:10px 0;">
        <button class="btn-pago" data-pago="Efectivo">Efectivo</button>
        <button class="btn-pago" data-pago="Tarjeta">Tarjeta</button>
        <button class="btn-pago" data-pago="QR">QR</button>
        <button class="btn-pago" data-pago="Electrónico">Electrónico</button>
        <button class="btn-pago" data-pago="Otro">Otro</button>
      </div>
      <button id="btn-cancelar-pago" style="background:red;color:#fff;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.filter = "blur(5px)";

  // Cancelar venta
  modal.querySelector("#btn-cancelar-pago").addEventListener("click", () => {
    modal.remove();
    document.body.style.filter = "none";
  });

  // Seleccionar tipo de pago
  modal.querySelectorAll(".btn-pago").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tipoPago = btn.dataset.pago;

      // Guardar ticket en Firebase
      const fecha = new Date();
      const dia = fecha.toISOString().slice(0,10);
      const hora = fecha.toTimeString().slice(0,5);
      const refTicket = ref(db, `movimientos/${dia}`);
      const ticketIDSnap = await get(refTicket);
      let idNum = 1;
      if (ticketIDSnap.exists()) {
        const keys = Object.keys(ticketIDSnap.val());
        idNum = keys.length + 1;
      }
      const ticketID = "ID_" + idNum.toString().padStart(6,"0");

      const total = cobroItems.reduce((acc,item)=>acc+item.total,0);

      const ticketData = {
        id: ticketID,
        cajero: currentCajero,
        fecha: `${fecha.getDate()}/${fecha.getMonth()+1}/${fecha.getFullYear()} (${hora})`,
        total,
        tipoPago,
        items: cobroItems
      };

      await set(ref(db, `movimientos/${dia}/${ticketID}`), ticketData);
      await set(ref(db, `historial/${dia}/${ticketID}`), ticketData);

      // Actualizar stock / sueltos
      for (let item of cobroItems) {
        const itemRef = ref(db, `${item.tipo}/${item.codigo}`);
        const snapItem = await get(itemRef);
        if (!snapItem.exists()) continue;
        const data = snapItem.val();
        if (item.tipo === "stock") {
          await update(itemRef, { cant: data.cant - item.cantidad });
        } else if (item.tipo === "sueltos") {
          await update(itemRef, { kg: (data.kg - parseFloat(item.cantidad)).toFixed(3) });
        }
      }

      alert("Venta realizada");

      // Limpiar tabla
      cobroItems = [];
      document.querySelector("#tabla-cobro tbody").innerHTML = "";
      document.getElementById("total-div").textContent = "TOTAL: $0";

      modal.remove();
      document.body.style.filter = "none";
    });
  });
}

// -----------------------
// SECCIÓN MOVIMIENTOS
// -----------------------
const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
const filtroCajero = document.getElementById("filtroCajero");
const btnTirarZ = document.getElementById("btn-tirar-z");

// Llenar filtro cajeros
onValue(ref(db, "cajeros"), snap => {
  filtroCajero.innerHTML = '<option value="TODOS">TODOS</option>';
  if (!snap.exists()) return;
  Object.keys(snap.val()).forEach(nro => {
    const opt = document.createElement("option");
    opt.value = nro;
    opt.textContent = nro;
    filtroCajero.appendChild(opt);
  });
});

// Función para renderizar movimientos
async function renderMovimientos() {
  tablaMovimientos.innerHTML = "";
  const fecha = new Date();
  const dia = fecha.toISOString().slice(0,10);
  const snap = await get(ref(db, `movimientos/${dia}`));
  if (!snap.exists()) return;

  const data = snap.val();
  Object.values(data).forEach(ticket => {
    if (filtroCajero.value !== "TODOS" && ticket.cajero !== filtroCajero.value) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>$${ticket.total}</td>
      <td>${ticket.tipoPago}</td>
      <td>
        <button class="btn-reimprimir">Reimprimir</button>
        <button class="btn-eliminar-mov">Eliminar</button>
      </td>
    `;
    tablaMovimientos.appendChild(tr);

    // Reimprimir ticket
    tr.querySelector(".btn-reimprimir").addEventListener("click", () => {
      reimprimirTicket(ticket);
    });

    // Eliminar ticket
    tr.querySelector(".btn-eliminar-mov").addEventListener("click", async () => {
      const ok = await pedirAdminPass();
      if (!ok) return;

      // Restaurar stock / sueltos
      for (let item of ticket.items) {
        const itemRef = ref(db, `${item.tipo}/${item.codigo}`);
        const snapItem = await get(itemRef);
        if (!snapItem.exists()) continue;
        const dataItem = snapItem.val();
        if (item.tipo === "stock") {
          await update(itemRef, { cant: dataItem.cant + item.cantidad });
        } else if (item.tipo === "sueltos") {
          await update(itemRef, { kg: (parseFloat(dataItem.kg) + parseFloat(item.cantidad)).toFixed(3) });
        }
      }

      // Eliminar ticket de movimientos
      await remove(ref(db, `movimientos/${dia}/${ticket.id}`));
      renderMovimientos();
    });
  });
}

// Reimprimir ticket (modal)
function reimprimirTicket(ticket) {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9999";

  let htmlItems = "";
  ticket.items.forEach(it => {
    htmlItems += `${it.nombre} $${it.precio} (x${it.cantidad}) = $${it.total.toFixed(2)}<br>==========<br>`;
  });

  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:8px;text-align:center; width:300px;">
      <h2>Ticket ${ticket.id}</h2>
      <p>Cajero: ${ticket.cajero}</p>
      <p>Fecha: ${ticket.fecha}</p>
      <p>${htmlItems}</p>
      <p>TOTAL: $${ticket.total}</p>
      <p>Pago: ${ticket.tipoPago}</p>
      <button id="modal-reimprimir">Reimprimir</button>
      <button id="modal-cerrar">Cerrar</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.filter = "blur(5px)";

  modal.querySelector("#modal-cerrar").addEventListener("click", () => {
    modal.remove();
    document.body.style.filter = "none";
  });

  modal.querySelector("#modal-reimprimir").addEventListener("click", () => {
    alert("Se imprimió el ticket (simulado)");
  });
}

// Eventos
filtroCajero.addEventListener("change", renderMovimientos);
btnTirarZ.addEventListener("click", async () => {
  const ok = confirm("⚠️ADVERTENCIA: Tirar Z no puede revertirse⚠️\n¿Desea continuar?");
  if (!ok) return;
  const fecha = new Date();
  const dia = fecha.toISOString().slice(0,10);
  await remove(ref(db, `movimientos/${dia}`));
  renderMovimientos();
});

// Inicializar movimientos al cargar
renderMovimientos();

// -----------------------
// APP.JS PARTE 3
// -----------------------

// -----------------------
// SECCIÓN HISTORIAL
// -----------------------
const tablaHistorial = document.querySelector("#tabla-historial tbody");

async function renderHistorial(dia = null) {
  tablaHistorial.innerHTML = "";
  const fecha = dia ? new Date(dia) : new Date();
  const diaKey = fecha.toISOString().slice(0,10);

  const snap = await get(ref(db, `historial/${diaKey}`));
  if (!snap.exists()) return;

  const data = snap.val();
  Object.values(data).forEach(ticket => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ticket.id}</td>
      <td>$${ticket.total}</td>
      <td>${ticket.tipoPago}</td>
      <td>${ticket.cajero}</td>
      <td>${ticket.fecha}</td>
      <td>
        <button class="btn-reimprimir">Reimprimir</button>
      </td>
    `;
    tablaHistorial.appendChild(tr);

    tr.querySelector(".btn-reimprimir").addEventListener("click", () => {
      reimprimirTicket(ticket);
    });
  });
}

// Inicializar historial al cargar
renderHistorial();

// -----------------------
// SECCIÓN STOCK
// -----------------------
const tablaStock = document.querySelector("#tabla-stock tbody");
const inputStockCodigo = document.getElementById("stock-codigo");
const selectStockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const btnBuscarStock = document.getElementById("buscar-stock");

// Rellenar select cantidades
for (let i = 1; i <= 999; i++) {
  const opt = document.createElement("option");
  opt.value = i.toString().padStart(3,"0");
  opt.textContent = i.toString().padStart(3,"0");
  selectStockCantidad.appendChild(opt);
}

// Función para renderizar stock
async function renderStock(buscar = "") {
  tablaStock.innerHTML = "";
  const snap = await get(ref(db, "stock"));
  if (!snap.exists()) return;
  const data = snap.val();

  Object.values(data).sort((a,b)=>new Date(b.fecha) - new Date(a.fecha)).forEach(item => {
    if (buscar && !item.nombre.includes(buscar) && !item.codigo.includes(buscar)) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.cant}</td>
      <td>${item.fecha}</td>
      <td>$${parseFloat(item.precio).toFixed(2)}</td>
      <td>
        <button class="btn-editar-stock">Editar</button>
        <button class="btn-eliminar-stock">Eliminar</button>
      </td>
    `;
    tablaStock.appendChild(tr);

    // Editar
    tr.querySelector(".btn-editar-stock").addEventListener("click", async () => {
      const ok = await pedirAdminPass();
      if (!ok) return;
      const nuevoNombre = prompt("Nuevo nombre:", item.nombre);
      const nuevaCant = prompt("Nueva cantidad:", item.cant);
      const nuevoPrecio = prompt("Nuevo precio:", item.precio);
      await update(ref(db, `stock/${item.codigo}`), {
        nombre: nuevoNombre,
        cant: parseInt(nuevaCant),
        precio: parseFloat(nuevoPrecio).toFixed(2)
      });
      renderStock();
    });

    // Eliminar
    tr.querySelector(".btn-eliminar-stock").addEventListener("click", async () => {
      const ok = await pedirAdminPass();
      if (!ok) return;
      await remove(ref(db, `stock/${item.codigo}`));
      renderStock();
    });
  });
}

// Agregar stock
btnAgregarStock.addEventListener("click", async () => {
  const codigo = inputStockCodigo.value || selectStockCantidad.value;
  if (!codigo) return;
  const snap = await get(ref(db, `stock/${codigo}`));
  const fecha = new Date();
  const fechaStr = `${fecha.getDate()}/${fecha.getMonth()+1}/${fecha.getFullYear()} (${fecha.getHours()}:${fecha.getMinutes()})`;

  if (snap.exists()) {
    const data = snap.val();
    await update(ref(db, `stock/${codigo}`), { cant: data.cant + parseInt(selectStockCantidad.value) });
  } else {
    await set(ref(db, `stock/${codigo}`), {
      codigo,
      nombre: "PRODUCTO NUEVO",
      cant: parseInt(selectStockCantidad.value),
      precio: 0,
      fecha: fechaStr
    });
  }
  renderStock();
});

// Buscar stock
btnBuscarStock.addEventListener("click", () => {
  renderStock(inputStockCodigo.value);
});

// Inicializar stock
renderStock();

// -----------------------
// SECCIÓN SUELTOS
// -----------------------
const tablaSueltos = document.querySelector("#tabla-sueltos tbody");
const inputSueltosCodigo = document.getElementById("sueltos-codigo");
const inputSueltosKG = document.getElementById("sueltos-kg");
const btnSueltosIncr = document.getElementById("sueltos-btn-incr");
const btnSueltosDecr = document.getElementById("sueltos-btn-decr");
const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");

// Botones + / -
btnSueltosIncr.addEventListener("click", () => {
  let val = parseFloat(inputSueltosKG.value);
  if (val < 99.000) {
    val += 0.100;
    inputSueltosKG.value = val.toFixed(3);
  }
});
btnSueltosDecr.addEventListener("click", () => {
  let val = parseFloat(inputSueltosKG.value);
  if (val > 0.100) {
    val -= 0.100;
    inputSueltosKG.value = val.toFixed(3);
  }
});

// Función para renderizar sueltos
async function renderSueltos(buscar="") {
  tablaSueltos.innerHTML = "";
  const snap = await get(ref(db, "sueltos"));
  if (!snap.exists()) return;
  const data = snap.val();

  Object.values(data).sort((a,b)=>new Date(b.fecha) - new Date(a.fecha)).forEach(item => {
    if (buscar && !item.nombre.includes(buscar) && !item.codigo.includes(buscar)) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.nombre}</td>
      <td>${parseFloat(item.kg).toFixed(3)}</td>
      <td>${item.fecha}</td>
      <td>$${parseFloat(item.precio).toFixed(2)}</td>
      <td>
        <button class="btn-editar-suelto">Editar</button>
        <button class="btn-eliminar-suelto">Eliminar</button>
      </td>
    `;
    tablaSueltos.appendChild(tr);

    // Editar sueltos
    tr.querySelector(".btn-editar-suelto").addEventListener("click", async () => {
      const ok = await pedirAdminPass();
      if (!ok) return;
      const nuevoNombre = prompt("Nuevo nombre:", item.nombre);
      const nuevoKG = prompt("Nuevo KG:", item.kg);
      const nuevoPrecio = prompt("Nuevo precio:", item.precio);
      await update(ref(db, `sueltos/${item.codigo}`), {
        nombre: nuevoNombre,
        kg: parseFloat(nuevoKG).toFixed(3),
        precio: parseFloat(nuevoPrecio).toFixed(2)
      });
      renderSueltos();
    });

    // Eliminar sueltos
    tr.querySelector(".btn-eliminar-suelto").addEventListener("click", async () => {
      const ok = await pedirAdminPass();
      if (!ok) return;
      await remove(ref(db, `sueltos/${item.codigo}`));
      renderSueltos();
    });
  });
}

// Agregar sueltos
btnAgregarSuelto.addEventListener("click", async () => {
  const codigo = inputSueltosCodigo.value;
  const kg = parseFloat(inputSueltosKG.value);
  if (!codigo || kg <= 0) return;

  const snap = await get(ref(db, `sueltos/${codigo}`));
  const fecha = new Date();
  const fechaStr = `${fecha.getDate()}/${fecha.getMonth()+1}/${fecha.getFullYear()} (${fecha.getHours()}:${fecha.getMinutes()})`;

  if (snap.exists()) {
    const data = snap.val();
    await update(ref(db, `sueltos/${codigo}`), { kg: (parseFloat(data.kg)+kg).toFixed(3) });
  } else {
    await set(ref(db, `sueltos/${codigo}`), {
      codigo,
      nombre: "PRODUCTO NUEVO",
      kg: kg.toFixed(3),
      precio: 0,
      fecha: fechaStr
    });
  }
  renderSueltos();
});

// Buscar sueltos
btnBuscarSuelto.addEventListener("click", () => {
  renderSueltos(inputSueltosCodigo.value);
});

// Inicializar sueltos
renderSueltos();

// -----------------------
// APP.JS PARTE 4
// -----------------------

// -----------------------
// SECCIÓN CAJEROS
// -----------------------
const tablaCajeros = document.querySelector("#tabla-cajeros tbody");
const selectCajeroNro = document.getElementById("cajero-nro");
const inputCajeroNombre = document.getElementById("cajero-nombre");
const inputCajeroDNI = document.getElementById("cajero-dni");
const inputCajeroPass = document.getElementById("cajero-pass");
const btnAgregarCajero = document.getElementById("agregar-cajero");

// Rellenar select Nro cajero 01-99
for (let i = 1; i <= 99; i++) {
  const opt = document.createElement("option");
  opt.value = i.toString().padStart(2,"0");
  opt.textContent = i.toString().padStart(2,"0");
  selectCajeroNro.appendChild(opt);
}

// Renderizar cajeros
async function renderCajeros() {
  tablaCajeros.innerHTML = "";
  const snap = await get(ref(db, "cajeros"));
  if (!snap.exists()) return;
  const data = snap.val();

  Object.values(data).sort((a,b)=>parseInt(a.nro)-parseInt(b.nro)).forEach(cajero => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cajero.nro}</td>
      <td>${cajero.nombre}</td>
      <td>${cajero.dni}</td>
      <td>
        <button class="btn-editar-cajero">Editar</button>
        <button class="btn-eliminar-cajero">Eliminar</button>
      </td>
    `;
    tablaCajeros.appendChild(tr);

    // Editar cajero
    tr.querySelector(".btn-editar-cajero").addEventListener("click", async () => {
      const ok = await pedirAdminPass();
      if (!ok) return;
      const nuevoNombre = prompt("Nuevo nombre:", cajero.nombre);
      const nuevoDNI = prompt("Nuevo DNI:", cajero.dni);
      const nuevaPass = prompt("Nueva contraseña:", cajero.pass);
      await update(ref(db, `cajeros/${cajero.nro}`), {
        nombre: nuevoNombre,
        dni: nuevoDNI,
        pass: nuevaPass
      });
      renderCajeros();
    });

    // Eliminar cajero
    tr.querySelector(".btn-eliminar-cajero").addEventListener("click", async () => {
      const ok = await pedirAdminPass();
      if (!ok) return;
      await remove(ref(db, `cajeros/${cajero.nro}`));
      renderCajeros();
    });
  });
}

// Agregar cajero
btnAgregarCajero.addEventListener("click", async () => {
  const nro = selectCajeroNro.value;
  const nombre = inputCajeroNombre.value;
  const dni = inputCajeroDNI.value;
  const pass = inputCajeroPass.value;

  if (!nro || !nombre || !dni || !pass) return;
  const ok = await pedirAdminPass();
  if (!ok) return;

  await set(ref(db, `cajeros/${nro}`), { nro, nombre, dni, pass });
  renderCajeros();
});

// Inicializar cajeros
renderCajeros();

// -----------------------
// SECCIÓN CONFIG
// -----------------------
const inputConfigNombre = document.getElementById("config-nombre");
const inputPassActual = document.getElementById("config-pass-actual");
const inputPassNueva = document.getElementById("config-pass-nueva");
const btnGuardarConfig = document.getElementById("guardar-config");
const pConfigMsg = document.getElementById("config-msg");
const inputMasterPass = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");

// Guardar configuración
btnGuardarConfig.addEventListener("click", async () => {
  const passActual = inputPassActual.value;
  const passNueva = inputPassNueva.value;
  const nombreTienda = inputConfigNombre.value;

  const snap = await get(ref(db, "config"));
  const config = snap.exists() ? snap.val() : { admin: "1918" };

  if (passActual !== config.admin) {
    pConfigMsg.textContent = "Contraseña incorrecta";
    return;
  }

  await update(ref(db, "config"), {
    admin: passNueva || config.admin,
    nombre: nombreTienda || config.nombre
  });
  pConfigMsg.textContent = "Configuración guardada";
});

// Restaurar contraseña
btnRestaurar.addEventListener("click", async () => {
  const master = inputMasterPass.value;
  const snap = await get(ref(db, "config"));
  const config = snap.exists() ? snap.val() : {};

  if (master !== "1409") {
    pConfigMsg.textContent = "Contraseña maestra incorrecta";
    return;
  }

  await update(ref(db, "config"), { admin: "1918" });
  pConfigMsg.textContent = "Contraseña restaurada por defecto (1918)";
});

// Mostrar nombre de tienda en header
async function mostrarNombreTienda() {
  const snap = await get(ref(db, "config/nombre"));
  if (snap.exists()) document.getElementById("app-title").textContent = snap.val();
}
mostrarNombreTienda();

// -----------------------
// FUNCIONES AUXILIARES
// -----------------------

// Modal para pedir contraseña de administrador
function pedirAdminPass() {
  return new Promise(resolve => {
    const pass = prompt("Ingrese contraseña de administrador:");
    get(ref(db, "config/admin")).then(snap => {
      if (!snap.exists()) return resolve(false);
      resolve(pass === snap.val());
    });
  });
}

// Reimprimir ticket
function reimprimirTicket(ticket) {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = 0;
  modal.style.left = 0;
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.innerHTML = `
    <div style="background:white; padding:20px; border-radius:10px; text-align:center;">
      <pre>${JSON.stringify(ticket, null, 2)}</pre>
      <button id="cerrar-modal">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#cerrar-modal").addEventListener("click", () => {
    modal.remove();
  });
}
