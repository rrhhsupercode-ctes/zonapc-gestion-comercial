/*****************************************************
 * app.js - Parte 1/3
 * Funcionalidad completa de la app web ZONAPC
 * Compatible Firebase 11.8.1 modular
 *****************************************************/
import { ref as dbRef, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

(() => {
  // ---------------------------
  // VARIABLES GLOBALES
  // ---------------------------
  let currentCajero = null;
  let ventaActual = [];
  let totalVenta = 0;
  let ticketCounter = 1;
  const adminPassDefault = "1918";
  const masterPassDefault = "1409";

  // ELEMENTOS DOM
  const loginModal = document.getElementById("login-modal");
  const loginUsuario = document.getElementById("login-usuario");
  const loginPass = document.getElementById("login-pass");
  const btnLogin = document.getElementById("btn-login");
  const loginMsg = document.getElementById("login-msg");
  const cobroControles = document.getElementById("cobro-controles");
  const navBtns = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll("main section");

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

  // ---------------------------
  // INICIALIZACIÓN
  // ---------------------------
  function initApp() {
    // Inicializamos select de cantidades (01 a 99)
    for (let i = 1; i <= 99; i++) {
      const val = i.toString().padStart(2, "0");
      cobroCantidad.innerHTML += `<option value="${val}">${val}</option>`;
      loginUsuario.innerHTML += `<option value="${val}">${val}</option>`;
    }

    // Mostrar sección por defecto: COBRAR
    showSection("cobro");

    // Eventos de navegación
    navBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        showSection(btn.dataset.section);
      });
    });

    // Eventos login cajero
    btnLogin.addEventListener("click", loginCajero);

    // Eventos incremento/decremento kg sueltos
    btnIncrKg.addEventListener("click", () => adjustKg(0.1));
    btnDecrKg.addEventListener("click", () => adjustKg(-0.1));

    // Eventos agregar productos
    btnAddProduct.addEventListener("click", () => addProducto(false));
    btnAddSuelto.addEventListener("click", () => addProducto(true));

    // Evento botón cobrar
    btnCobrar.addEventListener("click", abrirModalCobrar);

    // Cargar productos STOCK y SUELTOS
    cargarProductosStock();
    cargarProductosSueltos();

    // Cargar ticketCounter diario
    cargarTicketCounter();
  }

  function showSection(seccion) {
    sections.forEach(s => s.classList.add("hidden"));
    const active = document.getElementById(seccion);
    if (active) active.classList.remove("hidden");
  }

  // ---------------------------
  // LOGIN DE CAJERO
  // ---------------------------
  async function loginCajero() {
    const nro = loginUsuario.value;
    const pass = loginPass.value.trim();

    if (!nro || !pass) {
      loginMsg.textContent = "Complete los campos";
      return;
    }

    try {
      const cajeroSnap = await get(dbRef(window.db, `cajeros/${nro}`));
      if (!cajeroSnap.exists()) {
        loginMsg.textContent = "Contraseña incorrecta";
        return;
      }
      const cajeroData = cajeroSnap.val();
      if (cajeroData.pass === pass) {
        currentCajero = nro;
        loginModal.classList.add("hidden");
        cobroControles.classList.remove("hidden");
        loginMsg.textContent = "";
      } else {
        loginMsg.textContent = "Contraseña incorrecta";
      }
    } catch (err) {
      console.error("Error login cajero:", err);
      loginMsg.textContent = "Error al iniciar sesión";
    }
  }

  // ---------------------------
  // AJUSTE KG SUELTOS
  // ---------------------------
  function adjustKg(valor) {
    let kg = parseFloat(inputKgSuelto.value.replace(",", "."));
    kg += valor;
    if (kg < 0.1) kg = 0.1;
    if (kg > 99.9) kg = 99.9;
    inputKgSuelto.value = kg.toFixed(3);
  }

  // ---------------------------
  // CARGAR PRODUCTOS STOCK Y SUELTOS
  // ---------------------------
  function cargarProductosStock() {
    onValue(dbRef(window.db, "stock"), snap => {
      cobroProductos.innerHTML = `<option value="">Elija un Item</option>`;
      if (!snap.exists()) return;
      const data = snap.val();
      Object.entries(data).forEach(([codigo, item]) => {
        cobroProductos.innerHTML += `<option value="${codigo}">${item.nombre}</option>`;
      });
    });
  }

  function cargarProductosSueltos() {
    onValue(dbRef(window.db, "sueltos"), snap => {
      cobroSueltos.innerHTML = `<option value="">Elija un Item (Sueltos)</option>`;
      if (!snap.exists()) return;
      const data = snap.val();
      Object.entries(data).forEach(([codigo, item]) => {
        cobroSueltos.innerHTML += `<option value="${codigo}">${item.nombre}</option>`;
      });
    });
  }

  // ---------------------------
  // AGREGAR PRODUCTO A TABLA
  // ---------------------------
  async function addProducto(isSuelto) {
    const cantidad = isSuelto ? parseFloat(inputKgSuelto.value.replace(",", ".")) : parseInt(cobroCantidad.value);
    const codigo = isSuelto ? cobroSueltos.value : cobroProductos.value;
    const codInput = isSuelto ? cobroCodigoSuelto.value.trim() : cobroCodigo.value.trim();
    if (!codigo && !codInput) return;

    const dbPath = isSuelto ? "sueltos" : "stock";
    const prodCodigo = codigo || codInput;

    try {
      const prodSnap = await get(dbRef(window.db, `${dbPath}/${prodCodigo}`));
      if (!prodSnap.exists()) {
        alert("Producto no existe en la base");
        return;
      }
      const prod = prodSnap.val();
      const precioUnidad = isSuelto ? prod.precio * cantidad : prod.precio;
      const total = isSuelto ? prod.precio * (cantidad / 1) : prod.precio * cantidad;

      const row = {
        codigo: prodCodigo,
        nombre: prod.nombre,
        cantidad: cantidad.toFixed(3),
        precioUnidad: precioUnidad.toFixed(2),
        total: total.toFixed(2),
        suelto: isSuelto
      };
      ventaActual.push(row);
      renderTablaCobro();
    } catch (err) {
      console.error("Error agregar producto:", err);
    }
  }

  // ---------------------------
  // RENDER TABLA COBRO
  // ---------------------------
  function renderTablaCobro() {
    tablaCobro.innerHTML = "";
    totalVenta = 0;
    ventaActual.slice().reverse().forEach((item, index) => {
      totalVenta += parseFloat(item.total);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.cantidad}</td>
        <td>${item.nombre}</td>
        <td>${item.precioUnidad}</td>
        <td>${item.total}</td>
        <td><button class="btn-eliminar" data-index="${index}">Eliminar</button></td>
      `;
      tablaCobro.appendChild(tr);
    });
    totalDiv.textContent = `TOTAL: $${totalVenta.toFixed(2)}`;
    btnCobrar.classList.toggle("hidden", ventaActual.length === 0);

    // Eventos eliminar fila
    tablaCobro.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.addEventListener("click", () => eliminarProducto(btn.dataset.index));
    });
  }

  // ---------------------------
  // ELIMINAR PRODUCTO FILA
  // ---------------------------
  function eliminarProducto(index) {
    const pass = prompt("Contraseña de administrador:");
    if (pass !== adminPassDefault) {
      alert("Contraseña incorrecta");
      return;
    }
    ventaActual.splice(index, 1);
    renderTablaCobro();
  }

  // ---------------------------
  // ABRIR MODAL COBRAR
  // ---------------------------
  function abrirModalCobrar() {
    const modal = crearModal(`
      <h3>¿Cómo Pagará el Cliente?</h3>
      <button onclick="window.finalizarPago('Efectivo')">Efectivo</button>
      <button onclick="window.finalizarPago('Tarjeta')">Tarjeta</button>
      <button onclick="window.finalizarPago('QR')">QR</button>
      <button onclick="window.finalizarPago('Electrónico')">Electrónico</button>
      <button onclick="window.finalizarPago('Otro')">Otro</button>
      <br>
      <button onclick="window.cerrarModal()" style="background:#d63031; color:white;">Cancelar</button>
    `);
    document.body.appendChild(modal.overlay);
  }

  // ---------------------------
  // MODALES GENERALES
  // ---------------------------
  function crearModal(html) {
    const overlay = document.createElement("div");
    overlay.classList.add("modal-overlay");
    const modal = document.createElement("div");
    modal.classList.add("modal");
    modal.innerHTML = html;
    overlay.appendChild(modal);
    return { overlay, modal };
  }

  window.cerrarModal = () => {
    document.querySelectorAll(".modal-overlay").forEach(m => m.remove());
  };

  window.finalizarPago = async (tipoPago) => {
    // TODO: registrar venta, actualizar stock/sueltos, imprimir ticket
    alert(`Pago registrado como: ${tipoPago}`);
    ventaActual = [];
    renderTablaCobro();
    cerrarModal();
  };

  // ---------------------------
  // CARGAR TICKET COUNTER DIARIO
  // ---------------------------
  async function cargarTicketCounter() {
    try {
      const today = new Date().toISOString().slice(0,10);
      const counterSnap = await get(dbRef(window.db, `movimientos/${today}`));
      if (counterSnap.exists()) {
        ticketCounter = Object.keys(counterSnap.val()).length + 1;
      } else {
        ticketCounter = 1;
      }
    } catch (err) {
      console.error("Error cargar ticketCounter:", err);
    }
  }

  // ---------------------------
  // INICIALIZAR APP
  // ---------------------------
  document.addEventListener("DOMContentLoaded", initApp);
})();

/*****************************************************
 * app.js - Parte 2/3
 * Movimientos, Historial, Registro de ventas
 *****************************************************/
(() => {
  // ---------------------------
  // REGISTRAR VENTA
  // ---------------------------
  window.finalizarPago = async (tipoPago) => {
    if (ventaActual.length === 0) return;

    const hoy = new Date();
    const fecha = hoy.toISOString().slice(0,10);
    const hora = hoy.toLocaleTimeString("es-AR", { hour12: false });
    const ticketNum = ticketCounter.toString().padStart(4, "0");

    const ventaData = {
      ticket: ticketNum,
      cajero: currentCajero,
      fecha,
      hora,
      total: totalVenta.toFixed(2),
      pago: tipoPago,
      items: ventaActual
    };

    try {
      // Guardar en movimientos
      await push(dbRef(window.db, `movimientos/${fecha}`), ventaData);

      // Actualizar stock y sueltos
      for (const item of ventaActual) {
        const path = item.suelto ? "sueltos" : "stock";
        const prodRef = dbRef(window.db, `${path}/${item.codigo}`);
        const prodSnap = await get(prodRef);
        if (prodSnap.exists() && !item.suelto) {
          const prodData = prodSnap.val();
          const nuevoStock = (prodData.stock || 0) - parseInt(item.cantidad);
          await update(prodRef, { stock: nuevoStock });
        }
      }

      // Incrementar ticketCounter
      ticketCounter++;
      ventaActual = [];
      renderTablaCobro();

      // Imprimir ticket
      imprimirTicket(ventaData);

      alert(`Venta registrada. Ticket: ${ticketNum}`);
    } catch (err) {
      console.error("Error registrar venta:", err);
      alert("Error al registrar la venta");
    }
  };

  // ---------------------------
  // FUNCION IMPRIMIR TICKET
  // ---------------------------
  function imprimirTicket(data) {
    let contenido = `
      <h3>Ticket #${data.ticket}</h3>
      <p>${data.fecha} ${data.hora}</p>
      <p>Cajero: ${data.cajero}</p>
      <hr id="hr-ticket">
      <table style="width:100%;">
        ${data.items.map(i => `<tr><td>${i.cantidad}</td><td>${i.nombre}</td><td>$${parseFloat(i.total).toFixed(2)}</td></tr>`).join("")}
      </table>
      <hr id="hr-ticket">
      <p>Total: $${data.total}</p>
      <p>Pago: ${data.pago}</p>
    `;
    const printWindow = window.open("", "PRINT", "height=400,width=300");
    printWindow.document.write(contenido);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  // ---------------------------
  // MOVIMIENTOS - REIMPRIMIR / ELIMINAR
  // ---------------------------
  const tablaMovimientosBody = document.querySelector("#tabla-movimientos tbody");

  function cargarMovimientos() {
    const today = new Date().toISOString().slice(0,10);
    onValue(dbRef(window.db, `movimientos/${today}`), snap => {
      tablaMovimientosBody.innerHTML = "";
      if (!snap.exists()) return;

      const data = snap.val();
      Object.entries(data).forEach(([key, mov]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${mov.ticket}</td>
          <td>${mov.hora}</td>
          <td>${mov.cajero}</td>
          <td>$${parseFloat(mov.total).toFixed(2)}</td>
          <td>
            <button class="btn-reimprimir" data-key="${key}">Reimprimir</button>
            <button class="btn-eliminar-mov" data-key="${key}">Eliminar</button>
          </td>
        `;
        tablaMovimientosBody.appendChild(tr);
      });

      // Eventos botones
      tablaMovimientosBody.querySelectorAll(".btn-reimprimir").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const movSnap = await get(dbRef(window.db, `movimientos/${today}/${key}`));
          if (movSnap.exists()) imprimirTicket(movSnap.val());
        });
      });

      tablaMovimientosBody.querySelectorAll(".btn-eliminar-mov").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const pass = prompt("Contraseña de administrador:");
          if (pass !== adminPassDefault) {
            alert("Contraseña incorrecta");
            return;
          }
          await remove(dbRef(window.db, `movimientos/${today}/${key}`));
          alert("Movimiento eliminado");
        });
      });
    });
  }

  // ---------------------------
  // BOTÓN "TIRAR Z"
  // ---------------------------
  const btnTirarZ = document.getElementById("btn-tirar-z");
  if (btnTirarZ) {
    btnTirarZ.addEventListener("click", async () => {
      const pass = prompt("Contraseña de administrador para Tirar Z:");
      if (pass !== adminPassDefault) {
        alert("Contraseña incorrecta");
        return;
      }
      const today = new Date().toISOString().slice(0,10);
      const movSnap = await get(dbRef(window.db, `movimientos/${today}`));
      if (!movSnap.exists()) {
        alert("No hay movimientos hoy");
        return;
      }
      const data = movSnap.val();
      let totalDia = 0;
      Object.values(data).forEach(m => totalDia += parseFloat(m.total));
      alert(`Resumen Z: $${totalDia.toFixed(2)}\nMovimientos: ${Object.keys(data).length}`);
    });
  }

  // ---------------------------
  // HISTORIAL CON PAGINACIÓN
  // ---------------------------
  const tablaHistorialBody = document.querySelector("#tabla-historial tbody");
  let historialFechas = [];
  let historialPagina = 0;

  function cargarHistorial() {
    onValue(dbRef(window.db, "movimientos"), snap => {
      historialFechas = [];
      tablaHistorialBody.innerHTML = "";
      if (!snap.exists()) return;

      const data = snap.val();
      historialFechas = Object.keys(data).sort((a,b) => b.localeCompare(a));
      mostrarPaginaHistorial(0);
    });
  }

  function mostrarPaginaHistorial(pagina) {
    historialPagina = pagina;
    tablaHistorialBody.innerHTML = "";
    const fecha = historialFechas[pagina];
    if (!fecha) return;
    get(dbRef(window.db, `movimientos/${fecha}`)).then(snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      Object.entries(data).forEach(([key, mov]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${mov.ticket}</td>
          <td>${mov.fecha}</td>
          <td>${mov.hora}</td>
          <td>${mov.cajero}</td>
          <td>$${parseFloat(mov.total).toFixed(2)}</td>
          <td>
            <button class="btn-reimprimir-hist" data-fecha="${fecha}" data-key="${key}">Reimprimir</button>
          </td>
        `;
        tablaHistorialBody.appendChild(tr);
      });

      tablaHistorialBody.querySelectorAll(".btn-reimprimir-hist").forEach(btn => {
        btn.addEventListener("click", async () => {
          const f = btn.dataset.fecha;
          const k = btn.dataset.key;
          const snap = await get(dbRef(window.db, `movimientos/${f}/${k}`));
          if (snap.exists()) imprimirTicket(snap.val());
        });
      });
    });
  }

  // Paginación Historial
  const btnHistPrev = document.getElementById("btn-hist-prev");
  const btnHistNext = document.getElementById("btn-hist-next");
  if (btnHistPrev) btnHistPrev.addEventListener("click", () => {
    if (historialPagina > 0) mostrarPaginaHistorial(historialPagina - 1);
  });
  if (btnHistNext) btnHistNext.addEventListener("click", () => {
    if (historialPagina < historialFechas.length -1) mostrarPaginaHistorial(historialPagina +1);
  });

  // ---------------------------
  // INICIALIZAR MOVIMIENTOS E HISTORIAL
  // ---------------------------
  document.addEventListener("DOMContentLoaded", () => {
    cargarMovimientos();
    cargarHistorial();
  });
})();

/*****************************************************
 * app.js - Parte 3/3
 * Stock, Sueltos, Cajeros, Configuración
 *****************************************************/
(() => {
  // ---------------------------
  // STOCK - AGREGAR / EDITAR / ELIMINAR
  // ---------------------------
  const tablaStockBody = document.querySelector("#tabla-stock tbody");
  const stockCodigoInput = document.getElementById("stock-codigo");
  const stockCantidadSelect = document.getElementById("stock-cantidad");
  const btnAgregarStock = document.getElementById("agregar-stock");
  const btnBuscarStock = document.getElementById("buscar-stock");

  function renderStock() {
    onValue(dbRef(window.db, "stock"), snap => {
      tablaStockBody.innerHTML = "";
      if (!snap.exists()) return;
      const data = snap.val();
      Object.entries(data).forEach(([key, item]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${key}</td>
          <td>${item.nombre || "PRODUCTO NUEVO"}</td>
          <td>${item.stock}</td>
          <td>${item.fecha}</td>
          <td>$${parseFloat(item.precio || 0).toFixed(2)}</td>
          <td>
            <button class="btn-editar-stock" data-key="${key}">Editar</button>
            <button class="btn-eliminar-stock" data-key="${key}">Eliminar</button>
          </td>
        `;
        tablaStockBody.appendChild(tr);
      });

      tablaStockBody.querySelectorAll(".btn-eliminar-stock").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const pass = prompt("Contraseña de administrador:");
          if (pass !== adminPassDefault) {
            alert("Contraseña incorrecta");
            return;
          }
          await remove(dbRef(window.db, `stock/${key}`));
        });
      });

      tablaStockBody.querySelectorAll(".btn-editar-stock").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const pass = prompt("Contraseña de administrador:");
          if (pass !== adminPassDefault) {
            alert("Contraseña incorrecta");
            return;
          }
          const nuevoNombre = prompt("Nuevo nombre del producto:");
          const nuevoStock = parseInt(prompt("Nueva cantidad:"));
          const nuevoPrecio = parseFloat(prompt("Nuevo precio:"));
          await update(dbRef(window.db, `stock/${key}`), {
            nombre: nuevoNombre,
            stock: nuevoStock,
            precio: nuevoPrecio,
            fecha: new Date().toISOString()
          });
        });
      });
    });
  }

  btnAgregarStock?.addEventListener("click", async () => {
    const codigo = stockCodigoInput.value.trim();
    const cantidad = parseInt(stockCantidadSelect.value);
    if (!codigo || !cantidad) return;

    const prodRef = dbRef(window.db, `stock/${codigo}`);
    const snap = await get(prodRef);
    const fecha = new Date().toISOString();
    if (snap.exists()) {
      await update(prodRef, { stock: (snap.val().stock || 0) + cantidad, fecha });
    } else {
      await set(prodRef, { nombre: "PRODUCTO NUEVO", stock: cantidad, precio: 0, fecha });
    }
  });

  // ---------------------------
  // SUELTOS - AGREGAR / EDITAR / ELIMINAR
  // ---------------------------
  const tablaSueltosBody = document.querySelector("#tabla-sueltos tbody");
  const sueltosCodigoInput = document.getElementById("sueltos-codigo");
  const sueltosKgInput = document.getElementById("sueltos-kg");
  const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
  const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");
  const btnIncrSuelto = document.getElementById("sueltos-btn-incr");
  const btnDecrSuelto = document.getElementById("sueltos-btn-decr");

  btnIncrSuelto?.addEventListener("click", () => {
    let val = parseFloat(sueltosKgInput.value);
    val += 0.100;
    if (val > 99.000) val = 99.000;
    sueltosKgInput.value = val.toFixed(3);
  });

  btnDecrSuelto?.addEventListener("click", () => {
    let val = parseFloat(sueltosKgInput.value);
    val -= 0.100;
    if (val < 0.000) val = 0.000;
    sueltosKgInput.value = val.toFixed(3);
  });

  function renderSueltos() {
    onValue(dbRef(window.db, "sueltos"), snap => {
      tablaSueltosBody.innerHTML = "";
      if (!snap.exists()) return;
      const data = snap.val();
      Object.entries(data).forEach(([key, item]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${key}</td>
          <td>${item.nombre || "PRODUCTO NUEVO"}</td>
          <td>${item.kg}</td>
          <td>${item.fecha}</td>
          <td>$${parseFloat(item.precio || 0).toFixed(2)}</td>
          <td>
            <button class="btn-editar-suelto" data-key="${key}">Editar</button>
            <button class="btn-eliminar-suelto" data-key="${key}">Eliminar</button>
          </td>
        `;
        tablaSueltosBody.appendChild(tr);
      });

      tablaSueltosBody.querySelectorAll(".btn-eliminar-suelto").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const pass = prompt("Contraseña de administrador:");
          if (pass !== adminPassDefault) return alert("Contraseña incorrecta");
          await remove(dbRef(window.db, `sueltos/${key}`));
        });
      });

      tablaSueltosBody.querySelectorAll(".btn-editar-suelto").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const pass = prompt("Contraseña de administrador:");
          if (pass !== adminPassDefault) return alert("Contraseña incorrecta");
          const nuevoNombre = prompt("Nuevo nombre del producto:");
          const nuevoKg = parseFloat(prompt("Nuevo KG:"));
          const nuevoPrecio = parseFloat(prompt("Nuevo precio:"));
          await update(dbRef(window.db, `sueltos/${key}`), {
            nombre: nuevoNombre,
            kg: nuevoKg,
            precio: nuevoPrecio,
            fecha: new Date().toISOString()
          });
        });
      });
    });
  }

  btnAgregarSuelto?.addEventListener("click", async () => {
    const codigo = sueltosCodigoInput.value.trim();
    const kg = parseFloat(sueltosKgInput.value);
    if (!codigo || !kg) return;
    const refSuelto = dbRef(window.db, `sueltos/${codigo}`);
    const snap = await get(refSuelto);
    const fecha = new Date().toISOString();
    if (snap.exists()) {
      await update(refSuelto, { kg: (snap.val().kg || 0) + kg, fecha });
    } else {
      await set(refSuelto, { nombre: "PRODUCTO NUEVO", kg, precio: 0, fecha });
    }
  });

  // ---------------------------
  // CAJEROS - AGREGAR / EDITAR / ELIMINAR
  // ---------------------------
  const tablaCajerosBody = document.querySelector("#tabla-cajeros tbody");
  const cajeroNro = document.getElementById("cajero-nro");
  const cajeroNombre = document.getElementById("cajero-nombre");
  const cajeroDni = document.getElementById("cajero-dni");
  const cajeroPass = document.getElementById("cajero-pass");
  const btnAgregarCajero = document.getElementById("agregar-cajero");

  function renderCajeros() {
    onValue(dbRef(window.db, "cajeros"), snap => {
      tablaCajerosBody.innerHTML = "";
      if (!snap.exists()) return;
      const data = snap.val();
      Object.entries(data).sort().forEach(([key, c]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${key}</td>
          <td>${c.nombre}</td>
          <td>${c.dni}</td>
          <td>
            <button class="btn-editar-cajero" data-key="${key}">Editar</button>
            <button class="btn-eliminar-cajero" data-key="${key}">Eliminar</button>
          </td>
        `;
        tablaCajerosBody.appendChild(tr);
      });

      tablaCajerosBody.querySelectorAll(".btn-eliminar-cajero").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const pass = prompt("Contraseña de administrador:");
          if (pass !== adminPassDefault) return alert("Contraseña incorrecta");
          await remove(dbRef(window.db, `cajeros/${key}`));
        });
      });

      tablaCajerosBody.querySelectorAll(".btn-editar-cajero").forEach(btn => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          const pass = prompt("Contraseña de administrador:");
          if (pass !== adminPassDefault) return alert("Contraseña incorrecta");
          const nuevoNombre = prompt("Nuevo nombre:");
          const nuevoDni = prompt("Nuevo DNI:");
          const nuevaPass = prompt("Nueva contraseña:");
          await update(dbRef(window.db, `cajeros/${key}`), {
            nombre: nuevoNombre,
            dni: nuevoDni,
            pass: nuevaPass
          });
        });
      });
    });
  }

  btnAgregarCajero?.addEventListener("click", async () => {
    const nro = cajeroNro.value.trim();
    const nombre = cajeroNombre.value.trim();
    const dni = cajeroDni.value.trim();
    const pass = cajeroPass.value.trim();
    if (!nro || !nombre || !dni || !pass) return;
    await set(dbRef(window.db, `cajeros/${nro}`), { nombre, dni, pass });
  });

  // ---------------------------
  // CONFIGURACIÓN
  // ---------------------------
  const configTienda = document.getElementById("config-tienda");
  const configPass = document.getElementById("config-pass");
  const btnGuardarConfig = document.getElementById("btn-guardar-config");

  async function cargarConfig() {
    const snap = await get(dbRef(window.db, "config"));
    if (!snap.exists()) return;
    const c = snap.val();
    if (configTienda) configTienda.value = c.nombre || "";
    if (configPass) adminPassDefault = c.pass || adminPassDefault;
  }

  btnGuardarConfig?.addEventListener("click", async () => {
    const nombre = configTienda.value.trim();
    const pass = configPass.value.trim();
    await set(dbRef(window.db, "config"), { nombre, pass });
    adminPassDefault = pass;
    alert("Configuración guardada");
  });

  // ---------------------------
  // INICIALIZAR STOCK, SUELTOS, CAJEROS, CONFIG
  // ---------------------------
  document.addEventListener("DOMContentLoaded", () => {
    renderStock();
    renderSueltos();
    renderCajeros();
    cargarConfig();
  });
})();
