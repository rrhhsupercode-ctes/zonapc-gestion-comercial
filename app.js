/*****************************************************
 * app.js – PARTE 1
 * Inicialización, login admin/maestro, navegación y login de cajero
 *****************************************************/
import { db, ref, get, set, update, push, remove, onValue } from "./init.js";

// ---------------------------
// MODAL ADMIN/MAESTRO INICIAL
// ---------------------------
const body = document.querySelector("body");

function crearModalAdmin() {
  const modal = document.createElement("div");
  modal.id = "modal-admin";
  modal.style = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    display:flex; justify-content:center; align-items:center;
    background:rgba(0,0,0,0.6); z-index:9999;
  `;
  modal.innerHTML = `
    <div style="
      background:white; padding:30px; border-radius:10px;
      text-align:center; width:300px;
    ">
      <h2>🔑 Acceso Administrador 🔑</h2>
      <input id="input-admin-pass" type="password" placeholder="Contraseña">
      <p id="msg-admin" style="color:red; margin:5px 0;"></p>
      <button id="btn-admin-login">Ingresar</button>
    </div>
  `;
  body.appendChild(modal);

  document.getElementById("btn-admin-login").addEventListener("click", async () => {
    const pass = document.getElementById("input-admin-pass").value;
    const configSnap = await get(ref(db, "config"));
    const { passAdmin, masterPass } = configSnap.val();
    if (pass === passAdmin || pass === masterPass) {
      modal.remove();
      iniciarApp();
    } else {
      document.getElementById("msg-admin").innerText = "Contraseña incorrecta";
    }
  });
}

// ---------------------------
// NAVEGACION ENTRE SECCIONES
// ---------------------------
const secciones = document.querySelectorAll("main > section");
const navBtns = document.querySelectorAll("nav .nav-btn");

function mostrarSeccion(id) {
  secciones.forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

navBtns.forEach(btn => {
  btn.addEventListener("click", () => mostrarSeccion(btn.dataset.section));
});

// ---------------------------
// LOGIN DE CAJERO EN COBRAR
// ---------------------------
const cajeroSelect = document.getElementById("login-usuario");
const loginBtn = document.getElementById("btn-login");
const loginPassInput = document.getElementById("login-pass");
const loginMsg = document.getElementById("login-msg");
let cajeroActual = null;

async function cargarCajeros() {
  const snap = await get(ref(db, "cajeros"));
  const data = snap.exists() ? snap.val() : {};
  cajeroSelect.innerHTML = "";
  Object.keys(data).sort().forEach(nro => {
    cajeroSelect.innerHTML += `<option value="${nro}">${nro}</option>`;
  });
}

loginBtn.addEventListener("click", async () => {
  const nro = cajeroSelect.value;
  const pass = loginPassInput.value;
  const snap = await get(ref(db, `cajeros/${nro}`));
  if (!snap.exists()) {
    loginMsg.innerText = "Cajero no existe";
    return;
  }
  const cajero = snap.val();
  if (pass === cajero.pass) {
    cajeroActual = { nro, nombre: cajero.nombre };
    loginMsg.innerText = "";
    document.getElementById("cobro-controles").classList.remove("hidden");
  } else {
    loginMsg.innerText = "Contraseña incorrecta";
  }
});

// ---------------------------
// INICIAR APP
// ---------------------------
function iniciarApp() {
  mostrarSeccion("cobro"); // sección por defecto
  cargarCajeros();
}

// ---------------------------
// ARRANCAR MODAL ADMIN
// ---------------------------
crearModalAdmin();

/*****************************************************
 * app.js - Parte 2
 * Sección COBRAR - Firebase 11.8.1 modular
 *****************************************************/

import { db, ref, get, set, update, push, remove, onValue } from "./index.html"; // global wrappers

(() => {
  // ---------------------------
  // Variables generales COBRAR
  // ---------------------------
  const seccionCobro = document.getElementById("cobro");
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
  const tablaCobro = document.querySelector("#tabla-cobro tbody");
  const totalDiv = document.getElementById("total-div");
  const btnCobrar = document.getElementById("btn-cobrar");

  let cajeroActual = null;
  let cobroItems = []; // { tipo:'stock'|'sueltos', codigo, nombre, cantidad, precio, total }

  // ---------------------------
  // Inicialización selects
  // ---------------------------
  for (let i = 1; i <= 99; i++) {
    const val = i.toString().padStart(2, "0");
    const optionCajero = document.createElement("option");
    optionCajero.value = val;
    optionCajero.textContent = val;
    loginUsuario.appendChild(optionCajero);

    const optionCantidad = document.createElement("option");
    optionCantidad.value = val;
    optionCantidad.textContent = val;
    cobroCantidad.appendChild(optionCantidad);
  }

  // ---------------------------
  // Función mostrar mensaje error login
  // ---------------------------
  function showLoginError(msg) {
    loginMsg.textContent = msg;
    setTimeout(() => loginMsg.textContent = "", 3000);
  }

  // ---------------------------
  // Login Cajero
  // ---------------------------
  btnLogin.addEventListener("click", async () => {
    const nro = loginUsuario.value;
    const pass = loginPass.value.trim();
    if (!nro || !pass) return showLoginError("Completa usuario y contraseña");

    try {
      const snap = await get(ref(db, `cajeros/${nro}`));
      if (!snap.exists()) return showLoginError("Cajero no encontrado");

      const data = snap.val();
      if (data.pass === pass) {
        cajeroActual = nro;
        loginModal.style.display = "none";
        cobroControles.classList.remove("hidden");
        cargarProductosSelect();
        actualizarTotal();
      } else {
        showLoginError("Contraseña incorrecta");
      }
    } catch (err) {
      console.error("Error login cajero:", err);
      showLoginError("Error al verificar usuario");
    }
  });

  // ---------------------------
  // Cargar select de productos STOCK y SUELTOS
  // ---------------------------
  async function cargarProductosSelect() {
    cobroProductos.innerHTML = `<option value="">Elija un Item</option>`;
    cobroSueltos.innerHTML = `<option value="">Elija un Item (Sueltos)</option>`;

    const snapStock = await get(ref(db, "stock"));
    if (snapStock.exists()) {
      const dataStock = snapStock.val();
      Object.entries(dataStock).forEach(([codigo, producto]) => {
        const opt = document.createElement("option");
        opt.value = codigo;
        opt.textContent = `${producto.nombre} ($${producto.precio})`;
        cobroProductos.appendChild(opt);
      });
    }

    const snapSueltos = await get(ref(db, "sueltos"));
    if (snapSueltos.exists()) {
      const dataSueltos = snapSueltos.val();
      Object.entries(dataSueltos).forEach(([codigo, producto]) => {
        const opt = document.createElement("option");
        opt.value = codigo;
        opt.textContent = `${producto.nombre} ($${producto.precio})`;
        cobroSueltos.appendChild(opt);
      });
    }
  }

  // ---------------------------
  // Botón agregar producto STOCK
  // ---------------------------
  btnAddProduct.addEventListener("click", async () => {
    const cant = parseInt(cobroCantidad.value);
    const codigo = cobroProductos.value;
    if (!codigo) return;

    try {
      const snap = await get(ref(db, `stock/${codigo}`));
      if (!snap.exists()) return;
      const producto = snap.val();
      const total = cant * parseFloat(producto.precio);
      cobroItems.unshift({ tipo: "stock", codigo, nombre: producto.nombre, cantidad: cant, precio: producto.precio, total });
      renderTablaCobro();
      actualizarTotal();
    } catch (err) {
      console.error("Error agregar producto:", err);
    }
  });

  // ---------------------------
  // Botones incrementar/decrementar KG SUELTOS
  // ---------------------------
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

  // ---------------------------
  // Botón agregar producto SUELTOS
  // ---------------------------
  btnAddSuelto.addEventListener("click", async () => {
    const kg = parseFloat(inputKgSuelto.value);
    const codigo = cobroSueltos.value;
    if (!codigo) return;

    try {
      const snap = await get(ref(db, `sueltos/${codigo}`));
      if (!snap.exists()) return;
      const producto = snap.val();
      const total = kg * parseFloat(producto.precio);
      cobroItems.unshift({ tipo: "sueltos", codigo, nombre: producto.nombre, cantidad: kg, precio: producto.precio, total });
      renderTablaCobro();
      actualizarTotal();
    } catch (err) {
      console.error("Error agregar suelto:", err);
    }
  });

  // ---------------------------
  // Renderizar tabla COBRO
  // ---------------------------
  function renderTablaCobro() {
    tablaCobro.innerHTML = "";
    cobroItems.forEach((item, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.cantidad}</td>
        <td>${item.nombre}</td>
        <td>${item.precio}</td>
        <td>${item.total.toFixed(2)}</td>
        <td><button data-idx="${idx}" class="btn-eliminar">Eliminar</button></td>
      `;
      tablaCobro.appendChild(tr);
    });

    // Botones eliminar requieren modal admin, implementado en Parte 3
    document.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.idx;
        abrirModalEliminar(idx);
      });
    });
  }

  function actualizarTotal() {
    const total = cobroItems.reduce((acc, item) => acc + item.total, 0);
    totalDiv.textContent = `TOTAL: $${total.toFixed(2)}`;
    btnCobrar.classList.toggle("hidden", total === 0);
  }

  // ---------------------------
  // Modal pago (abrir)
  // ---------------------------
  btnCobrar.addEventListener("click", () => {
    abrirModalPago();
  });

  function abrirModalPago() {
    // Aquí se implementará modal centrado para elegir tipo de pago
    // Código del modal completo será incluido en Parte 3
    console.log("Abrir modal de pago - Parte 3 implementará");
  }

})();

/*****************************************************
 * app.js - Parte 3
 * COBRAR: Modal de pago, impresión tickets, eliminar productos
 *****************************************************/

(() => {
  // ---------------------------
  // Variables modal pago
  // ---------------------------
  const body = document.body;
  let modalPago = null;
  let modalEliminar = null;
  let eliminarIdx = null;

  // ---------------------------
  // Abrir modal de pago
  // ---------------------------
  window.abrirModalPago = () => {
    if (modalPago) modalPago.remove();

    modalPago = document.createElement("div");
    modalPago.id = "modal-pago";
    modalPago.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;
    `;
    modalPago.innerHTML = `
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:300px;">
        <h3>¿Cómo Pagará el Cliente?</h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0;">
          <button class="btn-pago" data-tipo="Efectivo">Efectivo</button>
          <button class="btn-pago" data-tipo="Tarjeta">Tarjeta</button>
          <button class="btn-pago" data-tipo="QR">QR</button>
          <button class="btn-pago" data-tipo="Electrónico">Electrónico</button>
          <button class="btn-pago" data-tipo="Otro">Otro</button>
        </div>
        <button id="btn-cancelar-pago" style="background:red;color:white;padding:5px 15px;border:none;border-radius:5px;">Cancelar</button>
      </div>
    `;
    body.appendChild(modalPago);

    // Cancelar
    modalPago.querySelector("#btn-cancelar-pago").addEventListener("click", () => {
      modalPago.remove();
      modalPago = null;
    });

    // Seleccionar tipo de pago
    modalPago.querySelectorAll(".btn-pago").forEach(btn => {
      btn.addEventListener("click", () => {
        const tipoPago = btn.dataset.tipo;
        realizarVenta(tipoPago);
        modalPago.remove();
        modalPago = null;
      });
    });
  };

  // ---------------------------
  // Realizar venta
  // ---------------------------
  async function realizarVenta(tipoPago) {
    const cobroItems = window.cobroItems;
    if (!cobroItems || cobroItems.length === 0) return;

    const fecha = new Date();
    const fechaStr = `${fecha.getDate().toString().padStart(2,"0")}/${(fecha.getMonth()+1).toString().padStart(2,"0")}/${fecha.getFullYear()} (${fecha.getHours()}:${fecha.getMinutes()})`;

    // Obtener ID del día
    const dayKey = fecha.toISOString().split("T")[0];
    const movimientosRef = ref(window.db, `movimientos/${dayKey}`);
    const movimientosSnap = await get(movimientosRef);
    let idNum = 1;
    if (movimientosSnap.exists()) {
      idNum = Object.keys(movimientosSnap.val()).length + 1;
    }
    const ticketId = `ID_${idNum.toString().padStart(6,"0")}`;

    // Preparar ticket
    const total = cobroItems.reduce((acc, i) => acc + i.total, 0);
    const ticket = {
      id: ticketId,
      fecha: fechaStr,
      cajero: window.cajeroActual,
      items: cobroItems,
      total,
      tipoPago
    };

    // Guardar en movimientos
    await set(ref(window.db, `movimientos/${dayKey}/${ticketId}`), ticket);

    // Actualizar stock y sueltos
    for (const item of cobroItems) {
      if (item.tipo === "stock") {
        const stockRef = ref(window.db, `stock/${item.codigo}/cant`);
        const snap = await get(stockRef);
        const cantActual = snap.exists() ? snap.val() : 0;
        await set(stockRef, cantActual - item.cantidad);
      } else if (item.tipo === "sueltos") {
        const sueltosRef = ref(window.db, `sueltos/${item.codigo}/kg`);
        const snap = await get(sueltosRef);
        const kgActual = snap.exists() ? snap.val() : 0;
        await set(sueltosRef, kgActual - item.cantidad);
      }
    }

    // Limpiar tabla y reset cobroItems
    window.cobroItems = [];
    window.renderTablaCobro();
    window.actualizarTotal();

    // Imprimir ticket
    imprimirTicket(ticket);
  }

  // ---------------------------
  // Imprimir ticket (console log y modal)
  // ---------------------------
  function imprimirTicket(ticket) {
    let contenido = `${ticket.id}\n${ticket.fecha}\nCajero: ${ticket.cajero}\n==========\n`;
    ticket.items.forEach(it => {
      contenido += `${it.nombre} $${it.precio} (x${it.cantidad}) = $${it.total.toFixed(2)}\n==========\n`;
    });
    contenido += `TOTAL: $${ticket.total.toFixed(2)}\nPago: ${ticket.tipoPago}`;
    console.log(contenido);

    const modal = document.createElement("div");
    modal.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;
    `;
    modal.innerHTML = `
      <div style="background:white;padding:20px;border-radius:10px;text-align:left;max-width:300px;white-space:pre-line;">
        ${contenido}
        <button id="btn-cerrar-ticket" style="margin-top:10px;">Cerrar</button>
      </div>
    `;
    body.appendChild(modal);
    modal.querySelector("#btn-cerrar-ticket").addEventListener("click", () => modal.remove());
  }

  // ---------------------------
  // Modal eliminar producto
  // ---------------------------
  window.abrirModalEliminar = (idx) => {
    eliminarIdx = idx;
    if (modalEliminar) modalEliminar.remove();

    modalEliminar = document.createElement("div");
    modalEliminar.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;
    `;
    modalEliminar.innerHTML = `
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:250px;">
        <h4>Contraseña de administrador</h4>
        <input id="input-pass-admin" type="password" placeholder="Contraseña">
        <div style="margin-top:10px;">
          <button id="btn-aceptar-eliminar">Aceptar</button>
          <button id="btn-cancelar-eliminar">Cancelar</button>
        </div>
        <p id="msg-eliminar" style="color:red;"></p>
      </div>
    `;
    body.appendChild(modalEliminar);

    modalEliminar.querySelector("#btn-cancelar-eliminar").addEventListener("click", () => {
      modalEliminar.remove();
      modalEliminar = null;
      eliminarIdx = null;
    });

    modalEliminar.querySelector("#btn-aceptar-eliminar").addEventListener("click", async () => {
      const pass = modalEliminar.querySelector("#input-pass-admin").value;
      const configSnap = await get(ref(window.db, "config"));
      const config = configSnap.val();
      if (pass === config.passAdmin || pass === config.masterPass) {
        // Restaurar stock/sueltos
        const item = window.cobroItems[eliminarIdx];
        if (item.tipo === "stock") {
          const snap = await get(ref(window.db, `stock/${item.codigo}/cant`));
          const cantActual = snap.exists() ? snap.val() : 0;
          await set(ref(window.db, `stock/${item.codigo}/cant`), cantActual + item.cantidad);
        } else if (item.tipo === "sueltos") {
          const snap = await get(ref(window.db, `sueltos/${item.codigo}/kg`));
          const kgActual = snap.exists() ? snap.val() : 0;
          await set(ref(window.db, `sueltos/${item.codigo}/kg`), kgActual + item.cantidad);
        }
        // Eliminar del arreglo
        window.cobroItems.splice(eliminarIdx, 1);
        window.renderTablaCobro();
        window.actualizarTotal();
        modalEliminar.remove();
        modalEliminar = null;
        eliminarIdx = null;
      } else {
        modalEliminar.querySelector("#msg-eliminar").textContent = "Contraseña incorrecta";
      }
    });
  };

})();

/*****************************************************
 * app.js - Parte 4
 * MOVIMIENTOS, HISTORIAL, STOCK, SUELTOS, CAJEROS, CONFIG
 *****************************************************/

(() => {
  // ---------------------------
  // Navegación entre secciones
  // ---------------------------
  const secciones = document.querySelectorAll("main section");
  const navBtns = document.querySelectorAll(".nav-btn");
  let seccionActual = "cobro";

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      secciones.forEach(sec => sec.classList.add("hidden"));
      const sec = document.getElementById(btn.dataset.section);
      if (sec) sec.classList.remove("hidden");
      seccionActual = btn.dataset.section;
    });
  });

  // ---------------------------
  // MOVIMIENTOS
  // ---------------------------
  const filtroCajero = document.getElementById("filtroCajero");
  const tablaMov = document.getElementById("tabla-movimientos").querySelector("tbody");
  const btnTirarZ = document.getElementById("btn-tirar-z");

  async function renderMovimientos() {
    const dayKey = new Date().toISOString().split("T")[0];
    const movRef = ref(window.db, `movimientos/${dayKey}`);
    const snap = await get(movRef);
    tablaMov.innerHTML = "";
    if (!snap.exists()) return;
    const movs = Object.values(snap.val()).reverse();
    for (const m of movs) {
      if (filtroCajero.value !== "TODOS" && m.cajero !== filtroCajero.value) continue;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.id}</td>
        <td>$${m.total.toFixed(2)}</td>
        <td>${m.tipoPago}</td>
        <td>
          <button class="btn-reimprimir">Reimprimir</button>
          <button class="btn-eliminar">Eliminar</button>
        </td>
      `;
      tablaMov.appendChild(tr);

      tr.querySelector(".btn-reimprimir").addEventListener("click", () => imprimirTicket(m));
      tr.querySelector(".btn-eliminar").addEventListener("click", () => window.abrirModalEliminarMovimiento(dayKey, m.id, m.items));
    }
  }

  filtroCajero.addEventListener("change", renderMovimientos);
  btnTirarZ.addEventListener("click", async () => {
    if (!confirm("⚠️ Tirar Z no puede revertirse. Continuar?")) return;
    const dayKey = new Date().toISOString().split("T")[0];
    await set(ref(window.db, `movimientos/${dayKey}`), {});
    renderMovimientos();
  });

  window.abrirModalEliminarMovimiento = (dayKey, ticketId, items) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;
    `;
    modal.innerHTML = `
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:250px;">
        <h4>Contraseña de administrador</h4>
        <input id="pass-eliminar-mov" type="password" placeholder="Contraseña">
        <div style="margin-top:10px;">
          <button id="aceptar-eliminar-mov">Aceptar</button>
          <button id="cancelar-eliminar-mov">Cancelar</button>
        </div>
        <p id="msg-eliminar-mov" style="color:red;"></p>
      </div>
    `;
    body.appendChild(modal);

    modal.querySelector("#cancelar-eliminar-mov").addEventListener("click", () => modal.remove());
    modal.querySelector("#aceptar-eliminar-mov").addEventListener("click", async () => {
      const pass = modal.querySelector("#pass-eliminar-mov").value;
      const configSnap = await get(ref(window.db, "config"));
      const config = configSnap.val();
      if (pass === config.passAdmin || pass === config.masterPass) {
        // Restaurar stock/sueltos
        for (const item of items) {
          if (item.tipo === "stock") {
            const snap = await get(ref(window.db, `stock/${item.codigo}/cant`));
            const cantActual = snap.exists() ? snap.val() : 0;
            await set(ref(window.db, `stock/${item.codigo}/cant`), cantActual + item.cantidad);
          } else if (item.tipo === "sueltos") {
            const snap = await get(ref(window.db, `sueltos/${item.codigo}/kg`));
            const kgActual = snap.exists() ? snap.val() : 0;
            await set(ref(window.db, `sueltos/${item.codigo}/kg`), kgActual + item.cantidad);
          }
        }
        await remove(ref(window.db, `movimientos/${dayKey}/${ticketId}`));
        modal.remove();
        renderMovimientos();
      } else {
        modal.querySelector("#msg-eliminar-mov").textContent = "Contraseña incorrecta";
      }
    });
  };

  // ---------------------------
  // HISTORIAL
  // ---------------------------
  const tablaHist = document.getElementById("tabla-historial").querySelector("tbody");
  async function renderHistorial() {
    const rootSnap = await get(ref(window.db, "movimientos"));
    tablaHist.innerHTML = "";
    if (!rootSnap.exists()) return;
    const days = Object.keys(rootSnap.val()).sort().reverse();
    for (const day of days) {
      const daySnap = rootSnap.val()[day];
      for (const ticket of Object.values(daySnap)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${ticket.id}</td>
          <td>$${ticket.total.toFixed(2)}</td>
          <td>${ticket.tipoPago}</td>
          <td>${ticket.cajero}</td>
          <td>${ticket.fecha}</td>
          <td><button class="btn-reimprimir">Reimprimir</button></td>
        `;
        tablaHist.appendChild(tr);
        tr.querySelector(".btn-reimprimir").addEventListener("click", () => imprimirTicket(ticket));
      }
    }
  }

  // ---------------------------
  // STOCK
  // ---------------------------
  const tablaStockBody = document.getElementById("tabla-stock").querySelector("tbody");
  async function renderStock() {
    const snap = await get(ref(window.db, "stock"));
    tablaStockBody.innerHTML = "";
    if (!snap.exists()) return;
    const data = snap.val();
    const ordenados = Object.entries(data).sort((a,b)=>b[1].fecha.localeCompare(a[1].fecha));
    for (const [codigo, item] of ordenados) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${codigo}</td>
        <td>${item.nombre || "PRODUCTO NUEVO"}</td>
        <td>${item.cant || 0}</td>
        <td>${item.fecha}</td>
        <td>$${item.precio?.toFixed(2) || "0.00"}</td>
        <td>
          <button class="btn-editar-stock">Editar</button>
          <button class="btn-eliminar-stock">Eliminar</button>
        </td>
      `;
      tablaStockBody.appendChild(tr);

      tr.querySelector(".btn-eliminar-stock").addEventListener("click", () => window.modalEliminarStock(codigo));
      tr.querySelector(".btn-editar-stock").addEventListener("click", () => window.modalEditarStock(codigo));
    }
  }

  window.modalEliminarStock = async (codigo) => {
    const modal = document.createElement("div");
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;`;
    modal.innerHTML = `
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:250px;">
        <h4>Contraseña de administrador</h4>
        <input id="pass-del-stock" type="password" placeholder="Contraseña">
        <div style="margin-top:10px;">
          <button id="aceptar-del-stock">Aceptar</button>
          <button id="cancelar-del-stock">Cancelar</button>
        </div>
        <p id="msg-del-stock" style="color:red;"></p>
      </div>
    `;
    body.appendChild(modal);
    modal.querySelector("#cancelar-del-stock").addEventListener("click", ()=>modal.remove());
    modal.querySelector("#aceptar-del-stock").addEventListener("click", async ()=>{
      const pass = modal.querySelector("#pass-del-stock").value;
      const configSnap = await get(ref(window.db, "config"));
      const config = configSnap.val();
      if(pass===config.passAdmin || pass===config.masterPass){
        await remove(ref(window.db, `stock/${codigo}`));
        modal.remove();
        renderStock();
      }else{
        modal.querySelector("#msg-del-stock").textContent="Contraseña incorrecta";
      }
    });
  };

  window.modalEditarStock = async (codigo) => {
    const snap = await get(ref(window.db, `stock/${codigo}`));
    if(!snap.exists()) return;
    const item = snap.val();
    const modal = document.createElement("div");
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;`;
    modal.innerHTML = `
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:300px;">
        <h4>Editar Stock: ${codigo}</h4>
        <input id="edit-nombre" placeholder="Nombre" value="${item.nombre || ""}">
        <input id="edit-cant" placeholder="Cantidad" type="number" value="${item.cant || 0}">
        <input id="edit-precio" placeholder="Precio" type="number" value="${item.precio || 0}">
        <input id="edit-pass-admin" type="password" placeholder="Contraseña admin">
        <div style="margin-top:10px;">
          <button id="guardar-edit-stock">Guardar</button>
          <button id="cancelar-edit-stock">Cancelar</button>
        </div>
        <p id="msg-edit-stock" style="color:red;"></p>
      </div>
    `;
    body.appendChild(modal);
    modal.querySelector("#cancelar-edit-stock").addEventListener("click", ()=>modal.remove());
    modal.querySelector("#guardar-edit-stock").addEventListener("click", async ()=>{
      const pass = modal.querySelector("#edit-pass-admin").value;
      const configSnap = await get(ref(window.db,"config"));
      const config = configSnap.val();
      if(pass===config.passAdmin || pass===config.masterPass){
        await update(ref(window.db, `stock/${codigo}`), {
          nombre: modal.querySelector("#edit-nombre").value,
          cant: parseFloat(modal.querySelector("#edit-cant").value),
          precio: parseFloat(modal.querySelector("#edit-precio").value)
        });
        modal.remove();
        renderStock();
      }else{
        modal.querySelector("#msg-edit-stock").textContent="Contraseña incorrecta";
      }
    });
  };

  // ---------------------------
  // SUELTOS
  // ---------------------------
  const tablaSueltosBody = document.getElementById("tabla-sueltos").querySelector("tbody");
  async function renderSueltos() {
    const snap = await get(ref(window.db, "sueltos"));
    tablaSueltosBody.innerHTML = "";
    if(!snap.exists()) return;
    const data = snap.val();
    const ordenados = Object.entries(data).sort((a,b)=>b[1].fecha.localeCompare(a[1].fecha));
    for(const [codigo,item] of ordenados){
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${codigo}</td>
        <td>${item.nombre || "PRODUCTO NUEVO"}</td>
        <td>${item.kg || 0}</td>
        <td>${item.fecha}</td>
        <td>$${item.precio?.toFixed(2)||"0.00"}</td>
        <td>
          <button class="btn-editar-su">Editar</button>
          <button class="btn-eliminar-su">Eliminar</button>
        </td>
      `;
      tablaSueltosBody.appendChild(tr);
      tr.querySelector(".btn-eliminar-su").addEventListener("click", ()=>window.modalEliminarSueltos(codigo));
      tr.querySelector(".btn-editar-su").addEventListener("click", ()=>window.modalEditarSueltos(codigo));
    }
  }

  window.modalEliminarSueltos = async (codigo)=>{
    const modal=document.createElement("div");
    modal.style.cssText=`position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;`;
    modal.innerHTML=`
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:250px;">
        <h4>Contraseña de administrador</h4>
        <input id="pass-del-su" type="password" placeholder="Contraseña">
        <div style="margin-top:10px;">
          <button id="aceptar-del-su">Aceptar</button>
          <button id="cancelar-del-su">Cancelar</button>
        </div>
        <p id="msg-del-su" style="color:red;"></p>
      </div>
    `;
    body.appendChild(modal);
    modal.querySelector("#cancelar-del-su").addEventListener("click", ()=>modal.remove());
    modal.querySelector("#aceptar-del-su").addEventListener("click",async ()=>{
      const pass=modal.querySelector("#pass-del-su").value;
      const configSnap = await get(ref(window.db,"config"));
      const config=configSnap.val();
      if(pass===config.passAdmin||pass===config.masterPass){
        await remove(ref(window.db, `sueltos/${codigo}`));
        modal.remove();
        renderSueltos();
      }else{
        modal.querySelector("#msg-del-su").textContent="Contraseña incorrecta";
      }
    });
  };

  window.modalEditarSueltos=async(codigo)=>{
    const snap = await get(ref(window.db, `sueltos/${codigo}`));
    if(!snap.exists()) return;
    const item=snap.val();
    const modal=document.createElement("div");
    modal.style.cssText=`position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;`;
    modal.innerHTML=`
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:300px;">
        <h4>Editar Suelto: ${codigo}</h4>
        <input id="edit-nombre-su" placeholder="Nombre" value="${item.nombre||""}">
        <input id="edit-kg-su" placeholder="KG" type="number" value="${item.kg||0}">
        <input id="edit-precio-su" placeholder="Precio" type="number" value="${item.precio||0}">
        <input id="edit-pass-admin-su" type="password" placeholder="Contraseña admin">
        <div style="margin-top:10px;">
          <button id="guardar-edit-su">Guardar</button>
          <button id="cancelar-edit-su">Cancelar</button>
        </div>
        <p id="msg-edit-su" style="color:red;"></p>
      </div>
    `;
    body.appendChild(modal);
    modal.querySelector("#cancelar-edit-su").addEventListener("click",()=>modal.remove());
    modal.querySelector("#guardar-edit-su").addEventListener("click",async()=>{
      const pass = modal.querySelector("#edit-pass-admin-su").value;
      const configSnap = await get(ref(window.db,"config"));
      const config = configSnap.val();
      if(pass===config.passAdmin||pass===config.masterPass){
        await update(ref(window.db, `sueltos/${codigo}`), {
          nombre: modal.querySelector("#edit-nombre-su").value,
          kg: parseFloat(modal.querySelector("#edit-kg-su").value),
          precio: parseFloat(modal.querySelector("#edit-precio-su").value)
        });
        modal.remove();
        renderSueltos();
      }else{
        modal.querySelector("#msg-edit-su").textContent="Contraseña incorrecta";
      }
    });
  };

  // ---------------------------
  // CAJEROS
  // ---------------------------
  const tablaCajeros = document.getElementById("tabla-cajeros").querySelector("tbody");
  async function renderCajeros(){
    const snap = await get(ref(window.db, "cajeros"));
    tablaCajeros.innerHTML="";
    if(!snap.exists()) return;
    const data = snap.val();
    const ordenados = Object.entries(data).sort((a,b)=>parseInt(a[0])-parseInt(b[0]));
    for(const [nro,caj] of ordenados){
      const tr = document.createElement("tr");
      tr.innerHTML=`
        <td>${nro}</td>
        <td>${caj.nombre}</td>
        <td>${caj.dni}</td>
        <td>
          <button class="btn-editar-cajero">Editar</button>
          <button class="btn-eliminar-cajero">Eliminar</button>
        </td>
      `;
      tablaCajeros.appendChild(tr);
      tr.querySelector(".btn-eliminar-cajero").addEventListener("click",()=>window.modalEliminarCajero(nro));
      tr.querySelector(".btn-editar-cajero").addEventListener("click",()=>window.modalEditarCajero(nro));
    }
  }

  window.modalEliminarCajero = async (nro)=>{
    const modal=document.createElement("div");
    modal.style.cssText=`position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;`;
    modal.innerHTML=`
      <div style="background:white;padding:20px;border-radius:10px;text-align:center;min-width:250px;">
        <h4>Contraseña de administrador</h4>
        <input id="pass-del-cajero" type="password" placeholder="Contraseña">
        <div style="margin-top:10px;">
          <button id="aceptar-del-cajero">Aceptar</button>
          <button id="cancelar-del-cajero">Cancelar</button>
        </div>
        <p id="msg-del-cajero" style="color:red;"></p>
      </div>
    `;
    body.appendChild(modal);
    modal.querySelector("#cancelar-del-cajero").addEventListener("click",()=>modal.remove());
    modal.querySelector("#aceptar-del-cajero").addEventListener("click",async ()=>{
      const pass = modal.querySelector("#pass-del-cajero").value;
      const configSnap = await get(ref(window.db,"config"));
      const config = configSnap.val();
      if(pass===config.passAdmin||pass===config.masterPass){
        await remove(ref(window.db, `cajeros/${nro}`));
        modal.remove();
        renderCajeros();
      }else{
        modal.querySelector("#msg-del-cajero").textContent="Contraseña incorrecta";
      }
    });
  };

  // ---------------------------
  // CONFIG
  // ---------------------------
  const inputNombreTienda = document.getElementById("config-nombre-tienda");
  const inputPassAdmin = document.getElementById("config-pass-admin");
  const inputPassMaster = document.getElementById("config-pass-master");
  const btnGuardarConfig = document.getElementById("btn-guardar-config");

  btnGuardarConfig.addEventListener("click", async () => {
    const snap = await get(ref(window.db, "config"));
    const config = snap.val();
    if(!config) return;
    const passAdminActual = config.passAdmin;
    const passMaestra = config.masterPass;
    const passIngresado = inputPassAdmin.value;
    if(passIngresado !== passAdminActual && passIngresado !== passMaestra){
      alert("Contraseña incorrecta");
      return;
    }
    await update(ref(window.db,"config"), {
      nombreTienda: inputNombreTienda.value,
      passAdmin: inputPassAdmin.value
    });
    alert("Configuración guardada");
  });

  // ---------------------------
  // Inicializar
  // ---------------------------
  async function initAll(){
    renderMovimientos();
    renderHistorial();
    renderStock();
    renderSueltos();
    renderCajeros();
  }

  window.addEventListener("load", initAll);

})();
