/*****************************************************
 * app.js
 * Lógica completa de Zona PC V2.12.2
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
  document.body.style.filter = "blur(2px)";

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
      adminModal.remove();
      document.body.style.filter = "none";
    } else {
      adminPassMsg.textContent = "Contraseña incorrecta";
    }
  }

  adminPassBtn.addEventListener("click", validarAdmin);
  adminPassInput.addEventListener("keyup", e => { if (e.key === "Enter") validarAdmin(); });

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
  const inputKgSuelto = document.getElementById("input-kg-suelto");
  const btnAddProduct = document.getElementById("btn-add-product");
  const btnAddSuelto = document.getElementById("btn-add-suelto");
  const tablaCobro = document.getElementById("tabla-cobro").querySelector("tbody");
  const totalDiv = document.getElementById("total-div");
  const btnCobrar = document.getElementById("btn-cobrar");

  let carrito = [];

  async function loadProductos() {
    const snap = await window.get(window.ref("/stock"));
    cobroProductos.innerHTML = '<option value="">Elija un Item</option>';
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([k, v]) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = v.nombre;
        cobroProductos.appendChild(opt);
      });
    }

    const sueltosSnap = await window.get(window.ref("/sueltos"));
    cobroSueltos.innerHTML = '<option value="">Elija un Item (Sueltos)</option>';
    if (sueltosSnap.exists()) {
      Object.entries(sueltosSnap.val()).forEach(([k, v]) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = v.nombre;
        cobroSueltos.appendChild(opt);
      });
    }

    cobroCantidad.innerHTML = "";
    for (let i = 1; i <= 99; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      cobroCantidad.appendChild(opt);
    }
  }

  function actualizarTabla() {
    tablaCobro.innerHTML = "";
    let total = 0;
    carrito.forEach((item, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.cant.toFixed(3)}</td>
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

  async function getPrecioStock(id, tipo = "stock") {
    const snap = await window.get(window.ref(`/${tipo}/${id}`));
    if (!snap.exists()) return 0;
    return snap.val().precio || 0;
  }

  btnAddProduct.addEventListener("click", async () => {
    const id = cobroProductos.value;
    const cant = parseFloat(cobroCantidad.value);
    if (!id || cant <= 0) return;
    const nombre = cobroProductos.selectedOptions[0].textContent;
    const precio = await getPrecioStock(id, "stock");
    carrito.push({ id, nombre, cant, precio, tipo: "stock" });
    actualizarTabla();
  });

  btnAddSuelto.addEventListener("click", async () => {
    const id = cobroSueltos.value;
    const cant = parseFloat(inputKgSuelto.value);
    if (!id || cant <= 0) return;
    const nombre = cobroSueltos.selectedOptions[0].textContent;
    const precio = await getPrecioStock(id, "sueltos");
    carrito.push({ id, nombre, cant, precio, tipo: "sueltos" });
    actualizarTabla();
  });

  // --- Cobrar con tickets diarios ---
  btnCobrar.addEventListener("click", async () => {
    if (!currentUser || carrito.length === 0) return;

    // Modal de pago
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
        const fechaHoy = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Obtener último ticket
        const confSnap = await window.get(window.ref("/config"));
        const confVal = confSnap.exists() ? confSnap.val() : {};
        let ultimoID = confVal.ultimoTicketID || 0;
        let ultimoFecha = confVal.ultimoTicketFecha || "";

        if (ultimoFecha !== fechaHoy) ultimoID = 0; // Reiniciar contador diario
        ultimoID++;
        const ticketID = "ID_" + String(ultimoID).padStart(6, "0");

        // Guardar ticket en movimientos
        const movRef = window.push(window.ref("/movimientos"));
        const total = carrito.reduce((a, b) => a + b.cant * b.precio, 0);
        const fecha = new Date().toISOString();

        await window.set(movRef, {
          ticketID,
          cajero: currentUser.id,
          items: carrito,
          total,
          fecha,
          tipo: tipoPago
        });

        // Guardar en historial
        const histRef = window.push(window.ref("/historial"));
        await window.set(histRef, {
          ticketID,
          cajero: currentUser.id,
          items: carrito,
          total,
          fecha,
          tipo: tipoPago
        });

        // Actualizar último ticket en config
        await window.update(window.ref("/config"), { ultimoTicketID: ultimoID, ultimoTicketFecha: fechaHoy });

        // Restar stock/sueltos
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

        // Generar ticket (alert como placeholder de impresión)
        let ticketStr = `${ticketID}\n${fecha}\nCajero: ${currentUser.id}\n==========\n`;
        carrito.forEach(it => {
          ticketStr += `${it.nombre} $${it.precio.toFixed(2)} (${it.cant}) = $${(it.precio*it.cant).toFixed(2)}\n==========\n`;
        });
        ticketStr += `TOTAL: $${total.toFixed(2)}\nPago: ${tipoPago}`;
        alert("Venta realizada ✅\n\n" + ticketStr);

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

  async function loadMovimientos() {
    const snap = await window.get(window.ref("/movimientos"));
    tablaMovimientos.innerHTML = "";
    filtroCajero.innerHTML = '<option value="TODOS">TODOS</option>';
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([id, mov]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${id}</td>
          <td>${mov.total}</td>
          <td>${mov.tipo}</td>
          <td><button data-id="${id}">❌</button></td>
        `;
        tr.querySelector("button").addEventListener("click", async () => {
          if (confirm("¿Eliminar este movimiento?")) {
            await window.remove(window.ref(`/movimientos/${id}`));
            loadMovimientos();
          }
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
  }

  btnTirarZ.addEventListener("click", async () => {
    if (confirm("Tirar Z eliminará todos los movimientos. ¿Continuar?")) {
      const snap = await window.get(window.ref("/movimientos"));
      if (snap.exists()) {
        Object.keys(snap.val()).forEach(async key => {
          await window.remove(window.ref(`/movimientos/${key}`));
        });
      }
      loadMovimientos();
      alert("✅ Movimientos eliminados");
    }
  });

  filtroCajero.addEventListener("change", async () => {
    const snap = await window.get(window.ref("/movimientos"));
    tablaMovimientos.innerHTML = "";
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([id, mov]) => {
        if (filtroCajero.value === "TODOS" || mov.cajero === filtroCajero.value) {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${id}</td>
            <td>${mov.total}</td>
            <td>${mov.tipo}</td>
            <td><button data-id="${id}">❌</button></td>
          `;
          tr.querySelector("button").addEventListener("click", async () => {
            if (confirm("¿Eliminar este movimiento?")) {
              await window.remove(window.ref(`/movimientos/${id}`));
              loadMovimientos();
            }
          });
          tablaMovimientos.appendChild(tr);
        }
      });
    }
  });

  // --- HISTORIAL ---
  const tablaHistorial = document.getElementById("tabla-historial").querySelector("tbody");

  async function loadHistorial() {
    const snap = await window.get(window.ref("/historial"));
    tablaHistorial.innerHTML = "";
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([id, mov]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${id}</td>
          <td>${mov.total}</td>
          <td>${mov.tipo}</td>
          <td>${mov.cajero}</td>
          <td>${mov.fecha}</td>
          <td><button data-id="${id}">❌</button></td>
        `;
        tr.querySelector("button").addEventListener("click", async () => {
          if (confirm("Eliminar este historial?")) {
            await window.remove(window.ref(`/historial/${id}`));
            loadHistorial();
          }
        });
        tablaHistorial.appendChild(tr);
      });
    }
  }

  // --- STOCK ---
  const stockCodigo = document.getElementById("stock-codigo");
  const stockCantidad = document.getElementById("stock-cantidad");
  const btnAgregarStock = document.getElementById("agregar-stock");
  const btnBuscarStock = document.getElementById("buscar-stock");
  const tablaStock = document.getElementById("tabla-stock").querySelector("tbody");

  async function loadStock() {
    const snap = await window.get(window.ref("/stock"));
    tablaStock.innerHTML = "";
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([id, prod]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${id}</td>
          <td>${prod.nombre}</td>
          <td>${prod.cant}</td>
          <td>${prod.fecha || ""}</td>
          <td>${prod.precio}</td>
          <td><button data-id="${id}">❌</button></td>
        `;
        tr.querySelector("button").addEventListener("click", async () => {
          if (confirm("Eliminar producto?")) {
            await window.remove(window.ref(`/stock/${id}`));
            loadStock();
            loadProductos();
          }
        });
        tablaStock.appendChild(tr);
      });
    }
  }

  btnAgregarStock.addEventListener("click", async () => {
    const codigo = stockCodigo.value.trim();
    const cant = parseFloat(stockCantidad.value);
    if (!codigo || cant <= 0) return;
    const fecha = new Date().toISOString();
    await window.set(window.ref(`/stock/${codigo}`), { nombre: codigo, cant, fecha, precio: 100 });
    loadStock();
    loadProductos();
  });

  btnBuscarStock.addEventListener("click", loadStock);

  // --- SUELTOS ---
  const sueltosCodigo = document.getElementById("sueltos-codigo");
  const sueltosKg = document.getElementById("sueltos-kg");
  const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
  const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");
  const tablaSueltos = document.getElementById("tabla-sueltos").querySelector("tbody");
  const btnSueltoDecr = document.getElementById("sueltos-btn-decr");
  const btnSueltoIncr = document.getElementById("sueltos-btn-incr");

  function actualizarKg(delta) {
    let val = parseFloat(sueltosKg.value);
    val = Math.max(0.001, val + delta);
    sueltosKg.value = val.toFixed(3);
  }

  btnSueltoDecr.addEventListener("click", () => actualizarKg(-0.100));
  btnSueltoIncr.addEventListener("click", () => actualizarKg(0.100));

  async function loadSueltos() {
    const snap = await window.get(window.ref("/sueltos"));
    tablaSueltos.innerHTML = "";
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([id, prod]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${id}</td>
          <td>${prod.nombre}</td>
          <td>${prod.kg}</td>
          <td>${prod.fecha || ""}</td>
          <td>${prod.precio}</td>
          <td><button data-id="${id}">❌</button></td>
        `;
        tr.querySelector("button").addEventListener("click", async () => {
          if (confirm("Eliminar suelto?")) {
            await window.remove(window.ref(`/sueltos/${id}`));
            loadSueltos();
            loadProductos();
          }
        });
        tablaSueltos.appendChild(tr);
      });
    }
  }

  btnAgregarSuelto.addEventListener("click", async () => {
    const codigo = sueltosCodigo.value.trim();
    const kg = parseFloat(sueltosKg.value);
    if (!codigo || kg <= 0) return;
    const fecha = new Date().toISOString();
    await window.set(window.ref(`/sueltos/${codigo}`), { nombre: codigo, kg, fecha, precio: 200 });
    loadSueltos();
    loadProductos();
  });

  btnBuscarSuelto.addEventListener("click", loadSueltos);

  // --- CAJEROS ---
  const cajeroNro = document.getElementById("cajero-nro");
  const cajeroNombre = document.getElementById("cajero-nombre");
  const cajeroDni = document.getElementById("cajero-dni");
  const cajeroPass = document.getElementById("cajero-pass");
  const btnAgregarCajero = document.getElementById("agregar-cajero");
  const tablaCajeros = document.getElementById("tabla-cajeros").querySelector("tbody");

  async function loadCajerosTabla() {
    const snap = await window.get(window.ref("/cajeros"));
    tablaCajeros.innerHTML = "";
    cajeroNro.innerHTML = "";
    if (snap.exists()) {
      Object.entries(snap.val()).forEach(([id, cajero]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${id}</td>
          <td>${cajero.nombre}</td>
          <td>${cajero.dni}</td>
          <td><button data-id="${id}">❌</button></td>
        `;
        tr.querySelector("button").addEventListener("click", async () => {
          if (confirm("Eliminar cajero?")) {
            await window.remove(window.ref(`/cajeros/${id}`));
            loadCajerosTabla();
            loadCajeros();
          }
        });
        tablaCajeros.appendChild(tr);
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = cajero.nombre;
        cajeroNro.appendChild(opt);
      });
    }
  }

  btnAgregarCajero.addEventListener("click", async () => {
    const nombre = cajeroNombre.value.trim();
    const dni = cajeroDni.value.trim();
    const pass = cajeroPass.value.trim();
    if (!nombre || !dni || !pass) return;
    const id = Date.now().toString();
    await window.set(window.ref(`/cajeros/${id}`), { nombre, dni, pass });
    cajeroNombre.value = cajeroDni.value = cajeroPass.value = "";
    loadCajerosTabla();
    loadCajeros();
  });

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
