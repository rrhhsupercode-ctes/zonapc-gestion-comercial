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
    const userId = loginUsuario.value;
    const password = loginPass.value;
    const userSnap = await window.get(window.ref(`/cajeros/${userId}`));
    if (userSnap.exists() && userSnap.val().pass === password) {
      currentUser = { id: userId, ...userSnap.val() };
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

let carrito = [];

// Cargar productos y sueltos en selects
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
}

// Actualiza tabla de cobro
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
    tr.querySelector("button").addEventListener("click", async () => {
      const pass = prompt("Contraseña de administrador para eliminar item:");
      const snap = await window.get(window.ref("/config"));
      const val = snap.exists() ? snap.val() : {};
      const passAdmin = val.passAdmin || "1918";
      if (pass === passAdmin || pass === val.masterPass) {
        carrito.splice(idx, 1);
        actualizarTabla();
      } else alert("Contraseña incorrecta");
    });
    tablaCobro.appendChild(tr);
    total += item.cant * item.precio;
  });
  totalDiv.textContent = `TOTAL: $${total.toFixed(2)}`;
  btnCobrar.classList.toggle("hidden", carrito.length === 0);
}

// Sumar cantidades si ya existe producto en carrito, con control de stock
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

// AGREGAR PRODUCTO
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

// AGREGAR SUELTO
btnAddSuelto.addEventListener("click", async () => {
  let id = cobroSueltos.value || inputCodigoSuelto.value.trim();
  let cant = parseFloat(inputKgSuelto.value);
  if (!id || cant <= 0) return;

  const snap = await window.get(window.ref(`/sueltos/${id}`));
  if (!snap.exists()) return alert("Producto no encontrado");
  const data = snap.val();

  if (cant > data.kg) return alert("STOCK INSUFICIENTE");

  agregarAlCarrito({ id, nombre: data.nombre, cant, precio: data.precio, tipo: "sueltos" });
  inputKgSuelto.value = "0.100";
  inputCodigoSuelto.value = "";
});

// BOTONES + / - SUELTOS
btnKgMas.addEventListener("click", () => {
  inputKgSuelto.value = (parseFloat(inputKgSuelto.value) + 0.100).toFixed(3);
});
btnKgMenos.addEventListener("click", () => {
  let val = parseFloat(inputKgSuelto.value) - 0.100;
  if (val < 0.100) val = 0.100;
  inputKgSuelto.value = val.toFixed(3);
});

// IMPRIMIR TICKET
function imprimirTicket(ticketID, fecha, cajeroID, items, total, tipoPago) {
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
          body { font-family: monospace; max-width:5cm; text-align:left; white-space: pre-line; padding:5px; }
          .ticket { border:1px solid #000; padding:5px; }
        </style>
      </head>
      <body>
        <div class="ticket">
          ${ticketID}\n${fecha}\nCajero: ${cajeroID}\n==========\n
          ${items.map(it => `${it.nombre} $${it.precio.toFixed(2)} (x${it.cant}) = $${(it.cant*it.precio).toFixed(2)}\n==========`).join("\n")}
          \nTOTAL: $${total.toFixed(2)}\nPago: ${tipoPago}
        </div>
      </body>
    </html>
  `);
  doc.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(()=>iframe.remove(),500);
}

// COBRAR
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
  document.getElementById("cancelar-pago").addEventListener("click", () => modal.remove());

  modal.querySelectorAll("button[data-pay]").forEach(btn => {
    btn.addEventListener("click", async () => {
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
      const total = carrito.reduce((a,b)=>a+b.cant*b.precio,0);

      // Guardar movimientos con ticketID como clave
      await window.set(window.ref(`/movimientos/${ticketID}`), {
        ticketID,
        cajero: currentUser.id,
        items: carrito,
        total,
        fecha: fecha.toISOString(),
        tipo: tipoPago,
        eliminado: false
      });

      // Guardar historial con ticketID como clave
      await window.set(window.ref(`/historial/${ticketID}`), {
        ticketID,
        cajero: currentUser.id,
        items: carrito,
        total,
        fecha: fecha.toISOString(),
        tipo: tipoPago
      });

      // Actualizar configuración de tickets
      await window.update(window.ref("/config"), { ultimoTicketID: ultimoID, ultimoTicketFecha: fechaHoy });

      // Actualizar stock
      for (const item of carrito) {
        const snapItem = await window.get(window.ref(`/${item.tipo}/${item.id}`));
        if (snapItem.exists()) {
          const data = snapItem.val();
          if (item.tipo === "stock") await window.update(window.ref(`/${item.tipo}/${item.id}`), { cant: data.cant - item.cant });
          else await window.update(window.ref(`/${item.tipo}/${item.id}`), { kg: data.kg - item.cant });
        }
      }

      // Imprimir ticket
      imprimirTicket(ticketID, fechaStr, currentUser.id, carrito, total, tipoPago);

      alert("VENTA FINALIZADA");

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
const btnTirarZ = document.getElementById("btn-tirar-z"); // botón Tirar Z

async function loadMovimientos() {
  const snap = await window.get(window.ref("/movimientos"));
  tablaMovimientos.innerHTML = "";
  filtroCajero.innerHTML = '<option value="TODOS">TODOS</option>';
  if (!snap.exists()) return;

  const entries = Object.entries(snap.val())
    .sort(([, a], [, b]) => new Date(b.fecha) - new Date(a.fecha));

  entries.forEach(([id, mov]) => {
    if (filtroCajero.value !== "TODOS" && mov.cajero !== filtroCajero.value) return;

    const tr = document.createElement("tr");
    const eliminado = mov.eliminado || false;

    tr.style.backgroundColor = eliminado ? "#ccc" : "";
    tr.innerHTML = `
      <td>${id}</td>
      <td>${mov.total.toFixed(2)}</td>
      <td>${mov.tipo}</td>
      <td>
        <button class="reimprimir" data-id="${id}" ${eliminado ? "disabled" : ""}>🖨</button>
        <button class="eliminar" data-id="${id}" ${eliminado ? "disabled" : ""}>❌</button>
      </td>
    `;

    tr.querySelector(".reimprimir").addEventListener("click", () => mostrarModalTicket(mov));

    tr.querySelector(".eliminar").addEventListener("click", () => {
      showAdminActionModal(async () => {
        const confSnap = await window.get(window.ref("/config"));
        const confVal = confSnap.exists() ? confSnap.val() : {};
        const passAdmin = confVal.passAdmin || "1918";

        // Restaurar stock/sueltos
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

        // Marcar ticket como eliminado
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
      .sort(([, a], [, b]) => new Date(a.fecha) - new Date(b.fecha))
      .filter(([, mov]) => filtroCajero.value === "TODOS" || mov.cajero === filtroCajero.value);

    if (!todosMov.length) return alert("No hay movimientos para el cajero seleccionado");

    const fechaZ = new Date();
    const zID = `TIRAR_Z_${fechaZ.getTime()}`;

    const totalPorTipoPago = {};
    let totalGeneral = 0;
    for (const [, mov] of todosMov) {
      if (!totalPorTipoPago[mov.tipo]) totalPorTipoPago[mov.tipo] = 0;
      totalPorTipoPago[mov.tipo] += mov.total;
      totalGeneral += mov.total;
    }

    const registroZ = {
      tipo: "TIRAR Z",
      fecha: fechaZ.toISOString(),
      items: todosMov.map(([id, mov]) => ({ ...mov, ticketID: id })),
      totalPorTipoPago,
      totalGeneral,
      cajeros: [...new Set(todosMov.map(([, mov]) => mov.cajero))]
    };

    await window.set(window.ref(`/historial/${zID}`), registroZ);

    for (const [id] of todosMov) {
      await window.remove(window.ref(`/movimientos/${id}`));
    }

    loadMovimientos();
    loadHistorial();

    let ticketTexto = `*** TIRAR Z ***\n${fechaZ.toLocaleDateString()} ${fechaZ.getHours().toString().padStart(2,'0')}:${fechaZ.getMinutes().toString().padStart(2,'0')}\n`;
    for (const cajero of registroZ.cajeros) {
      ticketTexto += `\n========== CAJERO: ${cajero} ==========\n`;
      const movCajero = registroZ.items.filter(m => m.cajero === cajero);
      const tiposPago = [...new Set(movCajero.map(m => m.tipo))];
      for (const tipo of tiposPago) {
        const ventasTipo = movCajero.filter(m => m.tipo === tipo);
        const subtotal = ventasTipo.reduce((acc, m) => acc + m.total, 0);
        ticketTexto += `\n-- ${tipo} (Subtotal: $${subtotal.toFixed(2)}) --\n`;
        ventasTipo.forEach(m => {
          ticketTexto += `${m.ticketID}  $${m.total.toFixed(2)}\n`;
        });
      }
    }
    ticketTexto += `\n========== TOTAL GENERAL: $${totalGeneral.toFixed(2)} ==========\n`;
    ticketTexto += `\n========== FIN TIRAR Z ==========\n`;

    if (typeof imprimirTicketZ === "function") {
      imprimirTicketZ(ticketTexto);
    } else {
      imprimirTicket(`TIRAR Z\n${ticketTexto}`, new Date().toLocaleString(), "Z", [], totalGeneral, "TIRAR Z");
    }
  });
});


// --- HISTORIAL ---
const tablaHistorial = document.getElementById("tabla-historial").querySelector("tbody");
const historialSeccion = document.getElementById("historial");

// Crear controles de día dinámicos (se insertan antes de la tabla)
const controlesHistorial = document.createElement("div");
controlesHistorial.style.cssText = `
  display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:10px;
`;
controlesHistorial.innerHTML = `
  <button id="historial-dia-prev">◀</button>
  <span id="historial-dia" style="min-width:60px; text-align:center; display:inline-block;">
    ${new Date().getDate().toString().padStart(2,'0')}/
    ${(new Date().getMonth()+1).toString().padStart(2,'0')}/
    ${new Date().getFullYear()}
  </span>
  <button id="historial-dia-next">▶</button>
`;
historialSeccion.insertBefore(controlesHistorial, historialSeccion.querySelector("table"));

const historialDia = document.getElementById("historial-dia");
const btnDiaPrev = document.getElementById("historial-dia-prev");
const btnDiaNext = document.getElementById("historial-dia-next");

let historialRegistros = [];
let fechaMin, fechaMax;

async function loadHistorial() {
  const snap = await window.get(window.ref("/historial"));
  tablaHistorial.innerHTML = "";
  historialRegistros = [];

  if (!snap.exists()) return;

  Object.entries(snap.val()).forEach(([id, mov]) => {
    historialRegistros.push({ id, ...mov, fechaObj: mov.fecha ? new Date(mov.fecha) : null });
  });

  historialRegistros.sort((a, b) => {
    if (!a.fechaObj) return 1;
    if (!b.fechaObj) return -1;
    return b.fechaObj - a.fechaObj;
  });

  const hoy = new Date();
  const diaHoy = hoy.getDate();

  if (diaHoy <= 15) {
    fechaMin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  } else {
    fechaMin = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    for (const mov of historialRegistros) {
      if (mov.fechaObj && mov.fechaObj < fechaMin) {
        await window.remove(window.ref(`/historial/${mov.id}`));
      }
    }
    historialRegistros = historialRegistros.filter(mov => mov.fechaObj && mov.fechaObj >= fechaMin);
  }

  fechaMax = hoy;

  let ultimoDia = historialRegistros.length ? Math.max(...historialRegistros.map(m => m.fechaObj.getDate())) : hoy.getDate();

  mostrarHistorialPorDia(ultimoDia);
}

function mostrarHistorialPorDia(dia) {
  tablaHistorial.innerHTML = "";

  historialRegistros
    .filter(mov => mov.fechaObj && mov.fechaObj.getDate() === dia)
    .forEach(mov => {
      const fechaStr = mov.fechaObj
        ? `${mov.fechaObj.getDate().toString().padStart(2,'0')}/${(mov.fechaObj.getMonth()+1).toString().padStart(2,'0')}/${mov.fechaObj.getFullYear()} (${mov.fechaObj.getHours().toString().padStart(2,'0')}:${mov.fechaObj.getMinutes().toString().padStart(2,'0')})`
        : "";

      const tr = document.createElement("tr");
      const hoy = new Date();
      const esMismoDia = mov.fechaObj &&
        mov.fechaObj.getFullYear() === hoy.getFullYear() &&
        mov.fechaObj.getMonth() === hoy.getMonth() &&
        mov.fechaObj.getDate() === hoy.getDate();

      const puedeEliminar = mov.tipo === "TIRAR Z" && esMismoDia && !mov.eliminado;

      tr.innerHTML = `
        <td>${mov.id}</td>
        <td>${(typeof mov.totalGeneral === "number") ? mov.totalGeneral.toFixed(2) : (mov.total || "")}</td>
        <td>${mov.tipo}</td>
        <td>${mov.cajeros ? mov.cajeros.join(", ") : mov.cajero || ""}</td>
        <td>${fechaStr}</td>
        <td>
          <button class="reimprimir" data-id="${mov.id}">🖨</button>
          ${mov.tipo === "TIRAR Z" ? `<button class="eliminar-z" ${puedeEliminar ? "" : "disabled"}>❌</button>` : ""}
        </td>
      `;

      if (mov.eliminado) tr.style.backgroundColor = "#ccc";

      // --- REIMPRIMIR ---
      tr.querySelector(".reimprimir").addEventListener("click", () => {
        if (mov.tipo === "TIRAR Z") {
          const registro = mov;
          let ticketTexto = `*** TIRAR Z (REIMPRESION) ***\n${registro.fechaObj ? registro.fechaObj.toLocaleDateString() : ""} ${registro.fechaObj ? registro.fechaObj.getHours().toString().padStart(2,'0')+':'+registro.fechaObj.getMinutes().toString().padStart(2,'0') : ""}\n`;
          const cajeros = registro.cajeros || [...new Set((registro.items||[]).map(it => it.cajero))];
          for (const cajero of cajeros) {
            ticketTexto += `\n========== CAJERO: ${cajero} ==========\n`;
            const movCajero = (registro.items || []).filter(i => i.cajero === cajero);
            const tiposPago = [...new Set(movCajero.map(m => m.tipo))];
            for (const tipo of tiposPago) {
              const ventasTipo = movCajero.filter(m => m.tipo === tipo);
              const subtotal = ventasTipo.reduce((acc,m) => acc + (m.total||0), 0);
              ticketTexto += `\n-- ${tipo} (Subtotal: $${subtotal.toFixed(2)}) --\n`;
              ventasTipo.forEach(m => ticketTexto += `${m.ticketID}  $${(m.total||0).toFixed(2)}\n`);
            }
          }
          ticketTexto += `\n========== TOTAL GENERAL: $${(registro.totalGeneral||0).toFixed(2)} ==========\n`;
          ticketTexto += `\n========== FIN REIMPRESION TIRAR Z ==========\n`;
          if (typeof imprimirTicketZ === "function") imprimirTicketZ(ticketTexto);
        } else {
          mostrarModalTicket(mov);
        }
      });

// --- ELIMINAR TIRAR Z ---
const btnEliminarZ = tr.querySelector(".eliminar-z");
if (btnEliminarZ) {
  btnEliminarZ.addEventListener("click", () => {
    showAdminActionModal(async () => {
      // restaurar movimientos
      for (const reg of mov.items || []) {
        await window.set(window.ref(`/movimientos/${reg.ticketID}`), reg);
      }
      // marcar eliminado
      await window.update(window.ref(`/historial/${mov.id}`), { eliminado: true });
      tr.style.backgroundColor = "#ccc";

      // deshabilitar ambos botones
      btnEliminarZ.disabled = true;
      const btnReimprimir = tr.querySelector(".reimprimir");
      if (btnReimprimir) {
        btnReimprimir.disabled = true;
        btnReimprimir.style.opacity = "0.5";
        btnReimprimir.style.pointerEvents = "none";
      }

      loadMovimientos();
    });
  });
}

      tablaHistorial.appendChild(tr);
    });

  historialDia.textContent = `${dia.toString().padStart(2,'0')}/${(fechaMax.getMonth()+1).toString().padStart(2,'0')}/${fechaMax.getFullYear()}`;
  historialDia.dataset.dia = dia;

  btnDiaPrev.disabled = fechaMin ? (dia <= fechaMin.getDate()) : false;
  btnDiaNext.disabled = fechaMax ? (dia >= fechaMax.getDate()) : false;
}

btnDiaPrev.addEventListener("click", () => {
  let dia = parseInt(historialDia.dataset.dia);
  if (!isNaN(dia) && (!fechaMin || dia > fechaMin.getDate())) mostrarHistorialPorDia(dia - 1);
});
btnDiaNext.addEventListener("click", () => {
  let dia = parseInt(historialDia.dataset.dia);
  if (!isNaN(dia) && (!fechaMax || dia < fechaMax.getDate())) mostrarHistorialPorDia(dia + 1);
});
  
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

// Formato precio "$0.000.000,00"
function formatPrecio(num) {
  const n = parseFloat(num) || 0;
  const partes = n.toFixed(2).split(".");
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${entero},${partes[1]}`;
}

async function loadStock(filtro = "") {
  const snap = await window.get(window.ref("/stock"));
  tablaStock.innerHTML = "";
  if (!snap.exists()) return;

  let stockArray = Object.entries(snap.val()).filter(([id, prod]) => {
    if (!filtro) return true;
    filtro = filtro.toLowerCase();
    return id.toLowerCase().includes(filtro) || prod.nombre.toLowerCase().includes(filtro);
  });

  stockArray.sort((a, b) => {
    const fechaA = new Date(a[1].fecha || 0).getTime();
    const fechaB = new Date(b[1].fecha || 0).getTime();
    return fechaB - fechaA;
  });

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

    tr.querySelector(`button[data-del-id="${id}"]`).addEventListener("click", () => {
      showAdminActionModal(async () => {
        await window.remove(window.ref(`/stock/${id}`));
        loadStock();
        loadProductos();
      });
    });

    tr.querySelector(`button[data-edit-id="${id}"]`).addEventListener("click", () => {
      showAdminActionModal(() => {
        const modal = document.createElement("div");
        modal.style.cssText = `
          position:fixed; top:0; left:0; width:100%; height:100%;
          display:flex; justify-content:center; align-items:center;
          background:rgba(0,0,0,0.7); z-index:9999;
        `;
        modal.innerHTML = `
          <div style="background:#fff; padding:20px; border-radius:10px; width:340px; text-align:center;">
            <h2>Editar Stock ${id}</h2>

            <label for="edit-nombre">Nombre del producto</label>
            <input id="edit-nombre" type="text" value="${prod.nombre}" style="width:100%; margin:5px 0;">

            <label for="edit-cant">Cantidad (0-999)</label>
            <div style="display:flex; align-items:center; justify-content:space-between; margin:5px 0;">
              <button id="cant-decr" style="width:30%;">-</button>
              <input id="edit-cant" type="number" min="0" max="999" value="${prod.cant}" style="width:40%; text-align:center;">
              <button id="cant-incr" style="width:30%;">+</button>
            </div>

            <label>Precio</label>
            <div style="display:flex; gap:6px; justify-content:center; align-items:center; margin-top:5px;">
              <input id="edit-precio" type="text" placeholder="0.000.000" style="width:65%; text-align:center;" value="${Math.floor(prod.precio)}">
              <span>,</span>
              <input id="edit-centavos" type="number" min="0" max="99" placeholder="00" style="width:25%; text-align:center;" value="${Math.round((prod.precio % 1) * 100)
                .toString()
                .padStart(2, "0")}">
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

        // Formateo dinámico del campo de pesos (000.000)
        editPrecio.addEventListener("input", () => {
          let val = editPrecio.value.replace(/\D/g, "");
          if (val.length > 7) val = val.slice(0, 7);
          const partes = [];
          while (val.length > 3) {
            partes.unshift(val.slice(-3));
            val = val.slice(0, -3);
          }
          if (val) partes.unshift(val);
          editPrecio.value = partes.join(".");
          actualizarPreview();
        });

        editCentavos.addEventListener("input", () => {
          let val = parseInt(editCentavos.value);
          if (isNaN(val) || val < 0) val = 0;
          if (val > 99) val = 99;
          editCentavos.value = val.toString().padStart(2, "0");
          actualizarPreview();
        });

        function actualizarPreview() {
          const entero = parseInt(editPrecio.value.replace(/\./g, "")) || 0;
          const dec = parseInt(editCentavos.value) || 0;
          const combinado = entero + dec / 100;
          preview.textContent = formatPrecio(combinado);
        }

        cantDecr.addEventListener("click", () => actualizarCant(-1, editCant));
        cantIncr.addEventListener("click", () => actualizarCant(1, editCant));
        editCancelar.addEventListener("click", () => modal.remove());

        editAceptar.addEventListener("click", async () => {
          const newNombre = editNombre.value.trim();
          const newCant = parseInt(editCant.value);
          const entero = parseInt(editPrecio.value.replace(/\./g, "")) || 0;
          const dec = parseInt(editCentavos.value) || 0;
          const newPrecio = entero + dec / 100;

          if (!newNombre || isNaN(newCant)) {
            editMsg.textContent = "Todos los campos son obligatorios y válidos";
            return;
          }
          if (newCant < 0 || newCant > 999) {
            editMsg.textContent = "Cantidad fuera de rango 0-999";
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
    });

    tablaStock.appendChild(tr);
  });
}

// Agregar stock (suma si existe)
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

// Buscar
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

// Reutilizamos el modal de admin
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

// Mensaje de error debajo del input sueltosKg
let msgKg = document.createElement("p");
msgKg.style.color = "red";
msgKg.style.margin = "4px 0 0 0";
msgKg.style.fontSize = "0.9em";
sueltosKg.parentNode.appendChild(msgKg);

// Función para formatear KG según nueva lógica 0.000 → 0.001, 0.012, 0.123, 1.234, 12.345
function formatearKg(inputElement, msgElement, delta = 0) {
  let raw = inputElement.value.replace(/\D/g, ""); // solo números

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

// Edición manual con validación en tiempo real y al perder foco
sueltosKg.addEventListener("input", () => formatearKg(sueltosKg, msgKg));
sueltosKg.addEventListener("blur", () => formatearKg(sueltosKg, msgKg));

// Formatea fecha ISO a DD/MM/YYYY (HH:MM)
function formatFecha(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} (${hh}:${min})`;
}

// Formatea precio a "$00000,00"
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

  sueltosArray.sort((a, b) => {
    const fechaA = new Date(a[1].fecha || 0).getTime();
    const fechaB = new Date(b[1].fecha || 0).getTime();
    return fechaB - fechaA;
  });

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

    tr.querySelector(`button[data-del-id="${id}"]`).addEventListener("click", () => {
      showAdminActionModal(async () => {
        await window.remove(window.ref(`/sueltos/${id}`));
        loadSueltos();
        loadProductos();
      });
    });

    tr.querySelector(`button[data-edit-id="${id}"]`).addEventListener("click", () => {
      showAdminActionModal(() => {
        const modal = document.createElement("div");
        modal.style.cssText = `
          position:fixed; top:0; left:0; width:100%; height:100%;
          display:flex; justify-content:center; align-items:center;
          background:rgba(0,0,0,0.7); z-index:9999;
        `;
        modal.innerHTML = `
          <div style="background:#fff; padding:20px; border-radius:10px; width:340px; text-align:center;">
            <h2>Editar Suelto ${id}</h2>

            <label for="edit-nombre">Nombre del producto</label>
            <input id="edit-nombre" type="text" value="${prod.nombre}" style="width:100%; margin:5px 0;">

            <label for="edit-kg">KG (0.000 - 99.000)</label>
            <div style="display:flex; align-items:center; justify-content:space-between; margin:5px 0;">
              <button id="kg-decr" style="width:30%;">-</button>
              <input id="edit-kg" type="text" value="${parseFloat(prod.kg).toFixed(3)}" style="width:40%; text-align:center;">
              <button id="kg-incr" style="width:30%;">+</button>
            </div>
            <p id="edit-kg-msg" style="color:red; margin-top:2px; font-size:0.9em; min-height:18px;"></p>

            <label>Precio</label>
            <div style="display:flex; gap:6px; justify-content:center; align-items:center; margin-top:5px;">
              <input id="edit-precio" type="text" placeholder="00000" style="width:65%; text-align:center;" value="${Math.floor(prod.precio)}">
              <span>,</span>
              <input id="edit-centavos" type="number" min="0" max="99" placeholder="00" style="width:25%; text-align:center;" value="${Math.round((prod.precio % 1) * 100).toString().padStart(2, "0")}">
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

        // Función formateo modal igual que principal
        function formatearKgModal(inputElement, msgElement, delta = 0) {
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
        kgIncr.addEventListener("click", () => formatearKgModal(editKg, editKgMsg, 0.100));
        kgDecr.addEventListener("click", () => formatearKgModal(editKg, editKgMsg, -0.100));

        // Edición manual con validación
        editKg.addEventListener("input", () => formatearKgModal(editKg, editKgMsg));
        editKg.addEventListener("blur", () => formatearKgModal(editKg, editKgMsg));

        // Precio
        editPrecio.addEventListener("input", () => {
          let val = editPrecio.value.replace(/\D/g, "");
          if (val.length > 5) val = val.slice(0, 5);
          editPrecio.value = val;
          actualizarPreview();
        });
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
          const combinado = entero + dec / 100;
          preview.textContent = formatPrecio(combinado);
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

// Buscar sueltos
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
